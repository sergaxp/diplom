export function clampDrop(r: DOMRect, dropW: number, dropH: number, vw: number, vh: number): { top: number; left: number } {
  const left = Math.min(r.left, vw - dropW - 8);

  const spaceBelow = vh - r.bottom;
  const spaceAbove = r.top;
  // Раскрываем вниз, если влезает либо если снизу места не меньше, чем сверху.
  let top = (spaceBelow >= dropH + 8 || spaceBelow >= spaceAbove)
    ? r.bottom + 4
    : r.top - dropH - 4;

  // Удерживаем поповер в пределах вьюпорта (важно для низких экранов < 727px,
  // иначе при «перевороте» вверх top уходит в минус и меню улетает за экран).
  top = Math.max(8, Math.min(top, vh - dropH - 8));

  return { top, left: Math.max(8, left) };
}
