import React, { useState, useRef } from 'react';
import {
    Card, Tabs, Table, Button, Modal, Form, Input, Select, AutoComplete,
    DatePicker, InputNumber, Tag, Space, Typography, Popconfirm,
    Badge, Spin, message, Tooltip, Row, Col, Empty, Avatar,
    Segmented, Divider, Drawer, Upload, Image, List,
} from 'antd';
import {
    PlusOutlined, DeleteOutlined, FireOutlined,
    ClockCircleOutlined, CheckOutlined, PlayCircleOutlined,
    ExperimentOutlined, ArrowRightOutlined, FolderOutlined,
    CommentOutlined, UserOutlined, CalendarOutlined,
    PaperClipOutlined, UploadOutlined, FileImageOutlined,
    FilePdfOutlined, FileOutlined, SendOutlined, EyeOutlined,
} from '@ant-design/icons';
import TaskCommentsDrawer  from '../../shared/ui/TaskCommentsDrawer';
import ExportTasksButton   from '../../shared/ui/ExportTasksButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
    fetchTasks, createTask, updateTask, deleteTask, fetchTaskProjects,
    addComment, fetchComments,
    fetchTaskFiles, uploadTaskFile, deleteTaskFile,
    fetchManagers,
} from '../../shared/api/managedTasksApi';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace('/api', '');

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

