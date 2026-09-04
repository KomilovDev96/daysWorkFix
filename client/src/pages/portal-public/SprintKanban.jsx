import React from 'react';
import { Card, Tag, Typography, Space, Empty } from 'antd';
import {
    ClockCircleOutlined, UserOutlined, CodeOutlined, DatabaseOutlined,
    TeamOutlined, BugOutlined, AppstoreOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const ROLE_META = {
    frontend: { label: 'Frontend',      color: '#2f54eb', icon: <CodeOutlined /> },
    backend:  { label: 'Backend',       color: '#08979c', icon: <DatabaseOutlined /> },
    pm:       { label: 'PM',            color: '#722ed1', icon: <TeamOutlined /> },
    tester:   { label: 'Тестировщик',   color: '#d4380d', icon: <BugOutlined /> },
    other:    { label: 'Другое',        color: '#8c8c8c', icon: <AppstoreOutlined /> },
};

const KANBAN_COLS = [
    { key: 'todo',        label: 'К выполнению', color: '#8c8c8c', bg: '#f0f0f0', border: '#d9d9d9' },
    { key: 'in_progress', label: 'В процессе',   color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
    { key: 'done',        label: 'Готово',       color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
];

// ── Мини-карточка задачи в клиентском канбане (только для чтения) ────────────
const PublicKanbanCard = ({ task, col }) => (
    <Card
        size="small"
        style={{ marginBottom: 8, borderRadius: 8, borderLeft: `3px solid ${col.color}` }}
        bodyStyle={{ padding: '8px 10px' }}
    >
        <Text style={{ fontSize: 13 }}>{task.title}</Text>
        <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {task.hours > 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                    <ClockCircleOutlined style={{ marginRight: 3 }} />{task.hours} ч
                </Text>
            )}
            {task.assignedTo?.name && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                    <UserOutlined style={{ marginRight: 3 }} />{task.assignedTo.name}
                </Text>
            )}
        </div>
    </Card>
);

// ── Канбан-снимок спринта: роль → статус (только для чтения, используется публичными страницами портала) ──
export const SprintKanban = ({ tasks }) => {
    const byRole = {};
    tasks.forEach((t) => {
        const role = ROLE_META[t.execRole] ? t.execRole : 'other';
        if (!byRole[role]) byRole[role] = [];
        byRole[role].push(t);
    });
    const roles = Object.keys(byRole).sort((a, b) =>
        Object.keys(ROLE_META).indexOf(a) - Object.keys(ROLE_META).indexOf(b));

    if (roles.length === 0) return <Empty description="В этом спринте пока нет задач" />;

    return (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {roles.map((role) => {
                const meta = ROLE_META[role];
                const roleTasks = byRole[role];
                return (
                    <div
                        key={role}
                        style={{
                            background: `${meta.color}0c`,
                            border: `1px solid ${meta.color}33`,
                            borderRadius: 14,
                            padding: '14px 14px 6px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{
                                width: 30, height: 30, borderRadius: 8, background: meta.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: 15, flexShrink: 0,
                            }}>
                                {meta.icon}
                            </div>
                            <Text strong style={{ fontSize: 14, color: meta.color }}>{meta.label}</Text>
                            <Tag style={{ margin: 0, background: '#fff', borderColor: `${meta.color}55`, color: meta.color }}>
                                {roleTasks.length}
                            </Tag>
                        </div>
                        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                            {KANBAN_COLS.map((col) => {
                                const colTasks = roleTasks.filter((t) => t.status === col.key);
                                return (
                                    <div key={col.key} style={{ flex: '1 1 200px', minWidth: 200, maxWidth: 280 }}>
                                        <div style={{
                                            background: col.bg, border: `1px solid ${col.border}`, borderRadius: 8,
                                            padding: '4px 10px', marginBottom: 8,
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        }}>
                                            <Text style={{ fontSize: 12, color: col.color, fontWeight: 600 }}>{col.label}</Text>
                                            <Text style={{ fontSize: 12, color: col.color, fontWeight: 600 }}>{colTasks.length}</Text>
                                        </div>
                                        {colTasks.length === 0 ? (
                                            <div style={{ border: `1px dashed ${col.border}`, borderRadius: 6, padding: 12, textAlign: 'center', color: '#bbb', fontSize: 12 }}>
                                                —
                                            </div>
                                        ) : (
                                            colTasks.map((t) => <PublicKanbanCard key={t._id} task={t} col={col} />)
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </Space>
    );
};

export default SprintKanban;
