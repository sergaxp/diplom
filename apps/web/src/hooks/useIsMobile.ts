'use client';

import { useEffect, useState } from 'react';

/**
 * true, когда вьюпорт уже телефонного брейкпоинта (по умолчанию ≤768px).
 * SSR-безопасно: на сервере и до монтирования возвращает false, затем
 * синхронизируется с matchMedia и слушает изменения.
 */
export function useIsMobile(maxWidth = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [maxWidth]);

  return isMobile;
}