const SelfTaskDrawer = ({ open, onClose, onSave, initial, projects }) => {
    const [form]         = Form.useForm();
    const [dateMode,     setDateMode]     = useState('today');
    const [commentText,  setCommentText]  = useState('');
    const [addingCmt,    setAddingCmt]    = useState(false);
    const [uploadingFile,setUploadingFile]= useState(false);

    React.useEffect(() => {
        if (open) {
            if (initial) {
                form.setFieldsValue({
                    ...initial,
                    project:   initial.project?._id || initial.project || null,
                    startDate: initial.startDate ? dayjs(initial.startDate) : null,
                    dueDate:   initial.dueDate   ? dayjs(initial.dueDate)   : null,
                });
                const isToday = initial.dueDate && dayjs(initial.dueDate).isSame(dayjs(), 'day');
                setDateMode(isToday || !initial.dueDate ? 'today' : 'other');
            } else {
                form.resetFields();
                form.setFieldsValue({ type: 'daily', estimatedHours: 1, status: 'in_progress' });
                setDateMode('today');
            }
            setCommentText('');
        } else {
            form.resetFields();
        }
    }, [open, initial]);

    // Комментарии (только для существующих задач)
    const { data: taskWithComments, refetch: refetchComments } = useQuery({
        queryKey: ['task-comments', initial?._id],
        queryFn:  () => fetchComments(initial._id),
        enabled:  open && !!initial?._id,
    });
    const comments = taskWithComments?.comments || [];

    // Файлы (только для существующих задач)
    const { data: taskFiles = [], refetch: refetchFiles } = useQuery({
        queryKey: ['task-files', initial?._id],
        queryFn:  () => fetchTaskFiles(initial._id),
        enabled:  open && !!initial?._id,
    });

    const handleAddComment = async () => {
        if (!commentText.trim() || !initial?._id) return;
        setAddingCmt(true);
        try {
            await addComment(initial._id, commentText.trim());
            setCommentText('');
            refetchComments();
        } catch {
            message.error('Ошибка при добавлении комментария');
        } finally {
            setAddingCmt(false);
        }
    };

    const handleFileUpload = async ({ file, onSuccess, onError }) => {
        if (!initial?._id) return;
        setUploadingFile(true);
        try {
            await uploadTaskFile(initial._id, file);
            refetchFiles();
            onSuccess('ok');
            message.success('Файл загружен');
        } catch {
            message.error('Ошибка загрузки файла');
            onError(new Error('upload failed'));
        } finally {
            setUploadingFile(false);
        }
    };

    const handleDeleteFile = async (fileId) => {
        try {
            await deleteTaskFile(fileId);
            refetchFiles();
            message.success('Файл удалён');
        } catch {
            message.error('Ошибка удаления файла');
        }
    };

    const handleSave = async () => {
        try {
            const vals = await form.validateFields();
            const date = dateMode === 'today' ? dayjs() : (vals.customDate || dayjs());
            onSave({
                ...vals,
                isSelfTask: true,
                project:    vals.project || null,
                startDate:  !initial ? date.startOf('day').toISOString() : vals.startDate?.toISOString(),
                dueDate:    !initial ? date.endOf('day').toISOString()   : vals.dueDate?.toISOString(),
                comment:    vals.comment || '',
            });
        } catch {}
    };

    const isImage = (ft) => ['jpg','jpeg','png','gif','webp'].includes(ft?.toLowerCase());

    const getFileIcon = (ft) => {
        if (isImage(ft))   return <FileImageOutlined style={{ color: '#1677ff', fontSize: 16 }} />;
        if (ft === 'pdf')  return <FilePdfOutlined   style={{ color: '#ff4d4f', fontSize: 16 }} />;
        return <FileOutlined style={{ fontSize: 16 }} />;
    };

    return (
        <Drawer
            open={open}
            onClose={onClose}
            placement="right"
            width={620}
            title={
                <Space>
                    <CalendarOutlined style={{ color: '#22C55E' }} />
                    {initial ? 'Редактировать задачу' : 'Новая задача'}
                </Space>
            }
            footer={
                <div style={{ textAlign: 'right' }}>
                    <Space>
                        <Button onClick={onClose}>Отмена</Button>
                        <Button type="primary" onClick={handleSave}>
                            {initial ? 'Сохранить' : 'Создать'}
                        </Button>
                    </Space>
                </div>
            }
            destroyOnHidden
        >
            {/* ── Форма ── */}
            <Form form={form} layout="vertical">
                {!initial && (
                    <Form.Item label={<b>На какой день?</b>} style={{ marginBottom: 12 }}>
                        <Segmented
                            block
                            value={dateMode}
                            onChange={setDateMode}
                            options={[
                                { label: '📅 На сегодня',    value: 'today' },
                                { label: '📆 На другой день', value: 'other' },
                            ]}
                        />
                        {dateMode === 'other' && (
                            <Form.Item name="customDate" noStyle rules={[{ required: true, message: 'Выберите дату' }]}>
                                <DatePicker style={{ width: '100%', marginTop: 8 }} format="DD.MM.YYYY" placeholder="Выберите дату" />
                            </Form.Item>
                        )}
                    </Form.Item>
                )}

                <Divider style={{ margin: '0 0 12px' }} />

                <Form.Item name="title" label="Название задачи" rules={[{ required: true, message: 'Введите название' }]}>
                    <Input placeholder="Что нужно сделать?" />
                </Form.Item>

                <Form.Item name="client" label="Менеджер / Заказчик" rules={[{ required: true, message: 'Укажите менеджера или заказчика' }]}>
                    <Input placeholder="Имя менеджера или заказчика" prefix={<UserOutlined style={{ color: '#aaa' }} />} />
                </Form.Item>

                <Form.Item name="project" label="Проект (необязательно)">
                    <Select placeholder="Без проекта" allowClear
                        options={(projects || []).map((p) => ({ value: p._id, label: p.name }))}
                    />
                </Form.Item>
                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name="status" label="Статус" rules={[{ required: true }]}>
                            <Select options={SELF_STATUS_OPTIONS} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="type" label="Тип" rules={[{ required: true }]}>
                            <Select options={[
                                { value: 'daily',   label: 'Дневная'   },
                                { value: 'hourly',  label: 'Часовая'   },
                                { value: 'weekly',  label: 'Недельная' },
                                { value: 'monthly', label: 'Месячная'  },
                            ]} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name="estimatedHours" label="Часы (план)" rules={[{ required: true, message: 'Укажите часы' }]}>
                            <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="0" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="actualHours" label="Часы (факт)">
                            <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="0" />
                        </Form.Item>
                    </Col>
                </Row>

                {initial && (
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="startDate" label="Начало">
                                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dueDate" label="Дедлайн">
                                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                            </Form.Item>
                        </Col>
                    </Row>
                )}

                <Form.Item name="description" label="Детали задачи">
                    <TextArea rows={2} placeholder="Подробное описание..." />
                </Form.Item>

                {!initial && (
                    <Form.Item name="comment" label="Причина / Комментарий">
                        <TextArea rows={2} placeholder="Причина, заметка или комментарий..." />
                    </Form.Item>
                )}
            </Form>

            {/* ── Комментарии (только для существующих задач) ── */}
            {initial && (
                <>
                    <Divider orientation="left" style={{ marginTop: 8 }}>
                        <Space size={4}>
                            <CommentOutlined />
                            <span>Комментарии{comments.length > 0 ? ` (${comments.length})` : ''}</span>
                        </Space>
                    </Divider>

                    <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
                        {comments.length === 0 ? (
                            <Empty description="Нет комментариев" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '8px 0' }} />
                        ) : (
                            <List
                                size="small"
                                dataSource={comments}
                                renderItem={(c) => (
                                    <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                                <Text strong style={{ fontSize: 12 }}>{c.author?.name || 'Вы'}</Text>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    {dayjs(c.createdAt).format('DD.MM HH:mm')}
                                                </Text>
                                            </div>
                                            <Text style={{ fontSize: 12 }}>{c.text}</Text>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <Input
                            placeholder="Написать комментарий..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onPressEnter={handleAddComment}
                            style={{ flex: 1 }}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleAddComment}
                            loading={addingCmt}
                            disabled={!commentText.trim()}
                        />
                    </div>
                </>
            )}

            {/* ── Файлы (только для существующих задач) ── */}
            {initial && (
                <>
                    <Divider orientation="left" style={{ marginTop: 8 }}>
                        <Space size={4}>
                            <PaperClipOutlined />
                            <span>Файлы{taskFiles.length > 0 ? ` (${taskFiles.length})` : ''}</span>
                        </Space>
                    </Divider>

                    {taskFiles.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            {taskFiles.map((f) => (
                                <div key={f._id} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '6px 10px', background: '#fafafa',
                                    border: '1px solid #f0f0f0', borderRadius: 6, marginBottom: 6,
                                }}>
                                    {isImage(f.fileType) ? (
                                        <Image
                                            src={`${API_BASE}/${f.fileUrl}`}
                                            alt={f.title}
                                            width={40}
                                            height={40}
                                            style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                                        />
                                    ) : (
                                        getFileIcon(f.fileType)
                                    )}
                                    <Text style={{ flex: 1, fontSize: 12 }} ellipsis={{ tooltip: f.title }}>
                                        {f.title}
                                    </Text>
                                    <a href={`${API_BASE}/${f.fileUrl}`} target="_blank" rel="noreferrer">
                                        <Button type="text" size="small" icon={<EyeOutlined />} />
                                    </a>
                                    <Popconfirm title="Удалить файл?" onConfirm={() => handleDeleteFile(f._id)} okText="Да" cancelText="Нет">
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                </div>
                            ))}
                        </div>
                    )}

                    <Upload customRequest={handleFileUpload} showUploadList={false} multiple={false}>
                        <Button icon={<UploadOutlined />} loading={uploadingFile}>
                            Прикрепить файл / фото
                        </Button>
                    </Upload>
                </>
            )}
        </Drawer>
    );
};

