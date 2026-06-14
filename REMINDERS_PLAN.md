# План реализации: напоминания у задач (для Sonnet 4.6)

Документ — пошаговый план добавления напоминаний к задачам в Warmingtea.
Писать код строго в стиле проекта (SCSS-модули, Zustand/TanStack Query на фронте,
NestJS + TypeORM на бэке, UI на русском, без лишних абстракций).

## Решения, согласованные с заказчиком

1. **Механизм:** фоновые **Web Push** (работают, даже когда сайт закрыт / телефон в кармане).
   → нужен Service Worker + Web Push (VAPID) + планировщик на бэкенде.
2. **Несколько напоминаний** на одну задачу (массив правил).
3. **Относительно каждого вхождения**: пресеты «за 5 минут / за день / за неделю до» и
   «в момент задачи» считаются от **каждого** появления повторяющейся/многодневной задачи.
   «Произвольно (конкретная дата+время)» — **разовое**, абсолютное.

## Кнопка и пресеты (требование UI)

Кнопка «Напоминание» стоит в строке мета-полей (`metaRow`) рядом с датой, временем,
приоритетом, тегом и типом — в [TaskFormModal.tsx](apps/web/src/components/manager/task-form/TaskFormModal.tsx#L299).
По клику — выпадающее меню (как у тега/приоритета через `useAnchoredDropdown`) с пунктами:

- В момент задачи (offset 0) — **только если у задачи есть `time`**
- За 5 минут до — **только если у задачи есть `time`**
- За день до (1440 мин)
- За неделю до (10080 мин)
- Произвольно… → мини-календарь (выбор дня) + **необязательное** поле времени (абсолютное напоминание)

Можно выбрать несколько; выбранные показываются «чипами» под кнопкой/в кнопке (счётчик).

### Задачи без времени (важно)

У задачи без `time` напоминание тоже доступно — но «в момент» и «за 5 минут» скрываются
(нет момента, к которому привязываться). Остаются: «за день до», «за неделю до» и
«произвольно». Такие «вседневные» напоминания срабатывают в **настраиваемое дефолтное
время дня** (поле профиля `reminderDefaultTime`, дефолт `'09:00'`; см. 1.7 и 7.5).
В коде ниже `DEFAULT_ALLDAY_TIME` — это значение из профиля с fallback `'09:00'`.

Это даёт единообразную формулу для всех случаев:
`base = дата_вхождения в (эффективное_время_задачи ?? DEFAULT_ALLDAY_TIME)`,
далее `fireAt = base − offsetMinutes`. Для задачи с временем «за день до» 14:00-задачи =
накануне в 14:00; для задачи без времени «за день до» = накануне в 09:00.

«Произвольно» без указанного времени → срабатывает в выбранный день в `DEFAULT_ALLDAY_TIME`.

---

## Ключевое архитектурное решение (прочитать до начала!)

Вся логика вычисления вхождений повторяющихся задач (`getTasksForDate`,
`getSeriesDays`, `getOccurrenceIndex`, циклические паттерны, погода, праздники)
живёт **только на фронтенде** в [tasks.ts](apps/web/src/lib/tasks.ts). Переносить её
на бэкенд — дорого и рискованно (дублирование сложной логики).

**Поэтому:** напоминания материализуются на клиенте.

- На задаче хранится **конфиг** напоминаний (`reminders`: массив правил).
- Клиент, зная локальный часовой пояс и весь движок повторов, вычисляет **конкретные
  абсолютные моменты срабатывания** (epoch / `timestamptz`) на горизонт вперёд
  (например, 60 дней) и синхронизирует их с бэкендом как «инстансы напоминаний».
- Бэкенд хранит инстансы (абсолютное время `fireAt`), а **cron раз в минуту** находит
  «пора» и шлёт Web Push на все push-подписки пользователя + создаёт запись в
  «колокольчик» (существующая `notifications`), помечает инстанс `fired`.

Часовые пояса целиком считает клиент (задачи хранят `date`/`time` без TZ — это локальное
время пользователя). Бэкенд просто сравнивает `fireAt <= now()`.

Синхронизация инстансов происходит:
- при создании/редактировании/удалении задачи;
- при загрузке менеджера (раз за сессию / раз в сутки) — чтобы «продлевать» горизонт
  для повторяющихся задач и для тех пользователей, кто давно не заходил.

Горизонт 60 дней для личного проекта достаточен (пользователь заходит регулярно).

---

## 1. Модель данных

### 1.1 Фронтенд-типы — [apps/web/src/lib/tasks.ts](apps/web/src/lib/tasks.ts) (рядом с `RepeatConfig`)

```ts
export type ReminderType = 'at_time' | 'before' | 'custom';

export interface ReminderRule {
  id: string;                 // uid() — стабильный ключ правила
  type: ReminderType;
  offsetMinutes?: number;     // для 'at_time' (0) и 'before' (5/1440/10080/произвольно)
  at?: string;                // для 'custom': 'YYYY-MM-DD' (без времени → DEFAULT_ALLDAY_TIME)
                              //              или 'YYYY-MM-DDTHH:MM' (с временем). Локальное.
}
```

В `interface Task` добавить:
```ts
reminders?: ReminderRule[] | null;
```

### 1.2 Backend entity — [task.entity.ts](apps/api/src/tasks/entities/task.entity.ts)

Добавить колонку (JSON, как `subtasks`/`repeatConfig`):
```ts
@Column({ type: 'json', nullable: true, default: null })
reminders: object[] | null;
```

### 1.3 Новая entity: материализованный инстанс — `apps/api/src/reminders/entities/reminder-instance.entity.ts`

```ts
@Entity('reminder_instances')
@Unique(['taskId', 'ruleId', 'occurrenceDate'])
@Index(['fired', 'fireAt'])
export class ReminderInstance {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() taskId: string;
  @Column() ruleId: string;            // ReminderRule.id
  @Column({ type: 'varchar', length: 10 }) occurrenceDate: string; // YYYY-MM-DD ('-' для custom)
  @Column({ type: 'varchar', length: 10 }) linkDate: string; // YYYY-MM-DD — для deep-link клика
  @Column({ type: 'timestamptz' }) fireAt: Date;     // абсолютный момент
  @Column({ type: 'varchar', length: 255 }) title: string;  // снимок названия задачи
  @Column({ type: 'varchar', length: 5, nullable: true }) occTime: string | null; // HH:MM вхождения (для текста)
  @Column({ type: 'boolean', default: false }) fired: boolean;
  @CreateDateColumn() createdAt: Date;
}
```

### 1.4 Новая entity: push-подписка — `apps/api/src/push/entities/push-subscription.entity.ts`

```ts
@Entity('push_subscriptions')
@Unique(['endpoint'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column({ type: 'text' }) endpoint: string;
  @Column({ type: 'varchar' }) p256dh: string;
  @Column({ type: 'varchar' }) auth: string;
  @CreateDateColumn() createdAt: Date;
}
```

TypeORM в dev на `synchronize: true` (проверить в [app.module.ts](apps/api/src/app.module.ts#L53)).
Если `synchronize: false` — добавить миграции для трёх изменений (колонка `tasks.reminders`,
таблицы `reminder_instances`, `push_subscriptions`).

### 1.5 DTO — [create-task.dto.ts](apps/api/src/tasks/dto/create-task.dto.ts) и [update-task.dto.ts](apps/api/src/tasks/dto/update-task.dto.ts)

Добавить в оба:
```ts
@IsOptional()
reminders?: object[] | null;
```
(по аналогии с `subtasks`). И прокинуть в [tasks.service.ts](apps/api/src/tasks/tasks.service.ts)
в `create` (поле при `create`) и `update` (`if (dto.reminders !== undefined) task.reminders = dto.reminders ?? null;`).

### 1.6 Маппинг API на фронте — [tasks.ts tasksApi](apps/web/src/lib/tasks.ts#L955)

В `create` и `update` добавить `reminders: p.reminders ?? null`. В `fromApi`/`ApiTask` и
`Payload` добавить `reminders`. В [taskFormPayload.ts](apps/web/src/lib/taskFormPayload.ts)
добавить `reminders` в `TaskFormState` и в результат `buildTaskPayload`.

### 1.7 Настройка пользователя: время вседневных напоминаний

Дефолтное время для напоминаний у задач без `time` — **настраиваемое** (решение заказчика).

- Backend [user.entity.ts](apps/api/src/users/entities/user.entity.ts): колонка
  ```ts
  @Column({ type: 'varchar', length: 5, default: '09:00' })
  reminderDefaultTime: string; // 'HH:MM'
  ```
- В DTO обновления профиля (users) добавить `reminderDefaultTime?` с валидацией
  `@Matches(/^\d{2}:\d{2}$/)`; прокинуть в users.service `update`.
- Фронт: добавить поле в тип профиля/`me`, отдавать его в менеджер.
- `lib/reminders.ts`: вместо хардкода — параметр функции `defaultAllDayTime` (fallback
  `'09:00'`), значение брать из профиля текущего пользователя. Константу
  `DEFAULT_ALLDAY_TIME = '09:00'` оставить как fallback, если профиль не загружен.

---

## 2. Backend: модуль Push

Папка `apps/api/src/push/`.

### 2.1 Зависимость
```
pnpm --filter @warmingtea/api add web-push
pnpm --filter @warmingtea/api add -D @types/web-push
```

### 2.2 VAPID ключи
Сгенерировать однократно: `npx web-push generate-vapid-keys`.
В `.env` (и `docker-compose.dev.yml` env, и прод):
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:tryundertea@gmail.com
```

### 2.3 `push.service.ts`
- `webpush.setVapidDetails(subject, pub, priv)` в конструкторе (из `ConfigService`).
- `subscribe(userId, sub)` — upsert по `endpoint`.
- `unsubscribe(endpoint)`.
- `sendToUser(userId, payload: { title; body; icon?; tag?; url?; snoozeToken?; doneToken? })` —
  берёт все подписки пользователя, шлёт `webpush.sendNotification(...)` (payload как JSON).
  На ошибку `410 Gone`/`404` — удалять «протухшую» подписку.
- `getPublicKey()` — отдать публичный ключ (или хранить на фронте в env).

### 2.4 `push.controller.ts` (под `JwtAuthGuard`, как notifications.controller)
- `GET  /push/public-key` → `{ key }`
- `POST /push/subscribe`   body: `PushSubscriptionJSON` → 204
- `POST /push/unsubscribe` body: `{ endpoint }` → 204

### 2.5 `push.module.ts` — экспортирует `PushService` (нужен в RemindersModule), регистрирует
TypeOrmModule.forFeature([PushSubscription]). Подключить в [app.module.ts](apps/api/src/app.module.ts).

---

## 3. Backend: модуль Reminders + планировщик

Папка `apps/api/src/reminders/`.

### 3.1 Зависимость планировщика
```
pnpm --filter @warmingtea/api add @nestjs/schedule
```
(Bull уже есть, но для «cron раз в минуту по таблице» `@nestjs/schedule` проще.)
В корневом модуле добавить `ScheduleModule.forRoot()`.

### 3.2 `reminders.service.ts`
- `syncForTask(userId, taskId, instances: SyncInstanceDto[])`:
  В транзакции: удалить будущие **нефайренные** инстансы этой задачи
  (`taskId`, `fired=false`, `fireAt > now()`), затем вставить присланные клиентом
  (upsert по unique `taskId+ruleId+occurrenceDate`). Прошлые/уже сработавшие не трогать.
- `deleteForTask(taskId)` — при удалении задачи удалить её инстансы.
- `pruneFired()` — чистить старые `fired=true` (например, > 30 дней).

### 3.3 `reminders.controller.ts` (под `JwtAuthGuard`)
- `PUT /reminders/sync` body:
  `{ taskId, instances: [{ ruleId, occurrenceDate, linkDate, fireAt, title, occTime }] }`
  → вызвать `syncForTask(req.user.id, ...)`. 204.
  (Можно батч: массив taskId → instances. Для простоты — по одной задаче за вызов.)
- `POST /reminders/snooze` body: `{ token, minutes }` — **без `JwtAuthGuard`** (вызывается из
  Service Worker, где нет access-токена). `token` — подписанный короткоживущий JWT из push-
  payload (содержит `instanceId`, `userId`). Сервис верифицирует токен и создаёт новый инстанс
  с `fireAt = now + minutes`, `title/linkDate/occTime` из исходного. 204.
- `POST /reminders/complete` body: `{ token }` — **без `JwtAuthGuard`**. `token` содержит
  `taskId, userId, occurrenceDate`. Сервис отмечает выполнение через `TaskCompletion`
  (как `tasks.service.toggleCompletion`, но идемпотентно — только проставить, если ещё нет). 204.
  Токены подписываются `JwtService` (отдельный секрет/TTL ~7 дней; payload-специфичные claims).

### 3.4 Планировщик `reminders.scheduler.ts`
```ts
@Cron(CronExpression.EVERY_MINUTE)
async tick() {
  const due = await this.repo.find({
    where: { fired: false, fireAt: LessThanOrEqual(new Date()) },
    take: 200,
  });
  for (const inst of due) {
    // Отмена для выполненного вхождения (решение заказчика): если день задачи
    // уже отмечен выполненным — не слать, просто пометить fired.
    if (inst.occurrenceDate !== '-') {
      const done = await this.completionRepo.findOne({
        where: { taskId: inst.taskId, userId: inst.userId, date: inst.occurrenceDate },
      });
      if (done) { inst.fired = true; continue; }
    }
    const body = inst.occTime ? `${inst.title} — в ${inst.occTime}` : inst.title;
    const snoozeToken = this.signSnoozeToken(inst);   // JWT { instanceId, userId }
    const doneToken   = inst.occurrenceDate !== '-'   // у custom нет вхождения для «Выполнено»
      ? this.signDoneToken(inst)                      // JWT { taskId, userId, occurrenceDate }
      : undefined;
    await this.push.sendToUser(inst.userId, {
      title: 'Напоминание',
      body,
      icon: 'Bell',
      tag: `reminder-${inst.id}`,
      url: `/?date=${inst.linkDate}`,                 // deep-link на день задачи
      snoozeToken,                                    // для кнопки «Отложить» в SW
      doneToken,                                      // для кнопки «Выполнено» в SW
    });
    await this.notifications.create({
      userId: inst.userId, kind: 'reminder',     // ← новый kind, см. ниже
      title: `Напоминание: ${inst.title}`, body: inst.occTime ? `в ${inst.occTime}` : null,
      icon: 'Bell', color: '#f59e0b',
    });
    inst.fired = true;
  }
  if (due.length) await this.repo.save(due);
}
```
- `completionRepo` (`TaskCompletion`) внедрить в планировщик — `RemindersModule` должен
  `TypeOrmModule.forFeature([ReminderInstance, TaskCompletion])`.
- Защита от дубликатов: обработка по одному + флаг `fired` сохраняется после цикла
  (cron раз в минуту, `take` ограничен — риск повторной отправки минимален).
- `custom`-напоминания (`occurrenceDate === '-'`) проверку выполнения не проходят (нет
  привязки к конкретному дню) — шлются всегда.

### 3.5 Новый `NotificationKind: 'reminder'`
- В [notification.entity.ts](apps/api/src/notifications/entities/notification.entity.ts) добавить `'reminder'` в union.
- В [notifications.ts](apps/web/src/lib/notifications.ts#L3) `NotificationKind` — добавить `'reminder'`.
- В UI колокольчика ([NotificationBell.tsx](apps/web/src/components/NotificationBell.tsx)) — иконка/цвет для нового kind (Bell, оранжевый).

### 3.6 `reminders.module.ts`
- `TypeOrmModule.forFeature([ReminderInstance])`, imports `PushModule`, `NotificationsModule`,
  providers `RemindersService`, `RemindersScheduler`. Подключить в [app.module.ts](apps/api/src/app.module.ts).
- В [tasks.service.ts remove](apps/api/src/tasks/tasks.service.ts#L124) вызвать `remindersService.deleteForTask(id)`
  (импорт через forwardRef или вынести очистку в контроллер — проще: RemindersModule
  экспортирует сервис, TasksModule импортирует).

---

## 4. Frontend: вычисление инстансов

Новый файл `apps/web/src/lib/reminders.ts`.

### 4.1 Перечисление вхождений
Использовать существующий движок. Для горизонта `[today, today+60d]`:
- для каждого дня диапазона вызвать существующую логику попадания вхождения
  (см. `getSeriesDays` / `getTasksForDate` / `getMultiDayOccurrence` в [tasks.ts](apps/web/src/lib/tasks.ts)).
  Берём дни, где задача присутствует, и её эффективное время начала (`time`, c учётом
  `dayOverrides[day].time`).
- Для одиночной задачи (`repeat==='none'`, без `endDate`) — одно вхождение в `task.date`.

### 4.2 Из правила → fireAt
```ts
function ruleFireTimes(task, rule, occurrences): { ruleId; occurrenceDate; fireAt; title }[] {
  if (rule.type === 'custom') {
    // одно абсолютное; occurrenceDate = '-'
    // at: 'YYYY-MM-DD' → день в DEFAULT_ALLDAY_TIME; 'YYYY-MM-DDTHH:MM' → точное время
    const dateOnly = rule.at.slice(0, 10);
    const at = rule.at.includes('T') ? rule.at : `${rule.at}T${DEFAULT_ALLDAY_TIME}`;
    return [{
      ruleId: rule.id, occurrenceDate: '-', linkDate: dateOnly,
      fireAt: localToDate(at), title: task.title, occTime: null,
    }];
  }
  // at_time/before: для каждого вхождения
  return occurrences.map(day => {
    const occTime = effectiveTime(task, day) || null;       // реальное время вхождения (или null)
    const baseTime = occTime || DEFAULT_ALLDAY_TIME;        // у задач без time → 09:00
    const base = new Date(`${day}T${baseTime}:00`);         // локальное
    base.setMinutes(base.getMinutes() - (rule.offsetMinutes ?? 0));
    return { ruleId: rule.id, occurrenceDate: day, linkDate: day, fireAt: base, title: task.title, occTime };
  });
}
```
Отбросить `fireAt <= now()` (прошедшие не слать). `fireAt` сериализовать как ISO
(`Date.toISOString()` — UTC) для отправки на бэкенд.

**Задачи без времени.** Базой берём `DEFAULT_ALLDAY_TIME` вместо `time`:
```ts
const baseTime = effectiveTime(task, day) || DEFAULT_ALLDAY_TIME; // '09:00'
```
Правила `at_time` (offset 0) и `before` с маленьким offset (5 мин) для задач без `time`
в UI не предлагаются (см. секцию «Задачи без времени»), но если такое правило всё же
сохранено — формула остаётся корректной (просто привяжется к 09:00).

**Custom без времени.** Если `rule.at` — только дата (`'YYYY-MM-DD'`), то
`fireAt = дата в DEFAULT_ALLDAY_TIME`; если `'YYYY-MM-DDTHH:MM'` — точное локальное время.

### 4.3 Синхронизация
`syncTaskReminders(task)`:
- если `!task.reminders?.length` → `PUT /reminders/sync { taskId, instances: [] }` (очистит будущие);
- иначе вычислить инстансы и отправить.

Вызовы в [page.tsx](apps/web/src/app/page.tsx):
- в `onSuccess` мутаций `createMut`/`updateMut` (после получения `task` с id) — `syncTaskReminders`.
- `deleteMut` — бэкенд сам чистит (см. 3.6), доп. действий не нужно.
- один общий проход при загрузке менеджера: `useEffect` после загрузки `tasks` —
  `Promise.all(tasks.filter(hasReminders).map(syncTaskReminders))`, с защёлкой
  «не чаще раза в сутки» через `localStorage` (как `useWeatherShownLock`).

### 4.4 Deep-link клика по уведомлению
- Менеджер ([page.tsx](apps/web/src/app/page.tsx)) при загрузке читает `?date=YYYY-MM-DD`
  из `useSearchParams` и выставляет выбранный день (использовать существующий стейт
  выбранной даты менеджера). После применения — очистить query (`router.replace('/')`),
  чтобы не залипало.
- Если задача с тем днём — менеджер её покажет; дополнительной прокрутки/подсветки не требуется
  (можно опционально подсветить).

---

## 5. Frontend: Service Worker + разрешения + подписка

### 5.1 Service worker `apps/web/public/sw.js`
Next 16 отдаёт файлы из `public/` по корню. SW:
```js
self.addEventListener('push', (e) => {
  const d = e.data?.json() ?? {};
  e.waitUntil((async () => {
    // Дедупликация: если открыта видимая вкладка — отдаём событие ей
    // (кастомный звук + вибрация + in-app тост), системный баннер НЕ показываем.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = wins.find(w => w.visibilityState === 'visible' || w.focused);
    if (visible) {
      visible.postMessage({ type: 'reminder', payload: d });
      return;
    }
    // Сайт закрыт / в фоне → обычный баннер с системным звуком и вибрацией.
    await self.registration.showNotification(d.title || 'Напоминание', {
      body: d.body || '',
      icon: '/white.png',
      badge: '/white.png',
      tag: d.tag,
      vibrate: [200, 100, 200],   // вибрация на телефоне
      actions: [
        { action: 'snooze', title: 'Отложить 10 мин' },
        { action: 'done',   title: 'Выполнено' },
      ],
      data: { url: d.url || '/', snoozeToken: d.snoozeToken, doneToken: d.doneToken },
    });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'snooze') {
    // Snooze без access-токена: POST с подписанным токеном из payload
    e.waitUntil(fetch('/api/reminders/snooze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: e.notification.data?.snoozeToken, minutes: 10 }),
    }));
    return;
  }
  if (e.action === 'done') {
    // Отметить вхождение выполненным подписанным токеном (без access-токена)
    e.waitUntil(fetch('/api/reminders/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: e.notification.data?.doneToken }),
    }));
    return;
  }
  // обычный клик → открыть/сфокусировать вкладку на нужном дне
  const url = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = wins.find(w => 'focus' in w);
    if (existing) { await existing.focus(); existing.navigate?.(url); }
    else await self.clients.openWindow(url);
  })());
});
```
Примечание: путь `/api/reminders/snooze` — через тот же origin/проксирование, что и
основной API (свериться с тем, как фронт обращается к бэку: базовый URL в `lib/api.ts`).
⚠️ При `userVisibleOnly: true` некоторые браузеры (Chrome) ожидают `showNotification`
на каждый push; пропуск при наличии **видимой** вкладки допустим, но поведение проверить.
Если браузер ругается — показывать тихий баннер и в нём тоже, либо принять баннер всегда
(см. секцию «Спорные места»).

### 5.2 Регистрация + подписка `apps/web/src/lib/push.ts`
- `registerPush()`:
  1. `if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;`
  2. `Notification.requestPermission()` (вызывать по клику пользователя, не на загрузке!).
  3. `navigator.serviceWorker.register('/sw.js')`.
  4. `reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) })`.
  5. `POST /push/subscribe` с `subscription.toJSON()`.
- VAPID public key: положить в `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (env web) или дёргать `GET /push/public-key`.
- Хелпер `urlBase64ToUint8Array` (стандартный сниппет).

