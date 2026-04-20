import React, { useState } from 'react';
import {
    Card, Tabs, Table, Button, Modal, Form, Input, Select, AutoComplete,
    DatePicker, InputNumber, Tag, Space, Typography, Popconfirm,
    Badge, Spin, message, Tooltip, Row, Col, Empty, Avatar,
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, FireOutlined,
    ClockCircleOutlined, CheckOutlined, PlayCircleOutlined,
    ExperimentOutlined, ArrowRightOutlined, FolderOutlined,
    CommentOutlined, UserOutlined,
} from '@ant-design/icons';
import TaskCommentsDrawer  from '../../shared/ui/TaskCommentsDrawer';
import ExportTasksButton   from '../../shared/ui/ExportTasksButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { fetchTasks, createTask, updateTask, deleteTask, fetchTaskProjects, createTaskProject, fetchManagers } from '../../shared/api/managedTasksApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ── Константы статусов ────────────────────────────────────────────────────────

const STATUSES = [
    {
        key:    'pending',
        label:  'Ожидает',
        color:  '#8c8c8c',
        bg:     '#f5f5f5',
        border: '#d9d9d9',
        icon:   <ClockCircleOutlined />,
    },
    {
        key:    'in_progress',
        label:  'В процессе',
        color:  '#1677ff',
        bg:     '#e6f4ff',
        border: '#91caff',
        icon:   <PlayCircleOutlined />,
    },
    {
        key:    'testing',
        label:  'Тестирование',
        color:  '#fa8c16',
        bg:     '#fff7e6',
        border: '#ffd591',
        icon:   <ExperimentOutlined />,
    },
    {
        key:    'completed',
        label:  'Выполнено',
        color:  '#52c41a',
        bg:     '#f6ffed',
        border: '#b7eb8f',
        icon:   <CheckOutlined />,
    },
];

// Только активные статусы — показываются в Канбане по умолчанию
const ACTIVE_STATUSES = STATUSES.filter((s) => s.key !== 'completed');

// Статусы на которые воркер может переключить карточку
const WORKER_NEXT = {
    pending:     { key: 'in_progress', label: 'Начать',            icon: <PlayCircleOutlined /> },
    in_progress: { key: 'testing',     label: 'Отправить на тест', icon: <ExperimentOutlined /> },
    testing:     { key: 'in_progress', label: 'Вернуть в работу',  icon: <ArrowRightOutlined style={{ transform: 'rotate(180deg)' }} /> },
};

const TYPE_COLOR = { monthly: 'purple', weekly: 'blue', daily: 'cyan', hourly: 'green' };
const TYPE_LABEL = { monthly: 'Месячная', weekly: 'Недельная', daily: 'Дневная', hourly: 'Часовая' };

// ── Карточка задачи в Канбане ─────────────────────────────────────────────────

