import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/ui/App.jsx';
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
const setTime = (name, value) => fireEvent.change(input(name), { target: { value } });
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