### 5.3 Где просить разрешение
Не на загрузке (отклонят). Варианты:
- при первом добавлении напоминания в форме задачи — после выбора пункта меню вызвать
  `registerPush()` (объяснить «чтобы напоминания приходили, разреши уведомления»);
- продублировать тумблер «Push-уведомления» в настройках ([ManagerTab.tsx](apps/web/src/app/settings/tabs/ManagerTab.tsx)).

---

## 6. Звук и вибрация

- **Фоновое (сайт закрыт):** Web Push → SW `showNotification` с `vibrate: [...]` →
  системный звук уведомления + вибрация телефона. Кастомный аудиофайл в фоне из SW
  проиграть нельзя (нет Audio API в SW) — это ограничение платформы, задокументировать.
- **Foreground (сайт открыт, в фокусе):** кастомный звук+вибрацию запускает **не** отдельный
  клиентский таймер, а сообщение из Service Worker. SW при получении push видит видимую
  вкладку и шлёт ей `postMessage({ type:'reminder', payload })` (см. 5.1). На фронте —
  единый слушатель:
  ```ts
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'reminder') return;
    new Audio('/sounds/reminder.mp3').play().catch(() => {});
    navigator.vibrate?.([200, 100, 200]);
    // + мягкий in-app тост (существующая система тостов проекта)
  });
  ```
  Так один и тот же серверный push даёт **либо** кастомный звук (вкладка открыта),
  **либо** системный баннер (закрыто/в фоне) — без дублей и без второго источника времени.
