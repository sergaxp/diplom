'use client';

import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { google?: any; }
}

/**
 * Кнопка «Войти через Google» на основе Google Identity Services.
 * Получает id_token и отдаёт его в onCredential. Если NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * не задан — ничего не рендерит (фича неактивна).
 */
export function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return;

    const render = () => {
      const g = window.google;
      if (!g?.accounts?.id || !ref.current) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp: { credential?: string }) => {
          if (resp.credential) cbRef.current(resp.credential);
        },
      });
      const width = Math.min(400, Math.max(240, ref.current.clientWidth || 320));
      ref.current.innerHTML = '';
      g.accounts.id.renderButton(ref.current, {
        theme: 'outline', size: 'large', shape: 'rectangular',
        text: 'continue_with', logo_alignment: 'center', width, locale: 'ru',
      });
    };

    if (window.google?.accounts?.id) { render(); return; }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    return () => script?.removeEventListener('load', render);
  }, []);

  if (!CLIENT_ID) return null;
  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />;
}
