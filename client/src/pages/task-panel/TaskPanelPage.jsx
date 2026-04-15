import React, { useState, useMemo } from 'react';
import {
    Card, Row, Col, Statistic, Tag, Badge, Typography, Space,
    Tooltip, Empty, Spin, Avatar, Progress, DatePicker,
} from 'antd';
import {
    CheckCircleOutlined, ClockCircleOutlined, FireOutlined,
    ExperimentOutlined, FolderOutlined, CalendarOutlined,
    UserOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { fetchTasks, fetchTaskProjects } from '../../shared/api/managedTasksApi';
import ExportTasksButton from '../../shared/ui/ExportTasksButton';

dayjs.locale('ru');

const { Title, Text } = Typography;

const STATUS_LABEL = {
    pending:     'Ожидает',
    in_progress: 'В процессе',
    testing:     'Тестирование',
    completed:   'Выполнено',
    cancelled:   'Отменено',
};

// ── Мини-календарь с задачами ─────────────────────────────────────────────────

const TaskCalendar = ({ tasks, month }) => {
    const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    // Группируем по дате дедлайна
    const tasksByDate = useMemo(() => {
        const map = {};
        tasks.forEach((t) => {
            if (!t.dueDate) return;
            const d = dayjs(t.dueDate).format('YYYY-MM-DD');
            if (!map[d]) map[d] = [];
            map[d].push(t);
        });
        return map;
    }, [tasks]);

    const startOfMonth = month.startOf('month');
    const daysInMonth  = month.daysInMonth();
    const firstWd      = (startOfMonth.day() + 6) % 7; // 0=Пн

    const cells = [
        ...Array(firstWd).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    const today = dayjs().format('YYYY-MM-DD');

    return (
        <div>
            {/* Дни недели */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
                {WEEK_DAYS.map((d) => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#888', fontWeight: 600 }}>{d}</div>
                ))}
            </div>

            {/* Клетки */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {cells.map((d, i) => {
                    if (!d) return <div key={`e-${i}`} />;

                    const dateStr  = month.date(d).format('YYYY-MM-DD');
                    const dayTasks = tasksByDate[dateStr] || [];
                    const isToday  = dateStr === today;
                    const isPast   = dayjs(dateStr).isBefore(dayjs(), 'day');

                    const done     = dayTasks.filter((t) => t.status === 'completed').length;
                    const active   = dayTasks.filter((t) => ['pending', 'in_progress', 'testing'].includes(t.status)).length;
                    const overdue  = isPast && dayTasks.filter((t) => ['pending', 'in_progress'].includes(t.status)).length > 0;

                    let bg = 'transparent', border = '1px solid transparent';
                    if (overdue)              { bg = '#fff1f0'; border = '1px solid #ffa39e'; }
                    else if (done && !active) { bg = '#f6ffed'; border = '1px solid #b7eb8f'; }
                    else if (active)          { bg = '#e6f4ff'; border = '1px solid #91caff'; }
                    if (isToday)              border = '2px solid #1677ff';

                    const tipLines = dayTasks.slice(0, 4).map((t) => `• ${t.title} (${STATUS_LABEL[t.status]})`).join('\n');
                    const tip      = dayTasks.length
                        ? `${dateStr}: ${dayTasks.length} задач\n${tipLines}${dayTasks.length > 4 ? '\n...' : ''}`
                        : dateStr;

                    return (
                        <Tooltip key={d} title={<span style={{ whiteSpace: 'pre-line' }}>{tip}</span>}>
                            <div style={{
                                textAlign: 'center', padding: '4px 2px', borderRadius: 4,
                                background: bg, border,
                                cursor: dayTasks.length ? 'help' : 'default',
                            }}>
                                <div style={{
                                    fontSize: 12,
                                    fontWeight: isToday ? 700 : 400,
                                    color: isToday ? '#1677ff' : '#333',
                                }}>
                                    {d}
                                </div>
                                {dayTasks.length > 0 && (
                                    <div style={{
                                        fontSize: 10, lineHeight: 1,
                                        color: overdue ? '#ff4d4f' : active ? '#1677ff' : '#52c41a',
                                    }}>
                                        {dayTasks.length}
                                    </div>
                                )}
                            </div>
                        </Tooltip>
                    );
                })}
            </div>

            {/* Легенда */}
            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                {[
                    { bg: '#e6f4ff', border: '#91caff', color: '#1677ff', label: 'Есть активные' },
                    { bg: '#f6ffed', border: '#b7eb8f', color: '#52c41a', label: 'Все выполнены' },
                    { bg: '#fff1f0', border: '#ffa39e', color: '#ff4d4f', label: 'Просрочены' },
                ].map(({ bg, border, color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, background: bg, border: `1px solid ${border}` }} />
                        <span style={{ color }}>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Карточка проекта ──────────────────────────────────────────────────────────

const ProjectCard = ({ project, tasks }) => {
    const pending     = tasks.filter((t) => t.status === 'pending').length;
    const in_progress = tasks.filter((t) => t.status === 'in_progress').length;
    const testing     = tasks.filter((t) => t.status === 'testing').length;
    const completed   = tasks.filter((t) => t.status === 'completed').length;
    const total       = tasks.length;
    const percent     = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div style={{
            background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8,
            padding: '10px 14px', marginBottom: 10,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <FolderOutlined style={{ color: '#722ed1' }} />
                <Text strong style={{ flex: 1, fontSize: 13 }}>{project.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{total} задач</Text>
            </div>
            <Progress percent={percent} size="small" strokeColor="#52c41a" trailColor="#f0f0f0" />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {pending > 0 && (
                    <Tag icon={<ClockCircleOutlined />} style={{ margin: 0, fontSize: 11 }}>
                        Ожидает: {pending}
                    </Tag>
                )}
                {in_progress > 0 && (
                    <Tag icon={<PlayCircleOutlined />} color="processing" style={{ margin: 0, fontSize: 11 }}>
                        В работе: {in_progress}
                    </Tag>
                )}
                {testing > 0 && (
                    <Tag icon={<ExperimentOutlined />} color="warning" style={{ margin: 0, fontSize: 11 }}>
                        Тест: {testing}
                    </Tag>
                )}
                {completed > 0 && (
                    <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0, fontSize: 11 }}>
                        Готово: {completed}
                    </Tag>
                )}
            </div>
        </div>
    );
};

// ── Главный компонент ─────────────────────────────────────────────────────────

const TaskPanelPage = () => {
    const [month, setMonth] = useState(dayjs());

    const { data: tasksData, isLoading } = useQuery({
        queryKey: ['panel-tasks'],
        queryFn:  () => fetchTasks({}),
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['task-projects'],
        queryFn:  fetchTaskProjects,
    });

    const tasks = tasksData?.tasks ?? [];

    // Разбивка по статусам
    const activeTasks  = tasks.filter((t) => ['pending', 'in_progress', 'testing'].includes(t.status));
    const todayDone    = tasks.filter((t) =>
        t.status === 'completed' && dayjs(t.updatedAt).isSame(dayjs(), 'day')
    );
    const overdueTasks = tasks.filter((t) =>
        ['pending', 'in_progress'].includes(t.status) &&
        t.dueDate && dayjs(t.dueDate).isBefore(dayjs(), 'day')
    ).sort((a, b) => dayjs(a.dueDate).diff(dayjs(b.dueDate)));

    const testingTasks  = tasks.filter((t) => t.status === 'testing');
    const upcomingTasks = activeTasks
        .filter((t) =>
            t.dueDate &&
            !dayjs(t.dueDate).isBefore(dayjs(), 'day') &&
            dayjs(t.dueDate).isBefore(dayjs().add(8, 'day'), 'day')
        )
        .sort((a, b) => dayjs(a.dueDate).diff(dayjs(b.dueDate)));

    // Группировка по проекту
    const tasksByProject = useMemo(() => {
        const map = {};
        tasks.forEach((t) => {
            const pid = t.project?._id || 'none';
            if (!map[pid]) map[pid] = [];
            map[pid].push(t);
        });
        return map;
    }, [tasks]);

    if (isLoading) return (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
    );

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Title level={3} style={{ margin: 0 }}>Панель задач</Title>
                <ExportTasksButton />
            </div>

            {/* Статистика */}
            <Row gutter={[12, 12]}>
                <Col xs={12} sm={6}>
                    <Card size="small">
                        <Statistic
                            title="Активных"
                            value={activeTasks.length}
                            valueStyle={{ color: '#1677ff' }}
                            prefix={<PlayCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small">
                        <Statistic
                            title="Выполнено сегодня"
                            value={todayDone.length}
                            valueStyle={{ color: '#52c41a' }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card
                        size="small"
                        style={overdueTasks.length > 0 ? { borderColor: '#ffa39e' } : {}}
                    >
                        <Statistic
                            title="Просрочено"
                            value={overdueTasks.length}
                            valueStyle={{ color: overdueTasks.length > 0 ? '#ff4d4f' : undefined }}
                            prefix={<FireOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card
                        size="small"
                        style={testingTasks.length > 0 ? { borderColor: '#ffd591' } : {}}
                    >
                        <Statistic
                            title="На тестировании"
                            value={testingTasks.length}
                            valueStyle={{ color: testingTasks.length > 0 ? '#fa8c16' : undefined }}
                            prefix={<ExperimentOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={[12, 12]}>
                {/* Календарь */}
                <Col xs={24} lg={13}>
                    <Card
                        size="small"
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CalendarOutlined />
                                <Text strong>Задачи по дням</Text>
                                <DatePicker
                                    picker="month"
                                    size="small"
                                    value={month}
                                    onChange={(d) => d && setMonth(d)}
                                    allowClear={false}
                                    style={{ marginLeft: 'auto' }}
                                />
                            </div>
                        }
                    >
                        {tasks.filter((t) => t.dueDate).length === 0 ? (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description="Нет задач с дедлайном"
                                style={{ padding: '20px 0' }}
                            />
                        ) : (
                            <TaskCalendar tasks={tasks} month={month} />
                        )}
                    </Card>
                </Col>

                {/* По проектам */}
                <Col xs={24} lg={11}>
                    <Card
                        size="small"
                        title={<Space><FolderOutlined />По проектам</Space>}
                        style={{ height: '100%' }}
                        bodyStyle={{ maxHeight: 380, overflowY: 'auto' }}
                    >
                        {projects.length === 0 && !tasksByProject['none'] ? (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет проектов" />
                        ) : (
                            <>
                                {projects.map((p) => (
                                    <ProjectCard
                                        key={p._id}
                                        project={p}
                                        tasks={tasksByProject[p._id] || []}
                                    />
                                ))}
                                {tasksByProject['none']?.length > 0 && (
                                    <ProjectCard
                                        project={{ _id: 'none', name: 'Без проекта' }}
                                        tasks={tasksByProject['none']}
                                    />
                                )}
                            </>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Просроченные */}
            {overdueTasks.length > 0 && (
                <Card
                    size="small"
                    title={
                        <Space>
                            <FireOutlined style={{ color: '#ff4d4f' }} />
                            <Text strong style={{ color: '#ff4d4f' }}>
                                Просроченные задачи ({overdueTasks.length})
                            </Text>
                        </Space>
                    }
                    style={{ borderColor: '#ffa39e' }}
                >
                    {overdueTasks.slice(0, 8).map((t) => (
                        <div key={t._id} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 0', borderBottom: '1px solid #f5f5f5',
                        }}>
                            <Badge status="error" />
                            <Text style={{ flex: 1, fontSize: 13 }}>{t.title}</Text>
                            {t.project?.name && (
                                <Tag color="purple" style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>
                                    {t.project.name}
                                </Tag>
                            )}
                            {t.createdBy?.name && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                    <Avatar size={16} icon={<UserOutlined />} style={{ background: '#722ed1' }} />
                                    <Text type="secondary" style={{ fontSize: 11 }}>{t.createdBy.name}</Text>
                                </div>
                            )}
                            <Text type="danger" style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                                до {dayjs(t.dueDate).format('DD.MM')}
                            </Text>
                        </div>
                    ))}
                </Card>
            )}

            {/* Ближайшие 7 дней */}
            {upcomingTasks.length > 0 && (
                <Card
                    size="small"
                    title={<Space><CalendarOutlined />Ближайшие задачи (7 дней)</Space>}
                >
                    {upcomingTasks.slice(0, 10).map((t) => {
                        const daysLeft = dayjs(t.dueDate).diff(dayjs(), 'day');
                        return (
                            <div key={t._id} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '7px 0', borderBottom: '1px solid #f5f5f5',
                            }}>
                                <Badge
                                    status={
                                        t.status === 'in_progress' ? 'processing'
                                        : t.status === 'testing' ? 'warning'
                                        : 'default'
                                    }
                                />
                                <Text style={{ flex: 1, fontSize: 13 }}>{t.title}</Text>
                                {t.project?.name && (
                                    <Tag color="purple" style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>
                                        {t.project.name}
                                    </Tag>
                                )}
                                {t.createdBy?.name && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                        <Avatar size={16} icon={<UserOutlined />} style={{ background: '#722ed1' }} />
                                        <Text type="secondary" style={{ fontSize: 11 }}>{t.createdBy.name}</Text>
                                    </div>
                                )}
                                <Tag
                                    color={daysLeft === 0 ? 'orange' : daysLeft === 1 ? 'gold' : 'blue'}
                                    style={{ margin: 0, fontSize: 11, flexShrink: 0 }}
                                >
                                    {daysLeft === 0 ? 'Сегодня' : daysLeft === 1 ? 'Завтра' : `через ${daysLeft}д`}
                                </Tag>
                            </div>
                        );
                    })}
                </Card>
            )}

            {/* Пусто */}
            {tasks.length === 0 && (
                <Empty
                    description="Нет задач. Создайте первую задачу на странице «Задачи»."
                    style={{ padding: 40 }}
                />
            )}
        </Space>
    );
};

export default TaskPanelPage;