- Звук требует «прогрева» из пользовательского жеста (autoplay policy): один раз при
  включении напоминаний проиграть «тихий» Audio в обработчике клика, чтобы разблокировать.

Преимущество подхода: нет второго движка времени на клиенте — единственный источник
истины о моменте срабатывания — серверные инстансы; клиент лишь по-разному их «озвучивает».

---

## 7. Frontend UI: кнопка и дропдаун напоминаний

### 7.1 Состояние в [TaskFormModal.tsx](apps/web/src/components/manager/task-form/TaskFormModal.tsx)
```ts
const [reminders, setReminders] = useState<ReminderRule[]>(task?.reminders ?? draft?.reminders ?? []);
```
Добавить в `useTaskDraft` поля (черновик) и в `clearForm`. Добавить в зависимости
автосейва черновика и в `buildTaskPayload(... reminders ...)`.

### 7.2 Кнопка в `metaRow` (после кнопки «Тип», строки ~390)
По образцу кнопок приоритета/тега: `useAnchoredDropdown` для попапа. Текст (без иконки-эмодзи):
`reminders.length ? 'Напоминание · {reminders.length}' : 'Напоминание'`. Подсветка при наличии.
(Если нужна иконка — использовать Lucide `Bell` как `metaBtnDot`-аналог, не эмодзи 🔔.)

