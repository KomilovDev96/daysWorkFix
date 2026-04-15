import React, { useState, useMemo } from 'react';
import {
    Card, Button, Modal, Form, Input, Select, DatePicker,
    InputNumber, Switch, Tag, Space, Typography, Tooltip,
    Drawer, Table, Empty, Spin, message, Badge, Popconfirm,
    Row, Col, Statistic, Avatar,
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, FireOutlined,
    ClockCircleOutlined, TeamOutlined, CalendarOutlined,
    CheckCircleOutlined, RollbackOutlined, ExperimentOutlined,
    FolderOutlined, FolderOpenOutlined, AppstoreOutlined,
    CommentOutlined, UserOutlined, FilterOutlined,
    PlayCircleOutlined, DownOutlined, UpOutlined,
} from '@ant-design/icons';
import TaskCommentsDrawer from '../../shared/ui/TaskCommentsDrawer';
import ExportTasksButton  from '../../shared/ui/ExportTasksButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
dayjs.locale('ru');
import {
    fetchTasks, createTask, updateTask, deleteTask,
    fetchWorkers, fetchAvailability,
    fetchTaskProjects, createTaskProject,
} from '../../shared/api/managedTasksApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ── Константы ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
    { value: 'monthly', label: 'Месячная' },
    { value: 'weekly',  label: 'Недельная' },
    { value: 'daily',   label: 'Дневная' },
    { value: 'hourly',  label: 'Часовая' },
];

const TYPE_COLOR   = { monthly: 'purple', weekly: 'blue', daily: 'cyan', hourly: 'green' };
const TYPE_LABEL   = { monthly: 'Месячная', weekly: 'Недельная', daily: 'Дневная', hourly: 'Часовая' };
const STATUS_COLOR = { pending: 'default', in_progress: 'processing', testing: 'warning', completed: 'success', cancelled: 'error' };
const STATUS_LABEL = { pending: 'Ожидает', in_progress: 'В процессе', testing: 'Тестирование', completed: 'Выполнено', cancelled: 'Отменено' };

const PROJECT_STATUS_COLOR = { planning: '#722ed1', active: '#1677ff', completed: '#52c41a', paused: '#fa8c16' };
const PROJECT_STATUS_LABEL = { planning: 'Планирование', active: 'Активен', completed: 'Завершён', paused: 'Пауза' };

// ── Статусы канбана менеджера ──────────────────────────────────────────────────

const KANBAN_STATUSES = [
    { key: 'pending',     label: 'Ожидает',      color: '#8c8c8c', bg: '#f5f5f5', border: '#d9d9d9', icon: <ClockCircleOutlined /> },
    { key: 'in_progress', label: 'В процессе',   color: '#1677ff', bg: '#e6f4ff', border: '#91caff', icon: <PlayCircleOutlined /> },
    { key: 'testing',     label: 'Тестирование', color: '#fa8c16', bg: '#fff7e6', border: '#ffd591', icon: <ExperimentOutlined /> },
];

// ── Карточка задачи (менеджер) ────────────────────────────────────────────────

