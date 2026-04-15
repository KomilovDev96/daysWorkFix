import React, { useState } from 'react';
import { Layout, Menu, Button, theme, Spin } from 'antd';
import {
    MenuFoldOutlined, MenuUnfoldOutlined,
    DashboardOutlined, LineChartOutlined, BarChartOutlined,
    MessageOutlined, TeamOutlined, LogoutOutlined,
    AppstoreOutlined, FolderOutlined, UserOutlined,
    RocketOutlined, SettingOutlined, ProjectOutlined,
    CheckSquareOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { logout } from '../../entities/user/model/authSlice';
import apiClient from '../../shared/api/apiClient';

const { Header, Sider, Content } = Layout;

const ROLE_LABEL = {
    admin:          'Администратор',
    projectManager: 'Менеджер',
    worker:         'Сотрудник',
};

// ── Строит список пунктов меню с учётом прав ─────────────────────────────────
const buildMenu = (role, perms) => {
    const can = (key) => !perms || perms[key] !== false;

    if (role === 'admin') {
        return [
            { key: '/admin-analytics', icon: <BarChartOutlined />,    label: 'Аналитика задач' },
            { key: '/users',           icon: <TeamOutlined />,         label: 'Пользователи' },
            { key: '/settings',        icon: <SettingOutlined />,      label: 'Настройки' },
        ];
    }

    if (role === 'projectManager') {
        const items = [
            { key: '/managed-tasks',       icon: <CheckSquareOutlined />, label: 'Задачи' },
            { key: '/manager-work-report', icon: <FileTextOutlined />,    label: 'Мой отчёт' },
        ];

        if (can('canViewDashboard'))
            items.push({ key: '/task-panel', icon: <DashboardOutlined />, label: 'Панель' });

        // Подменю отчётов — показываем только если хоть один пункт включён
        const reportChildren = [];
        if (can('canViewReports'))        reportChildren.push({ key: '/reports',         label: 'Общий отчёт' });
        if (can('canViewProjectReport'))  reportChildren.push({ key: '/project-report',  icon: <FolderOutlined />, label: 'По проекту' });
        if (can('canViewCustomerReport')) reportChildren.push({ key: '/customer-report', icon: <UserOutlined />,   label: 'По заказчику' });
        if (reportChildren.length) {
            items.push({ key: 'reports-group', icon: <BarChartOutlined />, label: 'Отчёты', children: reportChildren });
        }

        if (can('canViewAnalytics'))  items.push({ key: '/analytics', icon: <LineChartOutlined />, label: 'Аналитика' });
        if (can('canViewBoard'))      items.push({ key: '/board',     icon: <ProjectOutlined />,   label: 'Мои проекты' });
        if (can('canViewStartup'))    items.push({ key: '/startup',   icon: <RocketOutlined />,    label: 'Стартапы' });
        if (can('canViewTemplates'))  items.push({ key: '/templates', icon: <AppstoreOutlined />,  label: 'Шаблоны' });
        if (can('canViewAssistant'))  items.push({ key: '/assistant', icon: <MessageOutlined />,   label: 'AI Ассистент' });

        return items;
    }

    // worker
    const items = [
        { key: '/my-tasks', icon: <CheckSquareOutlined />, label: 'Мои задачи' },
    ];

    if (can('canViewDashboard'))
        items.push({ key: '/task-panel', icon: <DashboardOutlined />, label: 'Панель' });

    const reportChildren = [];
    if (can('canViewReports'))        reportChildren.push({ key: '/reports',         label: 'Общий отчёт' });
    if (can('canViewProjectReport'))  reportChildren.push({ key: '/project-report',  icon: <FolderOutlined />, label: 'По проекту' });
    if (can('canViewCustomerReport')) reportChildren.push({ key: '/customer-report', icon: <UserOutlined />,   label: 'По заказчику' });
    if (reportChildren.length) {
        items.push({ key: 'reports-group', icon: <BarChartOutlined />, label: 'Отчёты', children: reportChildren });
    }

    if (can('canViewAnalytics'))  items.push({ key: '/analytics', icon: <LineChartOutlined />, label: 'Аналитика' });
    if (can('canViewBoard'))      items.push({ key: '/board',     icon: <ProjectOutlined />,   label: 'Мои проекты' });
    if (can('canViewStartup'))    items.push({ key: '/startup',   icon: <RocketOutlined />,    label: 'Стартапы' });
    if (can('canViewTemplates'))  items.push({ key: '/templates', icon: <AppstoreOutlined />,  label: 'Шаблоны' });
    if (can('canViewAssistant'))  items.push({ key: '/assistant', icon: <MessageOutlined />,   label: 'AI Ассистент' });

    return items;
};

// ── Компонент ─────────────────────────────────────────────────────────────────
const MainLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate  = useNavigate();
    const location  = useLocation();
    const dispatch  = useDispatch();
    const user      = useSelector((state) => state.auth.user);

    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

    // Загружаем настройки — только для worker/manager; admin не ограничен
    const needsPerms = user?.role === 'worker' || user?.role === 'projectManager';
    const { data: settingsData, isLoading: settingsLoading } = useQuery({
        queryKey: ['app-settings'],
        queryFn:  async () => {
            const { data } = await apiClient.get('/settings');
            return data.data.settings;
        },
        enabled: needsPerms,
        staleTime: 5 * 60 * 1000, // 5 минут кэш
    });

    const perms = !needsPerms ? null
        : user?.role === 'worker'         ? settingsData?.workerPermissions
        : settingsData?.managerPermissions;

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    const menuItems  = settingsLoading && needsPerms ? [] : buildMenu(user?.role, perms);
    const defaultOpen = ['reports-group'];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
                <div style={{
                    height: 64, margin: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: collapsed ? 16 : 18, whiteSpace: 'nowrap',
                }}>
                    {collapsed ? 'ДЖ' : 'Дневной журнал'}
                </div>

                {settingsLoading && needsPerms ? (
                    <div style={{ textAlign: 'center', paddingTop: 20 }}><Spin /></div>
                ) : (
                    <Menu
                        theme="light"
                        mode="inline"
                        selectedKeys={[location.pathname]}
                        defaultOpenKeys={defaultOpen}
                        items={menuItems}
                        onClick={({ key }) => { if (!key.startsWith('/')) return; navigate(key); }}
                    />
                )}
            </Sider>

            <Layout>
                <Header style={{
                    padding: 0, background: colorBgContainer,
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', paddingRight: 24,
                }}>
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        style={{ fontSize: 16, width: 64, height: 64 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: 14 }}>
                            {user?.name}
                            <span style={{ color: '#888', marginLeft: 6, fontSize: 12 }}>
                                ({ROLE_LABEL[user?.role] ?? user?.role})
                            </span>
                        </span>
                        <Button type="primary" danger icon={<LogoutOutlined />} onClick={handleLogout}>
                            Выйти
                        </Button>
                    </div>
                </Header>

                <Content style={{
                    margin: '24px 16px',
                    padding: 24,
                    minHeight: 280,
                    background: colorBgContainer,
                    borderRadius: borderRadiusLG,
                    overflow: 'auto',
                }}>
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
};

export default MainLayout;