### 7.3 Компонент попапа `ReminderDropdown.tsx` (рядом с [MetaDropdowns.tsx](apps/web/src/components/manager/task-form/MetaDropdowns.tsx))
- Список пресетов (чекбоксы — несколько): at_time, before5, before1440, before10080.
  **Если у задачи нет `time`** — пункты `at_time` и `before5` скрыть/disabled (см. секцию
  «Задачи без времени»). Пробрасывать в компонент проп `hasTime: boolean`.
- Пункт «Произвольно…» → инлайн мини-календарь (переиспользовать
  [MiniCalendar.tsx](apps/web/src/components/manager/repeat-config/MiniCalendar.tsx) или
  `MiniCalendarGrid` из date-picker) + **необязательное** поле времени (`TimePickerField`/нативный
  input). Если время не задано → правило `{type:'custom', at:'YYYY-MM-DD'}` (сработает в 09:00);
  если задано → `{type:'custom', at:'YYYY-MM-DDTHH:MM'}`.
- Список добавленных правил с возможностью удалить (×).
- Helper для подписи правила: `reminderLabel(rule)` → «За 5 минут», «За день», «25 июня»,
  «25 июня, 14:00» (для custom без времени — только дата).
- При первом добавлении правила вызвать `registerPush()` (запрос разрешения по жесту).