const SelfTasksTab = () => {
    const qc = useQueryClient();
    const [modal,      setModal]      = useState(false);
    const [editTask,   setEditTask]   = useState(null);
    const [viewFilter, setViewFilter] = useState('active'); // 'active' | 'completed' | 'all'

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
        onSuccess:  async (task, vars) => {
            // Если есть комментарий — постим его сразу
            if (vars.comment?.trim()) {
                try {
                    const { addComment } = await import('../../shared/api/managedTasksApi');
                    await addComment(task._id, vars.comment.trim());
                } catch {}
            }
            message.success('Задача создана');
            invalidate();
            setModal(false);
        },
        onError: (e) => message.error(e.response?.data?.message || 'Ошибка'),
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

    // Фильтрация по viewFilter
    const filtered = selfTasks.filter((t) => {
        if (viewFilter === 'active')    return t.status !== 'completed' && t.status !== 'cancelled';
        if (viewFilter === 'completed') return t.status === 'completed';
        return true;
    });

    const completedCount = selfTasks.filter((t) => t.status === 'completed').length;
    const activeCount    = selfTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;

    const columns = [
        {
            title: 'Задача', dataIndex: 'title', key: 'title',
            render: (v, r) => (
                <div>
                    <Text strong style={{ fontSize: 13 }}>{v}</Text>
                    {r.client && <div><Text type="secondary" style={{ fontSize: 11 }}><UserOutlined /> {r.client}</Text></div>}
                    {r.description && <div><Text type="secondary" style={{ fontSize: 11 }} ellipsis={{ tooltip: r.description }}>{r.description}</Text></div>}
                </div>
            ),
        },
        {
            title: 'Статус', dataIndex: 'status', key: 'status', width: 140,
            render: (v) => <Badge status={STATUS_COLOR_MAP[v]} text={STATUS_LABEL_MAP[v]} />,
        },
        {
            title: 'Проект', key: 'project', width: 130,
            render: (_, r) => r.project?.name
                ? <Tag icon={<FolderOutlined />} color="purple">{r.project.name}</Tag>
                : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
        },
        {
            title: 'Дата', dataIndex: 'dueDate', key: 'dueDate', width: 110,
            render: (v) => v
                ? <Tag color={dayjs(v).isSame(dayjs(), 'day') ? 'green' : 'default'}>{dayjs(v).format('DD.MM.YYYY')}</Tag>
                : '—',
        },
        {
            title: 'Часы', key: 'hours', width: 90, align: 'center',
            render: (_, r) => (
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {r.actualHours || 0}/{r.estimatedHours || 0}ч
                </Text>
            ),
        },
        {
            title: 'Комм.', key: 'comments', width: 60, align: 'center',
            render: (_, r) => r.comments?.length > 0
                ? <Badge count={r.comments.length} color="#22C55E" style={{ fontSize: 10 }} />
                : <Text type="secondary">—</Text>,
        },
        {
            title: '', key: 'action', width: 60,
            render: (_, r) => (
                <Popconfirm
                    title="Удалить задачу?"
                    onConfirm={(e) => { e.stopPropagation(); deleteMut.mutate(r._id); }}
                    onCancel={(e) => e.stopPropagation()}
                    okText="Да"
                    cancelText="Нет"
                >
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                </Popconfirm>
            ),
        },
    ];

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    Добавить задачу
                </Button>
                <Segmented
                    value={viewFilter}
                    onChange={setViewFilter}
                    options={[
                        { label: `Активные (${activeCount})`,        value: 'active' },
                        { label: `Завершённые (${completedCount})`,  value: 'completed' },
                        { label: 'Все',                              value: 'all' },
                    ]}
                />
            </div>
            <Spin spinning={isLoading}>
                <Table
                    dataSource={filtered}
                    columns={columns}
                    rowKey="_id"
                    size="small"
                    pagination={{ pageSize: 20 }}
                    locale={{ emptyText: 'Нет задач' }}
                    rowClassName={(r) => r.status === 'completed' ? 'task-row-done' : ''}
                    onRow={(r) => ({ onClick: () => openEdit(r), style: { cursor: 'pointer' } })}
                />
            </Spin>
            <SelfTaskDrawer
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