const KanbanCard = ({ task, onStatusChange, changing, onComment }) => {
    const next       = WORKER_NEXT[task.status];
    const statusMeta = STATUSES.find(s => s.key === task.status);
    const isSelf     = task.isSelfTask;

    return (
        <Card
            size="small"
            style={{
                marginBottom: 8,
                borderLeft: `3px solid ${statusMeta?.color || '#d9d9d9'}`,
            }}
            bodyStyle={{ padding: '10px 12px' }}
        >
            {/* Источник задачи — кто назначил */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 6, paddingBottom: 6,
                borderBottom: '1px solid #f0f0f0',
            }}>
                <Avatar
                    size={18}
                    icon={<UserOutlined />}
                    style={{ background: isSelf ? '#52c41a' : '#722ed1', flexShrink: 0 }}
                />
                <Text style={{ fontSize: 11, color: isSelf ? '#52c41a' : '#722ed1', fontWeight: 600 }}>
                    {isSelf ? 'Личная задача' : `от ${task.createdBy?.name || 'Менеджера'}`}
                </Text>
                {task.project?.name && (
                    <Tag
                        icon={<FolderOutlined />}
                        color="purple"
                        style={{ margin: 0, fontSize: 10, padding: '0 4px' }}
                    >
                        {task.project.name}
                    </Tag>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        {task.isHot && <FireOutlined style={{ color: '#ff4d4f', flexShrink: 0 }} />}
                        <Text strong style={{ fontSize: 13, lineHeight: 1.4 }}>{task.title}</Text>
                    </div>

                    <Space size={4} wrap>
                        <Tag color={TYPE_COLOR[task.type]} style={{ margin: 0 }}>{TYPE_LABEL[task.type]}</Tag>
                        {task.estimatedHours > 0 && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                <ClockCircleOutlined /> {task.actualHours || 0}/{task.estimatedHours}ч
                            </Text>
                        )}
                        {task.dueDate && (
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: dayjs(task.dueDate).isBefore(dayjs(), 'day') ? '#ff4d4f' : '#888',
                                    fontWeight: dayjs(task.dueDate).isBefore(dayjs(), 'day') ? 600 : 400,
                                }}
                            >
                                до {dayjs(task.dueDate).format('DD.MM')}
                                {dayjs(task.dueDate).isBefore(dayjs(), 'day') ? ' ⚠️' : ''}
                            </Text>
                        )}
                        {/* Счётчик комментариев */}
                        {task.comments?.length > 0 && (
                            <Tag
                                icon={<CommentOutlined />}
                                style={{ margin: 0, cursor: 'pointer', fontSize: 11 }}
                                onClick={() => onComment(task)}
                            >
                                {task.comments.length}
                            </Tag>
                        )}
                    </Space>
                </div>

                {/* Кнопки действий */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                    {next && (
                        <Tooltip title={next.label}>
                            <Button
                                size="small"
                                type={task.status === 'in_progress' ? 'primary' : 'default'}
                                icon={next.icon}
                                loading={changing}
                                onClick={() => onStatusChange(task._id, next.key)}
                            >
                                <span style={{ fontSize: 11 }}>{next.label}</span>
                            </Button>
                        </Tooltip>
                    )}
                    <Button
                        size="small"
                        icon={<CommentOutlined />}
                        onClick={() => onComment(task)}
                        type={task.comments?.length > 0 ? 'link' : 'text'}
                        style={{ padding: '0 4px', fontSize: 11 }}
                    >
                        Заметки{task.comments?.length > 0 ? ` (${task.comments.length})` : ''}
                    </Button>
                </div>
            </div>
        </Card>
    );
};

// ── Колонка Канбана ───────────────────────────────────────────────────────────

