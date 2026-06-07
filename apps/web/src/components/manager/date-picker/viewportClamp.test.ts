import { describe, it, expect } from 'vitest';
import { clampPopoverPos } from './viewportClamp';

describe('clampPopoverPos', () => {
  it('размещает поповер под триггером, когда снизу достаточно места', () => {
    const pos = clampPopoverPos({ width: 220, height: 240 }, { top: 100, bottom: 120, left: 50 }, 1000, 800);
    expect(pos).toEqual({ top: 124, left: 50 });
  });

  it('прижимает left к правому краю, не давая поповеру выйти за вьюпорт', () => {
    const pos = clampPopoverPos({ width: 220, height: 240 }, { top: 100, bottom: 120, left: 950 }, 1000, 800);
    expect(pos).toEqual({ top: 124, left: 772 });
  });

  it('прижимает left к левому краю при отрицательной позиции триггера', () => {
    const pos = clampPopoverPos({ width: 220, height: 240 }, { top: 100, bottom: 120, left: -50 }, 1000, 800);
    expect(pos).toEqual({ top: 124, left: 8 });
  });

  it('переворачивает поповер над триггером, если снизу не помещается', () => {
    const pos = clampPopoverPos({ width: 220, height: 240 }, { top: 700, bottom: 720, left: 50 }, 1000, 800);
    expect(pos).toEqual({ top: 456, left: 50 });
  });

  it('прижимает к низу вьюпорта, если не помещается ни сверху, ни снизу', () => {
    const pos = clampPopoverPos({ width: 220, height: 760 }, { top: 50, bottom: 70, left: 50 }, 1000, 800);
    // above = 50 - 4 - 760 = -714 (< MARGIN) → прижать к низу: max(8, 800-8-760) = 32
    expect(pos).toEqual({ top: 32, left: 50 });
  });
});
