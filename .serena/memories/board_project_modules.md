# Board Projects: Frontend/Backend/PM module split

`client/src/pages/board/BoardProjectPage.jsx` navigation flow:
Projects list → click project → **module selection screen** (3 cards: Frontend / Backend / PM,
`renderModuleCard`) → click module → normal project detail view (tabs Обзор/Задачи/Обновления/
Таймлайн/Файлы/Портал), but **Обзор and Задачи are filtered to that module's tasks only**.

- Module = `task.execRole` (enum `frontend|backend|pm` on `boardTaskSchema` in
  `server/models/BoardProject.js`), falling back to `task.assignedTo.specialization` if execRole is unset.
- `getModuleTasks(project, moduleKey)` filters `project.tasks` directly (NOT via `getRelevantTasks` —
  that function restricts to the current user's own assigned tasks and is only meant for the
  project-list-level worker scoping; using it inside an already-open project caused an empty-modules
  regression for worker accounts, fixed once).
- New tasks created while inside a module are auto-tagged with that module's `execRole`
  (`handleSaveTask` in BoardProjectPage.jsx passes `execRole: selectedModule` on create).
- `computeStats(tasks)` now also returns `paidHours` / `unpaidHours` (sum of `amount`... no, `hours`
  field, filtered by `isPaid`) — shown on module cards and the Обзор tab.
- Обновления/Таймлайн/Файлы/Клиентский портал tabs remain **project-wide, not module-filtered** —
  those entities (ProjectUpdate, ProjectEvent, files, portal settings) have no execRole concept in
  the data model; module-scoping them would need a schema change, not done.
- Legacy data backfill: Fabrio project had 21 tasks with `execRole: null` but a `[Backend]`/`[Frontend]`/
  `[Docs]` prefix in the title (leftover from before this feature existed) — backfilled by a one-off
  script matching the prefix (`[Docs]` → `pm`).

See also `mem:board_project_task_api` for the public task-submission API that also uses `execRole`.