const KanbanColumn = ({ status, tasks, onStatusChange, changingId, onComment }) => (
    <div style={{ flex: '1 1 200px', minWidth: 200, maxWidth: 320 }}>
        <div style={{
            background: status.bg,
            border: `1px solid ${status.border}`,
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
        }}>
            <span style={{ color: status.color, fontSize: 15 }}>{status.icon}</span>
            <Text strong style={{ color: status.color, fontSize: 13 }}>{status.label}</Text>
            <Badge
                count={tasks.length}
                style={{ background: status.color, marginLeft: 'auto' }}
            />
        </div>

        <div style={{ minHeight: 60 }}>
            {tasks.length === 0 ? (
                <div style={{
                    border: `1px dashed ${status.border}`,
                    borderRadius: 6, padding: 16,
                    textAlign: 'center', color: '#bbb', fontSize: 12,
                }}>
                    Нет задач
                </div>
            ) : (
                tasks.map((t) => (
                    <KanbanCard
                        key={t._id}
                        task={t}
                        onStatusChange={onStatusChange}
                        changing={changingId === t._id}
                        onComment={onComment}
                    />
                ))
            )}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Вкладка — ЗАДАЧИ ОТ МЕНЕДЖЕРА (Канбан)
// ═══════════════════════════════════════════════════════════════════════════════

const AssignedTasksKanban = () => {
    const qc = useQueryClient();
    const [changingId,    setChangingId]    = useState(null);
    const [commentTask,   setCommentTask]   = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ['my-assigned-tasks'],
        queryFn:  () => fetchTasks({}),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, status }) => updateTask(id, { status }),
        onMutate:   ({ id }) => setChangingId(id),
        onSettled:  () => setChangingId(null),
        onSuccess:  () => {
            message.success('Статус обновлён');
            qc.invalidateQueries({ queryKey: ['my-assigned-tasks'] });
        },
        onError: (e) => message.error(e.response?.data?.message || 'Ошибка'),
    });

    // Только назначенные мне задачи (не isSelfTask)
    const assignedTasks = (data?.tasks ?? []).filter((t) => !t.isSelfTask);

    // Активные задачи (pending / in_progress / testing)
    const activeTasks = assignedTasks.filter((t) => ['pending', 'in_progress', 'testing'].includes(t.status));

    // Только сегодня выполненные (updatedAt === сегодня)
    const todayDone = assignedTasks.filter((t) =>
        t.status === 'completed' &&
        dayjs(t.updatedAt).isSame(dayjs(), 'day')
    );

    const byStatus = {};
    ACTIVE_STATUSES.forEach((s) => { byStatus[s.key] = []; });
    activeTasks.forEach((t) => {
        if (byStatus[t.status]) byStatus[t.status].push(t);
    });

    if (isLoading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;

    if (assignedTasks.length === 0) return (
        <Empty description="Менеджер ещё не назначил вам задачи" />
    );

    return (
        <div>
            {/* Подсказка для воркера */}
            <div style={{
                background: '#f0f5ff', border: '1px solid #adc6ff',
                borderRadius: 6, padding: '8px 12px', marginBottom: 16,
                fontSize: 12, color: '#2f54eb',
            }}>
                <b>Как работают статусы:</b>&nbsp;
                Ожидает → <b>Начать</b> → В процессе → <b>Отправить на тест</b> → Тестирование → <i>Менеджер одобряет</i> → ✅ Выполнено
            </div>

            {/* Активные колонки */}
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
                {ACTIVE_STATUSES.map((status) => (
                    <KanbanColumn
                        key={status.key}
                        status={status}
                        tasks={byStatus[status.key] || []}
                        onStatusChange={(id, newStatus) => updateMut.mutate({ id, status: newStatus })}
                        changingId={changingId}
                        onComment={(task) => setCommentTask(task)}
                    />
                ))}
            </div>

            {/* Сегодня выполненные — показываем всегда если есть */}
            {todayDone.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #f6ffed 0%, #e6fffb 100%)',
                        border: '1px solid #b7eb8f',
                        borderRadius: 10, padding: '12px 16px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <CheckOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                            <Text strong style={{ color: '#389e0d', fontSize: 14 }}>
                                Сегодня выполнено — {todayDone.length} задач
                            </Text>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {todayDone.map((t) => (
                                <div key={t._id} style={{
                                    background: '#fff',
                                    border: '1px solid #b7eb8f',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    minWidth: 180, maxWidth: 280,
                                }}>
                                    <CheckOutlined style={{ color: '#52c41a', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text strong style={{ fontSize: 12, display: 'block' }} ellipsis={{ tooltip: t.title }}>
                                            {t.title}
                                        </Text>
                                        {t.createdBy?.name && (
                                            <Text type="secondary" style={{ fontSize: 11 }}>
                                                от {t.createdBy.name}
                                            </Text>
                                        )}
                                    </div>
                                    {t.comments?.length > 0 && (
                                        <Button type="text" size="small" icon={<CommentOutlined />}
                                            style={{ padding: '0 4px', color: '#52c41a' }}
                                            onClick={() => setCommentTask(t)} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <TaskCommentsDrawer
                taskId={commentTask?._id}
                taskTitle={commentTask?.title}
                open={!!commentTask}
                onClose={() => setCommentTask(null)}
            />
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Вкладка — МОИ ЛИЧНЫЕ ЗАДАЧИ
// ═══════════════════════════════════════════════════════════════════════════════

const SELF_STATUS_OPTIONS = [
    { value: 'pending',     label: 'Ожидает' },
    { value: 'in_progress', label: 'В процессе' },
    { value: 'testing',     label: 'Тестирование' },
    { value: 'completed',   label: 'Выполнено' },
    { value: 'cancelled',   label: 'Отменено' },
];

const STATUS_COLOR_MAP = {
    pending:     'default',
    in_progress: 'processing',
    testing:     'warning',
    completed:   'success',
    cancelled:   'error',
};
const STATUS_LABEL_MAP = {
    pending:     'Ожидает',
    in_progress: 'В процессе',
    testing:     'Тестирование',
    completed:   'Выполнено',
    cancelled:   'Отменено',
};

const SelfTaskModal = ({ open, onClose, onSave, initial, projects, managers }) => {
    const [form] = Form.useForm();

    React.useEffect(() => {
        if (open) {
            form.setFieldsValue(
                initial
                    ? {
                        ...initial,
                        project:   initial.project?._id || initial.project || null,
                        startDate: initial.startDate ? dayjs(initial.startDate) : null,
                        dueDate:   initial.dueDate   ? dayjs(initial.dueDate)   : null,
                    }
                    : { type: 'daily', estimatedHours: 0 }
            );
        } else {
            form.resetFields();
        }
    }, [open, initial]);

    const handleOk = async () => {
        try {
            const vals = await form.validateFields();
            onSave({
                ...vals,
                isSelfTask: true,
                project:    vals.project || null,
                startDate:  vals.startDate?.toISOString() || null,
                dueDate:    vals.dueDate?.toISOString()   || null,
            });
        } catch {}
    };

    return (
        <Modal
            open={open}
            title={initial ? 'Редактировать задачу' : 'Новая задача'}
            onOk={handleOk}
            onCancel={onClose}
            okText={initial ? 'Сохранить' : 'Создать'}
            cancelText="Отмена"
            width={500}
            destroyOnHidden
        >
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
                    <Input />
                </Form.Item>
                <Form.Item name="description" label="Описание">
                    <TextArea rows={2} />
                </Form.Item>
                <Form.Item name="project" label="Проект (необязательно)">
                    <Select placeholder="Без проекта" allowClear
                        options={(projects || []).map((p) => ({ value: p._id, label: p.name }))}
                    />
                </Form.Item>
                <Form.Item name="manualAssignee" label="Исполнитель">
                    <AutoComplete
                        placeholder="Выберите менеджера или введите имя"
                        allowClear
                        filterOption={(input, option) =>
                            (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={(managers || []).map((m) => ({ value: m.name }))}
                    />
                </Form.Item>
                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name="type" label="Тип" rules={[{ required: true }]}>
                            <Select options={[
                                { value: 'daily',  label: 'Дневная' },
                                { value: 'hourly', label: 'Часовая' },
                            ]} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="estimatedHours" label="Часов (план)">
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
                {initial && (
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="status" label="Статус">
                                <Select options={SELF_STATUS_OPTIONS} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="actualHours" label="Часов (факт)">
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                )}
                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name="startDate" label="Начало">
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="dueDate" label="Дедлайн">
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};

const SelfTasksTab = () => {
    const qc = useQueryClient();
    const [modal,    setModal]    = useState(false);
    const [editTask, setEditTask] = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ['my-self-tasks'],
        queryFn:  () => fetchTasks({}),
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['task-projects'],
        queryFn:  fetchTaskProjects,
    });

    const { data: managers = [] } = useQuery({
        queryKey: ['managers'],
        queryFn:  fetchManagers,
    });

    const selfTasks = (data?.tasks ?? []).filter((t) => t.isSelfTask);
    const invalidate = () => qc.invalidateQueries({ queryKey: ['my-self-tasks'] });

    const createMut = useMutation({
        mutationFn: createTask,
        onSuccess:  () => { message.success('Задача создана'); invalidate(); setModal(false); },
        onError:    (e) => message.error(e.response?.data?.message || 'Ошибка'),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, body }) => updateTask(id, body),
        onSuccess:  () => { message.success('Обновлено'); invalidate(); setModal(false); },
        onError:    (e) => message.error(e.response?.data?.message || 'Ошибка'),
    });
    const deleteMut = useMutation({
        mutationFn: deleteTask,
        onSuccess:  () => { message.success('Удалено'); invalidate(); },
        onError:    (e) => message.error(e.response?.data?.message || 'Ошибка'),
    });

    const openEdit   = (task) => { setEditTask(task); setModal(true); };
    const openCreate = ()     => { setEditTask(null); setModal(true); };

    const handleSave = (vals) => {
        if (editTask) updateMut.mutate({ id: editTask._id, body: vals });
        else          createMut.mutate(vals);
    };

    const columns = [
        {
            title: 'Задача', dataIndex: 'title', key: 'title',
        },
        {
            title: 'Тип', dataIndex: 'type', key: 'type', width: 110,
            render: (v) => <Tag color={TYPE_COLOR[v]}>{TYPE_LABEL[v]}</Tag>,
        },
        {
            title: 'Статус', dataIndex: 'status', key: 'status', width: 140,
            render: (v) => <Badge status={STATUS_COLOR_MAP[v]} text={STATUS_LABEL_MAP[v]} />,
        },
        {
            title: 'Проект', key: 'project', width: 140,
            render: (_, r) => r.project?.name
                ? <Tag icon={<FolderOutlined />} color="purple">{r.project.name}</Tag>
                : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
        },
        {
            title: 'Исполнитель', dataIndex: 'manualAssignee', key: 'manualAssignee', width: 140,
            render: (v) => v
                ? <Tag icon={<UserOutlined />} color="blue">{v}</Tag>
                : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
        },
        {
            title: 'Дедлайн', dataIndex: 'dueDate', key: 'dueDate', width: 120,
            render: (v) => v ? dayjs(v).format('DD.MM.YYYY') : '—',
        },
        {
            title: 'Часы', key: 'hours', width: 90, align: 'center',
            render: (_, r) => <Text type="secondary">{r.actualHours || 0}/{r.estimatedHours || 0}ч</Text>,
        },
        {
            title: '', key: 'action', width: 80,
            render: (_, r) => (
                <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                    <Popconfirm
                        title="Удалить задачу?"
                        onConfirm={() => deleteMut.mutate(r._id)}
                        okText="Да" cancelText="Нет"
                    >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <>
            <div style={{ marginBottom: 12 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    Добавить задачу
                </Button>
            </div>
            <Spin spinning={isLoading}>
                <Table
                    dataSource={selfTasks}
                    columns={columns}
                    rowKey="_id"
                    size="small"
                    pagination={{ pageSize: 20 }}
                    locale={{ emptyText: 'Нет задач' }}
                />
            </Spin>
            <SelfTaskModal
                open={modal}
                onClose={() => { setModal(false); setEditTask(null); }}
                onSave={handleSave}
                initial={editTask}
                projects={projects}
                managers={managers}
            />
        </>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Главный компонент
// ═══════════════════════════════════════════════════════════════════════════════

const WorkerTasksPage = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Title level={3} style={{ margin: 0 }}>Мои задачи</Title>
            <ExportTasksButton />
        </div>
        <Card bodyStyle={{ padding: '12px 16px' }}>
            <Tabs
                defaultActiveKey="assigned"
                items={[
                    {
                        key:      'assigned',
                        label:    'Задачи от менеджера',
                        children: <AssignedTasksKanban />,
                    },
                    {
                        key:      'self',
                        label:    'Мои личные задачи',
                        children: <SelfTasksTab />,
                    },
                ]}
            />
        </Card>
    </Space>
);

export default WorkerTasksPage;
