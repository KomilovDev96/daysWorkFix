# Клиентский портал проекта — архитектура и план реализации

> Статус: **черновик на согласование**. Код не изменяется до подтверждения.
> Базовая сущность проекта: **`BoardProject`** (не `Project` — см. §1).

---

## 1. Что уже есть (анализ через Graphify + чтение кода)

### Сущности «проект»
В системе несколько project-подобных моделей, но карточка проекта с задачами/клиентами/файлами/комментариями построена на **`BoardProject`**:

| Модель | Назначение | Использовать для портала? |
|---|---|---|
| **`BoardProject`** | Доска проекта: `tasks[]` (embedded, со `status`/`hours`/`files[]`), `clients[]`, `deadline`, `status`, `createdBy` | **ДА — основная** |
| `Project` | Старая сущность дневника задач | нет |
| `ManagedTask` / `StartupProject` / `ProjectTemplate` | другие потоки | нет |
| `ProjectComment` | комментарии к `BoardProject` (отдельная коллекция) | переиспользуем как образец |

`BoardProject` (server/models/BoardProject.js):
```
name, description,
status: planning | active | completed | paused,
deadline, createdBy(ref User), clients[](ref User),
tasks: [ { title, description, status: todo|in_progress|done|cancelled,
           priority, hours, isPaid, customer, system, assignedTo,
           dueDate, notes, files:[{originalName,fileUrl,fileType,uploadedAt}] } ]
```

### Уже существующий портал (важно — не дублировать)
- `server/routes/portalRoutes.js` → `router.use(protect)` — **весь портал под авторизацией**.
- `portalController.js`: `getMyProjects`, `getProject`, `addComment`, `addClient`… работает по `BoardProject.clients[]`.
- Клиент = `User{role:'guest'}`, видит проект после логина на `/portal` (`CustomerPortalPage.jsx`, под `GuestLayout`).
- Расчёт прогресса уже реализован в `CustomerPortalPage.jsx`:
  `done = tasks.status==='done'`, `total = tasks.status!=='cancelled'`, `progress = done/total`, `totalHours = Σ hours`.

**Вывод:** существующий портал — это «личный кабинет гостя». Новая задача — **публичная ссылка без логина**. Это разные вещи; строим новый публичный слой, переиспользуя сущность и формулы прогресса.

### Роли (server/models/User.js)
`enum: ['admin', 'projectManager', 'worker', 'guest']`. Маппинг на ТЗ:

| Роль в ТЗ | Роль в системе | Доступ к порталу |
|---|---|---|
| Super Admin | `admin` | полный (настройки, токен, публикация) |
| Project Manager | `projectManager` | управление обновлениями своего проекта |
| Client | — (без аккаунта) | публичный просмотр по ссылке |

Гард ролей: `middleware/roleMiddleware.js` → `restrictTo('admin','projectManager')`.

### Стек и инфраструктура
- **Backend:** Express 5, Mongoose, JWT (`authMiddleware`), multer (`uploadMiddleware`, 5 МБ, `uploads/`, отдаётся на `/uploads`), Telegraf.
- **Frontend:** React + Vite, FSD (`pages/`, `shared/`, `widgets/`), AntD, `@tanstack/react-query`, Redux (auth). `apiClient` шлёт JWT из `localStorage`.
- **Telegram:** инстанс бота создаётся в `createBot()` и **не экспортируется наружу** (`module.exports = { startTelegramBot }`). Отправка: `telegram.sendMessage(chatId, text, { parse_mode:'Markdown' })`. Пользователь получает по `User.telegramId`.
- **Email: ОТСУТСТВУЕТ.** В зависимостях нет `nodemailer`/SMTP. Email-канал = новая зависимость + конфиг (см. §6, открытый вопрос).
- **Маршруты:** монтируются в `server.js`; `/api/portal` уже занят авторизованным порталом.
- **Роутинг фронта:** `/portal` (exact) уже отдан гостю под `ProtectedRoute allowedRoles={['guest']}`. Путь `/portal/:token` свободен и не конфликтует (разные паттерны).

---

## 2. Целевая архитектура (что добавляем)

```
                 ┌─────────────────────────── DaysWorkFix (внутр.) ───────────────────────────┐
 Исполнитель ──▶ │  BoardProjectPage → вкладки: Обзор│Задачи│Обновления│Таймлайн│Файлы│Портал  │
 (admin/PM)      │      └ «Опубликовать обновление» → POST /board-projects/:id/updates          │
                 └───────────────┬───────────────────────────────────────────────┬────────────┘
                                 │ пишет                                          │ триггерит
                          ProjectUpdate + ProjectEvent                     notificationService
                                 │                                          ├─ Telegram (Telegraf)
                                 ▼                                          └─ Email (nodemailer*)
 Заказчик ──▶ GET /api/public/portal/:token ──▶ ClientPortalPublicPage  ◀── ссылка из уведомления
 (без логина)     (overview + progress + timeline + updates + files)
```

