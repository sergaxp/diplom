export function clampDrop(r: DOMRect, dropW: number, dropH: number, vw: number, vh: number): { top: number; left: number } {
  const left = Math.min(r.left, vw - dropW - 8);
  const top  = r.bottom + 4 + dropH > vh ? r.top - dropH - 4 : r.bottom + 4;
  return { top, left: Math.max(8, left) };
}
