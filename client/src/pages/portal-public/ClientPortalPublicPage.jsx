import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Typography, Card, Row, Col, Progress, Tag, Badge, Timeline, Empty, Spin,
    Result, Input, Button, Image, Space, Divider, message,
} from 'antd';
import {
    CheckCircleOutlined, ClockCircleOutlined, FlagOutlined, FileAddOutlined,
    CalendarOutlined, RocketOutlined, LinkOutlined, LockOutlined, PaperClipOutlined,
    TrophyOutlined, UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import publicApi, { PUBLIC_API_BASE } from '../../shared/api/publicApi';

const { Title, Text, Paragraph } = Typography;

const STATUS = {
    planning:  { label: 'Планирование', color: 'default' },
    active:    { label: 'Активный',     color: 'processing' },
    completed: { label: 'Завершён',     color: 'success' },
    paused:    { label: 'На паузе',     color: 'warning' },
};

const TASK_STATUS = {
    todo:        { label: 'К выполнению', color: 'default' },
    in_progress: { label: 'В процессе',   color: 'processing' },
    done:        { label: 'Готово',       color: 'success' },
};

const EVENT_ICON = {
    project_created:  <RocketOutlined style={{ color: '#1677ff' }} />,
    stage_completed:  <FlagOutlined style={{ color: '#52c41a' }} />,
    update_published: <CheckCircleOutlined style={{ color: '#6ba932' }} />,
    file_added:       <FileAddOutlined style={{ color: '#722ed1' }} />,
    deadline_changed: <CalendarOutlined style={{ color: '#faad14' }} />,
    progress_changed: <ClockCircleOutlined style={{ color: '#1677ff' }} />,
    sprint_started:   <RocketOutlined style={{ color: '#722ed1' }} />,
    sprint_completed: <TrophyOutlined style={{ color: '#faad14' }} />,
};

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

// ── Канбан-снимок текущего спринта: роль → статус ─────────────────────────────
const SprintKanban = ({ tasks }) => {
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

const fileSrc = (url) => `${PUBLIC_API_BASE}/${url}`.replace(/([^:])\/\/+/g, '$1/');

// ── Медиа одного обновления ───────────────────────────────────────────────────
const UpdateMedia = ({ files }) => {
    if (!files?.length) return null;
    const images = files.filter((f) => f.kind === 'image');
    const videos = files.filter((f) => f.kind === 'video');
    const docs = files.filter((f) => f.kind === 'file');
    return (
        <div style={{ marginTop: 12 }}>
            {images.length > 0 && (
                <Image.PreviewGroup>
                    <Space wrap>
                        {images.map((f) => (
                            <Image key={f._id || f.fileUrl} src={fileSrc(f.fileUrl)} width={120} height={90}
                                style={{ objectFit: 'cover', borderRadius: 8 }} />
                        ))}
                    </Space>
                </Image.PreviewGroup>
            )}
            {videos.map((f) => (
                <video key={f._id || f.fileUrl} src={fileSrc(f.fileUrl)} controls
                    style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8 }} />
            ))}
            {docs.length > 0 && (
                <Space direction="vertical" style={{ marginTop: 8 }}>
                    {docs.map((f) => (
                        <a key={f._id || f.fileUrl} href={fileSrc(f.fileUrl)} target="_blank" rel="noreferrer">
                            <PaperClipOutlined /> {f.originalName}
                        </a>
                    ))}
                </Space>
            )}
        </div>
    );
};

// ── Форма пароля ──────────────────────────────────────────────────────────────
const PasswordGate = ({ token, onUnlock }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async () => {
        setLoading(true);
        try {
            const { data } = await publicApi.post(`/portal/${token}/access`, { password });
            const access = data.data.accessToken;
            localStorage.setItem(`portal_access_${token}`, access);
            onUnlock(access);
        } catch {
            message.error('Неверный пароль');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 380, margin: '120px auto', textAlign: 'center' }}>
            <LockOutlined style={{ fontSize: 44, color: '#6ba932' }} />
            <Title level={4} style={{ marginTop: 16 }}>Портал защищён паролем</Title>
            <Text type="secondary">Введите пароль, выданный вашим менеджером</Text>
            <Input.Password
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={submit}
                placeholder="Пароль"
                size="large"
                style={{ marginTop: 20 }}
            />
            <Button type="primary" size="large" block loading={loading} onClick={submit} style={{ marginTop: 12 }}>
                Открыть портал
            </Button>
        </div>
    );
};

