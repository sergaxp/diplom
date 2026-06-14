import { describe, it, expect } from 'vitest';
import { clampDrop } from './anchor';

function mkRect(over: Partial<DOMRect>): DOMRect {
  return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}), ...over } as DOMRect;
}

describe('clampDrop', () => {
  it('places the dropdown below the anchor when there is enough room', () => {
    const r = mkRect({ top: 100, bottom: 120, left: 50 });
    expect(clampDrop(r, 220, 240, 1000, 800)).toEqual({ top: 124, left: 50 });
  });

  it('clamps left so the dropdown does not overflow the right edge', () => {
    const r = mkRect({ top: 100, bottom: 120, left: 950 });
    expect(clampDrop(r, 220, 240, 1000, 800)).toEqual({ top: 124, left: 772 });
  });

  it('flips the dropdown above the anchor when there is not enough room below', () => {
    const r = mkRect({ top: 700, bottom: 720, left: 50 });
    expect(clampDrop(r, 220, 240, 1000, 800)).toEqual({ top: 456, left: 50 });
  });

  it('keeps a tall dropdown on-screen on short viewports instead of flying off the top', () => {
    // Низкий экран (< 727px) и высокий поповер напоминаний (380px):
    // при «перевороте» вверх top уходил бы в минус.
    const r = mkRect({ top: 300, bottom: 320, left: 50 });
    const pos = clampDrop(r, 280, 380, 1000, 700);
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + 380).toBeLessThanOrEqual(700 - 8);
  });
});
