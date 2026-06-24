# Graph Report - .  (2026-06-24)

## Corpus Check
- 123 files · ~87,739 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 749 nodes · 1052 edges · 63 communities (54 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.8)
- Token cost: 70,233 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_AI Assistant Backend|AI Assistant Backend]]
- [[_COMMUNITY_Report Generation & AI Insights|Report Generation & AI Insights]]
- [[_COMMUNITY_Client Dependencies (React Stack)|Client Dependencies (React Stack)]]
- [[_COMMUNITY_Task & Project Templates|Task & Project Templates]]
- [[_COMMUNITY_Telegram Bot Core|Telegram Bot Core]]
- [[_COMMUNITY_Authentication & Users|Authentication & Users]]
- [[_COMMUNITY_Manager Tasks UI (KanbanGantt)|Manager Tasks UI (Kanban/Gantt)]]
- [[_COMMUNITY_Server Dependencies (ExpressMongo)|Server Dependencies (Express/Mongo)]]
- [[_COMMUNITY_App Shell & Routing|App Shell & Routing]]
- [[_COMMUNITY_Managed Tasks Backend|Managed Tasks Backend]]
- [[_COMMUNITY_Deployment & Docker Stack|Deployment & Docker Stack]]
- [[_COMMUNITY_Server Bootstrap & DB Connection|Server Bootstrap & DB Connection]]
- [[_COMMUNITY_File Upload & Route Wiring|File Upload & Route Wiring]]
- [[_COMMUNITY_Reports Page & Task CRUD UI|Reports Page & Task CRUD UI]]
- [[_COMMUNITY_Manager Work Report UI|Manager Work Report UI]]
- [[_COMMUNITY_API Client & Dashboard Pages|API Client & Dashboard Pages]]
- [[_COMMUNITY_Reminders Backend|Reminders Backend]]
- [[_COMMUNITY_Board Projects Backend|Board Projects Backend]]
- [[_COMMUNITY_Customer Portal Backend|Customer Portal Backend]]
- [[_COMMUNITY_Startup Projects Backend|Startup Projects Backend]]
- [[_COMMUNITY_Excel Report Service|Excel Report Service]]
- [[_COMMUNITY_Admin Analytics & Task Files API|Admin Analytics & Task Files API]]
- [[_COMMUNITY_Board Project UI|Board Project UI]]
- [[_COMMUNITY_Auth State & Protected Layout|Auth State & Protected Layout]]
- [[_COMMUNITY_Role Guard & Error Util|Role Guard & Error Util]]
- [[_COMMUNITY_Telegram Draft State Maps|Telegram Draft State Maps]]
- [[_COMMUNITY_Task Panel & Export UI|Task Panel & Export UI]]
- [[_COMMUNITY_Day Log Backend|Day Log Backend]]
- [[_COMMUNITY_Auth Middleware & Report Routes|Auth Middleware & Report Routes]]
- [[_COMMUNITY_Team Context Service|Team Context Service]]
- [[_COMMUNITY_Task Comments UI|Task Comments UI]]
- [[_COMMUNITY_File Access Controller|File Access Controller]]
- [[_COMMUNITY_Ollama LLM Service|Ollama LLM Service]]
- [[_COMMUNITY_App Settings Backend|App Settings Backend]]
- [[_COMMUNITY_Project Controller|Project Controller]]
- [[_COMMUNITY_Telegram Draft Keyboards|Telegram Draft Keyboards]]
- [[_COMMUNITY_React Error Boundary|React Error Boundary]]
- [[_COMMUNITY_Analytics Page UI|Analytics Page UI]]
- [[_COMMUNITY_Customer Portal UI|Customer Portal UI]]
- [[_COMMUNITY_DB Inspection Script|DB Inspection Script]]
- [[_COMMUNITY_Calendar View UI|Calendar View UI]]
- [[_COMMUNITY_Table View UI|Table View UI]]
- [[_COMMUNITY_AI Assistant UI|AI Assistant UI]]
- [[_COMMUNITY_Task Model|Task Model]]
- [[_COMMUNITY_DaysWorkFix Branding|DaysWorkFix Branding]]
- [[_COMMUNITY_Assistant Routes|Assistant Routes]]
- [[_COMMUNITY_Project Routes|Project Routes]]
- [[_COMMUNITY_Day Log Model|Day Log Model]]
- [[_COMMUNITY_Task File Model|Task File Model]]
- [[_COMMUNITY_Telegram Task Saving|Telegram Task Saving]]
- [[_COMMUNITY_Settings Page UI|Settings Page UI]]
- [[_COMMUNITY_Telegram Draft Model|Telegram Draft Model]]
- [[_COMMUNITY_Telegram Bot Startup|Telegram Bot Startup]]
- [[_COMMUNITY_Telegram Reminders & Summary|Telegram Reminders & Summary]]
- [[_COMMUNITY_Startup Page UI|Startup Page UI]]
- [[_COMMUNITY_Uploaded Screenshots|Uploaded Screenshots]]
- [[_COMMUNITY_React & Vite Logos|React & Vite Logos]]
- [[_COMMUNITY_Weeko Brand Logos|Weeko Brand Logos]]
- [[_COMMUNITY_Telegram Unpaid Tasks|Telegram Unpaid Tasks]]
- [[_COMMUNITY_Telegram Reminder Firing|Telegram Reminder Firing]]