Принципы:
1. **Аддитивно** — расширяем `BoardProject` поддокументом `portal`, не ломая существующий гостевой портал.
2. **Публичные эндпоинты вынесены** в отдельный роутер `/api/public/*` **без** `protect`.
3. **Переиспользуем** загрузку файлов (multer), формулы прогресса, паттерн `ProjectComment` для новых коллекций.

---

## 3. Модель данных

### 3.1 Расширение `BoardProject` — поддокумент `portal` (в том же документе)
Настройки портала логически принадлежат проекту, читаются вместе с ним → embedded.

```js
portal: {
  enabled:        { type: Boolean, default: false },
  token:          { type: String, index: true, unique: true, sparse: true }, // crypto.randomBytes(24).base64url
  passwordHash:   { type: String, default: null },   // bcrypt; null = без пароля
  manager:        { type: ObjectId, ref: 'User', default: null }, // «Ответственный менеджер»
  notifyEmail:    { type: String, default: '' },     // куда слать клиенту
  notifyTelegramId:{ type: String, default: '' },    // chatId клиента (если есть)
  manualProgress: { type: Number, default: null, min: 0, max: 100 }, // ручной override %
  createdAt:      { type: Date },
  revokedAt:      { type: Date, default: null },
}
```
- Токен генерируется **лениво** при первом «Включить портал» → существующие проекты не требуют миграции данных.
- «Отключить ссылку» = `enabled:false` (+ `revokedAt`). «Сгенерировать новую» = новый `token` (старый перестаёт работать).

### 3.2 Новая коллекция `ProjectUpdate` (по образцу `ProjectComment`)
Обновления растут неограниченно и содержат медиа → отдельная коллекция.

```js
{
  projectId:  { type: ObjectId, ref: 'BoardProject', required: true, index: true },
  authorId:   { type: ObjectId, ref: 'User', required: true },
  title:      { type: String, required: true, trim: true, maxlength: 200 },
  body:       { type: String, default: '', maxlength: 5000 },
  progress:   { type: Number, default: null, min: 0, max: 100 }, // прогресс на момент публикации
  links:      [{ label: String, url: String }],
  files:      [{ originalName, fileUrl, fileType, kind: 'image'|'video'|'file', uploadedAt }],
  isPublished:{ type: Boolean, default: true }, // черновик/публикация
  timestamps: true
}
```
Скриншоты/видео/файлы — через тот же multer (`fileUrl: uploads/...`). `kind` определяем по расширению.

### 3.3 Новая коллекция `ProjectEvent` (таймлайн, append-only)
Явный журнал событий — проще и быстрее, чем собирать таймлайн из разных источников.

```js
{
  projectId: { type: ObjectId, ref: 'BoardProject', required: true, index: true },
  type:      { type: String, enum: [
                 'project_created','stage_completed','update_published',
                 'file_added','deadline_changed','progress_changed' ], required: true },
  title:     { type: String, required: true },  // «Завершён этап Backend API»
  meta:      { type: Object, default: {} },     // { updateId, oldDeadline, percent, ... }
  actorId:   { type: ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
}
```
События пишет хелпер `logProjectEvent(projectId, type, title, meta)` при: создании проекта, публикации обновления, добавлении файла, смене дедлайна, достижении вех прогресса.

**Прогресс (единая формула, server-side):**
`done = tasks.filter(status==='done').length`, `total = tasks.filter(status!=='cancelled').length`,
`percent = portal.manualProgress ?? round(done/total*100)`, `hours = Σ tasks.hours`.

---

## 4. REST API

### 4.1 Публичные (без авторизации) — новый роутер `/api/public/portal`
Монтируется в `server.js` **до** error-handler, **без** `protect`.

| Метод | Путь | Назначение |
|---|---|---|
| `GET`  | `/api/public/portal/:token` | Обзор: проект (name/description/status/deadline/manager), прогресс (total/done/percent/hours), последние обновления, таймлайн, файлы. Уважает `enabled`; если есть пароль и нет валидного доступа → `401 { passwordRequired:true }` |
| `POST` | `/api/public/portal/:token/access` | `{ password }` → проверка bcrypt → выдаёт короткоживущий `portalJwt` (scope:'portal', exp 12ч) |
| `GET`  | `/api/public/portal/:token/updates` | Пагинация обновлений (публичные поля) |

Безопасность публичной выдачи: отдаём только whitelisted-поля (без `isPaid`, без внутренних заметок, без email/телефонов исполнителей).

