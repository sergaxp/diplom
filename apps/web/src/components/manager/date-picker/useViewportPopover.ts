'use client';

import { RefObject, useEffect, useRef, useState } from 'react';
import { clampPopoverPos } from './viewportClamp';

interface Pos { top: number; left: number }

/**
 * Позиционирование поповера под триггером с удержанием в пределах вьюпорта
 * (важно для мобильных: при раскрытии содержимого поповер не должен уезжать за экран).
 * Отслеживает изменение размеров поповера (ResizeObserver) и окна (resize).
 */
export function useViewportPopover(triggerRef: RefObject<HTMLElement | null>) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
  }, [triggerRef]);

  useEffect(() => {
    const el = popupRef.current;
    const trigger = triggerRef.current;
    if (!el || !trigger) return;
    const clamp = () => {
      const rect = el.getBoundingClientRect();
      const tr   = trigger.getBoundingClientRect();
      const next = clampPopoverPos(rect, tr, window.innerWidth, window.innerHeight);
      setPos(prev => (prev && prev.left === next.left && prev.top === next.top ? prev : next));
    };
    clamp();
    const ro = new ResizeObserver(clamp);
    ro.observe(el);
    window.addEventListener('resize', clamp);
    return () => { ro.disconnect(); window.removeEventListener('resize', clamp); };
  }, [triggerRef]);

  return { popupRef, pos };
}