// ── Страница ──────────────────────────────────────────────────────────────────
const ClientPortalPublicPage = () => {
    const { token } = useParams();
    const [access, setAccess] = useState(() => localStorage.getItem(`portal_access_${token}`) || '');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['public-portal', token, access],
        queryFn: async () => {
            const res = await publicApi.get(`/portal/${token}`, {
                headers: access ? { Authorization: `Bearer ${access}` } : {},
                validateStatus: (s) => s === 200 || s === 401 || s === 404,
            });
            if (res.status === 404) throw new Error('not_found');
            if (res.status === 401) return { passwordRequired: true };
            return res.data.data.project;
        },
        retry: false,
    });

    if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
    if (isError) {
        return <Result status="404" title="Портал не найден"
            subTitle="Ссылка недействительна или была отключена. Обратитесь к вашему менеджеру." />;
    }
    if (data?.passwordRequired) {
        return <PasswordGate token={token} onUnlock={(a) => { setAccess(a); refetch(); }} />;
    }

    const project = data;
    const { progress } = project;
    const statusInfo = STATUS[project.status] || { label: project.status, color: 'default' };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 60px' }}>
            {/* Шапка */}
            <div style={{ marginBottom: 24 }}>
                <Space align="center" size={12} wrap>
                    <Title level={2} style={{ margin: 0 }}>{project.name}</Title>
                    <Badge status={statusInfo.color} text={<b>{statusInfo.label}</b>} />
                </Space>
                {project.description && (
                    <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 15 }}>{project.description}</Paragraph>
                )}
                <Space size={20} wrap style={{ marginTop: 4 }}>
                    {project.deadline && (
                        <Text type="secondary"><CalendarOutlined /> Дедлайн: <b>{dayjs(project.deadline).format('DD.MM.YYYY')}</b></Text>
                    )}
                    {project.manager?.name && (
                        <Text type="secondary">Менеджер: <b>{project.manager.name}</b></Text>
                    )}
                </Space>
            </div>

            {/* Прогресс */}
            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <Row gutter={16} align="middle">
                    <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                        <Progress type="dashboard" percent={progress.percent} size={120}
                            strokeColor={progress.percent === 100 ? '#52c41a' : '#6ba932'} />
                    </Col>
                    <Col xs={24} sm={18}>
                        <Row gutter={[16, 16]}>
                            {[
                                { label: 'Всего задач', value: progress.total, color: '#000' },
                                { label: 'Выполнено',   value: progress.done, color: '#52c41a' },
                                { label: 'В процессе',  value: progress.inProgress, color: '#1677ff' },
                                { label: 'Часов',       value: progress.hours, color: '#722ed1' },
                            ].map((s) => (
                                <Col xs={12} sm={6} key={s.label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                                    <Text type="secondary" style={{ fontSize: 13 }}>{s.label}</Text>
                                </Col>
                            ))}
                        </Row>
                        <Progress percent={progress.percent} style={{ marginTop: 16 }}
                            strokeColor={progress.percent === 100 ? '#52c41a' : '#1677ff'} />
                    </Col>
                </Row>
            </Card>

            {/* Спринт-канбан (проекты, разбитые на спринты) */}
            {project.hasSprints && (
                <Card
                    style={{ marginBottom: 24, borderRadius: 12 }}
                    title={
                        project.activeSprint
                            ? <Space><RocketOutlined style={{ color: '#722ed1' }} />Текущий спринт: {project.activeSprint.name}</Space>
                            : 'Текущий спринт'
                    }
                >
                    {project.activeSprint?.description && (
                        <Paragraph type="secondary" style={{ marginTop: -4, marginBottom: 16 }}>
                            {project.activeSprint.description}
                        </Paragraph>
                    )}
                    {project.activeSprint
                        ? <SprintKanban tasks={project.tasks || []} />
                        : <Empty description="Нет активного спринта — ожидайте обновления от команды" />}
                </Card>
            )}

            {/* Задачи (только названия + статус) — легаси-вид для проектов без спринтов */}
            {!project.hasSprints && (() => {
                const tasks = (project.tasks || []).filter((t) => t.status !== 'cancelled');
                if (tasks.length === 0) return null;
                return (
                    <Card style={{ marginBottom: 24, borderRadius: 12 }} title={`Задачи (${tasks.length})`}>
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {tasks.map((t) => {
                                const info = TASK_STATUS[t.status] || { label: t.status, color: 'default' };
                                const isDone = t.status === 'done';
                                return (
                                    <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {isDone
                                            ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                            : <Badge status={info.color} />}
                                        <Text
                                            style={{
                                                fontSize: 15,
                                                flex: 1,
                                                textDecoration: isDone ? 'line-through' : 'none',
                                                color: isDone ? '#8c8c8c' : undefined,
                                            }}
                                        >
                                            {t.title}
                                        </Text>
                                        {t.hours > 0 && (
                                            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                                <ClockCircleOutlined style={{ marginRight: 4 }} />{t.hours} ч
                                            </Text>
                                        )}
                                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                            {info.label}
                                        </Text>
                                    </div>
                                );
                            })}
                        </Space>
                    </Card>
                );
            })()}

            <Row gutter={24}>
                {/* Обновления */}
                <Col xs={24} md={14}>
                    <Title level={4}>Обновления проекта</Title>
                    {(!project.updates || project.updates.length === 0) && (
                        <Empty description="Обновлений пока нет" />
                    )}
                    {project.updates?.map((u) => (
                        <Card key={u._id} style={{ marginBottom: 16, borderRadius: 12 }} size="small">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <Text strong style={{ fontSize: 16 }}>{u.title}</Text>
                                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                    {dayjs(u.createdAt).format('DD.MM.YYYY')}
                                </Text>
                            </div>
                            {u.progress != null && (
                                <Tag color="green" style={{ marginTop: 6 }}>Прогресс: {u.progress}%</Tag>
                            )}
                            {u.body && (
                                <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{u.body}</Paragraph>
                            )}
                            <UpdateMedia files={u.files} />
                            {u.links?.length > 0 && (
                                <Space direction="vertical" style={{ marginTop: 8 }}>
                                    {u.links.map((l, i) => (
                                        <a key={i} href={l.url} target="_blank" rel="noreferrer">
                                            <LinkOutlined /> {l.label || l.url}
                                        </a>
                                    ))}
                                </Space>
                            )}
                        </Card>
                    ))}
                </Col>

                {/* Таймлайн */}
                <Col xs={24} md={10}>
                    <Title level={4}>Таймлайн</Title>
                    {(!project.timeline || project.timeline.length === 0) && (
                        <Empty description="Событий пока нет" />
                    )}
                    {project.timeline?.length > 0 && (
                        <Timeline
                            items={project.timeline.map((e) => ({
                                dot: EVENT_ICON[e.type],
                                children: (
                                    <div>
                                        <Text style={{ fontSize: 13 }}>{e.title}</Text>
                                        <div><Text type="secondary" style={{ fontSize: 11 }}>
                                            {dayjs(e.createdAt).format('DD.MM.YYYY HH:mm')}
                                        </Text></div>
                                    </div>
                                ),
                            }))}
                        />
                    )}
                </Col>
            </Row>

            <Divider />
            <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                    Обновлено {dayjs(project.updatedAt).format('DD.MM.YYYY HH:mm')} · DaysWorkFix
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                    Сделано с <span style={{ color: '#eb2f96' }}>♥</span> командой{' '}
                    <a
                        href="https://azdev.uz"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontWeight: 600 }}
                    >
                        azdev.uz
                    </a>
                </Text>
            </div>
        </div>
    );
};

export default ClientPortalPublicPage;