### 7.4 Стили
Добавить классы в [TaskFormModal.module.scss](apps/web/src/components/manager/task-form/TaskFormModal.module.scss)
по образцу `.metaBtn`, `.tagBtn`. Попап — по образцу MetaDropdowns стилей.

### 7.5 Настройки в [ManagerTab.tsx](apps/web/src/app/settings/tabs/ManagerTab.tsx)

Блок «Напоминания»:
- **Тумблер «Push-уведомления»** (решение заказчика):
  - вкл → `registerPush()` (запрос разрешения + подписка + `POST /push/subscribe`);
  - выкл → `unsubscribe` локально + `POST /push/unsubscribe`;
  - состояние тумблера отражает фактическое: `Notification.permission` +
    наличие активной `pushManager.getSubscription()`;
  - если `permission === 'denied'` — тумблер disabled + подсказка «разрешите уведомления
    в настройках браузера».
- **Поле «Время напоминаний для задач без времени»** (`reminderDefaultTime`, input `time`)
  → сохраняется в профиль (users update DTO из 1.7).
- Подсказка про iOS: «на iPhone добавьте сайт на экран Домой, чтобы напоминания приходили
  в фоне».

---

## 8. Чеклист файлов

**Backend — новые:**
- `apps/api/src/push/entities/push-subscription.entity.ts`
- `apps/api/src/push/push.service.ts`, `push.controller.ts`, `push.module.ts`
- `apps/api/src/reminders/entities/reminder-instance.entity.ts`
- `apps/api/src/reminders/dto/sync-reminders.dto.ts`
- `apps/api/src/reminders/reminders.service.ts`, `reminders.controller.ts`,
  `reminders.scheduler.ts`, `reminders.module.ts`