## God Nodes (most connected - your core abstractions)
1. `apiClient` - 19 edges
2. `ReportsPage()` - 9 edges
3. `advanceDraft()` - 9 edges
4. `Docker Compose multi-service stack` - 8 edges
5. `addComment()` - 7 edges
6. `ErrorBoundary` - 7 edges
7. `ManagerSelfTaskDrawer()` - 6 edges
8. `fetchTasks()` - 6 edges
9. `updateTask()` - 6 edges
10. `getBucketMeta()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `pm2 reload daysworkfix-server` --semantically_similar_to--> `api service (server + Telegram bot)`  [INFERRED] [semantically similar]
  .github/workflows/deploy.yml → docker-compose.yml
- `Deploy to Production (GitHub Actions workflow)` --semantically_similar_to--> `Deploy Guide (Docker Compose deployment)`  [INFERRED] [semantically similar]
  .github/workflows/deploy.yml → DEPLOY.md
- `Client env config (Vite VITE_API_URL)` --semantically_similar_to--> `Server env config (MERN stack env)`  [INFERRED] [semantically similar]
  client/README.md → server/README.md
- `Deploy health checks (API + Ollama)` --conceptually_related_to--> `ollama service (LLM runtime)`  [INFERRED]
  .github/workflows/deploy.yml → docker-compose.yml
- `Deploy Guide (Docker Compose deployment)` --references--> `Docker Compose multi-service stack`  [EXTRACTED]
  DEPLOY.md → docker-compose.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **All Docker Compose services on the shared app network** — docker_compose_service_mongo, docker_compose_service_ollama, docker_compose_service_ollama_init, docker_compose_service_api, docker_compose_service_web, docker_compose_service_caddy [EXTRACTED 1.00]
- **Production deploy flow (pull, build, migrate, reload, health-check)** — workflows_deploy_ssh_deploy_step, workflows_deploy_pm2_reload, workflows_deploy_health_checks [EXTRACTED 1.00]

## Communities (63 total, 9 thin omitted)

### Community 0 - "AI Assistant Backend"
Cohesion: 0.06
Nodes (35): addDays(), AppError, AssistantKnowledge, buildAuthErrorIfNeeded(), buildProjectContext(), catchAsync, DayLog, extractChatCompletionText() (+27 more)

### Community 1 - "Report Generation & AI Insights"
Cohesion: 0.07
Nodes (43): AiInsight, AppError, buildAiPrompt(), buildAnalyticsData(), buildAuthErrorIfNeeded(), buildEmptyBucket(), buildFallbackInsight(), buildGroupedStats() (+35 more)

### Community 2 - "Client Dependencies (React Stack)"
Cohesion: 0.05
Nodes (39): dependencies, @ant-design/icons, antd, axios, dayjs, echarts, echarts-for-react, lodash (+31 more)

### Community 3 - "Task & Project Templates"
Cohesion: 0.06
Nodes (27): AppError, catchAsync, Project, ProjectTemplate, Task, AppError, catchAsync, DayLog (+19 more)

### Community 4 - "Telegram Bot Core"
Cohesion: 0.06
Nodes (18): AssistantKnowledge, { buildTeamContext }, crypto, DayLog, fs, ollamaService, path, pendingReminders (+10 more)

### Community 5 - "Authentication & Users"
Cohesion: 0.07
Nodes (22): AppError, catchAsync, createSendToken(), jwt, signToken(), User, bcrypt, mongoose (+14 more)

### Community 6 - "Manager Tasks UI (Kanban/Gantt)"
Cohesion: 0.09
Nodes (18): fetchTasks(), updateTask(), API_BASE, KANBAN_STATUSES, ManagerSelfTasksSection(), ManagerTasksPage(), PROJECT_STATUS_COLOR, PROJECT_STATUS_LABEL (+10 more)

### Community 7 - "Server Dependencies (Express/Mongo)"
Cohesion: 0.08
Nodes (24): author, dependencies, bcryptjs, cors, dotenv, exceljs, express, jsonwebtoken (+16 more)

### Community 8 - "App Shell & Routing"
Cohesion: 0.12
Nodes (13): AIGuidePage(), SECTIONS, App(), CustomerReportPage(), DashboardPage(), DayLogDetailsPage(), ProjectReportPage(), GuestLayout() (+5 more)

### Community 9 - "Managed Tasks Backend"
Cohesion: 0.10
Nodes (15): AppError, BoardProject, catchAsync, ExcelJS, ManagedTask, POPULATE_OPTS, SavedClient, User (+7 more)

### Community 10 - "Deployment & Docker Stack"
Cohesion: 0.15
Nodes (19): Client HTML entry (root div + main.jsx), Caddy auto-SSL via Let's Encrypt, Deploy Guide (Docker Compose deployment), One-time Ollama model pull (qwen2.5:3b), Volume persistence across redeploys, api service (server + Telegram bot), caddy service (reverse proxy + SSL), mongo service (MongoDB 7) (+11 more)

### Community 11 - "Server Bootstrap & DB Connection"
Cohesion: 0.11
Nodes (13): dotenv, mongoose, AppError, app, connectDB, cors, dotenv, errorHandler (+5 more)

### Community 12 - "File Upload & Route Wiring"
Cohesion: 0.11
Nodes (15): AppError, multer, path, storage, upload, ctrl, express, protect (+7 more)

### Community 13 - "Reports Page & Task CRUD UI"
Cohesion: 0.17
Nodes (14): createSavedClient(), createTask(), createTaskProject(), deleteSavedClient(), deleteTask(), DEFAULT_COLS, EXCEL_COLUMNS, KIND_LABEL (+6 more)

### Community 14 - "Manager Work Report UI"
Cohesion: 0.14
Nodes (11): fetchAvailability(), fetchManagerStats(), fetchWorkers(), AvailabilityDrawer(), ManagerWorkReportPage(), MyReportTab(), STATUS_COLOR, STATUS_LABEL (+3 more)

### Community 15 - "API Client & Dashboard Pages"
Cohesion: 0.23
Nodes (6): apiClient, BASE, DashboardCards(), LoginPage(), RemindersPage(), STATUS_LABEL

### Community 16 - "Reminders Backend"
Cohesion: 0.14
Nodes (10): AppError, catchAsync, PRIVILEGED, Reminder, mongoose, reminderSchema, express, protect (+2 more)

### Community 17 - "Board Projects Backend"
Cohesion: 0.15
Nodes (11): AppError, BoardProject, catchAsync, ExcelJS, fs, path, PRIORITY_LABELS, STATUS_LABELS (+3 more)

### Community 18 - "Customer Portal Backend"
Cohesion: 0.15
Nodes (10): AppError, BoardProject, catchAsync, ProjectComment, mongoose, projectCommentSchema, ctrl, express (+2 more)

### Community 19 - "Startup Projects Backend"
Cohesion: 0.15
Nodes (10): AppError, catchAsync, StartupProject, mongoose, StartupProject, startupProjectSchema, ctrl, express (+2 more)

### Community 20 - "Excel Report Service"
Cohesion: 0.24
Nodes (11): ALL_GENERAL_COLUMNS, createBucketsSheet(), ExcelJS, generateAnalyticsReport(), generateGeneralReport(), generateReport(), KIND_LABEL_RU, PAYMENT_LABEL_RU (+3 more)

### Community 21 - "Admin Analytics & Task Files API"
Cohesion: 0.26
Nodes (8): AdminAnalyticsPage(), deleteTaskFile(), exportMonthlyXls(), fetchAdminAnalytics(), fetchSavedClients(), fetchTaskFiles(), uploadTaskFile(), ManagerSelfTaskDrawer()

### Community 22 - "Board Project UI"
Cohesion: 0.18
Nodes (5): API_BASE, BoardProjectPage(), PROJECT_STATUS, TASK_PRIORITY, TASK_STATUS

### Community 23 - "Auth State & Protected Layout"
Cohesion: 0.22
Nodes (7): ProtectedRoute(), authSlice, initialState, selectIsAuthenticated(), buildMenu(), MainLayout(), ROLE_LABEL

### Community 24 - "Role Guard & Error Util"
Cohesion: 0.18
Nodes (7): AppError, ctrl, express, protect, restrictTo, router, AppError

### Community 26 - "Task Panel & Export UI"
Cohesion: 0.24
Nodes (5): exportMyTasks(), fetchTaskProjects(), STATUS_LABEL, TaskPanelPage(), ExportTasksButton()

### Community 27 - "Day Log Backend"
Cohesion: 0.20
Nodes (7): AppError, catchAsync, DayLog, express, logController, protect, router

### Community 28 - "Auth Middleware & Report Routes"
Cohesion: 0.20
Nodes (8): AppError, catchAsync, jwt, User, express, protect, reportController, router

### Community 29 - "Team Context Service"
Cohesion: 0.22
Nodes (8): managedTaskSchema, mongoose, buildTeamContext(), DayLog, ManagedTask, Task, todayRange(), User

### Community 30 - "Task Comments UI"
Cohesion: 0.31
Nodes (7): addComment(), deleteComment(), fetchComments(), ROLE_COLOR, ROLE_LABEL, STATUS_COLOR, TaskCommentsDrawer()

### Community 31 - "File Access Controller"
Cohesion: 0.22
Nodes (7): AppError, catchAsync, DayLog, ManagedTask, PRIVILEGED_ROLES, Task, TaskFile

### Community 32 - "Ollama LLM Service"
Cohesion: 0.33
Nodes (7): answerQuestion(), buildKnowledgeContext(), callOllama(), OLLAMA_URL, parseReminderMessage(), parseTaskMessage(), ROLE_HINTS

### Community 33 - "App Settings Backend"
Cohesion: 0.25
Nodes (5): AppSettings, catchAsync, appSettingsSchema, mongoose, permissionsBlock

### Community 34 - "Project Controller"
Cohesion: 0.29
Nodes (6): AppError, catchAsync, DayLog, Project, Task, TaskFile

### Community 35 - "Telegram Draft Keyboards"
Cohesion: 0.29
Nodes (7): advanceDraft(), buildCustomerPromptKeyboard(), buildDatePromptKeyboard(), buildDraftKeyboard(), buildPhotoPromptKeyboard(), buildProjectPromptKeyboard(), formatPreview()

### Community 37 - "Analytics Page UI"
Cohesion: 0.40
Nodes (5): AnalyticsPage(), DEFAULT_RANGE, formatWeekLabel(), GRANULARITY_LABELS, GRANULARITY_OPTIONS

### Community 38 - "Customer Portal UI"
Cohesion: 0.33
Nodes (4): CustomerPortalPage(), ROLE_LABEL, STATUS_LABELS, TASK_STATUS

### Community 39 - "DB Inspection Script"
Cohesion: 0.33
Nodes (5): DayLog, mongoose, path, Task, User

### Community 40 - "Calendar View UI"
Cohesion: 0.33
Nodes (4): CalendarView(), STATUS_COLOR, STATUS_LABEL, TYPE_COLOR

### Community 41 - "Table View UI"
Cohesion: 0.33
Nodes (5): STATUS_LABEL, STATUS_TAG, TableView(), TYPE_COLOR, TYPE_LABEL

### Community 42 - "AI Assistant UI"
Cohesion: 0.40
Nodes (4): AssistantPage(), INITIAL_RANGE, markdownComponents, QUICK_QUESTIONS

### Community 43 - "Task Model"
Cohesion: 0.40
Nodes (4): DayLog, mongoose, Task, taskSchema

### Community 44 - "DaysWorkFix Branding"
Cohesion: 0.80
Nodes (5): DaysWorkFix Favicon Icon, Sun and Checkmark Visual Motif, DaysWorkFix Brand, DaysWorkFix Logo Lockup, Green-to-Blue Gradient Style

### Community 45 - "Assistant Routes"
Cohesion: 0.40
Nodes (4): assistantController, express, protect, router

### Community 46 - "Project Routes"
Cohesion: 0.40
Nodes (4): express, projectController, protect, router

### Community 47 - "Day Log Model"
Cohesion: 0.50
Nodes (3): DayLog, dayLogSchema, mongoose

### Community 48 - "Task File Model"
Cohesion: 0.50
Nodes (3): mongoose, TaskFile, taskFileSchema

### Community 49 - "Telegram Task Saving"
Cohesion: 0.50
Nodes (4): ensureUserProject(), generateShortCode(), resolveExecutor(), saveTask()

### Community 52 - "Telegram Bot Startup"
Cohesion: 0.67
Nodes (3): createBot(), loadDraftsFromDB(), startTelegramBot()

### Community 53 - "Telegram Reminders & Summary"
Cohesion: 0.67
Nodes (3): getTasksFor(), runReminderTick(), sendTodaySummary()

### Community 55 - "Uploaded Screenshots"
Cohesion: 1.00
Nodes (3): Smart Space User Profile Page Screenshot (Очилов Азизбек), Smart Space Login Page Screenshot (Добро пожаловать), GitHub Desktop Branch List Screenshot (hr-crm/hr-page highlighted)

## Knowledge Gaps
- **377 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+372 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PendingDrafts` connect `Telegram Draft State Maps` to `Telegram Bot Core`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `UserActiveDraft` connect `Telegram Draft State Maps` to `Telegram Bot Core`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `apiClient` connect `API Client & Dashboard Pages` to `Analytics Page UI`, `Customer Portal UI`, `App Shell & Routing`, `AI Assistant UI`, `Reports Page & Task CRUD UI`, `Settings Page UI`, `Admin Analytics & Task Files API`, `Board Project UI`, `Auth State & Protected Layout`, `Startup Page UI`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _380 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AI Assistant Backend` be split into smaller, more focused modules?**
  _Cohesion score 0.05782312925170068 - nodes in this community are weakly interconnected._
- **Should `Report Generation & AI Insights` be split into smaller, more focused modules?**
  _Cohesion score 0.0700354609929078 - nodes in this community are weakly interconnected._
- **Should `Client Dependencies (React Stack)` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._