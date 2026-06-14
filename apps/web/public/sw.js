/* Service Worker: фоновые web-push напоминания Warmingtea. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }

  e.waitUntil((async () => {
    // Если открыта видимая вкладка — отдаём событие ей (кастомный звук/вибрация/тост),
    // системный баннер не показываем, чтобы не было дубля.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = wins.find((w) => w.visibilityState === 'visible' || w.focused);
    if (visible) {
      visible.postMessage({ type: 'reminder', payload: d });
      return;
    }

    // Сайт закрыт / в фоне → системный баннер со звуком и вибрацией.
    await self.registration.showNotification(d.title || 'Напоминание', {
      body: d.body || '',
      icon: '/white.png',
      badge: '/white.png',
      tag: d.tag,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'snooze', title: 'Отложить 10 мин' },
        { action: 'done', title: 'Выполнено' },
      ],
      data: {
        url: d.url || '/',
        snoozeUrl: d.snoozeUrl,
        doneUrl: d.doneUrl,
        snoozeToken: d.snoozeToken,
        doneToken: d.doneToken,
      },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};

  if (e.action === 'snooze' && data.snoozeUrl && data.snoozeToken) {
    e.waitUntil(fetch(data.snoozeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: data.snoozeToken, minutes: 10 }),
    }).catch(() => {}));
    return;
  }

  if (e.action === 'done' && data.doneUrl && data.doneToken) {
    e.waitUntil(fetch(data.doneUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: data.doneToken }),
    }).catch(() => {}));
    return;
  }

  // Обычный клик → открыть/сфокусировать вкладку на нужном дне.
  const url = data.url || '/';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = wins.find((w) => 'focus' in w);
    if (existing) {
      await existing.focus();
      if (existing.navigate) { try { await existing.navigate(url); } catch { /* ignore */ } }
    } else {
      await self.clients.openWindow(url);
    }
  })());
});
