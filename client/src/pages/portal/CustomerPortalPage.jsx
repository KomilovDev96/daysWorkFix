import React, { useState } from 'react';
import {
    Typography, Card, Row, Col, Tag, Progress, Button, Input,
    Space, Empty, Spin, Divider, Avatar, Badge, message, Popconfirm, List
} from 'antd';
import {
    SendOutlined, DeleteOutlined, CheckCircleOutlined,
    ClockCircleOutlined, SyncOutlined, FolderOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_LABELS = {
    planning:  { label: 'Планирование', color: 'default' },
    active:    { label: 'Активный',     color: 'processing' },
    completed: { label: 'Завершён',     color: 'success' },
    paused:    { label: 'На паузе',     color: 'warning' },
};

const TASK_STATUS = {
    todo:        { label: 'К выполнению', color: 'default',    icon: <ClockCircleOutlined /> },
    in_progress: { label: 'В процессе',   color: 'processing', icon: <SyncOutlined spin /> },
    done:        { label: 'Выполнено',    color: 'success',    icon: <CheckCircleOutlined /> },
    cancelled:   { label: 'Отменено',     color: 'error',      icon: null },
};

const ROLE_LABEL = { admin: 'Команда', worker: 'Команда', guest: 'Вы' };

// ── Single project view ───────────────────────────────────────────────────────
const ProjectDetail = ({ projectId, onBack }) => {
    const queryClient = useQueryClient();
    const user = useSelector((s) => s.auth.user);
    const [commentText, setCommentText] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['portal-project', projectId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/portal/projects/${projectId}`);
            return data.data;
        },
    });

    const addComment = useMutation({
        mutationFn: (text) => apiClient.post(`/portal/projects/${projectId}/comments`, { text }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portal-project', projectId] });
            setCommentText('');
        },
        onError: () => message.error('Не удалось отправить комментарий'),
    });

    const deleteComment = useMutation({
        mutationFn: (commentId) =>
            apiClient.delete(`/portal/projects/${projectId}/comments/${commentId}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-project', projectId] }),
        onError: () => message.error('Не удалось удалить комментарий'),
    });

    if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
    if (!data) return <Empty />;

    const { project, comments } = data;
    const tasks = project.tasks || [];

    const groups = {
        todo:        tasks.filter((t) => t.status === 'todo'),
        in_progress: tasks.filter((t) => t.status === 'in_progress'),
        done:        tasks.filter((t) => t.status === 'done'),
    };

    const doneCount = groups.done.length;
    const totalCount = tasks.filter((t) => t.status !== 'cancelled').length;
    const progress = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
    const totalHours = tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);
    const statusInfo = STATUS_LABELS[project.status] || { label: project.status, color: 'default' };

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 12 }}>
                    Все проекты
                </Button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <Title level={2} style={{ margin: 0 }}>{project.name}</Title>
                    <Badge status={statusInfo.color} text={
                        <span style={{ fontSize: 15, fontWeight: 500 }}>{statusInfo.label}</span>
                    } />
                </div>
                {project.description && (
                    <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 15 }}>
                        {project.description}
                    </Paragraph>
                )}
                {project.deadline && (
                    <Text type="secondary">
                        Дедлайн: <b>{dayjs(project.deadline).format('DD.MM.YYYY')}</b>
                    </Text>
                )}
            </div>

            {/* Stats */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                        <Text type="secondary">Всего задач</Text>
                        <Title level={3} style={{ margin: '4px 0' }}>{totalCount}</Title>
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                        <Text type="secondary">Выполнено</Text>
                        <Title level={3} style={{ margin: '4px 0', color: '#3f8600' }}>{doneCount}</Title>
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                        <Text type="secondary">Часов потрачено</Text>
                        <Title level={3} style={{ margin: '4px 0' }}>{totalHours} ч</Title>
                    </Card>
                </Col>
            </Row>

            {/* Progress */}
            <Card style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 15 }}>Прогресс проекта</Text>
                    <Text type="secondary">{doneCount} из {totalCount} задач выполнено</Text>
                </div>
                <Progress
                    percent={progress}
                    strokeColor={progress === 100 ? '#52c41a' : '#1677ff'}
                    size={{ height: 14 }}
                    status={progress === 100 ? 'success' : 'active'}
                />
            </Card>

            {/* Task groups */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                {[
                    { key: 'in_progress', title: 'В процессе', color: '#1677ff' },
                    { key: 'todo',        title: 'К выполнению', color: '#faad14' },
                    { key: 'done',        title: 'Выполнено',   color: '#52c41a' },
                ].map(({ key, title, color }) => (
                    <Col xs={24} md={8} key={key}>
                        <Card
                            size="small"
                            title={
                                <Space>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                                    {title}
                                    <Tag>{groups[key].length}</Tag>
                                </Space>
                            }
                            style={{ minHeight: 180 }}
                        >
                            {groups[key].length === 0 && (
                                <Text type="secondary" style={{ fontSize: 13 }}>Нет задач</Text>
                            )}
                            {groups[key].map((task) => (
                                <div key={task._id} style={{
                                    padding: '8px 0',
                                    borderBottom: '1px solid #f0f0f0',
                                }}>
                                    <Text style={{ fontSize: 13 }}>{task.title}</Text>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                        {task.hours > 0 && (
                                            <Tag color="blue" style={{ fontSize: 11 }}>{task.hours} ч</Tag>
                                        )}
                                        {task.dueDate && (
                                            <Tag style={{ fontSize: 11 }}>
                                                {dayjs(task.dueDate).format('DD.MM.YYYY')}
                                            </Tag>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Comments */}
            <Card title={<span style={{ fontSize: 16 }}>💬 Обратная связь</span>}>
                {/* Comment list */}
                {comments?.length === 0 && (
                    <Empty description="Комментариев пока нет. Напишите первым!" style={{ padding: '20px 0' }} />
                )}
                <List
                    dataSource={comments || []}
                    renderItem={(c) => {
                        const isOwn = String(c.userId?._id) === String(user?._id);
                        const isGuest = c.userId?.role === 'guest';
                        return (
                            <List.Item
                                style={{
                                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                                    border: 'none',
                                    padding: '6px 0',
                                }}
                            >
                                <div style={{
                                    maxWidth: '75%',
                                    background: isOwn ? '#e6f4ff' : '#f6ffed',
                                    border: `1px solid ${isOwn ? '#91caff' : '#b7eb8f'}`,
                                    borderRadius: 12,
                                    padding: '10px 14px',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                                        <Space size={6}>
                                            <Avatar size={22} style={{ background: isGuest ? '#1677ff' : '#52c41a', fontSize: 11 }}>
                                                {c.userId?.name?.[0]?.toUpperCase()}
                                            </Avatar>
                                            <Text strong style={{ fontSize: 13 }}>
                                                {isGuest ? 'Заказчик' : 'Команда'}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>
                                                {dayjs(c.createdAt).format('DD.MM HH:mm')}
                                            </Text>
                                        </Space>
                                        {(isOwn || user?.role === 'admin') && (
                                            <Popconfirm title="Удалить комментарий?" onConfirm={() => deleteComment.mutate(c._id)}>
                                                <DeleteOutlined style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 12 }} />
                                            </Popconfirm>
                                        )}
                                    </div>
                                    <Text style={{ fontSize: 14 }}>{c.text}</Text>
                                </div>
                            </List.Item>
                        );
                    }}
                />

                {/* Input */}
                <Divider style={{ margin: '16px 0' }} />
                <div style={{ display: 'flex', gap: 10 }}>
                    <TextArea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Напишите ваш комментарий или вопрос..."
                        autoSize={{ minRows: 2, maxRows: 5 }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && commentText.trim()) {
                                addComment.mutate(commentText.trim());
                            }
                        }}
                    />
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={addComment.isPending}
                        disabled={!commentText.trim()}
                        onClick={() => addComment.mutate(commentText.trim())}
                        style={{ height: 'auto', minHeight: 64 }}
                    >
                        Отправить
                    </Button>
                </div>
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                    Ctrl+Enter для быстрой отправки
                </Text>
            </Card>
        </div>
    );
};

// ── Project list ──────────────────────────────────────────────────────────────
const CustomerPortalPage = () => {
    const [selectedId, setSelectedId] = useState(null);

    const { data: projects, isLoading } = useQuery({
        queryKey: ['portal-projects'],
        queryFn: async () => {
            const { data } = await apiClient.get('/portal/projects');
            return data.data.projects;
        },
    });

    if (selectedId) {
        return <ProjectDetail projectId={selectedId} onBack={() => setSelectedId(null)} />;
    }

    return (
        <div>
            <Title level={2} style={{ marginBottom: 24 }}>
                <FolderOutlined style={{ marginRight: 8 }} />
                Мои проекты
            </Title>

            {isLoading && <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />}

            {!isLoading && !projects?.length && (
                <Empty description="Пока нет назначенных проектов. Обратитесь к менеджеру." />
            )}

            <Row gutter={[16, 16]}>
                {projects?.map((p) => {
                    const tasks = p.tasks || [];
                    const done = tasks.filter((t) => t.status === 'done').length;
                    const total = tasks.filter((t) => t.status !== 'cancelled').length;
                    const progress = total ? Math.round((done / total) * 100) : 0;
                    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
                    const statusInfo = STATUS_LABELS[p.status] || { label: p.status, color: 'default' };

                    return (
                        <Col xs={24} sm={12} lg={8} key={p._id}>
                            <Card
                                hoverable
                                onClick={() => setSelectedId(p._id)}
                                style={{ cursor: 'pointer', borderRadius: 12 }}
                            >
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text strong style={{ fontSize: 17 }}>{p.name}</Text>
                                        <Badge status={statusInfo.color} text={statusInfo.label} />
                                    </div>
                                    {p.description && (
                                        <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
                                            {p.description.length > 80 ? p.description.slice(0, 80) + '…' : p.description}
                                        </Text>
                                    )}
                                </div>

                                <Progress
                                    percent={progress}
                                    size="small"
                                    status={progress === 100 ? 'success' : 'active'}
                                    style={{ marginBottom: 12 }}
                                />

                                <Row gutter={8}>
                                    <Col span={8}>
                                        <div style={{ textAlign: 'center', padding: '6px 0', background: '#f6ffed', borderRadius: 8 }}>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>{done}</div>
                                            <div style={{ fontSize: 11, color: '#888' }}>Готово</div>
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ textAlign: 'center', padding: '6px 0', background: '#e6f4ff', borderRadius: 8 }}>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>{inProgress}</div>
                                            <div style={{ fontSize: 11, color: '#888' }}>В процессе</div>
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ textAlign: 'center', padding: '6px 0', background: '#fff7e6', borderRadius: 8 }}>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: '#faad14' }}>{tasks.filter(t=>t.status==='todo').length}</div>
                                            <div style={{ fontSize: 11, color: '#888' }}>Ожидает</div>
                                        </div>
                                    </Col>
                                </Row>

                                {p.deadline && (
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                                        Дедлайн: {dayjs(p.deadline).format('DD.MM.YYYY')}
                                    </Text>
                                )}
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </div>
    );
};

export default CustomerPortalPage;