const ManagerKanbanCard = ({ task, currentUserId, onEdit, onDelete, onAddChild, onApprove, onReject, onComment }) => {
    const isOwn    = String(task.createdBy?._id || task.createdBy) === String(currentUserId);
    const statusM  = KANBAN_STATUSES.find((s) => s.key === task.status);
    const isOverdue = task.dueDate && dayjs(task.dueDate).isBefore(dayjs(), 'day');

    return (
        <Card
            size="small"
            style={{ marginBottom: 8, borderLeft: `3px solid ${statusM?.color || '#d9d9d9'}` }}
            bodyStyle={{ padding: '10px 12px' }}
        >
            {/* Шапка: кто назначил + заказчик + проект */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #f0f0f0',
                flexWrap: 'wrap',
            }}>
                <Avatar size={16} icon={<UserOutlined />}
                    style={{ background: isOwn ? '#1677ff' : '#722ed1', flexShrink: 0 }} />
                <Text style={{ fontSize: 11, fontWeight: 600, color: isOwn ? '#1677ff' : '#722ed1' }}>
                    {isOwn ? 'Моя задача' : `от ${task.createdBy?.name || 'Менеджера'}`}
                </Text>
                {task.client && (
                    <Tooltip title="Заказчик">
                        <Tag color="gold" style={{ margin: 0, fontSize: 10, padding: '0 5px' }}>
                            {task.client}
                        </Tag>
                    </Tooltip>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {task.project?.name && (
                        <Tag icon={<FolderOutlined />} color="purple"
                            style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
                            {task.project.name}
                        </Tag>
                    )}
                    {task.isHot && <FireOutlined style={{ color: '#ff4d4f' }} />}
                </div>
            </div>

            {/* Заголовок */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                {task.isHot && task.project?.name && <FireOutlined style={{ color: '#ff4d4f', flexShrink: 0, marginTop: 2 }} />}
                <Text strong style={{ fontSize: 13, lineHeight: 1.4 }}>{task.title}</Text>
            </div>

            {/* Исполнители */}
            {task.assignedTo?.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                    {task.assignedTo.map((w) => (
                        <Tag key={w._id || w} icon={<UserOutlined />} color="cyan"
                            style={{ marginRight: 4, marginBottom: 2, fontSize: 11 }}>
                            {w.name || 'Исполнитель'}
                        </Tag>
                    ))}
                </div>
            )}

            {/* Мета */}
            <Space size={4} wrap style={{ marginBottom: 8 }}>
                <Tag color={TYPE_COLOR[task.type]} style={{ margin: 0 }}>{TYPE_LABEL[task.type]}</Tag>
                {task.estimatedHours > 0 && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        <ClockCircleOutlined /> {task.actualHours || 0}/{task.estimatedHours}ч
                    </Text>
                )}
                {task.dueDate && (
                    <Text style={{ fontSize: 11, color: isOverdue ? '#ff4d4f' : '#888', fontWeight: isOverdue ? 600 : 400 }}>
                        <CalendarOutlined /> до {dayjs(task.dueDate).format('DD.MM')}
                        {isOverdue ? ' ⚠️' : ''}
                    </Text>
                )}
                {task.comments?.length > 0 && (
                    <Tag icon={<CommentOutlined />} style={{ margin: 0, fontSize: 11, cursor: 'pointer' }}
                        onClick={() => onComment(task)}>
                        {task.comments.length}
                    </Tag>
                )}
            </Space>

            {/* Действия */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                {/* Одобрение (если тест) */}
                <Space size={4}>
                    {task.status === 'testing' && (
                        <>
                            <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                                style={{ background: '#52c41a', borderColor: '#52c41a', fontSize: 11 }}
                                onClick={() => onApprove(task._id)}>Одобрить</Button>
                            <Button size="small" icon={<RollbackOutlined />} style={{ fontSize: 11 }}
                                onClick={() => onReject(task._id)}>Вернуть</Button>
                        </>
                    )}
                </Space>
                {/* Кнопки */}
                <Space size={4}>
                    <Tooltip title={task.comments?.length > 0 ? `Комментарии (${task.comments.length})` : 'Комментарии'}>
                        <Badge count={task.comments?.length || 0} size="small" offset={[-2, 2]}>
                            <Button size="small" icon={<CommentOutlined />}
                                type={task.comments?.length > 0 ? 'primary' : 'default'}
                                ghost={task.comments?.length > 0}
                                onClick={() => onComment(task)} />
                        </Badge>
                    </Tooltip>
                    <Tooltip title="Подзадача">
                        <Button size="small" icon={<PlusOutlined />} onClick={() => onAddChild(task)} />
                    </Tooltip>
                    <Tooltip title="Редактировать">
                        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(task)} />
                    </Tooltip>
                    <Popconfirm title="Удалить задачу?" onConfirm={() => onDelete(task._id)}
                        okText="Да" cancelText="Нет">
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            </div>
        </Card>
    );
};

// ── Колонка канбана (менеджер) ────────────────────────────────────────────────