### 4.2 Управление (auth: `protect` + `restrictTo('admin','projectManager')`)
Добавляем в `boardProjectRoutes.js` (или новый `projectPortalRoutes.js`):

| Метод | Путь | Назначение |
|---|---|---|
| `GET`   | `/api/board-projects/:id/portal` | текущие настройки + готовая публичная ссылка |
| `PATCH` | `/api/board-projects/:id/portal` | `enabled`, `password` (set/clear), `manager`, `notifyEmail`, `notifyTelegramId`, `manualProgress` |
| `POST`  | `/api/board-projects/:id/portal/regenerate` | новый токен |
| `GET`   | `/api/board-projects/:id/updates` | список обновлений (внутр. вид) |
| `POST`  | `/api/board-projects/:id/updates` | публикация (multipart: files[]) → ProjectUpdate + ProjectEvent + уведомления |
| `DELETE`| `/api/board-projects/:id/updates/:updateId` | удалить обновление (+ физ. файлы) |
| `GET`   | `/api/board-projects/:id/timeline` | события таймлайна |

Контроль доступа: `admin` — любой проект; `projectManager` — только где он `createdBy` или `portal.manager` (как в текущем `boardProjectController.update`).

---

## 5. UI-компоненты (фронт)

### 5.1 Карточка проекта → вкладки (рефактор `BoardProjectPage.jsx` detail-view)
Сейчас detail-вид проекта — одна таблица задач. Оборачиваем в AntD `<Tabs>`:

| Вкладка | Содержимое | Источник |
|---|---|---|
| **Обзор** | шапка + статистика (есть) + блок «Клиентский портал»-сводка | существующий код |
| **Задачи** | текущая `<Table>` задач | без изменений |
| **Обновления** | лента `ProjectUpdate` + кнопка «Опубликовать обновление» | новый `UpdatesTab` + `PublishUpdateModal` |
| **Таймлайн** | вертикальный `<Timeline>` событий | новый `TimelineTab` |
| **Файлы** | агрегированные файлы задач + обновлений | переиспользовать `FilesDrawer`-логику |
| **Клиентский портал** | вкл/выкл, ссылка+копировать, пароль, менеджер, каналы уведомлений, QR | новый `PortalSettingsTab` |

Компоненты (FSD):
- `pages/board/tabs/PublishUpdateModal.jsx` — форма: Заголовок, Описание, Прогресс %, Скриншоты/Видео/Файлы (Upload), Ссылки (динамический список).
- `pages/board/tabs/PortalSettingsTab.jsx` — Switch enabled, ссылка `\${origin}/portal/\${token}`, кнопки «Новая ссылка»/«Отключить», поле пароля, выбор менеджера, поля email/telegram клиента.

### 5.2 Публичная страница заказчика — новый `pages/portal-public/`
- Маршрут **публичный**, вне `ProtectedRoute`, в `App.jsx`:
  ```jsx
  <Route path="/portal/:token" element={<ClientPortalPublicPage />} />
  ```
  (не конфликтует с гостевым `/portal`, т.к. паттерн отличается).
- `apiClient` шлёт JWT-гостя — для публичных вызовов используем **чистый axios** (без интерсептора) или отдельный `publicApi` инстанс, чтобы 401 не редиректил на `/login`.
- Экран: шапка (лого Weeko + название проекта, статус, дедлайн, менеджер) → блок прогресса (45 задач / 31 выполнена / 69% / часы) → лента обновлений (медиа-галерея) → вертикальный таймлайн → файлы. Если `passwordRequired` → форма ввода пароля.

---

## 6. Уведомления

### Telegram (есть инфраструктура, нужен мост)
Проблема: инстанс бота не экспортируется. Решение — минимально инвазивно:
- В `telegramBot.js` сохранить module-level ссылку на `bot` и экспортировать `notifyTelegram(telegramId, text)`:
  ```js
  let botRef = null;            // выставляется в startTelegramBot()
  async function notifyTelegram(tgId, text) {
    if (!botRef || !tgId) return false;
    try { await botRef.telegram.sendMessage(String(tgId), text, { parse_mode:'Markdown' }); return true; }
    catch (e) { console.error('notifyTelegram:', e.message); return false; }
  }
  module.exports = { startTelegramBot, notifyTelegram };
  ```
- Кому слать: `portal.notifyTelegramId`, а также `project.clients[].telegramId` (если клиент — гость с привязанным TG).

### Email (инфраструктуры НЕТ — отложено в фазу 2)
**Решение: на старте НЕ делаем.** `notificationService` имеет канал `email`, но он отключён (no-op + лог). В фазу 2: `nodemailer` + env `SMTP_HOST/PORT/USER/PASS/MAIL_FROM` + `sendEmail(to, subject, html)`. Никакого рефактора при включении — только реализация заглушки.

