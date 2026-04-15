import React, { useState, useEffect } from 'react';
import {
    Typography, Card, Switch, Button, message, Spin,
    Divider, Space, Alert, Tabs, Tag, Row, Col,
} from 'antd';
import {
    SaveOutlined, SettingOutlined, LockOutlined,
    UserOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../shared/api/apiClient';

const { Title, Text } = Typography;

// Все переключаемые права с описанием
const PERMISSION_ITEMS = [
    { key: 'canViewDashboard',      label: 'Панель',                    desc: 'Главная панель с дневными логами' },
    { key: 'canViewBoard',          label: 'Мои проекты',               desc: 'Доска задач по проектам (BoardProject)' },
    { key: 'canViewReports',        label: 'Общий отчёт',               desc: 'Страница сводных отчётов' },
    { key: 'canViewAnalytics',      label: 'Аналитика',                 desc: 'Графики и статистика по работе' },
    { key: 'canViewProjectReport',  label: 'Отчёт по проекту',          desc: 'Фильтрация отчётов по проекту' },
    { key: 'canViewCustomerReport', label: 'Отчёт по заказчику',        desc: 'Фильтрация отчётов по заказчику' },
    { key: 'canViewTemplates',      label: 'Шаблоны',                   desc: 'Создание и использование шаблонов задач' },
    { key: 'canViewStartup',        label: 'Стартапы',                  desc: 'Страница стартап-проектов' },
    { key: 'canViewAssistant',      label: 'AI Ассистент',              desc: 'Чат с AI-помощником' },
    { key: 'canExportExcel',        label: 'Экспорт в Excel',           desc: 'Скачивание отчётов в формате XLS' },
];

// ── Блок переключателей для одной роли ───────────────────────────────────────
const PermissionsBlock = ({ permissions, onChange }) => (
    <div>
        {PERMISSION_ITEMS.map(({ key, label, desc }, i) => (
            <React.Fragment key={key}>
                {i > 0 && <Divider style={{ margin: '10px 0' }} />}
                <Row align="middle" style={{ padding: '4px 0' }}>
                    <Col flex="1">
                        <Text strong>{label}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text>
                    </Col>
                    <Col>
                        <Switch
                            checked={!!permissions?.[key]}
                            onChange={(val) => onChange(key, val)}
                            checkedChildren="Вкл"
                            unCheckedChildren="Выкл"
                        />
                    </Col>
                </Row>
            </React.Fragment>
        ))}
    </div>
);

// ── Главный компонент ─────────────────────────────────────────────────────────
const SettingsPage = () => {
    const queryClient = useQueryClient();

    const [workerPerms,  setWorkerPerms]  = useState(null);
    const [managerPerms, setManagerPerms] = useState(null);

    const { data: settings, isLoading } = useQuery({
        queryKey: ['app-settings'],
        queryFn: async () => {
            const { data } = await apiClient.get('/settings');
            return data.data.settings;
        },
    });

    useEffect(() => {
        if (settings) {
            setWorkerPerms(prev  => prev  ?? { ...settings.workerPermissions });
            setManagerPerms(prev => prev  ?? { ...settings.managerPermissions });
        }
    }, [settings]);

    const updateMut = useMutation({
        mutationFn: (body) => apiClient.patch('/settings', body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['app-settings'] });
            message.success('Настройки сохранены');
        },
        onError: () => message.error('Не удалось сохранить настройки'),
    });

    const handleSave = () => {
        updateMut.mutate({
            workerPermissions:  workerPerms,
            managerPermissions: managerPerms,
        });
    };

    const allOn  = (setter) => {
        const all = {};
        PERMISSION_ITEMS.forEach(({ key }) => (all[key] = true));
        setter(all);
    };
    const allOff = (setter) => {
        const none = {};
        PERMISSION_ITEMS.forEach(({ key }) => (none[key] = false));
        setter(none);
    };

    if (isLoading || !workerPerms || !managerPerms) {
        return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
    }

    const tabItems = [
        {
            key:   'worker',
            label: (
                <Space>
                    <UserOutlined />
                    <span>Сотрудник (worker)</span>
                </Space>
            ),
            children: (
                <Card
                    bordered={false}
                    extra={
                        <Space>
                            <Button size="small" onClick={() => allOn(setWorkerPerms)}>Всё включить</Button>
                            <Button size="small" danger onClick={() => allOff(setWorkerPerms)}>Всё выключить</Button>
                        </Space>
                    }
                >
                    <Alert
                        type="info"
                        showIcon
                        message="Настройки видимости разделов для сотрудников"
                        description="Выключенные разделы не будут отображаться в меню у сотрудников. Задачи (Мои задачи) всегда доступны."
                        style={{ marginBottom: 20 }}
                    />
                    <PermissionsBlock
                        permissions={workerPerms}
                        onChange={(key, val) => setWorkerPerms((p) => ({ ...p, [key]: val }))}
                    />
                </Card>
            ),
        },
        {
            key:   'manager',
            label: (
                <Space>
                    <TeamOutlined />
                    <span>Менеджер (projectManager)</span>
                </Space>
            ),
            children: (
                <Card
                    bordered={false}
                    extra={
                        <Space>
                            <Button size="small" onClick={() => allOn(setManagerPerms)}>Всё включить</Button>
                            <Button size="small" danger onClick={() => allOff(setManagerPerms)}>Всё выключить</Button>
                        </Space>
                    }
                >
                    <Alert
                        type="info"
                        showIcon
                        message="Настройки видимости разделов для менеджеров"
                        description="Выключенные разделы не будут отображаться в меню у менеджеров. Задачи (Задачи) всегда доступны."
                        style={{ marginBottom: 20 }}
                    />
                    <PermissionsBlock
                        permissions={managerPerms}
                        onChange={(key, val) => setManagerPerms((p) => ({ ...p, [key]: val }))}
                    />
                </Card>
            ),
        },
    ];

    return (
        <div style={{ maxWidth: 760 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <SettingOutlined style={{ marginRight: 8 }} />
                    Настройки доступа
                </Title>
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    size="large"
                    onClick={handleSave}
                    loading={updateMut.isPending}
                >
                    Сохранить
                </Button>
            </div>

            <Tabs defaultActiveKey="worker" items={tabItems} />
        </div>
    );
};

export default SettingsPage;