const ManagerKanbanColumn = ({ status, tasks, currentUserId, onEdit, onDelete, onAddChild, onApprove, onReject, onComment }) => (
    <div style={{ flex: '1 1 220px', minWidth: 220, maxWidth: 340 }}>
        <div style={{
            background: status.bg, border: `1px solid ${status.border}`,
            borderRadius: 8, padding: '8px 12px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
        }}>
            <span style={{ color: status.color, fontSize: 15 }}>{status.icon}</span>
            <Text strong style={{ color: status.color, fontSize: 13 }}>{status.label}</Text>
            <Badge count={tasks.length} style={{ background: status.color, marginLeft: 'auto' }} />
        </div>
        <div style={{ minHeight: 60 }}>
            {tasks.length === 0 ? (
                <div style={{
                    border: `1px dashed ${status.border}`, borderRadius: 6,
                    padding: 16, textAlign: 'center', color: '#bbb', fontSize: 12,
                }}>Нет задач</div>
            ) : (
                tasks.map((t) => (
                    <ManagerKanbanCard
                        key={t._id}
                        task={t}
                        currentUserId={currentUserId}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onAddChild={onAddChild}
                        onApprove={onApprove}
                        onReject={onReject}
                        onComment={onComment}
                    />
                ))
            )}
        </div>
    </div>
);

// ── Модалка задачи ────────────────────────────────────────────────────────────

const TaskModal = ({ open, onClose, onSave, initial, parentTask, workers, projects, defaultProject }) => {
    const [form] = Form.useForm();

    const childType = { monthly: 'weekly', weekly: 'daily', daily: 'hourly' }[parentTask?.type];

    React.useEffect(() => {
        if (open) {
            form.setFieldsValue(
                initial ? {
                    ...initial,
                    project:    initial.project?._id || initial.project || defaultProject || null,
                    assignedTo: (initial.assignedTo || []).map((w) => w._id || w),
                    startDate:  initial.startDate ? dayjs(initial.startDate) : null,
                    dueDate:    initial.dueDate   ? dayjs(initial.dueDate)   : null,
                    client:     initial.client    || '',
                } : {
                    type:           parentTask ? childType : 'monthly',
                    isHot:          false,
                    estimatedHours: 0,
                    project:        defaultProject || null,
                    client:         '',
                }
            );
        } else {
            form.resetFields();
        }
    }, [open, initial, parentTask, defaultProject]);

    const handleOk = async () => {
        try {
            const vals = await form.validateFields();
            onSave({
                ...vals,
                parentId:  parentTask?._id || null,
                startDate: vals.startDate?.toISOString() || null,
                dueDate:   vals.dueDate?.toISOString()   || null,
                project:   vals.project || null,
                client:    vals.client  || '',
            });
        } catch {}
    };

    return (
        <Modal open={open}
            title={initial ? 'Редактировать задачу'
                : parentTask ? `Подзадача к «${parentTask.title}»`
                : 'Создать задачу'}
            onOk={handleOk} onCancel={onClose}
            okText={initial ? 'Сохранить' : 'Создать'} cancelText="Отмена"
            width={580} destroyOnHidden
        >
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item name="title" label="Название" rules={[{ required: true }]}>
                    <Input />
                </Form.Item>
                <Form.Item name="description" label="Описание">
                    <TextArea rows={2} />
                </Form.Item>
                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name="type" label="Тип" rules={[{ required: true }]}>
                            <Select options={TYPE_OPTIONS} disabled={!!parentTask && !initial} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="estimatedHours" label="Часов (план)">
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
                <Form.Item name="project" label="Проект">
                    <Select
                        placeholder="Без проекта"
                        allowClear
                        options={[
                            ...(projects || []).map((p) => ({
                                value: p._id,
                                label: (
                                    <Space>
                                        <FolderOutlined style={{ color: PROJECT_STATUS_COLOR[p.status] }} />
                                        {p.name}
                                    </Space>
                                ),
                            })),
                        ]}
                    />
                </Form.Item>
                <Form.Item name="assignedTo" label="Исполнители">
                    <Select mode="multiple" placeholder="Выберите сотрудников"
                        options={(workers || []).map((w) => ({ value: w._id, label: w.name }))}
                        allowClear
                    />
                </Form.Item>
                <Form.Item
                    name="client"
                    label="Заказчик"
                    tooltip="Кто является заказчиком этой задачи — вы сами, название компании или имя клиента"
                >
                    <Input placeholder="Например: Иванов А.А. / ООО Ромашка / Себя" />
                </Form.Item>
                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name="startDate" label="Дата начала">
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="dueDate" label="Дедлайн">
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
                <Form.Item name="isHot" label="Горячая задача" valuePropName="checked">
                    <Switch checkedChildren={<FireOutlined />} unCheckedChildren="—" />
                </Form.Item>
            </Form>
        </Modal>
    );
};

// ── Модалка создания проекта ──────────────────────────────────────────────────

