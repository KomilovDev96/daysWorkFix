import React from 'react';
import { Card, Tag, Typography, Space, Empty } from 'antd';
import { ClockCircleOutlined, UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

const ROLE_META = {
    frontend: { label: 'Frontend', color: '#2f54eb' },
    backend:  { label: 'Backend',  color: '#08979c' },
    pm:       { label: 'PM',       color: '#722ed1' },
    tester:   { label: 'Тестировщик', color: '#d4380d' },
    other:    { label: 'Другое',   color: '#8c8c8c' },
};

const KANBAN_COLS = [
    { key: 'todo',        label: 'К выполнению' },
    { key: 'in_progress', label: 'В процессе' },
    { key: 'done',        label: 'Готово' },
];

// ── Мини-карточка задачи в клиентском канбане (только для чтения) ────────────
const PublicKanbanCard = ({ task }) => (
    <Card size="small" style={{ marginBottom: 8, borderRadius: 8 }} bodyStyle={{ padding: '8px 10px' }}>
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
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
            {roles.map((role) => {
                const meta = ROLE_META[role];
                const roleTasks = byRole[role];
                return (
                    <div key={role}>
                        <Tag color={meta.color} style={{ marginBottom: 10, fontSize: 12, padding: '2px 10px' }}>
                            {meta.label} · {roleTasks.length}
                        </Tag>
                        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                            {KANBAN_COLS.map((col) => {
                                const colTasks = roleTasks.filter((t) => t.status === col.key);
                                return (
                                    <div key={col.key} style={{ flex: '1 1 200px', minWidth: 200, maxWidth: 280 }}>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                                            {col.label} ({colTasks.length})
                                        </Text>
                                        {colTasks.length === 0 ? (
                                            <div style={{ border: '1px dashed #e0e0e0', borderRadius: 6, padding: 12, textAlign: 'center', color: '#bbb', fontSize: 12 }}>
                                                —
                                            </div>
                                        ) : (
                                            colTasks.map((t) => <PublicKanbanCard key={t._id} task={t} />)
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
