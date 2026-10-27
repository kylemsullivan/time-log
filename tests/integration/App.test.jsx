import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/ui/App.jsx';
import { dayLabel, localISO, mondayOf, shiftDate } from '../../src/lib/dates.js';
import { SAVE_DELAY_MS } from '../../src/ui/hooks/useSpanStorage.js';

// An in-memory stand-in for the preload bridge that keeps "disk" across App mounts.
function fakeBridge(initial = {}) {
  const disk = { days: initial };
  return {
    disk,
    getNotesDirectory: vi.fn().mockResolvedValue(null),
    chooseNotesDirectory: vi.fn(),
    listNoteDates: vi.fn().mockResolvedValue([]),
    readWeekNotes: vi.fn().mockResolvedValue([]),
    onHistoryAction: vi.fn(() => () => {}),
    loadSpans: vi.fn(async () => structuredClone(disk.days)),
    saveSpans: vi.fn(async (days) => { disk.days = structuredClone(days); }),
  };
}

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 50); });
const input = (name) => screen.getByLabelText(name);
const setTime = (name, value) => { fireEvent.change(input(name), { target: { value } }); fireEvent.blur(input(name)); };
const mondayDate = () => Object.keys(window.timeLog.disk.days)[0];

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });

describe('App persistence', () => {
  it('shows weekday placeholders and saves nothing until something is edited', async () => {
    window.timeLog = fakeBridge();
    render(<App />);
    await settle();
    expect(input('Monday Span 1 Start Time')).toHaveValue('08:00');
    expect(input('Monday Span 1 End Time')).toHaveValue('18:00');
    expect(window.timeLog.disk.days).toEqual({});
  });

  it('saves an edit and restores it in a fresh session', async () => {
    window.timeLog = fakeBridge();
    const first = render(<App />);
    await settle();
    setTime('Monday Span 1 Start Time', '09:00');
    setTime('Monday Span 1 End Time', '12:00');
    await settle();

    const saved = window.timeLog.disk.days;
    expect(Object.keys(saved)).toHaveLength(1);
    expect(Object.values(saved)[0]).toEqual([expect.objectContaining({ start: '09:00', end: '12:00' })]);

    first.unmount();
    render(<App />);
    await settle();
    expect(input('Monday Span 1 Start Time')).toHaveValue('09:00');
    expect(input('Monday Span 1 End Time')).toHaveValue('12:00');
    expect(screen.getAllByText('3.00h').length).toBeGreaterThan(0);
  });

  it('persists added and cleared spans', async () => {
    window.timeLog = fakeBridge();
    render(<App />);
    await settle();
    fireEvent.click(screen.getByLabelText('Add Monday Span'));
    await settle();
    expect(window.timeLog.disk.days[mondayDate()]).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Delete Monday Span 2'));
    fireEvent.click(screen.getByLabelText('Delete Monday Span 1'));
    await settle();
    expect(window.timeLog.disk.days[mondayDate()]).toEqual([expect.objectContaining({ start: '', end: '' })]);
  });

  it('does not save over existing data when loading fails', async () => {
    window.timeLog = fakeBridge({ '2026-01-05': [{ id: 'x', start: '09:00', end: '10:00' }] });
    window.timeLog.loadSpans.mockRejectedValue(new Error('locked'));
    render(<App />);
    await settle();
    setTime('Monday Span 1 End Time', '12:00');
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load saved hours: locked');
    expect(window.timeLog.saveSpans).not.toHaveBeenCalled();
    expect(window.timeLog.disk.days).toHaveProperty('2026-01-05');
  });

  it('shows a save error without losing the on-screen edit', async () => {
    window.timeLog = fakeBridge();
    window.timeLog.saveSpans.mockRejectedValue(new Error('disk full'));
    render(<App />);
    await settle();
    setTime('Monday Span 1 End Time', '12:00');
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save hours: disk full');
    expect(input('Monday Span 1 End Time')).toHaveValue('12:00');
  });

  it('works without the Electron bridge', async () => {
    render(<App />);
    await settle();
    setTime('Monday Span 1 End Time', '12:00');
    expect(input('Monday Span 1 End Time')).toHaveValue('12:00');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('App editing', () => {
  it('rejects overlapping edits and supports undo from the keyboard bridge', async () => {
    window.timeLog = fakeBridge();
    let onHistory;
    window.timeLog.onHistoryAction.mockImplementation((cb) => { onHistory = cb; return () => {}; });
    render(<App />);
    await settle();

    setTime('Monday Span 1 End Time', '07:00'); // before start -> ignored
    expect(input('Monday Span 1 End Time')).toHaveValue('18:00');

    setTime('Monday Span 1 End Time', '12:00');
    expect(input('Monday Span 1 End Time')).toHaveValue('12:00');
    act(() => onHistory('undo'));
    expect(input('Monday Span 1 End Time')).toHaveValue('18:00');
    act(() => onHistory('redo'));
    expect(input('Monday Span 1 End Time')).toHaveValue('12:00');
  });
});

describe('App typed time entry', () => {
  const type = (name, text) => { fireEvent.change(input(name), { target: { value: text } }); };

  it('normalizes shorthand on blur', async () => {
    window.timeLog = fakeBridge();
    render(<App />);
    await settle();
    type('Monday Span 1 Start Time', '9');
    fireEvent.blur(input('Monday Span 1 Start Time'));
    type('Monday Span 1 End Time', '5p');
    fireEvent.keyDown(input('Monday Span 1 End Time'), { key: 'Enter' });
    fireEvent.blur(input('Monday Span 1 End Time'));
    expect(input('Monday Span 1 Start Time')).toHaveValue('09:00');
    expect(input('Monday Span 1 End Time')).toHaveValue('17:00');
    expect(screen.getAllByText('8.00h').length).toBeGreaterThan(0);
  });

  it('keeps showing what you typed until you leave the field, then reverts invalid text', async () => {
    render(<App />);
    await settle();
    type('Monday Span 1 End Time', 'nope');
    expect(input('Monday Span 1 End Time')).toHaveValue('nope');
    fireEvent.blur(input('Monday Span 1 End Time'));
    expect(input('Monday Span 1 End Time')).toHaveValue('18:00');
  });

  it('reverts on Escape and when the edit would overlap', async () => {
    render(<App />);
    await settle();
    type('Monday Span 1 End Time', '12');
    fireEvent.keyDown(input('Monday Span 1 End Time'), { key: 'Escape' });
    fireEvent.blur(input('Monday Span 1 End Time'));
    expect(input('Monday Span 1 End Time')).toHaveValue('18:00');
    setTime('Monday Span 1 End Time', '7'); // before the 08:00 start
    expect(input('Monday Span 1 End Time')).toHaveValue('18:00');
  });
});

describe('App history sidebar', () => {
  it('collapses, remembers the choice, and expands again', async () => {
    localStorage.clear();
    const first = render(<App />);
    await settle();
    expect(screen.getByText('Changes (0)')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Hide Changes'));
    expect(screen.queryByText('Changes (0)')).toBeNull();
    expect(localStorage.getItem('time-log.historyOpen')).toBe('false');
    first.unmount();

    render(<App />);
    await settle();
    expect(screen.queryByText('Changes (0)')).toBeNull();
    fireEvent.click(screen.getByLabelText('Show Changes'));
    expect(screen.getByText('Changes (0)')).toBeInTheDocument();
    localStorage.clear();
  });
});

describe('App sidebar day navigation', () => {
  it('scrolls to, highlights and focuses the clicked day', async () => {
    vi.useFakeTimers();
    window.timeLog = fakeBridge();
    const wednesday = shiftDate(mondayOf(localISO(new Date())), 2);
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<App />);
    await settle();
    fireEvent.click(screen.getByTitle(`Go To ${dayLabel(wednesday)}`));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    const row = document.getElementById(`hours-${wednesday}`);
    expect(row).toHaveClass('highlighted');
    expect(row.querySelector('input')).toHaveFocus();
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(row).not.toHaveClass('highlighted');
  });
});

describe('App import and export', () => {
  it('exports edited days in the chosen format', async () => {
    window.timeLog = fakeBridge();
    window.timeLog.exportFile = vi.fn().mockResolvedValue({ path: '/tmp/time-log.md' });
    render(<App />);
    await settle();
    setTime('Monday Span 1 Start Time', '9');
    setTime('Monday Span 1 End Time', '12');
    fireEvent.change(screen.getByLabelText('Export Format'), { target: { value: 'md' } });
    fireEvent.click(screen.getByTitle('Export Hours'));
    await act(async () => {});
    const [file] = window.timeLog.exportFile.mock.calls[0];
    expect(file).toMatchObject({ defaultName: 'time-log.md', extension: 'md' });
    expect(file.content).toMatch(/\| \d{4}-\d{2}-\d{2} \| 09:00 \| 12:00 \| 3\.00 \|/);
    expect(screen.getByRole('status')).toHaveTextContent('Exported to /tmp/time-log.md');
  });

  it('imports a CSV as undoable, persisted changes', async () => {
    window.timeLog = fakeBridge();
    window.timeLog.importFile = vi.fn().mockResolvedValue({ name: 'hours.csv', content: 'date,start,end\n2026-01-05,09:00,12:00\n2026-01-05,13:00,17:00\n' });
    render(<App />);
    await settle();
    fireEvent.click(screen.getByLabelText('Choose Week'));
    fireEvent.change(screen.getByLabelText('Choose Week'), { target: { value: '2026-01-05' } });
    await settle();
    fireEvent.click(screen.getByTitle(/Import Hours/));
    await act(async () => {});
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('Imported 2 spans across 1 day from hours.csv');
    expect(input('Monday Span 1 End Time')).toHaveValue('12:00');
    expect(input('Monday Span 2 Start Time')).toHaveValue('13:00');
    expect(window.timeLog.disk.days['2026-01-05']).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Undo'));
    expect(input('Monday Span 1 End Time')).toHaveValue('18:00');
  });

  it('reports unreadable imports and ignores a cancelled picker', async () => {
    window.timeLog = fakeBridge();
    window.timeLog.importFile = vi.fn().mockResolvedValueOnce({ name: 'bad.csv', content: 'nothing here' }).mockResolvedValueOnce(null);
    render(<App />);
    await settle();
    fireEvent.click(screen.getByTitle(/Import Hours/));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent('No time spans found');
    fireEvent.click(screen.getByTitle(/Import Hours/));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent('No time spans found'); // unchanged by the cancel
  });

  it('explains when the desktop bridge is missing', async () => {
    render(<App />);
    await settle();
    fireEvent.click(screen.getByTitle('Export Hours'));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent('Exporting needs the desktop app');
  });
});
