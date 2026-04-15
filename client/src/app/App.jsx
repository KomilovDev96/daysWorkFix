import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import ru_RU from 'antd/locale/ru_RU';
import { store } from './providers/store';
import { QueryProvider } from './providers/QueryProvider';
import MainLayout from './providers/MainLayout';
import ProtectedRoute from '../shared/lib/ProtectedRoute';

import LoginPage           from '../pages/login/LoginPage';
import DashboardPage       from '../pages/dashboard/DashboardPage';
import DayLogDetailsPage   from '../pages/day-log/DayLogDetailsPage';
import ReportsPage         from '../pages/reports/ReportsPage';
import AnalyticsPage       from '../pages/analytics/AnalyticsPage';
import AssistantPage       from '../pages/assistant/AssistantPage';
import UsersPage           from '../pages/users/UsersPage';
import TemplatesPage       from '../pages/templates/TemplatesPage';
import BoardProjectPage    from '../pages/board/BoardProjectPage';
import CustomerPortalPage  from '../pages/portal/CustomerPortalPage';
import GuestLayout         from './providers/GuestLayout';
import ProjectReportPage   from '../pages/project-report/ProjectReportPage';
import CustomerReportPage  from '../pages/customer-report/CustomerReportPage';
import StartupPage         from '../pages/startup/StartupPage';
import SettingsPage        from '../pages/settings/SettingsPage';

// Новые ролевые страницы
import AdminAnalyticsPage       from '../pages/admin-analytics/AdminAnalyticsPage';
import ManagerTasksPage         from '../pages/managed-tasks/ManagerTasksPage';
import WorkerTasksPage          from '../pages/my-tasks/WorkerTasksPage';
import ManagerWorkReportPage    from '../pages/manager-work-report/ManagerWorkReportPage';
import TaskPanelPage            from '../pages/task-panel/TaskPanelPage';

import './styles/index.css';
import { useSelector } from 'react-redux';

const RoleRedirect = () => {
    const user = useSelector((s) => s.auth.user);
    const dest = !user                        ? '/login'
               : user.role === 'admin'          ? '/admin-analytics'
               : user.role === 'projectManager' ? '/managed-tasks'
               : user.role === 'worker'         ? '/my-tasks'
               : '/dashboard';
    return <Navigate to={dest} replace />;
};

const App = () => (
    <Provider store={store}>
        <ConfigProvider locale={ru_RU}>
            <QueryProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />

                        {/* Гостевой портал */}
                        <Route element={<ProtectedRoute allowedRoles={['guest']} />}>
                            <Route element={<GuestLayout />}>
                                <Route path="/portal" element={<CustomerPortalPage />} />
                            </Route>
                        </Route>

                        {/* Основной раздел — все роли кроме guest */}
                        <Route element={<ProtectedRoute />}>
                            <Route element={<MainLayout />}>
                                {/* Общие */}
                                <Route path="/dashboard"      element={<DashboardPage />} />
                                <Route path="/day/:id"        element={<DayLogDetailsPage />} />
                                <Route path="/board"          element={<BoardProjectPage />} />
                                <Route path="/assistant"      element={<AssistantPage />} />

                                {/* Менеджер + воркер */}
                                <Route path="/reports"         element={<ReportsPage />} />
                                <Route path="/analytics"       element={<AnalyticsPage />} />
                                <Route path="/project-report"  element={<ProjectReportPage />} />
                                <Route path="/customer-report" element={<CustomerReportPage />} />
                                <Route path="/startup"         element={<StartupPage />} />
                                <Route path="/templates"       element={<TemplatesPage />} />

                                {/* Менеджер — задачи + отчёт */}
                                <Route element={<ProtectedRoute allowedRoles={['projectManager', 'admin']} />}>
                                    <Route path="/managed-tasks"       element={<ManagerTasksPage />} />
                                    <Route path="/manager-work-report" element={<ManagerWorkReportPage />} />
                                </Route>

                                {/* Воркер — свои задачи */}
                                <Route element={<ProtectedRoute allowedRoles={['worker']} />}>
                                    <Route path="/my-tasks" element={<WorkerTasksPage />} />
                                </Route>

                                {/* Панель задач — менеджер и воркер */}
                                <Route element={<ProtectedRoute allowedRoles={['projectManager', 'worker']} />}>
                                    <Route path="/task-panel" element={<TaskPanelPage />} />
                                </Route>

                                {/* Только Admin */}
                                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                                    <Route path="/admin-analytics" element={<AdminAnalyticsPage />} />
                                    <Route path="/users"           element={<UsersPage />} />
                                    <Route path="/settings"        element={<SettingsPage />} />
                                </Route>

                                <Route path="/" element={<RoleRedirect />} />
                            </Route>
                        </Route>

                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </BrowserRouter>
            </QueryProvider>
        </ConfigProvider>
    </Provider>
);

export default App;
