# Graph Report - .  (2026-08-24)

## Corpus Check
- 42 files · ~103,680 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 954 nodes · 1226 edges · 87 communities (75 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.81)
- Token cost: 100,581 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_AI Assistant Controller|AI Assistant Controller]]
- [[_COMMUNITY_Reports & Analytics Controller|Reports & Analytics Controller]]
- [[_COMMUNITY_Client Dependencies|Client Dependencies]]
- [[_COMMUNITY_Telegram Bot Core|Telegram Bot Core]]
- [[_COMMUNITY_Auth Controller|Auth Controller]]
- [[_COMMUNITY_Fabrio Public Task Import|Fabrio Public Task Import]]
- [[_COMMUNITY_Manager Tasks Page|Manager Tasks Page]]
- [[_COMMUNITY_Server Dependencies|Server Dependencies]]
- [[_COMMUNITY_Board Project Page (Frontend, Modules API)|Board Project Page (Frontend, Modules API)]]
- [[_COMMUNITY_Managed Task Controller|Managed Task Controller]]
- [[_COMMUNITY_Client Portal Admin Controller|Client Portal Admin Controller]]
- [[_COMMUNITY_Dashboard & API Client|Dashboard & API Client]]
- [[_COMMUNITY_Public Client Portal Controller|Public Client Portal Controller]]
- [[_COMMUNITY_Reports Page & Task API|Reports Page & Task API]]
- [[_COMMUNITY_Manager Work Report|Manager Work Report]]
- [[_COMMUNITY_Project Template Controller|Project Template Controller]]
- [[_COMMUNITY_Task Controller|Task Controller]]
- [[_COMMUNITY_Reminder Controller|Reminder Controller]]
- [[_COMMUNITY_Express App Bootstrap|Express App Bootstrap]]
- [[_COMMUNITY_Board Project Controller|Board Project Controller]]
- [[_COMMUNITY_Guest Portal Controller|Guest Portal Controller]]
- [[_COMMUNITY_Startup Project Controller|Startup Project Controller]]
- [[_COMMUNITY_Auth Frontend (LoginRoute Guard)|Auth Frontend (Login/Route Guard)]]
- [[_COMMUNITY_File Upload Middleware|File Upload Middleware]]
- [[_COMMUNITY_Excel Report Service|Excel Report Service]]
- [[_COMMUNITY_Admin Analytics Page|Admin Analytics Page]]
- [[_COMMUNITY_Public Client Portal Page (Frontend)|Public Client Portal Page (Frontend)]]
- [[_COMMUNITY_App Routing & Query Provider|App Routing & Query Provider]]
- [[_COMMUNITY_Legacy Project Controller|Legacy Project Controller]]
- [[_COMMUNITY_Task API Admin Controller|Task API Admin Controller]]
- [[_COMMUNITY_Public Task Submission API|Public Task Submission API]]
- [[_COMMUNITY_Client Portal Architecture Doc (Existing)|Client Portal Architecture Doc (Existing)]]
- [[_COMMUNITY_Project Event Timeline|Project Event Timeline]]
- [[_COMMUNITY_Telegram Draft State|Telegram Draft State]]
- [[_COMMUNITY_Worker Task Panel|Worker Task Panel]]
- [[_COMMUNITY_Day Log Controller|Day Log Controller]]
- [[_COMMUNITY_Docker Deploy Stack|Docker Deploy Stack]]
- [[_COMMUNITY_Client Portal Proposed Design + Fabrio Upload|Client Portal Proposed Design + Fabrio Upload]]
- [[_COMMUNITY_Auth Middleware & Assistant Routes|Auth Middleware & Assistant Routes]]
- [[_COMMUNITY_DayLog Model & DB Inspect Script|DayLog Model & DB Inspect Script]]
- [[_COMMUNITY_Managed Task Model & Team Context|Managed Task Model & Team Context]]
- [[_COMMUNITY_Project Update Model & Cleanup Script|Project Update Model & Cleanup Script]]
- [[_COMMUNITY_Board Project Routes|Board Project Routes]]
- [[_COMMUNITY_Task Comments UI|Task Comments UI]]
- [[_COMMUNITY_File Controller|File Controller]]
- [[_COMMUNITY_Notification Service (TelegramEmail)|Notification Service (Telegram/Email)]]
- [[_COMMUNITY_Ollama AI Service|Ollama AI Service]]
- [[_COMMUNITY_App Settings|App Settings]]
- [[_COMMUNITY_Role Middleware & Settings Routes|Role Middleware & Settings Routes]]
- [[_COMMUNITY_Deploy Env & Notification Rationale|Deploy Env & Notification Rationale]]
- [[_COMMUNITY_Error Handling|Error Handling]]
- [[_COMMUNITY_Telegram Draft Keyboards|Telegram Draft Keyboards]]
- [[_COMMUNITY_React Error Boundary|React Error Boundary]]
- [[_COMMUNITY_Analytics Page|Analytics Page]]
- [[_COMMUNITY_Deploy Workflow Scripts|Deploy Workflow Scripts]]
- [[_COMMUNITY_Portal Subdocument Design Rationale|Portal Subdocument Design Rationale]]
- [[_COMMUNITY_Board Project Model|Board Project Model]]
- [[_COMMUNITY_Customer Portal Page (Legacy Guest)|Customer Portal Page (Legacy Guest)]]
- [[_COMMUNITY_Project Files Tab|Project Files Tab]]
- [[_COMMUNITY_Project Updates UI|Project Updates UI]]
- [[_COMMUNITY_Task Calendar View|Task Calendar View]]
- [[_COMMUNITY_Task Table View|Task Table View]]
- [[_COMMUNITY_AI Assistant Page|AI Assistant Page]]
- [[_COMMUNITY_Timeline Cleanup Scripts|Timeline Cleanup Scripts]]
- [[_COMMUNITY_Task Model|Task Model]]
- [[_COMMUNITY_Brand Assets (LogoFavicon)|Brand Assets (Logo/Favicon)]]
- [[_COMMUNITY_Legacy Project Routes|Legacy Project Routes]]
- [[_COMMUNITY_Report Routes|Report Routes]]
- [[_COMMUNITY_MongoDB Connection Config|MongoDB Connection Config]]
- [[_COMMUNITY_Task File Model|Task File Model]]
- [[_COMMUNITY_Main App Layout|Main App Layout]]
- [[_COMMUNITY_Telegram Task Save Helpers|Telegram Task Save Helpers]]
- [[_COMMUNITY_Settings Page (Frontend)|Settings Page (Frontend)]]
- [[_COMMUNITY_AI Guide Page|AI Guide Page]]
- [[_COMMUNITY_Telegram Draft Model|Telegram Draft Model]]
- [[_COMMUNITY_README & Env Docs|README & Env Docs]]
- [[_COMMUNITY_Telegram Reminder Jobs|Telegram Reminder Jobs]]
- [[_COMMUNITY_Startup Projects Page|Startup Projects Page]]
- [[_COMMUNITY_Uploaded Task Images|Uploaded Task Images]]
- [[_COMMUNITY_Fabrio Production Plan Entities|Fabrio Production Plan Entities]]
- [[_COMMUNITY_ViteReact Assets|Vite/React Assets]]
- [[_COMMUNITY_Portal Architecture Misc Refs|Portal Architecture Misc Refs]]
- [[_COMMUNITY_Weeko Brand Assets|Weeko Brand Assets]]
- [[_COMMUNITY_Client Entry Mount|Client Entry Mount]]