### Сервис `services/notificationService.js`
```js
notifyProjectUpdate(project, update) {
  const link = `${process.env.APP_PUBLIC_URL}/portal/${project.portal.token}`;
  const text = `Проект: ${project.name}\n\nНовое обновление:\n"${update.title}"\n\nТекущий прогресс: ${pct}%\n\nОткрыть портал: ${link}`;
  // → notifyTelegram(...) и/или sendEmail(...)
}
```
Нужен новый env **`APP_PUBLIC_URL`** (напр. `https://daysworkfix.com`) для ссылок в письмах/сообщениях.

---

## 7. Безопасность
- **Токен:** `crypto.randomBytes(24).toString('base64url')` (~32 симв., 192 бита) — встроенный модуль, без зависимостей. Уникальность через unique-индекс + повтор при коллизии.
- **Пароль портала:** bcrypt (уже есть `bcryptjs`), хранится `passwordHash`. Доступ → короткоживущий `portalJwt` (scope ограничен токеном).
- **Отзыв:** `enabled:false` либо regenerate мгновенно инвалидирует ссылку.
- **Утечки данных:** публичный сериализатор отдаёт только разрешённые поля; `isPaid`, внутренние заметки, контакты исполнителей — скрыты (в текущем гостевом портале уже есть `.select('-tasks.isPaid')`).
- **Rate-limit** на `/access` (перебор пароля) — желательно (express-rate-limit, фаза 2).

---

## 8. План миграции
1. **Схема `BoardProject`** — аддитивна (`portal` с дефолтами). Существующие документы валидны без миграции; токен создаётся лениво при включении портала.
2. **Новые коллекции** `ProjectUpdate`, `ProjectEvent` — создаются Mongo автоматически.
3. **Бэкфилл (опц., одноразовый скрипт `server/scripts/backfillPortalEvents.js`):** для существующих проектов добавить событие `project_created` в таймлайн (по `createdAt`). Не обязателен.
4. **Env-переменные (добавить в `.env` и DEPLOY.md):**
   `APP_PUBLIC_URL`, и (если email) `SMTP_HOST/PORT/USER/PASS/MAIL_FROM`.
5. **Зависимости:** `nodemailer` (только при выборе email-канала). Telegram/crypto/bcrypt — уже есть.
6. **Прод:** изменения совместимы назад; деплой обычным `pm2 reload`. Отдельных шагов БД нет.

---

## 9. Этапы реализации (предлагаемый порядок)

**Фаза 1 — Бэкенд-ядро**
- [ ] `BoardProject.portal` поддокумент + методы генерации токена.
- [ ] Модели `ProjectUpdate`, `ProjectEvent` + хелпер `logProjectEvent`.
- [ ] Контроллер `portalPublicController` + роутер `/api/public/portal`.
- [ ] Расширение управления в `boardProjectController`/новый `projectPortalController` + роуты (portal settings, regenerate, updates CRUD, timeline).

**Фаза 2 — Уведомления**
- [ ] `notifyTelegram` экспорт из бота + `notificationService`.
- [ ] (реш.) email через nodemailer.
- [ ] env `APP_PUBLIC_URL` (+ SMTP).

**Фаза 3 — Внутренний UI**
- [ ] Вкладки в `BoardProjectPage` (Обзор/Задачи/Обновления/Таймлайн/Файлы/Портал).
- [ ] `PublishUpdateModal`, `UpdatesTab`, `TimelineTab`, `PortalSettingsTab`.

**Фаза 4 — Публичный UI**
- [ ] `publicApi` инстанс (без auth-редиректа).
- [ ] `ClientPortalPublicPage` + публичный роут `/portal/:token` + форма пароля.

**Фаза 5 — Полировка**
- [ ] QR-код ссылки, rate-limit на `/access`, бэкфилл-скрипт, обновить README/DEPLOY.

---

## 10. Зафиксированные решения (согласовано)
1. **Канал уведомлений: только Telegram на старте.** Email (`nodemailer` + SMTP) — отдельная фаза 2, не делаем сейчас. `notificationService` проектируется с pluggable-каналами, чтобы email добавился без рефактора.
2. **Получатель уведомлений клиента: оба источника.** Шлём и на ручные поля портала (`portal.notifyTelegramId`/`notifyEmail`), и привязанным `guest`-клиентам из `clients[]` (по их `telegramId`). Дедупликация по chatId.
3. **Пароль портала: опциональный.** По умолчанию ссылка открыта; пароль включается per-project через настройки.
4. **«Ответственный менеджер»:** поле `portal.manager` (ref User) с фолбэком на `createdBy`, если не задано.
</content>
