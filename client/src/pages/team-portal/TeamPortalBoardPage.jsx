import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Typography, Card, Tag, Space, Button, Tooltip, Result, Spin, Empty, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import publicApi from '../../shared/api/publicApi';
import TaskDetailModal from './TaskDetailModal';

const { Title, Text } = Typography;

const ROLE_LABELS = { frontend: 'Frontend', backend: 'Backend', pm: 'PM', tester: 'Тестировщик' };
const ROLE_COLORS = { frontend: '#2f54eb', backend: '#08979c', pm: '#722ed1', tester: '#d4380d' };

const STATUS_META = {
    todo: { label: 'К выполнению', color: '#8c8c8c', bg: '#f5f5f5', border: '#d9d9d9' },
    in_progress: { label: 'В процессе', color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
    review: { label: 'На проверке', color: '#fa8c16', bg: '#fff7e6', border: '#ffd591' },
    done: { label: 'Выполнено', color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
};
const COLUMN_ORDER = ['todo', 'in_progress', 'review', 'done'];

// Публичная командная доска спринта (/team-portal/:token/:role) — без входа в систему.
// PM видит и утверждает задачи всех ролей (review → done / review → in_progress),
// остальные роли видят и двигают только свои задачи (кроме финального шага done).
const TeamPortalBoardPage = () => {
    const { token, role } = useParams();
    const queryClient = useQueryClient();
    const [detailTaskId, setDetailTaskId] = useState(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['team-portal-tasks', token, role],
        queryFn: async () => {
            const { data } = await publicApi.get(`/team-portal/${token}/${role}/tasks`);
            return data.data;
        },
        retry: false,
        // Живое обновление: коллеги видят перемещения карточек друг друга без перезагрузки.
        refetchInterval: 5000,
        refetchIntervalInBackground: true,
    });

    const moveTask = useMutation({
        mutationFn: ({ taskId, status }) => publicApi.patch(`/team-portal/${token}/${role}/tasks/${taskId}`, { status }),
        onSuccess: ({ data: res }) => {
            queryClient.setQueryData(['team-portal-tasks', token, role], (old) =>
                old ? { ...old, tasks: old.tasks.map((t) => (t._id === res.data.task._id ? res.data.task : t)) } : old
            );
        },
        onError: (e) => message.error(e.response?.data?.message || 'Не удалось изменить статус'),
    });

    if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
    if (isError || !data) {
        return (
            <Result
                status="404"
                title="Ссылка не найдена"
                subTitle="Ссылка недействительна, роль указана неверно, или спринт был удалён. Обратитесь к менеджеру проекта."
            />
        );
    }

    const { sprint, project, tasks } = data;
    const isPm = role === 'pm';
    const detailTask = tasks.find((t) => t._id === detailTaskId) || null;

    const groups = isPm
        ? Object.keys(ROLE_LABELS)
            .map((r) => ({ role: r, tasks: tasks.filter((t) => t.execRole === r) }))
            .filter((g) => g.tasks.length > 0)
        : [{ role, tasks }];

    const renderCard = (task) => {
        const idx = COLUMN_ORDER.indexOf(task.status);
        const prevKey = COLUMN_ORDER[idx - 1];
        const nextKey = COLUMN_ORDER[idx + 1];
        const prevBlocked = task.status === 'review' && !isPm;
        const nextBlocked = nextKey === 'done' && !isPm;

        return (
            <Card key={task._id} size="small" style={{ marginBottom: 8, borderRadius: 8 }} bodyStyle={{ padding: '10px 12px' }}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{task.title}</Text>
                {task.description && (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                        {task.description.length > 70 ? task.description.slice(0, 70) + '…' : task.description}
                    </Text>
                )}
                <Space size={4} wrap style={{ marginBottom: 8 }}>
                    {task.hours > 0 && <Tag color="blue" style={{ margin: 0 }}>{task.hours} ч</Tag>}
                    {task.assignedTo?.name && <Tag style={{ margin: 0 }}>{task.assignedTo.name}</Tag>}
                    {task.dueDate && <Tag style={{ margin: 0 }}>до {dayjs(task.dueDate).format('DD.MM')}</Tag>}
                    {task.files?.length > 0 && <Tag color="purple" style={{ margin: 0 }}>📎 {task.files.length}</Tag>}
                </Space>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                    <Space size={4}>
                        {prevKey && (
                            <Tooltip title={prevBlocked ? 'Вернуть с проверки может только PM' : `В «${STATUS_META[prevKey].label}»`}>
                                <Button size="small" disabled={prevBlocked || moveTask.isPending}
                                    onClick={() => moveTask.mutate({ taskId: task._id, status: prevKey })}>←</Button>
                            </Tooltip>
                        )}
                        {nextKey && (
                            <Tooltip title={nextBlocked ? 'Отметить выполненной может только PM' : `В «${STATUS_META[nextKey].label}»`}>
                                <Button size="small" type="primary" ghost disabled={nextBlocked || moveTask.isPending}
                                    onClick={() => moveTask.mutate({ taskId: task._id, status: nextKey })}>→</Button>
                            </Tooltip>
                        )}
                    </Space>
                    <Button size="small" onClick={() => setDetailTaskId(task._id)}>Комментарии / файлы</Button>
                </div>
            </Card>
        );
    };

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 60px' }}>
            <div style={{ marginBottom: 20 }}>
                <Text type="secondary">{project.name}</Text>
                <Title level={2} style={{ margin: '4px 0' }}>{sprint.name}</Title>
                <Space size={12} align="center">
                    <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
                    <Link to={`/team-portal/${token}`} style={{ fontSize: 13 }}>Сменить роль</Link>
                </Space>
            </div>

            {groups.length === 0 && <Empty description="Задач пока нет" />}

            {groups.map((g) => (
                <Card
                    key={g.role}
                    style={{ marginBottom: 20, borderRadius: 12 }}
                    title={isPm ? <Tag color={ROLE_COLORS[g.role]}>{ROLE_LABELS[g.role]}</Tag> : null}
                    bodyStyle={{ paddingBottom: 8 }}
                >
                    {g.tasks.length === 0 ? <Empty description="Нет задач" /> : (
                        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                            {COLUMN_ORDER.map((colKey) => {
                                const meta = STATUS_META[colKey];
                                const colTasks = g.tasks.filter((t) => t.status === colKey);
                                return (
                                    <div key={colKey} style={{ flex: '1 1 230px', minWidth: 230, maxWidth: 320 }}>
                                        <div style={{
                                            background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 8,
                                            padding: '6px 10px', marginBottom: 8,
                                            display: 'flex', justifyContent: 'space-between',
                                        }}>
                                            <Text style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>{meta.label}</Text>
                                            <Text style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>{colTasks.length}</Text>
                                        </div>
                                        {colTasks.length === 0 ? (
                                            <div style={{ border: `1px dashed ${meta.border}`, borderRadius: 6, padding: 14, textAlign: 'center', color: '#bbb', fontSize: 12 }}>—</div>
                                        ) : colTasks.map(renderCard)}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            ))}

            <TaskDetailModal
                open={!!detailTask}
                task={detailTask}
                token={token}
                role={role}
                onClose={() => setDetailTaskId(null)}
            />

            <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>DaysWorkFix · azdev.uz</Text>
            </div>
        </div>
    );
};

export default TeamPortalBoardPage;
