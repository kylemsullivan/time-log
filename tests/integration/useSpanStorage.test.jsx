import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SAVE_DELAY_MS, useSpanStorage } from '../../src/ui/hooks/useSpanStorage.js';

const monday = [{ id: 'm', start: '08:00', end: '18:00' }];
const edited = [{ id: 'm', start: '09:00', end: '12:00' }];
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10); });

let bridge;
beforeEach(() => {
  vi.useFakeTimers();
  bridge = { loadSpans: vi.fn().mockResolvedValue({}), saveSpans: vi.fn().mockResolvedValue(undefined) };
  window.timeLog = bridge;
});
afterEach(() => { vi.useRealTimers(); });

const mount = (initial) => renderHook(({ spans, restore }) => useSpanStorage(spans, restore), { initialProps: { spans: initial, restore: vi.fn() } });

describe('useSpanStorage', () => {
  it('does nothing without the Electron bridge', async () => {
    delete window.timeLog;
    const { result } = mount({ '2026-10-19': edited });
    await flush();
    expect(result.current.storageError).toBe('');
  });

  it('restores saved spans on mount', async () => {
    const saved = { '2026-10-19': edited };
    bridge.loadSpans.mockResolvedValue(saved);
    const restore = vi.fn();
    renderHook(() => useSpanStorage({}, restore));
    await flush();
    expect(restore).toHaveBeenCalledWith(saved);
  });

  it('saves only edited days, debounced', async () => {
    const { rerender } = mount({ '2026-10-19': monday });
    await flush();
    bridge.saveSpans.mockClear();

    rerender({ spans: { '2026-10-19': edited, '2026-10-20': monday }, restore: vi.fn() });
    rerender({ spans: { '2026-10-19': edited, '2026-10-20': monday }, restore: vi.fn() });
    expect(bridge.saveSpans).not.toHaveBeenCalled();
    await flush();
    expect(bridge.saveSpans).toHaveBeenCalledTimes(1);
    expect(bridge.saveSpans).toHaveBeenCalledWith({ '2026-10-19': edited });
  });

  it('collapses rapid edits into the latest state', async () => {
    const { rerender } = mount({});
    await flush();
    bridge.saveSpans.mockClear();
    const restore = vi.fn();
    rerender({ spans: { '2026-10-19': [{ id: 'm', start: '09:00', end: '10:00' }] }, restore });
    await act(async () => { await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS / 2); });
    rerender({ spans: { '2026-10-19': edited }, restore });
    await flush();
    expect(bridge.saveSpans).toHaveBeenCalledTimes(1);
    expect(bridge.saveSpans).toHaveBeenCalledWith({ '2026-10-19': edited });
  });

  it('never saves when loading failed, and reports the error', async () => {
    bridge.loadSpans.mockRejectedValue(new Error('disk on fire'));
    const { result, rerender } = mount({});
    await flush();
    rerender({ spans: { '2026-10-19': edited }, restore: vi.fn() });
    await flush();
    expect(bridge.saveSpans).not.toHaveBeenCalled();
    expect(result.current.storageError).toBe('Could not load saved hours: disk on fire');
  });

  it('reports save failures and clears the error after a later success', async () => {
    const { result, rerender } = mount({});
    await flush();
    bridge.saveSpans.mockRejectedValueOnce(new Error('read-only'));
    rerender({ spans: { '2026-10-19': edited }, restore: vi.fn() });
    await flush();
    expect(result.current.storageError).toBe('Could not save hours: read-only');

    rerender({ spans: { '2026-10-19': [{ id: 'm', start: '09:00', end: '11:00' }] }, restore: vi.fn() });
    await flush();
    expect(result.current.storageError).toBe('');
  });

  it('flushes a pending save when the page is hidden', async () => {
    const { rerender } = mount({});
    await flush();
    bridge.saveSpans.mockClear();
    rerender({ spans: { '2026-10-19': edited }, restore: vi.fn() });
    window.dispatchEvent(new Event('pagehide'));
    expect(bridge.saveSpans).toHaveBeenCalledTimes(1);
    await flush();
    expect(bridge.saveSpans).toHaveBeenCalledTimes(1); // the debounce timer does not double-save
  });
});

describe('useSpanStorage write avoidance', () => {
  it('does not write on load or when only placeholder days change', async () => {
    const { rerender } = mount({ '2026-10-19': monday });
    await flush();
    rerender({ spans: { '2026-10-19': monday, '2026-10-26': [{ id: 'n', start: '08:00', end: '18:00' }] }, restore: vi.fn() });
    await flush();
    expect(bridge.saveSpans).not.toHaveBeenCalled();
  });

  it('does not rewrite identical data after a successful save', async () => {
    const { rerender } = mount({});
    await flush();
    rerender({ spans: { '2026-10-19': edited }, restore: vi.fn() });
    await flush();
    rerender({ spans: { '2026-10-19': [...edited] }, restore: vi.fn() });
    await flush();
    expect(bridge.saveSpans).toHaveBeenCalledTimes(1);
  });
});
