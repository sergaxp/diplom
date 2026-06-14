import { useEffect, useRef, useState } from 'react';
import { clampDrop } from '../components/manager/task-form/anchor';

interface Pos { top: number; left: number }

interface UseAnchoredDropdownOptions {
  width?: number;
  height?: number;
  onOpen?: () => void;
  onClose?: () => void;
}

/** Кнопка-якорь + поповер с закрытием по клику снаружи и позиционированием через clampDrop. */
export function useAnchoredDropdown<B extends HTMLElement = HTMLButtonElement, P extends HTMLElement = HTMLDivElement>(
  { width = 180, height = 160, onOpen, onClose }: UseAnchoredDropdownOptions = {},
) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState<Pos | null>(null);
  const anchorRef  = useRef<B>(null);
  const popoverRef = useRef<P>(null);

  // Свежие колбэки без пересоздания обработчика клика снаружи
  const callbacksRef = useRef({ onOpen, onClose });
  useEffect(() => { callbacksRef.current = { onOpen, onClose }; });

  const close = () => { setOpen(false); callbacksRef.current.onClose?.(); };

  const toggle = () => {
    if (open) { close(); return; }
    if (anchorRef.current) {
      setPos(clampDrop(anchorRef.current.getBoundingClientRect(), width, height, window.innerWidth, window.innerHeight));
    }
    setOpen(true);
    callbacksRef.current.onOpen?.();
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !popoverRef.current?.contains(t)) {
        setOpen(false);
        callbacksRef.current.onClose?.();
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Перепозиционирование по ФАКТИЧЕСКИМ размерам поповера: переданные width/height —
  // лишь оценка для первого кадра. На устройствах с низким вьюпортом завышенная оценка
  // высоты приводила к ненужному «перевороту» вверх и прижатию к верху экрана.
  // ResizeObserver также ловит раскрытие вложенного контента (напр. «Произвольно…»).
  useEffect(() => {
    if (!open) return;
    const el = popoverRef.current;
    const anchor = anchorRef.current;
    if (!el || !anchor) return;
    const reposition = () => {
      const rect = el.getBoundingClientRect();
      const next = clampDrop(
        anchor.getBoundingClientRect(),
        rect.width  || width,
        rect.height || height,
        window.innerWidth,
        window.innerHeight,
      );
      setPos(prev => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
    };
    reposition();
    const ro = new ResizeObserver(reposition);
    ro.observe(el);
    window.addEventListener('resize', reposition);
    return () => { ro.disconnect(); window.removeEventListener('resize', reposition); };
  }, [open, width, height]);

  return { open, pos, toggle, close, anchorRef, popoverRef };
}
