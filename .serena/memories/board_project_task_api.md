# Public task-submission API (per-project token, no login)

Lets a frontend/backend/pm contributor POST completed tasks (with price) into a specific
BoardProject module without an app account — modeled directly on the existing client-portal
token pattern (`portal.token` / `generateUniquePortalToken`).

## Backend
- Model: `BoardProject.taskApi` sub-schema (`server/models/BoardProject.js`) —
  `{ enabled, token, createdAt, revokedAt }`, partial-unique index on `taskApi.token`.
- Admin-side management (auth required, `manage = restrictTo('admin','projectManager','worker')`
  + ownership check via `createdBy` in `loadManageable`):
  `server/controllers/projectTaskApiController.js` — `getTaskApi` / `updateTaskApi` (enable toggle,
  auto-generates token on first enable) / `regenerateToken`. Routes in `boardProjectRoutes.js`
  under `/:id/task-api*`.
- Public submission (NO auth, mounted at `/api/public` in `server.js`):
  `server/controllers/publicTaskApiController.js` + `server/routes/publicTaskApiRoutes.js` —
  `POST /api/public/task-api/:token/tasks`.
  - Body: single task JSON `{title, execRole, hours, amount, ...}`, OR batch
    `{tasks: [...]}` / bare array `[...]` (max 100), OR `multipart/form-data` with a `files` field
    (up to 10 files, reuses `middleware/uploadMiddleware.js`) — multipart only supports a single
    task per request, not batch. Route uses a `maybeUpload` wrapper that only invokes multer when
    `req.is('multipart/form-data')`, so JSON requests bypass it untouched.
  - `execRole` is REQUIRED (frontend/backend/pm) — this is what routes the task into the right
    module (see `mem:board_project_modules`). `amount` = price field. Tasks are created with
    `status: 'done'` by default (can be overridden).
  - Rate limited 30 req/min per (IP, token) via `middleware/rateLimit.js`.
  - Logs a `task_submitted_api` event to the project timeline (`ProjectEvent` — had to add this
    value to the model's `EVENT_TYPES` enum, `logProjectEvent` silently no-ops on validation
    failure otherwise).

## Frontend
- `TaskApiDrawer` component in `BoardProjectPage.jsx` — enable/disable switch, copyable endpoint
  URL (built client-side as `${API_BASE}/api/public/task-api/${token}/tasks}`, not from a backend
  `link` field — matches how `copyPortalLink` already works), regenerate button, and ready-to-copy
  curl examples per module + a bulk example + a multipart/file-upload example.
- Opened via an "API для задач" button on the module-selection screen, visible to admin OR the
  project's creator (`String(currentProject.createdBy._id) === String(user._id)`) — not
  admin-only, since workers commonly create their own projects (e.g. Fabrio was created by a
  worker account).

Gotcha hit while testing via curl in this environment: writing a generated JWT to a file with
plain shell redirection captured dotenv's stdout banner line too, corrupting the Authorization
header (raw newline) and producing a content-less 400. Fix: `tail -1` the file before using it.
