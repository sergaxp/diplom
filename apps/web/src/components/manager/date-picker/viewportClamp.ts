const MARGIN = 8; // отступ от краёв вьюпорта
const GAP    = 4; // отступ между триггером и поповером

/** Позиция поповера, прижатого к границам вьюпорта (с переворотом наверх при нехватке места снизу). */
export function clampPopoverPos(
  rect: { width: number; height: number },
  trigger: { top: number; bottom: number; left: number },
  vw: number, vh: number,
): { top: number; left: number } {
  let left = trigger.left;
  if (left + rect.width > vw - MARGIN) left = vw - MARGIN - rect.width;
  if (left < MARGIN) left = MARGIN;

  let top = trigger.bottom + GAP;
  if (top + rect.height > vh - MARGIN) {
    // не помещается снизу — пробуем над триггером, иначе прижимаем к низу
    const above = trigger.top - GAP - rect.height;
    top = above >= MARGIN ? above : Math.max(MARGIN, vh - MARGIN - rect.height);
  }
  return { top, left };
}
