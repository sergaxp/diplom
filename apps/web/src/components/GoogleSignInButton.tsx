'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './GoogleSignInButton.module.scss';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { google?: any; }
}

/**
 * Кастомная кнопка «Войти через Google» в стиле сайта.
 * Использует OAuth token flow (initTokenClient) → отдаёт access_token в onToken.
 * Если NEXT_PUBLIC_GOOGLE_CLIENT_ID не задан — ничего не рендерит.
 */
export function GoogleSignInButton({ onToken, disabled }: { onToken: (accessToken: string) => void; disabled?: boolean }) {
  const clientRef = useRef<any>(null);
  const cbRef = useRef(onToken);
  useEffect(() => {
    cbRef.current = onToken;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const init = () => {
      const g = window.google;
      if (!g?.accounts?.oauth2) return;
      clientRef.current = g.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'openid email profile',
        callback: (resp: { access_token?: string }) => {
          if (resp.access_token) cbRef.current(resp.access_token);
        },
      });
      setReady(true);
    };

    if (window.google?.accounts?.oauth2) { init(); return; }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', init);
    return () => script?.removeEventListener('load', init);
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <button
      type="button"
      className={styles.googleBtn}
      disabled={disabled || !ready}
      onClick={() => clientRef.current?.requestAccessToken()}
    >
      <svg className={styles.icon} viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z"/>
      </svg>
      <span>Войти через Google</span>
    </button>
  );
}
