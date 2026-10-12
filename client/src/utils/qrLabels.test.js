import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLabelSheetHtml, closeAfterPrint } from './qrLabels';

describe('buildLabelSheetHtml', () => {
  it('escapes text and includes no scripts', () => {
    const html = buildLabelSheetHtml([{ name: '<img src=x onerror=alert(1)>', serial: 'S"1', svg: '<svg></svg>' }, { name: 'B', serial: '' }]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('S&quot;1');
    expect(html).toContain('<svg></svg>');
    expect(html).toContain('No serial number');
    expect(html).not.toMatch(/<script/i);
  });
});

describe('closeAfterPrint', () => {
  afterEach(() => vi.useRealTimers());

  const fakeWindow = () => {
    const listeners = {};
    return {
      closed: 0,
      listeners,
      addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
      close() { this.closed += 1; },
      fire(type) { (listeners[type] || []).forEach((fn) => fn()); },
    };
  };

  it('closes on afterprint, not synchronously (Safari keeps its dialog)', () => {
    vi.useFakeTimers();
    const win = fakeWindow();
    closeAfterPrint(win);
    expect(win.closed).toBe(0);
    win.fire('afterprint');
    expect(win.closed).toBe(1);
    // The fallback timeout never closes it a second time.
    vi.runAllTimers();
    expect(win.closed).toBe(1);
  });

  it('falls back to a timeout when afterprint never fires', () => {
    vi.useFakeTimers();
    const win = fakeWindow();
    closeAfterPrint(win, { timeoutMs: 5000 });
    vi.advanceTimersByTime(4999);
    expect(win.closed).toBe(0);
    vi.advanceTimersByTime(1);
    expect(win.closed).toBe(1);
  });

  it('survives a window the user already closed', () => {
    vi.useFakeTimers();
    const win = { addEventListener() {}, close() { throw new Error('closed'); } };
    const close = closeAfterPrint(win);
    expect(close).not.toThrow();
    expect(() => vi.runAllTimers()).not.toThrow();
  });
});