## God Nodes (most connected - your core abstractions)
1. `apiClient` - 17 edges
2. `advanceDraft()` - 9 edges
3. `ReportsPage()` - 8 edges
4. `addComment()` - 7 edges
5. `Docker Compose deployment procedure` - 7 edges
6. `BoardProject model` - 7 edges
7. `ManagerSelfTaskDrawer()` - 6 edges
8. `fetchTasks()` - 6 edges
9. `updateTask()` - 6 edges
10. `ErrorBoundary` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Stage Quantity Ledger (append-only produced/defect fact log)` --semantically_similar_to--> `ProjectEvent collection / timeline (proposed, append-only)`  [INFERRED] [semantically similar]
  server/uploads/file-1786462351388-155417593.html → docs/CLIENT_PORTAL_ARCHITECTURE.md
- `Client env config (Vite VITE_API_URL)` --semantically_similar_to--> `Server env config (MERN stack env)`  [INFERRED] [semantically similar]
  client/README.md → server/README.md
- `seedKnowledge.js (native deploy path)` --semantically_similar_to--> `seedKnowledge.js (docker deploy path)`  [INFERRED] [semantically similar]
  .github/workflows/deploy.yml → DEPLOY.md
- `scripts/cleanupOrphanEvents.js` --semantically_similar_to--> `server/scripts/backfillPortalEvents.js`  [INFERRED] [semantically similar]
  .github/workflows/deploy.yml → DEPLOY.md
- `server/scripts/backfillPortalEvents.js` --semantically_similar_to--> `server/scripts/backfillPortalEvents.js`  [INFERRED] [semantically similar]
  DEPLOY.md → docs/CLIENT_PORTAL_ARCHITECTURE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **DaysWorkFix Docker Compose stack (mongo, ollama, ollama-init, api, web, caddy on shared app network)** — docker_compose_mongo, docker_compose_ollama, docker_compose_ollama_init, docker_compose_api, docker_compose_web, docker_compose_caddy [EXTRACTED 1.00]
- **Client portal update notification flow (project update -> notificationService -> notifyTelegram -> bot -> client link)** — docs_client_portal_architecture_notificationservice, docs_client_portal_architecture_notifytelegram, docs_client_portal_architecture_telegrambot, docs_client_portal_architecture_portal_subdocument, docs_client_portal_architecture_app_public_url [EXTRACTED 1.00]
- **Fabrio production tracking data model (order, plan, assignment, fact ledger, supervision)** — uploads_file_1786462351388_155417593_order, uploads_file_1786462351388_155417593_productionstageplan, uploads_file_1786462351388_155417593_productionassignment, uploads_file_1786462351388_155417593_stagequantityledger, uploads_file_1786462351388_155417593_workersupervision [EXTRACTED 1.00]

## Communities (87 total, 12 thin omitted)

### Community 0 - "AI Assistant Controller"
Cohesion: 0.06
Nodes (35): addDays(), AppError, AssistantKnowledge, buildAuthErrorIfNeeded(), buildProjectContext(), catchAsync, DayLog, extractChatCompletionText() (+27 more)

### Community 1 - "Reports & Analytics Controller"
Cohesion: 0.07
Nodes (43): AiInsight, AppError, buildAiPrompt(), buildAnalyticsData(), buildAuthErrorIfNeeded(), buildEmptyBucket(), buildFallbackInsight(), buildGroupedStats() (+35 more)

### Community 2 - "Client Dependencies"
Cohesion: 0.05
Nodes (40): dependencies, @ant-design/icons, antd, axios, dayjs, echarts, echarts-for-react, lodash (+32 more)

### Community 3 - "Telegram Bot Core"
Cohesion: 0.05
Nodes (22): AssistantKnowledge, backfillCodesIfNeeded(), buildReminderFireKeyboard(), { buildTeamContext }, crypto, DayLog, fireDueReminders(), fs (+14 more)

### Community 4 - "Auth Controller"
Cohesion: 0.07
Nodes (22): AppError, catchAsync, createSendToken(), jwt, signToken(), User, bcrypt, mongoose (+14 more)

### Community 5 - "Fabrio Public Task Import"
Cohesion: 0.07
Nodes (20): AppError, BoardProject, catchAsync, buckets, ctrl, express, limiter, rateLimit (+12 more)

### Community 6 - "Manager Tasks Page"
Cohesion: 0.09
Nodes (18): fetchTasks(), updateTask(), API_BASE, KANBAN_STATUSES, ManagerSelfTasksSection(), ManagerTasksPage(), PROJECT_STATUS_COLOR, PROJECT_STATUS_LABEL (+10 more)

### Community 7 - "Server Dependencies"
Cohesion: 0.08
Nodes (24): author, dependencies, bcryptjs, cors, dotenv, exceljs, express, jsonwebtoken (+16 more)

### Community 8 - "Board Project Page (Frontend, Modules API)"
Cohesion: 0.12
Nodes (11): API_BASE, buildTaskApiBulkCurl(), buildTaskApiFileCurl(), MODULE_META, PROJECT_STATUS, TASK_PRIORITY, TASK_STATUS, TaskApiDrawer() (+3 more)

### Community 9 - "Managed Task Controller"
Cohesion: 0.10
Nodes (15): AppError, BoardProject, catchAsync, ExcelJS, ManagedTask, POPULATE_OPTS, SavedClient, User (+7 more)

### Community 10 - "Client Portal Admin Controller"
Cohesion: 0.11
Nodes (16): AppError, bcrypt, BoardProject, buildLink(), catchAsync, { computeProgress }, fs, { generateUniquePortalToken } (+8 more)

### Community 11 - "Dashboard & API Client"
Cohesion: 0.17
Nodes (4): apiClient, BASE, DashboardCards(), STATUS_LABEL

### Community 12 - "Public Client Portal Controller"
Cohesion: 0.14
Nodes (11): AppError, bcrypt, BoardProject, catchAsync, jwt, ProjectEvent, ProjectUpdate, { publicProjectView, publicUpdate } (+3 more)

### Community 13 - "Reports Page & Task API"
Cohesion: 0.17
Nodes (14): createSavedClient(), createTask(), createTaskProject(), deleteSavedClient(), deleteTask(), DEFAULT_COLS, EXCEL_COLUMNS, KIND_LABEL (+6 more)

### Community 14 - "Manager Work Report"
Cohesion: 0.14
Nodes (10): fetchAvailability(), fetchManagerStats(), fetchWorkers(), AvailabilityDrawer(), MyReportTab(), STATUS_COLOR, STATUS_LABEL, TYPE_COLOR (+2 more)

### Community 15 - "Project Template Controller"
Cohesion: 0.12
Nodes (13): AppError, catchAsync, Project, ProjectTemplate, Task, mongoose, ProjectTemplate, projectTemplateSchema (+5 more)

### Community 16 - "Task Controller"
Cohesion: 0.13
Nodes (11): AppError, catchAsync, DayLog, PRIVILEGED_ROLES, Task, mongoose, userProjectSchema, express (+3 more)

### Community 17 - "Reminder Controller"
Cohesion: 0.14
Nodes (10): AppError, catchAsync, PRIVILEGED, Reminder, mongoose, reminderSchema, express, protect (+2 more)

### Community 18 - "Express App Bootstrap"
Cohesion: 0.14
Nodes (13): app, connectDB, cors, dotenv, errorHandler, express, morgan, path (+5 more)

### Community 19 - "Board Project Controller"
Cohesion: 0.17
Nodes (11): AppError, BoardProject, catchAsync, ExcelJS, fs, { logProjectEvent }, path, PRIORITY_LABELS (+3 more)

### Community 20 - "Guest Portal Controller"
Cohesion: 0.15
Nodes (10): AppError, BoardProject, catchAsync, ProjectComment, mongoose, projectCommentSchema, ctrl, express (+2 more)

### Community 21 - "Startup Project Controller"
Cohesion: 0.15
Nodes (10): AppError, catchAsync, StartupProject, mongoose, StartupProject, startupProjectSchema, ctrl, express (+2 more)

### Community 22 - "Auth Frontend (Login/Route Guard)"
Cohesion: 0.17
Nodes (4): authSlice, initialState, selectIsAuthenticated(), store

### Community 23 - "File Upload Middleware"
Cohesion: 0.15
Nodes (10): AppError, multer, path, storage, upload, express, fileController, protect (+2 more)

### Community 24 - "Excel Report Service"
Cohesion: 0.24
Nodes (11): ALL_GENERAL_COLUMNS, createBucketsSheet(), ExcelJS, generateAnalyticsReport(), generateGeneralReport(), generateReport(), KIND_LABEL_RU, PAYMENT_LABEL_RU (+3 more)

### Community 25 - "Admin Analytics Page"
Cohesion: 0.26
Nodes (8): AdminAnalyticsPage(), deleteTaskFile(), exportMonthlyXls(), fetchAdminAnalytics(), fetchSavedClients(), fetchTaskFiles(), uploadTaskFile(), ManagerSelfTaskDrawer()

### Community 26 - "Public Client Portal Page (Frontend)"
Cohesion: 0.20
Nodes (6): BASE, PUBLIC_API_BASE, publicApi, EVENT_ICON, STATUS, TASK_STATUS

### Community 27 - "App Routing & Query Provider"
Cohesion: 0.22
Nodes (6): App(), BoardProjectPage(), ClientPortalPublicPage(), queryClient, QueryProvider(), UsersPage()

### Community 28 - "Legacy Project Controller"
Cohesion: 0.18
Nodes (9): AppError, catchAsync, DayLog, Project, Task, TaskFile, mongoose, Project (+1 more)

### Community 29 - "Task API Admin Controller"
Cohesion: 0.22
Nodes (7): AppError, BoardProject, catchAsync, { generateUniquePortalToken }, crypto, generatePortalToken(), generateUniquePortalToken()

### Community 30 - "Public Task Submission API"
Cohesion: 0.18
Nodes (8): AppError, BoardProject, catchAsync, EXEC_ROLES, { logProjectEvent }, path, ROLE_LABELS, TASK_STATUSES

### Community 31 - "Client Portal Architecture Doc (Existing)"
Cohesion: 0.18
Nodes (11): BoardProject model, boardProjectController.js (existing access-control pattern), ManagedTask model, portalController.js (getMyProjects, getProject, addComment, addClient), server/routes/portalRoutes.js (authorized guest portal), Project model (legacy task diary entity), ProjectComment collection, ProjectTemplate model (+3 more)

### Community 32 - "Project Event Timeline"
Cohesion: 0.18
Nodes (9): EVENT_TYPES, mongoose, ProjectEvent, projectEventSchema, BoardProject, dotenv, mongoose, path (+1 more)

### Community 34 - "Worker Task Panel"
Cohesion: 0.24
Nodes (5): exportMyTasks(), fetchTaskProjects(), STATUS_LABEL, TaskPanelPage(), ExportTasksButton()

### Community 35 - "Day Log Controller"
Cohesion: 0.20
Nodes (7): AppError, catchAsync, DayLog, express, logController, protect, router

### Community 36 - "Docker Deploy Stack"
Cohesion: 0.24
Nodes (10): Caddy auto-SSL / domain setup, createAdmin.js one-off admin bootstrap script, Docker Compose deployment procedure, Volumes not recreated on update, so data persists across redeploys, api service (server, build ./server), caddy service (reverse proxy), mongo service (mongo:7), ollama service (+2 more)

### Community 37 - "Client Portal Proposed Design + Fabrio Upload"
Cohesion: 0.24
Nodes (10): ClientPortalPublicPage (proposed public no-login page), publicApi axios instance without auth interceptor (proposed), Страница «Бригады» (frontend/src/pages/workforce-supervision/), Produced facts are permanent; reassigning brigadir/plan never rewrites past history, Order Journey page (full order history), frontend/src/widgets/order-journey/ui/OrderJourneyWorkAssignments.tsx, Дашборд производства (live plan-vs-fact dashboard, 15s poll), ProductionAssignment model (worker + stage + assigned qty) (+2 more)

### Community 38 - "Auth Middleware & Assistant Routes"
Cohesion: 0.20
Nodes (8): AppError, catchAsync, jwt, User, assistantController, express, protect, router

### Community 39 - "DayLog Model & DB Inspect Script"
Cohesion: 0.20
Nodes (8): DayLog, dayLogSchema, mongoose, DayLog, mongoose, path, Task, User

### Community 40 - "Managed Task Model & Team Context"
Cohesion: 0.22
Nodes (8): managedTaskSchema, mongoose, buildTeamContext(), DayLog, ManagedTask, Task, todayRange(), User

### Community 41 - "Project Update Model & Cleanup Script"
Cohesion: 0.20
Nodes (8): mongoose, projectUpdateSchema, updateFileSchema, BoardProject, mongoose, path, ProjectEvent, ProjectUpdate

### Community 42 - "Board Project Routes"
Cohesion: 0.20
Nodes (9): ctrl, express, manage, portalCtrl, protect, restrictTo, router, taskApiCtrl (+1 more)

### Community 43 - "Task Comments UI"
Cohesion: 0.31
Nodes (7): addComment(), deleteComment(), fetchComments(), ROLE_COLOR, ROLE_LABEL, STATUS_COLOR, TaskCommentsDrawer()

### Community 44 - "File Controller"
Cohesion: 0.22
Nodes (7): AppError, catchAsync, DayLog, ManagedTask, PRIVILEGED_ROLES, Task, TaskFile

### Community 45 - "Notification Service (Telegram/Email)"
Cohesion: 0.33
Nodes (8): buildLink(), collectTelegramRecipients(), esc(), notifyProjectUpdate(), { notifyTelegram }, sendEmail(), User, notifyTelegram()

### Community 46 - "Ollama AI Service"
Cohesion: 0.33
Nodes (7): answerQuestion(), buildKnowledgeContext(), callOllama(), OLLAMA_URL, parseReminderMessage(), parseTaskMessage(), ROLE_HINTS

### Community 47 - "App Settings"
Cohesion: 0.25
Nodes (5): AppSettings, catchAsync, appSettingsSchema, mongoose, permissionsBlock

### Community 48 - "Role Middleware & Settings Routes"
Cohesion: 0.25
Nodes (6): AppError, ctrl, express, protect, restrictTo, router

### Community 49 - "Deploy Env & Notification Rationale"
Cohesion: 0.29
Nodes (7): APP_PUBLIC_URL env var, Клиентский портал проекта (публичная ссылка), APP_PUBLIC_URL env var (new, for portal links), Email channel deliberately deferred to phase 2; Telegram-only at launch, pluggable channel design, services/notificationService.js, notifyTelegram(tgId, text) exported function (proposed), telegramBot.js (createBot/startTelegramBot)

### Community 51 - "Telegram Draft Keyboards"
Cohesion: 0.29
Nodes (7): advanceDraft(), buildCustomerPromptKeyboard(), buildDatePromptKeyboard(), buildDraftKeyboard(), buildPhotoPromptKeyboard(), buildProjectPromptKeyboard(), formatPreview()

### Community 53 - "Analytics Page"
Cohesion: 0.40
Nodes (5): AnalyticsPage(), DEFAULT_RANGE, formatWeekLabel(), GRANULARITY_LABELS, GRANULARITY_OPTIONS

### Community 54 - "Deploy Workflow Scripts"
Cohesion: 0.33
Nodes (6): seedKnowledge.js (docker deploy path), fixIndexes.js migration script, Post-deploy health checks (API + Ollama), pm2 reload daysworkfix-server, seedKnowledge.js (native deploy path), Deploy to Production (GitHub Actions workflow)

### Community 55 - "Portal Subdocument Design Rationale"
Cohesion: 0.33
Nodes (6): Additive design: extend BoardProject/portal without breaking the existing guest portal, CustomerPortalPage.jsx (guest portal UI + progress calc), BoardProject.portal embedded subdocument (proposed), PortalSettingsTab.jsx (proposed), Unified progress formula (done/total, hours, manualProgress override), /api/public/portal router + portalPublicController (proposed)

### Community 56 - "Board Project Model"
Cohesion: 0.33
Nodes (5): boardProjectSchema, boardTaskSchema, mongoose, portalSchema, taskApiSchema

### Community 57 - "Customer Portal Page (Legacy Guest)"
Cohesion: 0.33
Nodes (3): ROLE_LABEL, STATUS_LABELS, TASK_STATUS

### Community 58 - "Project Files Tab"
Cohesion: 0.40
Nodes (4): API_BASE, icon(), isImage(), ProjectFilesTab()

### Community 59 - "Project Updates UI"
Cohesion: 0.40
Nodes (3): PublishUpdateModal(), API_BASE, UpdatesTab()

### Community 60 - "Task Calendar View"
Cohesion: 0.33
Nodes (4): CalendarView(), STATUS_COLOR, STATUS_LABEL, TYPE_COLOR

### Community 61 - "Task Table View"
Cohesion: 0.33
Nodes (5): STATUS_LABEL, STATUS_TAG, TableView(), TYPE_COLOR, TYPE_LABEL

### Community 62 - "AI Assistant Page"
Cohesion: 0.40
Nodes (3): INITIAL_RANGE, markdownComponents, QUICK_QUESTIONS

### Community 63 - "Timeline Cleanup Scripts"
Cohesion: 0.40
Nodes (5): server/scripts/backfillPortalEvents.js, server/scripts/backfillPortalEvents.js, logProjectEvent(projectId, type, title, meta) helper (proposed), ProjectEvent collection / timeline (proposed, append-only), scripts/cleanupOrphanEvents.js

### Community 64 - "Task Model"
Cohesion: 0.40
Nodes (4): DayLog, mongoose, Task, taskSchema

### Community 65 - "Brand Assets (Logo/Favicon)"
Cohesion: 0.80
Nodes (5): DaysWorkFix Favicon Icon, Sun and Checkmark Visual Motif, DaysWorkFix Brand, DaysWorkFix Logo Lockup, Green-to-Blue Gradient Style

### Community 66 - "Legacy Project Routes"
Cohesion: 0.40
Nodes (4): express, projectController, protect, router

### Community 67 - "Report Routes"
Cohesion: 0.40
Nodes (4): express, protect, reportController, router

### Community 69 - "Task File Model"
Cohesion: 0.50
Nodes (3): mongoose, TaskFile, taskFileSchema

### Community 70 - "Main App Layout"
Cohesion: 0.67
Nodes (3): buildMenu(), MainLayout(), ROLE_LABEL

### Community 71 - "Telegram Task Save Helpers"
Cohesion: 0.50
Nodes (4): ensureUserProject(), generateShortCode(), resolveExecutor(), saveTask()

### Community 75 - "README & Env Docs"
Cohesion: 0.67
Nodes (3): Client env config (Vite VITE_API_URL), DaysWorkFix project overview README, Server env config (MERN stack env)

### Community 76 - "Telegram Reminder Jobs"
Cohesion: 0.67
Nodes (3): getTasksFor(), runReminderTick(), sendTodaySummary()

### Community 78 - "Uploaded Task Images"
Cohesion: 1.00
Nodes (3): Smart Space User Profile Page Screenshot (Очилов Азизбек), Smart Space Login Page Screenshot (Добро пожаловать), GitHub Desktop Branch List Screenshot (hr-crm/hr-page highlighted)

### Community 79 - "Fabrio Production Plan Entities"
Cohesion: 0.67
Nodes (3): Order entity, Панель «План производства» (frontend/src/features/production-plan-edit/), ProductionStagePlan model (quantity + due date per order stage)

## Knowledge Gaps
- **495 isolated node(s):** `ROLE_LABEL`, `queryClient`, `initialState`, `authSlice`, `SECTIONS` (+490 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `store` connect `Auth Frontend (Login/Route Guard)` to `App Routing & Query Provider`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `apiClient` connect `Dashboard & API Client` to `Main App Layout`, `Settings Page (Frontend)`, `Reports Page & Task API`, `Startup Projects Page`, `Analytics Page`, `Auth Frontend (Login/Route Guard)`, `Admin Analytics Page`, `AI Assistant Page`, `Customer Portal Page (Legacy Guest)`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `buildTeamContext()` connect `Managed Task Model & Team Context` to `AI Assistant Controller`, `Telegram Bot Core`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `ROLE_LABEL`, `queryClient`, `initialState` to the rest of the system?**
  _498 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AI Assistant Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.05782312925170068 - nodes in this community are weakly interconnected._
- **Should `Reports & Analytics Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.0700354609929078 - nodes in this community are weakly interconnected._
- **Should `Client Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._