**Backend — изменить:**
- `tasks/entities/task.entity.ts` (+reminders)
- `tasks/dto/create-task.dto.ts`, `update-task.dto.ts` (+reminders)
- `tasks/tasks.service.ts` (create/update +reminders; remove → deleteForTask)
- `tasks/tasks.module.ts` (import RemindersModule при необходимости)
- `users/entities/user.entity.ts` (+reminderDefaultTime) и users update DTO/service (1.7)
- `notifications/entities/notification.entity.ts` (+kind 'reminder')
- `app.module.ts` (ScheduleModule, PushModule, RemindersModule)
- `.env` / docker compose env (VAPID_*, `REMINDER_TOKEN_SECRET` для snooze/done-токенов)

**Frontend — новые:**
- `apps/web/public/sw.js`
- `apps/web/public/sounds/reminder.mp3` (короткий звук — **файл предоставит заказчик**)
- `apps/web/src/app/manifest.ts` (PWA, для iOS — раздел 13) + квадратные иконки (192/512)
- `apps/web/src/lib/push.ts`
- `apps/web/src/lib/reminders.ts`
- `apps/web/src/lib/reminders.test.ts`
- `apps/web/src/components/manager/task-form/ReminderDropdown.tsx` (+ .module.scss или в общий)

**Frontend — изменить:**
- `lib/tasks.ts` (типы ReminderRule, Task.reminders, ApiTask/Payload, tasksApi map, fromApi)
- `lib/taskFormPayload.ts` (+reminders)
- `lib/notifications.ts` (+kind 'reminder')
- `hooks/useTaskDraft.ts` (+reminders в черновик)
- `app/layout.tsx` (appleWebApp/apple-touch-icon, регистрация SW — раздел 13)
- `components/manager/task-form/TaskFormModal.tsx` (state, кнопка, попап, payload, clearForm)
- `components/manager/task-form/TaskFormModal.module.scss` (стили кнопки/попапа)
- `app/page.tsx` (sync в onSuccess мутаций + проход при загрузке; слушатель SW message;
  deep-link `?date=` из раздела 4.4)
- `components/NotificationBell.tsx` (иконка/цвет kind 'reminder')
- `app/settings/tabs/ManagerTab.tsx` (тумблер push + поле reminderDefaultTime — раздел 7.5)
- профиль/`me` тип на фронте (+reminderDefaultTime)
- env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

---

## 9. Порядок реализации (этапы)

1. **Модель данных:** колонка `tasks.reminders` + фронт-типы + DTO + маппинг + сохранение
   конфига в форме (без срабатывания). Проверить, что reminders сохраняются и читаются.
2. **UI кнопки/дропдауна** в metaRow (пресеты + произвольно; скрытие at_time/before5 при
   задаче без времени), сохранение в `reminders`.
3. **Push-инфраструктура:** web-push, VAPID, PushModule (subscribe/unsubscribe), SW, `lib/push.ts`,
   запрос разрешения по жесту. Проверить ручной отправкой пуша из бэка.