const CreateProjectModal = ({ open, onClose, onSave }) => {
    const [form] = Form.useForm();
    React.useEffect(() => { if (!open) form.resetFields(); }, [open]);
    const handleOk = async () => {
        try { const v = await form.validateFields(); onSave(v); } catch {}
    };
    return (
        <Modal open={open} title="Создать проект" onOk={handleOk} onCancel={onClose}
            okText="Создать" cancelText="Отмена" destroyOnHidden>
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item name="name" label="Название" rules={[{ required: true }]}>
                    <Input placeholder="Название проекта" />
                </Form.Item>
                <Form.Item name="description" label="Описание">
                    <TextArea rows={2} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

// ── Мини-календарь доступности ────────────────────────────────────────────────

const AvailabilityCalendar = ({ availability, month }) => {
    const avMap = {};
    (availability || []).forEach((a) => { avMap[a.date] = a; });

    const startOfMonth   = month.startOf('month');
    const daysInMonth    = month.daysInMonth();
    const firstWeekDay   = (startOfMonth.day() + 6) % 7; // 0=Пн … 6=Вс
    const weekDayLabels  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    const cells = [
        ...Array(firstWeekDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    return (
        <div>
            {/* Заголовки дней недели */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
                {weekDayLabels.map((d) => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#888', fontWeight: 600 }}>{d}</div>
                ))}
            </div>
            {/* Клетки дней */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {cells.map((d, i) => {
                    if (!d) return <div key={`e-${i}`} />;
                    const dateStr = month.date(d).format('YYYY-MM-DD');
                    const data    = avMap[dateStr];
                    const isToday = dayjs().format('YYYY-MM-DD') === dateStr;

                    let bg = '#f5f5f5', textColor = '#bbb', borderColor = 'transparent';
                    if (data) {
                        if (data.freeHours >= 4)      { bg = '#f6ffed'; textColor = '#389e0d'; borderColor = '#b7eb8f'; }
                        else if (data.freeHours >= 1) { bg = '#fff7e6'; textColor = '#d46b08'; borderColor = '#ffd591'; }
                        else                          { bg = '#fff1f0'; textColor = '#cf1322'; borderColor = '#ffa39e'; }
                    }
                    if (isToday) borderColor = '#1677ff';

                    return (
                        <Tooltip key={d}
                            title={data
                                ? `${dateStr}: занято ${data.totalEstimated}ч, свободно ${data.freeHours}ч`
                                : dateStr}
                        >
                            <div style={{
                                textAlign: 'center', padding: '4px 2px', borderRadius: 4,
                                background: bg, cursor: data ? 'help' : 'default',
                                border: `1px solid ${borderColor}`,
                                fontWeight: isToday ? 700 : 400,
                            }}>
                                <div style={{ fontSize: 12, color: textColor, lineHeight: 1.2 }}>{d}</div>
                                {data && (
                                    <div style={{ fontSize: 10, color: textColor, lineHeight: 1 }}>
                                        {data.freeHours}ч
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
                    { bg: '#f6ffed', border: '#b7eb8f', color: '#389e0d', label: '≥4ч свободно' },
                    { bg: '#fff7e6', border: '#ffd591', color: '#d46b08', label: '1–3ч свободно' },
                    { bg: '#fff1f0', border: '#ffa39e', color: '#cf1322', label: 'Занят' },
                    { bg: '#f5f5f5', border: 'transparent', color: '#bbb', label: 'Нет задач' },
                ].map(({ bg, border, color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
                        <span style={{ color }}>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Drawer свободных часов ────────────────────────────────────────────────────

const AvailabilityDrawer = ({ open, onClose, workers }) => {
    const [workerId, setWorkerId] = useState(null);
    // По умолчанию — текущий месяц
    const [month, setMonth] = useState(dayjs());

    const range = [month.startOf('month'), month.endOf('month')];

    const { data, isFetching } = useQuery({
        queryKey: ['availability', workerId, month.format('YYYY-MM')],
        queryFn:  () => fetchAvailability({
            workerId,
            startDate: range[0].toISOString(),
            endDate:   range[1].toISOString(),
        }),
        enabled: !!workerId,
    });

    const availability = data?.availability ?? [];

    // Считаем сводку по месяцу
    const totalFree  = availability.reduce((s, a) => s + (a.freeHours || 0), 0);
    const freeDays   = availability.filter((a) => a.freeHours > 0).length;
    const busyDays   = availability.filter((a) => a.freeHours === 0 && a.totalEstimated > 0).length;

    const tableColumns = [
        { title: 'Дата', dataIndex: 'date', key: 'date', width: 110 },
        { title: 'Занято', dataIndex: 'totalEstimated', key: 'total', align: 'center', width: 80 },
        {
            title: 'Свободно', dataIndex: 'freeHours', key: 'free', align: 'center', width: 90,
            render: (v) => (
                <span style={{ color: v >= 4 ? '#52c41a' : v > 0 ? '#fa8c16' : '#ff4d4f', fontWeight: 600 }}>
                    {v}ч
                </span>
            ),
        },
        {
            title: 'Задачи', key: 'tasks',
            render: (_, row) => row.tasks.map((t) => (
                <Tag key={t._id} color={t.isHot ? 'red' : 'default'} style={{ marginBottom: 2 }}>
                    {t.title} ({t.estimatedHours || 0}ч)
                    {t.assignedBy?.name ? ` · ${t.assignedBy.name}` : ''}
                </Tag>
            )),
        },
    ];

    return (
        <Drawer
            title={<Space><TeamOutlined />Свободное время сотрудника</Space>}
            open={open} onClose={onClose} width={660}
        >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* Выбор сотрудника и месяца */}
                <Row gutter={12}>
                    <Col span={14}>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="Выберите сотрудника"
                            options={(workers || []).map((w) => ({
                                value: w._id,
                                label: (
                                    <Space>
                                        <Avatar size={18} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                                        {w.name}
                                    </Space>
                                ),
                            }))}
                            onChange={(v) => setWorkerId(v)}
                            value={workerId}
                            allowClear
                        />
                    </Col>
                    <Col span={10}>
                        <DatePicker
                            picker="month"
                            style={{ width: '100%' }}
                            value={month}
                            onChange={(d) => d && setMonth(d)}
                            allowClear={false}
                        />
                    </Col>
                </Row>

                {workerId && (
                    <Spin spinning={isFetching}>
                        {/* Шапка сотрудника */}
                        {data?.worker && (
                            <div style={{
                                background: '#f0f5ff', border: '1px solid #adc6ff',
                                borderRadius: 8, padding: '10px 14px',
                                display: 'flex', alignItems: 'center', gap: 12,
                            }}>
                                <Avatar size={40} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                                <div>
                                    <Text strong style={{ fontSize: 15 }}>{data.worker.name}</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: 12 }}>{data.worker.email}</Text>
                                </div>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>{freeDays}</div>
                                        <div style={{ fontSize: 11, color: '#888' }}>свободных дней</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#ff4d4f' }}>{busyDays}</div>
                                        <div style={{ fontSize: 11, color: '#888' }}>загружен полностью</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>{totalFree}</div>
                                        <div style={{ fontSize: 11, color: '#888' }}>ч свободно</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Календарь */}
                        {availability.length > 0 && (
                            <Card size="small" title={
                                <Space>
                                    <CalendarOutlined />
                                    {month.format('MMMM YYYY')}
                                </Space>
                            }>
                                <AvailabilityCalendar availability={availability} month={month} />
                            </Card>
                        )}

                        {/* Таблица по дням */}
                        <Table
                            dataSource={availability}
                            columns={tableColumns}
                            rowKey="date"
                            pagination={false}
                            size="small"
                            locale={{ emptyText: 'Нет назначенных задач на этот месяц' }}
                        />
                    </Spin>
                )}

                {!workerId && (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Выберите сотрудника для просмотра доступности"
                        style={{ padding: '40px 0' }}
                    />
                )}
            </Space>
        </Drawer>
    );
};

// ── Карточки проектов ─────────────────────────────────────────────────────────

const ProjectSelector = ({ projects, selected, onSelect, onCreateClick, taskCounts }) => (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, alignItems: 'stretch' }}>
        {/* Все задачи */}
        <div
            onClick={() => onSelect(null)}
            style={{
                minWidth: 120, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${!selected ? '#1677ff' : '#d9d9d9'}`,
                background: !selected ? '#e6f4ff' : '#fff',
                flexShrink: 0,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <AppstoreOutlined style={{ color: '#1677ff' }} />
                <Text strong style={{ fontSize: 13 }}>Все задачи</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>{taskCounts?.total ?? 0} задач</Text>
        </div>

        {/* Карточки проектов */}
        {(projects || []).map((p) => {
            const isActive = selected === p._id;
            const color    = PROJECT_STATUS_COLOR[p.status] || '#1677ff';
            const cnt      = taskCounts?.[p._id] ?? 0;
            return (
                <div
                    key={p._id}
                    onClick={() => onSelect(p._id)}
                    style={{
                        minWidth: 150, maxWidth: 200, padding: '10px 14px', borderRadius: 8,
                        cursor: 'pointer', flexShrink: 0,
                        border: `2px solid ${isActive ? color : '#d9d9d9'}`,
                        background: isActive ? `${color}15` : '#fff',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        {isActive
                            ? <FolderOpenOutlined style={{ color }} />
                            : <FolderOutlined style={{ color }} />}
                        <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                            {p.name}
                        </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tag color={p.status} style={{ margin: 0, fontSize: 11 }}>
                            {PROJECT_STATUS_LABEL[p.status] || p.status}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>{cnt} задач</Text>
                    </div>
                </div>
            );
        })}

        {/* Создать новый */}
        <div
            onClick={onCreateClick}
            style={{
                minWidth: 120, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: '2px dashed #d9d9d9', background: '#fafafa', flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
        >
            <PlusOutlined style={{ fontSize: 18, color: '#aaa' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>Новый проект</Text>
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Главная страница
// ═══════════════════════════════════════════════════════════════════════════════

const ManagerTasksPage = () => {
    const qc          = useQueryClient();
    const currentUser = useSelector((s) => s.auth.user);

    const [modalOpen,       setModalOpen]       = useState(false);
    const [projModalOpen,   setProjModalOpen]   = useState(false);
    const [editTask,        setEditTask]        = useState(null);
    const [parentTask,      setParentTask]      = useState(null);
    const [availDrawer,     setAvailDrawer]     = useState(false);
    const [commentTask,     setCommentTask]     = useState(null);
    const [filterHot,       setFilterHot]       = useState(false);
    const [filterMine,      setFilterMine]      = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [showDone,        setShowDone]        = useState(false);

    // Запросы
    const params = useMemo(() => {
        const p = {};
        if (filterHot)  p.isHot    = 'true';
        if (filterMine) p.onlyMine = 'true';
        if (selectedProject) p.projectId = selectedProject;
        return p;
    }, [filterHot, filterMine, selectedProject]);

    const { data: tasksData, isLoading } = useQuery({
        queryKey: ['managed-tasks', params],
        queryFn:  () => fetchTasks(params),
    });
    const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: fetchWorkers });
    const { data: projects = [], isLoading: projLoading } = useQuery({
        queryKey: ['task-projects'], queryFn: fetchTaskProjects,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ['managed-tasks'] });
    const invalidateProj = () => qc.invalidateQueries({ queryKey: ['task-projects'] });

    // Подсчёт задач по проектам (из незафильтрованных данных)
    const { data: allTasksData } = useQuery({
        queryKey: ['managed-tasks', {}],
        queryFn:  () => fetchTasks({}),
    });
    const taskCounts = useMemo(() => {
        const counts = { total: allTasksData?.tasks?.length ?? 0 };
        (allTasksData?.tasks ?? []).forEach((t) => {
            const pid = t.project?._id || t.project;
            if (pid) counts[String(pid)] = (counts[String(pid)] || 0) + 1;
        });
        return counts;
    }, [allTasksData]);

    // Мутации
    const createMut  = useMutation({ mutationFn: createTask,
        onSuccess: () => { message.success('Задача создана'); invalidate(); closeModal(); },
        onError:   (e) => message.error(e.response?.data?.message || 'Ошибка') });

    const updateMut  = useMutation({ mutationFn: ({ id, body }) => updateTask(id, body),
        onSuccess: () => { message.success('Задача обновлена'); invalidate(); closeModal(); },
        onError:   (e) => message.error(e.response?.data?.message || 'Ошибка') });

    const deleteMut  = useMutation({ mutationFn: deleteTask,
        onSuccess: () => { message.success('Задача удалена'); invalidate(); },
        onError:   (e) => message.error(e.response?.data?.message || 'Ошибка') });

    const approveMut = useMutation({ mutationFn: (id) => updateTask(id, { status: 'completed' }),
        onSuccess: () => { message.success('Задача одобрена ✅'); invalidate(); },
        onError:   (e) => message.error(e.response?.data?.message || 'Ошибка') });

    const rejectMut  = useMutation({ mutationFn: (id) => updateTask(id, { status: 'in_progress' }),
        onSuccess: () => { message.success('Задача возвращена в работу'); invalidate(); },
        onError:   (e) => message.error(e.response?.data?.message || 'Ошибка') });

    const createProjMut = useMutation({ mutationFn: createTaskProject,
        onSuccess: (proj) => {
            message.success('Проект создан');
            invalidateProj();
            setProjModalOpen(false);
            setSelectedProject(proj._id);
        },
        onError: (e) => message.error(e.response?.data?.message || 'Ошибка') });

    const openCreate   = ()      => { setEditTask(null); setParentTask(null); setModalOpen(true); };
    const openAddChild = (task)  => { setEditTask(null); setParentTask(task); setModalOpen(true); };
    const openEdit     = (task)  => { setEditTask(task); setParentTask(null); setModalOpen(true); };
    const closeModal   = ()      => { setModalOpen(false); setEditTask(null); setParentTask(null); };

    const handleSave = (vals) => {
        if (editTask) updateMut.mutate({ id: editTask._id, body: vals });
        else          createMut.mutate(vals);
    };

    const allTasks     = tasksData?.tasks ?? [];
    // Активные задачи (pending / in_progress / testing)
    const activeTasks  = allTasks.filter((t) => ['pending', 'in_progress', 'testing'].includes(t.status));
    // Завершённые / отменённые
    const doneTasks    = allTasks.filter((t) => ['completed', 'cancelled'].includes(t.status));

    const hotCount     = allTasks.filter((t) => t.isHot).length;
    const doneCount    = doneTasks.filter((t) => t.status === 'completed').length;
    const testingCount = allTasks.filter((t) => t.status === 'testing').length;

    // Разбивка по колонкам
    const byStatus = {};
    KANBAN_STATUSES.forEach((s) => { byStatus[s.key] = []; });
    activeTasks.forEach((t) => { if (byStatus[t.status]) byStatus[t.status].push(t); });

    const selectedProj = selectedProject ? projects.find((p) => p._id === selectedProject) : null;

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* Шапка */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Title level={3} style={{ margin: 0 }}>
                    {selectedProj
                        ? <Space><FolderOpenOutlined style={{ color: PROJECT_STATUS_COLOR[selectedProj.status] }} />{selectedProj.name}</Space>
                        : 'Задачи'}
                </Title>
                <Space wrap>
                    <Button
                        icon={<FilterOutlined />}
                        type={filterMine ? 'primary' : 'default'}
                        onClick={() => setFilterMine((v) => !v)}
                    >
                        {filterMine ? 'Только мои' : 'Все задачи'}
                    </Button>
                    <Button icon={<FireOutlined />} danger={filterHot}
                        onClick={() => setFilterHot((v) => !v)}>
                        {filterHot ? 'Все задачи' : 'Горячие'}
                        {!filterHot && hotCount > 0 && <Badge count={hotCount} style={{ marginLeft: 4 }} />}
                    </Button>
                    <Button icon={<TeamOutlined />} onClick={() => setAvailDrawer(true)}>
                        Свободное время
                    </Button>
                    <ExportTasksButton />
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                        Новая задача
                    </Button>
                </Space>
            </div>

            {/* Проекты */}
            <Card size="small" title={<Space><FolderOutlined />Проекты</Space>} loading={projLoading}>
                <ProjectSelector
                    projects={projects}
                    selected={selectedProject}
                    onSelect={setSelectedProject}
                    onCreateClick={() => setProjModalOpen(true)}
                    taskCounts={taskCounts}
                />
            </Card>

            {/* Статистика */}
            <Row gutter={[12, 12]}>
                <Col xs={12} sm={6} md={5}>
                    <Card size="small"><Statistic title="Задач" value={allTasks.length} /></Card>
                </Col>
                <Col xs={12} sm={6} md={4}>
                    <Card size="small"><Statistic title="Выполнено" value={doneCount} valueStyle={{ color: '#52c41a' }} /></Card>
                </Col>
                <Col xs={12} sm={6} md={5} style={testingCount > 0 ? { border: '1px solid #fa8c16', borderRadius: 8 } : {}}>
                    <Card size="small">
                        <Statistic
                            title={<Space><ExperimentOutlined style={{ color: '#fa8c16' }} />На тесте</Space>}
                            value={testingCount}
                            valueStyle={{ color: testingCount > 0 ? '#fa8c16' : undefined }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6} md={4}>
                    <Card size="small"><Statistic title="Горячих" value={hotCount} valueStyle={{ color: '#ff4d4f' }} /></Card>
                </Col>
                <Col xs={12} sm={6} md={4}>
                    <Card size="small">
                        <Statistic title="В процессе"
                            value={allTasks.filter((t) => t.status === 'in_progress').length}
                            valueStyle={{ color: '#1677ff' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Канбан задач */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : activeTasks.length === 0 && doneTasks.length === 0 ? (
                <Empty description={
                    selectedProj
                        ? `В проекте «${selectedProj.name}» нет задач. Создайте первую.`
                        : 'Нет задач. Создайте первую задачу.'
                } style={{ padding: 40 }} />
            ) : (
                <>
                    {/* Активные колонки */}
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
                        {KANBAN_STATUSES.map((status) => (
                            <ManagerKanbanColumn
                                key={status.key}
                                status={status}
                                tasks={byStatus[status.key] || []}
                                currentUserId={currentUser?._id}
                                onEdit={openEdit}
                                onDelete={(id) => deleteMut.mutate(id)}
                                onAddChild={openAddChild}
                                onApprove={(id) => approveMut.mutate(id)}
                                onReject={(id)  => rejectMut.mutate(id)}
                                onComment={(t)  => setCommentTask(t)}
                            />
                        ))}
                    </div>

                    {/* Секция выполненных */}
                    {doneTasks.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <Button
                                type="link" size="small"
                                icon={showDone ? <UpOutlined /> : <DownOutlined />}
                                onClick={() => setShowDone((v) => !v)}
                                style={{ padding: 0, color: '#8c8c8c', fontSize: 12 }}
                            >
                                {showDone ? 'Скрыть выполненные' : `Показать выполненные и отменённые (${doneTasks.length})`}
                            </Button>
                            {showDone && (
                                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {doneTasks.map((t) => (
                                        <div key={t._id} style={{
                                            background: '#fafafa', border: '1px solid #e0e0e0',
                                            borderRadius: 6, padding: '6px 12px', fontSize: 12,
                                            display: 'flex', alignItems: 'center', gap: 8, maxWidth: 340,
                                        }}>
                                            <CheckCircleOutlined style={{ color: t.status === 'cancelled' ? '#ff4d4f' : '#52c41a' }} />
                                            <Text style={{ fontSize: 12, color: '#555', flex: 1 }} ellipsis={{ tooltip: t.title }}>
                                                {t.title}
                                            </Text>
                                            {t.assignedTo?.length > 0 && (
                                                <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                                                    {t.assignedTo[0].name}
                                                </Text>
                                            )}
                                            <Tag style={{ margin: 0, fontSize: 10 }}
                                                color={t.status === 'cancelled' ? 'error' : 'success'}>
                                                {t.status === 'cancelled' ? 'Отменено' : 'Выполнено'}
                                            </Tag>
                                            <Button size="small" icon={<EditOutlined />}
                                                onClick={() => openEdit(t)} type="text" style={{ padding: '0 4px' }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Модалка задачи */}
            <TaskModal
                open={modalOpen}
                onClose={closeModal}
                onSave={handleSave}
                initial={editTask}
                parentTask={parentTask}
                workers={workers}
                projects={projects}
                defaultProject={selectedProject}
            />

            {/* Модалка проекта */}
            <CreateProjectModal
                open={projModalOpen}
                onClose={() => setProjModalOpen(false)}
                onSave={(vals) => createProjMut.mutate(vals)}
            />

            {/* Drawer свободных часов */}
            <AvailabilityDrawer
                open={availDrawer}
                onClose={() => setAvailDrawer(false)}
                workers={workers}
            />

            {/* Drawer комментариев */}
            <TaskCommentsDrawer
                taskId={commentTask?._id}
                taskTitle={commentTask?.title}
                open={!!commentTask}
                onClose={() => setCommentTask(null)}
            />
        </Space>
    );
};

export default ManagerTasksPage;