4. **PWA-manifest** (`app/manifest.ts`, appleWebApp, иконки) — для iOS-push (раздел 13).
5. **Настройка пользователя** `reminderDefaultTime` (User entity + users DTO/service + фронт).
6. **Материализация инстансов:** `lib/reminders.ts` (вычисление по движку повторов, учёт
   `reminderDefaultTime`) + `reminders.test.ts`. RemindersModule (sync API).
7. **Планировщик** (`@Cron` раз в минуту) → проверка выполнения вхождения → push (текст с
   временем, deep-link `?date=`, snooze/done токены) + запись в колокольчик + `fired`.
8. **Действия уведомления:** SW actions «Отложить 10 мин» / «Выполнено»; эндпоинты
   `/reminders/snooze` и `/reminders/complete` (подписанные токены, без JwtAuthGuard);
   клик → открыть/сфокусировать вкладку на дне (4.4).
9. **Синхронизация с фронта:** в onSuccess мутаций + проход при загрузке менеджера.
10. **Foreground звук+вибрация** через `postMessage` из SW (дедуп в SW по видимой вкладке) +
   слушатель `serviceWorker.message` на фронте (звук/вибрация/тост).
11. **Колокольчик:** новый kind 'reminder' (иконка/цвет).
12. **Настройки** (раздел 7.5): тумблер push + поле времени.
13. Очистка `fired` (prune), документация ограничений.

---

## 10. Тесты

- `apps/web/src/lib/reminders.test.ts` (Vitest, как существующие тесты):
  - одиночная задача: at_time/before дают правильный `fireAt`;
  - daily-повтор: несколько вхождений в горизонте, offset применён к каждому;
  - multiDay: вхождения по дням;
  - custom с временем и без времени (без → `reminderDefaultTime`);
  - задача без `time`: «за день/неделю» привязаны к `reminderDefaultTime`;
  - прошедшие `fireAt` отброшены;
  - учёт `dayOverrides[day].time`;
  - `repeatUntil` обрезает горизонт.
- Backend: спека `reminders.service.spec.ts` — `syncForTask` не трогает `fired`/прошлые,
  заменяет будущие; планировщик помечает `fired` и зовёт push один раз; **выполненное
  вхождение (`task_completions`) не шлётся, но помечается `fired`**.

---

## 11. Подводные камни

- **HTTPS обязателен** для SW/Push (на проде warmingtea.su — есть; локально — `localhost`
  считается secure, ок).
- **iOS Safari:** Web Push работает только для PWA, добавленного на домашний экран
  (iOS 16.4+). Для обычной вкладки на iOS пуш не придёт — задокументировать; foreground-звук
  при этом работает.
- **Разрешение просить по жесту**, не на загрузке (иначе отказ/игнор).
- **Часовые пояса:** всё считает клиент → `fireAt` в UTC ISO; бэкенд только сравнивает.
  Если пользователь сменил TZ — пересчитается при следующей синхронизации.
- **Идемпотентность sync:** unique `(taskId, ruleId, occurrenceDate)`; при ре-синхронизации
  не плодить дубли (upsert / удалить будущие нефайренные перед вставкой).
- **Дубликат foreground+background:** решён дедупликацией в SW (см. 5.1/6) — баннер
  показывается только при отсутствии видимой вкладки; иначе вкладка играет кастомный звук.
- **Звук autoplay:** «прогреть» Audio в обработчике клика при включении напоминаний.

---

## 12. Решения по спорным местам (согласовано с заказчиком)

1. **Дефолтное время «вседневных» напоминаний — НАСТРАИВАЕМОЕ.** Поле в настройках
   пользователя `reminderDefaultTime` ('HH:MM', дефолт `'09:00'`). Используется для задач
   без `time` и для «произвольно без времени». Реализация — см. 1.7 и 7.5.
2. **iOS Web Push — ДОБАВЛЯЕМ PWA-manifest.** Сайт делаем устанавливаемым (см. секцию 13),
   иначе на iPhone фоновых напоминаний нет вовсе.
3. **Горизонт материализации.** 60 дней + «продление» при заходе в менеджер (раз в сутки).
4. **Отмена напоминания для выполненного вхождения — ОТМЕНЯЕМ.** Планировщик перед отправкой
   проверяет `task_completions` по `(taskId, occurrenceDate)`; если выполнено — помечает
   инстанс `fired` без отправки (см. 3.4).
5. **Перенос даты задачи и `custom`-напоминание.** Абсолютное (`custom`) при переносе задачи
   **не сдвигается** (это его смысл). Относительные (`at_time`/`before`) пересчитываются при
   ре-синке. Так и задумано.
6. **Доставка VAPID public key.** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (env).
7. **Нет разрешения / браузер без push.** Напоминания всё равно сохраняются; при открытой
   вкладке отработает foreground-звук. Показывать ненавязчивую подсказку и не блокировать
   сохранение задачи. Управление — тумблер в настройках (см. 7.5).
8. **Снятие подписки/чистка.** Протухшие подписки (404/410) удалять на бэке. Инстансы
   `fired` старше 30 дней — `pruneFired` по cron.
9. **Несколько устройств.** Push уходит на все подписки пользователя — на каждом устройстве
   своё уведомление. Дедупликация между устройствами не делается.
10. **Клик по уведомлению — на день задачи.** Deep-link `/?date=YYYY-MM-DD` (раздел 4.4).
11. **Действия в уведомлении — «Отложить 10 мин» и «Выполнено».** Через подписанные токены
    из payload (`/reminders/snooze`, `/reminders/complete`), без access-токена. «Выполнено»
    недоступно для `custom`-напоминаний (нет привязки к вхождению).
12. **Текст уведомления — название + время.** Заголовок «Напоминание», тело
    «<название> — в HH:MM» (для задач без времени — только название).
13. **Звук (foreground).** Файл `public/sounds/reminder.mp3` предоставляет заказчик.

---

## 13. PWA-manifest (Android + iOS + десктоп)

Один общий manifest делает сайт устанавливаемым на **всех** платформах: Android (Chrome),
iOS (Safari «на экран Домой», обязательно для push), десктоп (Chrome/Edge — кнопка
«Установить» в адресной строке, приложение в отдельном окне).

- `apps/web/src/app/manifest.ts` (Next 16 Metadata API) — `name`, `short_name`,
  `start_url: '/'`, `display: 'standalone'`, `background_color`, `theme_color`, `icons`.
- **Иконки** обязательны для установки: 192×192 и 512×512 (PNG), плюс одна
  `"purpose": "maskable"` (для аккуратной иконки на Android). Есть `white.png`/`dark.png` —
  при необходимости подготовить квадратные версии нужных размеров в `public/`.
- `app/layout.tsx`: `appleWebApp` (через `metadata`) + `apple-touch-icon` (180×180) —
  для корректной установки на iOS. `theme_color` для строки статуса.
- Проверить, что SW (`/sw.js`) регистрируется и работает в standalone-режиме на каждой
  платформе.
- **Десктоп:** после установки приложение работает в своём окне; push-уведомления идут в
  системный центр уведомлений Windows/macOS (даже когда окно закрыто, если ОС позволяет
  фоновую работу браузера).
- Документировать пользователю: iPhone — «Поделиться → На экран Домой» (iOS 16.4+);
  десктоп/Android — кнопка «Установить».
- **at_time/before у задачи без `time`:** определить поведение (рекомендация — пропускать).
- Не забыть `ScheduleModule.forRoot()` и `synchronize`/миграции под прод.
```

---

## 14. Что реализовано (статус) и ограничения

Реализованы все 13 этапов. Ключевые файлы — см. чеклист (раздел 8). Дополнительно:

**Решения, принятые при реализации (отклонения/уточнения плана):**
- **Кросс-доменный API.** Фронт ходит на API по отдельному origin (`NEXT_PUBLIC_API_URL`,
  по умолчанию `http://localhost:3001`). Поэтому Service Worker для snooze/done **не**
  стучится в относительный `/api/...`, а получает абсолютные `snoozeUrl`/`doneUrl` в
  payload пуша (бэкенд строит их из `API_PUBLIC_URL`). См. [sw.js](apps/web/public/sw.js)
  и [reminders.scheduler.ts](apps/api/src/reminders/reminders.scheduler.ts).
- **Погода/праздники при материализации игнорируются.** Прогноза/календаря на 60 дней
  вперёд нет, а `checkWeatherCondition(undefined)` строго прячет задачу. Поэтому
  `enumerateOccurrences` снимает `weatherCondition`/`holidaySettings` и берёт плановое
  расписание (months/cyclic/interval/endAfter/dayOverrides — учитываются). См.
  [reminders.ts](apps/web/src/lib/reminders.ts).
- **Snooze-копии** хранятся с `ruleId = 'snooze:<исходный>'`, чтобы не конфликтовать с
  unique-ключом и не удаляться при ре-синке задачи (sync исключает `ruleId LIKE 'snooze:%'`).
- **Foreground.** SW при видимой вкладке шлёт `postMessage` → [ReminderToast](apps/web/src/components/ReminderToast.tsx)
  (звук `/sounds/reminder.mp3` + вибрация + in-app тост), системный баннер не дублируется.
  SW регистрируется при загрузке (без запроса разрешения); подписка/permission — по жесту.
- **PWA-иконки** (192/512/maskable/apple-touch) сгенерированы из `dark.png` (sharp) —
  при необходимости заменить на фирменные.

**Ограничения (платформенные, задокументированы):**
- **iOS:** web-push только для PWA с домашнего экрана (iOS 16.4+); в обычной вкладке Safari
  фоновых пушей нет (foreground-звук работает). Подсказка в настройках.
- **Кастомный звук в фоне невозможен** (в SW нет Audio API) — играет системный звук баннера.
- **Звук foreground требует «прогрева»** из жеста (autoplay policy): `registerPush()`
  вызывается по клику, что разблокирует последующий `Audio.play()`.
- **`reminder.mp3`** не в репозитории — предоставляет заказчик (см.
  [public/sounds/README.md](apps/web/public/sounds/README.md)); без него foreground-звука нет.
- **Горизонт 60 дней** + продление раз в сутки при заходе в менеджер (защёлка
  `wt_reminders_synced_at` в localStorage).

**Проверки:** `pnpm --filter web test` (reminders.test.ts — 13 тестов) + `pnpm --filter api exec jest`
(reminders.service/scheduler.spec — 10 тестов); оба `tsc --noEmit` чисты; `next build` и boot
Nest-приложения проходят (таблицы `reminder_instances`/`push_subscriptions` и колонки
`tasks.reminders`/`users.reminderDefaultTime` создаются `synchronize` в dev).

