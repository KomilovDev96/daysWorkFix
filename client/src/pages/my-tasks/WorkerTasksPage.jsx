import React, { useState, useRef } from 'react';
import {
    Card, Tabs, Table, Button, Modal, Form, Input, Select, AutoComplete,
    DatePicker, InputNumber, Tag, Space, Typography, Popconfirm,
    Badge, Spin, message, Tooltip, Row, Col, Empty, Avatar,
    Segmented, Divider, Drawer, Upload, Image, List, Progress,
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

// Статусы на которые воркер может переключить карточку (назначенные менеджером)
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

const TYPE_FILTER_OPTIONS = [
    { value: 'all',     label: 'Все' },
    { value: 'hourly',  label: 'Часовые' },
    { value: 'daily',   label: 'Дневные' },
    { value: 'weekly',  label: 'Недельные' },
    { value: 'monthly', label: 'Месячные' },
];

const AssignedTasksKanban = ({ onCreateSelfTask }) => {
    const qc = useQueryClient();
    const [changingId,    setChangingId]    = useState(null);
    const [commentTask,   setCommentTask]   = useState(null);
    const [search,        setSearch]        = useState('');
    const [typeFilter,    setTypeFilter]    = useState('all');
    const [onlyHot,       setOnlyHot]       = useState(false);
    const [hintOpen,      setHintOpen]      = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['my-tasks'],
        queryFn:  () => fetchTasks({}),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, status }) => updateTask(id, { status }),
        onMutate:   ({ id }) => setChangingId(id),
        onSettled:  () => setChangingId(null),
        onSuccess:  () => {
            message.success('Статус обновлён');
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
        },
        onError: (e) => message.error(e.response?.data?.message || 'Ошибка'),
    });

    // Только назначенные мне задачи (не isSelfTask)
    const assignedTasksAll = (data?.tasks ?? []).filter((t) => !t.isSelfTask);

    // Применяем фильтры (поиск, тип, only hot)
    const applyFilters = (list) => list.filter((t) => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (onlyHot && !t.isHot) return false;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            const hay = `${t.title || ''} ${t.description || ''} ${t.client || ''} ${t.createdBy?.name || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    const assignedTasks = applyFilters(assignedTasksAll);

    // Активные задачи (pending / in_progress / testing)
    const activeTasks = assignedTasks.filter((t) => ['pending', 'in_progress', 'testing'].includes(t.status));

    // Только сегодня выполненные (completedAt === сегодня; для старых записей — fallback на updatedAt)
    const todayDone = assignedTasks.filter((t) => {
        if (t.status !== 'completed') return false;
        const when = t.completedAt || t.updatedAt;
        return when && dayjs(when).isSame(dayjs(), 'day');
    });

    const byStatus = {};
    ACTIVE_STATUSES.forEach((s) => { byStatus[s.key] = []; });
    activeTasks.forEach((t) => {
        if (byStatus[t.status]) byStatus[t.status].push(t);
    });

    if (isLoading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;

    const hasAnyAssigned = assignedTasksAll.length > 0;
    const hasFilters = search.trim() || typeFilter !== 'all' || onlyHot;

    return (
        <div>
            {/* Toolbar — поиск и фильтры (только когда есть назначенные задачи) */}
            {hasAnyAssigned && (
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 8,
                    alignItems: 'center', marginBottom: 12,
                }}>
                    <Input
                        allowClear
                        placeholder="Поиск по названию, заказчику, менеджеру…"
                        prefix={<EyeOutlined style={{ color: '#bbb' }} />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ flex: '1 1 240px', maxWidth: 360 }}
                    />
                    <Segmented
                        size="small"
                        value={typeFilter}
                        onChange={setTypeFilter}
                        options={TYPE_FILTER_OPTIONS}
                    />
                    <Button
                        size="small"
                        type={onlyHot ? 'primary' : 'default'}
                        danger={onlyHot}
                        icon={<FireOutlined />}
                        onClick={() => setOnlyHot((v) => !v)}
                    >
                        Только горячие
                    </Button>
                    <Button
                        size="small"
                        type="text"
                        onClick={() => setHintOpen((v) => !v)}
                        style={{ marginLeft: 'auto', color: '#2f54eb' }}
                    >
                        {hintOpen ? 'Скрыть подсказку' : 'Как работают статусы?'}
                    </Button>
                </div>
            )}

            {hintOpen && (
                <div style={{
                    background: '#f0f5ff', border: '1px solid #adc6ff',
                    borderRadius: 6, padding: '8px 12px', marginBottom: 12,
                    fontSize: 12, color: '#2f54eb',
                }}>
                    <b>Поток статусов:</b>&nbsp;
                    Ожидает → <b>Начать</b> → В процессе → <b>Отправить на тест</b> → Тестирование → <i>Менеджер одобряет</i> → ✅ Выполнено
                </div>
            )}

            {/* Большой empty state — когда менеджер ничего не назначил */}
            {!hasAnyAssigned ? (
                <div style={{ padding: '40px 16px' }}>
                    <Empty
                        image="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg"
                        imageStyle={{ height: 100 }}
                        description={
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 4 }}>
                                    Менеджер ещё не назначил вам задачи
                                </div>
                                <Text type="secondary" style={{ fontSize: 13 }}>
                                    Пока пусто — ждите назначения от менеджера.
                                </Text>
                            </div>
                        }
                    />
                </div>
            ) : activeTasks.length === 0 && hasFilters ? (
                <div style={{ padding: '24px 16px' }}>
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={<Text type="secondary">Ничего не найдено по выбранным фильтрам</Text>}
                    >
                        <Button onClick={() => { setSearch(''); setTypeFilter('all'); setOnlyHot(false); }}>
                            Сбросить фильтры
                        </Button>
                    </Empty>
                </div>
            ) : (
                /* Активные колонки */
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
            )}

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

const SelfTaskDrawer = ({ open, onClose, onSave, initial, projects, saving }) => {
    const [form]         = Form.useForm();
    const [dateMode,     setDateMode]     = useState('today');
    const [commentText,  setCommentText]  = useState('');
    const [addingCmt,    setAddingCmt]    = useState(false);
    const [uploadingFile,setUploadingFile]= useState(false);

    // Дедлайн не может быть в прошлом; начало — не позже сегодня + 1 года
    const disablePastDate = (d) => d && d.isBefore(dayjs().startOf('day'));
    const disableFarFuture = (d) => d && (d.isBefore(dayjs().subtract(7, 'day').startOf('day')) || d.isAfter(dayjs().add(1, 'year')));

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
            width={Math.min(880, typeof window !== 'undefined' ? window.innerWidth * 0.9 : 880)}
            title={
                <Space>
                    <CalendarOutlined style={{ color: '#22C55E' }} />
                    {initial ? 'Редактировать задачу' : 'Новая задача'}
                </Space>
            }
            footer={
                <div style={{ textAlign: 'right' }}>
                    <Space>
                        <Button onClick={onClose} disabled={saving}>Отмена</Button>
                        <Button type="primary" onClick={handleSave} loading={saving}>
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
                                <DatePicker style={{ width: '100%', marginTop: 8 }} format="DD.MM.YYYY" placeholder="Выберите дату" disabledDate={disableFarFuture} />
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
                                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" disabledDate={disableFarFuture} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dueDate" label="Дедлайн">
                                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" disabledDate={disablePastDate} />
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

const SelfTasksTab = ({ autoOpenCreate, onConsumedAutoOpen }) => {
    const qc = useQueryClient();
    const [modal,      setModal]      = useState(false);
    const [editTask,   setEditTask]   = useState(null);
    const [viewFilter, setViewFilter] = useState('active'); // 'active' | 'completed' | 'all'
    const [statusBusyId, setStatusBusyId] = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ['my-tasks'],
        queryFn:  () => fetchTasks({}),
    });

    React.useEffect(() => {
        if (autoOpenCreate) {
            setEditTask(null);
            setModal(true);
            onConsumedAutoOpen?.();
        }
    }, [autoOpenCreate, onConsumedAutoOpen]);

    const { data: projects = [] } = useQuery({
        queryKey: ['task-projects'],
        queryFn:  fetchTaskProjects,
    });

    const { data: managers = [] } = useQuery({
        queryKey: ['managers'],
        queryFn:  fetchManagers,
    });

    const selfTasks = (data?.tasks ?? []).filter((t) => t.isSelfTask);
    const invalidate = () => qc.invalidateQueries({ queryKey: ['my-tasks'] });

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
    const inlineStatusMut = useMutation({
        mutationFn: ({ id, status }) => updateTask(id, { status }),
        onMutate:   ({ id }) => setStatusBusyId(id),
        onSettled:  () => setStatusBusyId(null),
        onSuccess:  () => { message.success('Статус обновлён'); invalidate(); },
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
        if (viewFilter === 'active'    && (t.status === 'completed' || t.status === 'cancelled')) return false;
        if (viewFilter === 'completed' && t.status !== 'completed') return false;
        return true;
    });

    const completedCount = selfTasks.filter((t) => t.status === 'completed').length;
    const activeCount    = selfTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;
    const hasAnySelf     = selfTasks.length > 0;

    const isOverdue = (t) =>
        t.dueDate && t.status !== 'completed' && t.status !== 'cancelled' &&
        dayjs(t.dueDate).isBefore(dayjs(), 'day');

    const columns = [
        {
            title: 'Задача', dataIndex: 'title', key: 'title',
            render: (v, r) => (
                <div>
                    <Space size={6} align="center" style={{ marginBottom: 2 }}>
                        {r.isHot && <Tooltip title="Горящая"><FireOutlined style={{ color: '#ff4d4f' }} /></Tooltip>}
                        <Text strong style={{ fontSize: 13 }}>{v}</Text>
                    </Space>
                    <Space size={8} wrap>
                        {r.client && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                <UserOutlined /> {r.client}
                            </Text>
                        )}
                        {r.project?.name && (
                            <Tag icon={<FolderOutlined />} color="purple" style={{ margin: 0, fontSize: 10, padding: '0 6px' }}>
                                {r.project.name}
                            </Tag>
                        )}
                    </Space>
                    {r.description && (
                        <div>
                            <Text type="secondary" style={{ fontSize: 11 }} ellipsis={{ tooltip: r.description }}>
                                {r.description}
                            </Text>
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Тип', dataIndex: 'type', key: 'type', width: 100,
            sorter: (a, b) => (a.type || '').localeCompare(b.type || ''),
            render: (v) => v ? <Tag color={TYPE_COLOR[v]} style={{ margin: 0 }}>{TYPE_LABEL[v]}</Tag> : '—',
        },
        {
            title: 'Статус', dataIndex: 'status', key: 'status', width: 160,
            render: (v, r) => (
                <Select
                    size="small"
                    variant="borderless"
                    value={v}
                    loading={statusBusyId === r._id}
                    disabled={statusBusyId === r._id}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(newStatus) => inlineStatusMut.mutate({ id: r._id, status: newStatus })}
                    options={SELF_STATUS_OPTIONS.map((o) => ({
                        value: o.value,
                        label: <Badge status={STATUS_COLOR_MAP[o.value]} text={o.label} />,
                    }))}
                    style={{ width: '100%' }}
                />
            ),
        },
        {
            title: 'Дедлайн', dataIndex: 'dueDate', key: 'dueDate', width: 120,
            sorter: (a, b) => {
                const ax = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                const bx = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                return ax - bx;
            },
            render: (v, r) => {
                if (!v) return <Text type="secondary">—</Text>;
                const d = dayjs(v);
                const overdue = isOverdue(r);
                const today = d.isSame(dayjs(), 'day');
                const color = overdue ? 'red' : today ? 'green' : 'default';
                return (
                    <Tooltip title={overdue ? 'Просрочено' : today ? 'Сегодня' : ''}>
                        <Tag color={color} style={{ margin: 0 }}>{d.format('DD.MM.YYYY')}</Tag>
                    </Tooltip>
                );
            },
        },
        {
            title: 'Часы', key: 'hours', width: 130, align: 'center',
            sorter: (a, b) => (a.actualHours || 0) - (b.actualHours || 0),
            render: (_, r) => {
                const plan = r.estimatedHours || 0;
                const fact = r.actualHours || 0;
                if (!plan && !fact) return <Text type="secondary">—</Text>;
                const pct = plan > 0 ? Math.min(100, Math.round((fact / plan) * 100)) : 0;
                const over = plan > 0 && fact > plan;
                return (
                    <div>
                        <Progress
                            percent={pct}
                            size="small"
                            showInfo={false}
                            strokeColor={over ? '#ff4d4f' : pct >= 100 ? '#52c41a' : '#1677ff'}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {fact}/{plan}ч{over ? ' ⚠️' : ''}
                        </Text>
                    </div>
                );
            },
        },
        {
            title: 'Комм.', key: 'comments', width: 60, align: 'center',
            render: (_, r) => r.comments?.length > 0
                ? <Badge count={r.comments.length} color="#22C55E" style={{ fontSize: 10 }} />
                : <Text type="secondary">—</Text>,
        },
        {
            title: '', key: 'action', width: 110, align: 'right',
            render: (_, r) => {
                const canComplete = r.status !== 'completed' && r.status !== 'cancelled';
                return (
                    <Space size={4} onClick={(e) => e.stopPropagation()}>
                        {canComplete && (
                            <Tooltip title="Отметить выполненной">
                                <Button
                                    size="small"
                                    type="text"
                                    style={{ color: '#52c41a' }}
                                    icon={<CheckOutlined />}
                                    loading={statusBusyId === r._id}
                                    onClick={() => inlineStatusMut.mutate({ id: r._id, status: 'completed' })}
                                />
                            </Tooltip>
                        )}
                        <Popconfirm
                            title="Удалить задачу?"
                            description="Это действие нельзя отменить."
                            onConfirm={() => deleteMut.mutate(r._id)}
                            okText="Удалить"
                            cancelText="Отмена"
                            okButtonProps={{ danger: true }}
                        >
                            <Button size="small" danger type="text" icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Space>
                );
            },
        },
    ];

    const emptyBlock = !hasAnySelf ? (
        <div style={{ padding: '40px 16px' }}>
            <Empty
                image="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg"
                imageStyle={{ height: 100 }}
                description={
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 4 }}>
                            У вас пока нет личных задач
                        </div>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            Создайте задачу, чтобы зафиксировать что нужно сделать сегодня.
                        </Text>
                    </div>
                }
            >
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreate}>
                    Добавить первую задачу
                </Button>
            </Empty>
        </div>
    ) : filtered.length === 0 ? (
        <div style={{ padding: '24px 16px' }}>
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">В этом разделе задач нет</Text>}
            >
                <Button onClick={() => setViewFilter('all')}>Показать все</Button>
            </Empty>
        </div>
    ) : null;

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <Space wrap>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                        Добавить задачу
                    </Button>
                    {hasAnySelf && (
                        <Segmented
                            value={viewFilter}
                            onChange={setViewFilter}
                            options={[
                                { label: `Активные (${activeCount})`,        value: 'active' },
                                { label: `Завершённые (${completedCount})`,  value: 'completed' },
                                { label: 'Все',                              value: 'all' },
                            ]}
                        />
                    )}
                </Space>
            </div>

            <Spin spinning={isLoading}>
                {emptyBlock || (
                    <Table
                        dataSource={filtered}
                        columns={columns}
                        rowKey="_id"
                        size="small"
                        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
                        rowClassName={(r) => {
                            if (r.status === 'completed') return 'task-row-done';
                            if (isOverdue(r)) return 'task-row-overdue';
                            return r.isHot ? 'task-row-hot' : '';
                        }}
                        onRow={(r) => ({ onClick: () => openEdit(r), style: { cursor: 'pointer' } })}
                    />
                )}
            </Spin>

            <SelfTaskDrawer
                open={modal}
                onClose={() => { setModal(false); setEditTask(null); }}
                onSave={handleSave}
                initial={editTask}
                projects={projects}
                managers={managers}
                saving={createMut.isPending || updateMut.isPending}
            />
        </>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Шапка-сводка — мини-метрики дня
// ═══════════════════════════════════════════════════════════════════════════════

const TodaySummary = () => {
    const { data } = useQuery({
        queryKey: ['my-tasks'],
        queryFn:  () => fetchTasks({}),
    });

    const tasks = data?.tasks ?? [];
    const today = dayjs();

    const isToday = (d) => d && dayjs(d).isSame(today, 'day');
    const isThisWeek = (d) => d && dayjs(d).isSame(today, 'week');

    const inWork = tasks.filter((t) => ['pending', 'in_progress', 'testing'].includes(t.status)).length;
    const doneToday = tasks.filter((t) => t.status === 'completed' && isToday(t.completedAt || t.updatedAt)).length;
    const dueThisWeek = tasks.filter((t) =>
        ['pending', 'in_progress', 'testing'].includes(t.status) && isThisWeek(t.dueDate)
    ).length;
    const overdue = tasks.filter((t) =>
        ['pending', 'in_progress', 'testing'].includes(t.status) &&
        t.dueDate && dayjs(t.dueDate).isBefore(today, 'day')
    ).length;
    const hotCount = tasks.filter((t) =>
        ['pending', 'in_progress', 'testing'].includes(t.status) && t.isHot
    ).length;

    const cards = [
        { label: 'В работе',      value: inWork,      color: '#1677ff', icon: <PlayCircleOutlined /> },
        { label: 'Готово сегодня', value: doneToday,  color: '#52c41a', icon: <CheckOutlined /> },
        { label: 'На этой неделе', value: dueThisWeek, color: '#fa8c16', icon: <CalendarOutlined /> },
        { label: 'Просрочено',    value: overdue,     color: '#ff4d4f', icon: <ClockCircleOutlined /> },
        { label: 'Горячие',       value: hotCount,    color: '#cf1322', icon: <FireOutlined /> },
    ];

    return (
        <Row gutter={[12, 12]}>
            {cards.map((c) => (
                <Col xs={12} sm={8} md={Math.floor(24 / cards.length)} key={c.label}>
                    <Card size="small" bodyStyle={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: `${c.color}15`, color: c.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 18, flexShrink: 0,
                            }}>{c.icon}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.2 }}>{c.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: c.color, lineHeight: 1.2 }}>
                                    {c.value}
                                </div>
                            </div>
                        </div>
                    </Card>
                </Col>
            ))}
        </Row>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Главный компонент
// ═══════════════════════════════════════════════════════════════════════════════

const WorkerTasksPage = () => {
    const [activeTab, setActiveTab] = useState('assigned');
    const [autoOpenCreate, setAutoOpenCreate] = useState(false);

    const { data } = useQuery({
        queryKey: ['my-tasks'],
        queryFn:  () => fetchTasks({}),
    });
    const all = data?.tasks ?? [];
    const assignedCount = all.filter((t) => !t.isSelfTask && ['pending', 'in_progress', 'testing'].includes(t.status)).length;
    const selfCount     = all.filter((t) =>  t.isSelfTask && t.status !== 'completed' && t.status !== 'cancelled').length;

    const handleCreateSelfTask = () => {
        setActiveTab('self');
        setAutoOpenCreate(true);
    };

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Title level={3} style={{ margin: 0 }}>Мои задачи</Title>
            </div>

            <TodaySummary />

            <Card bodyStyle={{ padding: '12px 16px' }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key:   'assigned',
                            label: (
                                <Space size={6}>
                                    <span>Задачи от менеджера</span>
                                    {assignedCount > 0 && <Badge count={assignedCount} color="#1677ff" />}
                                </Space>
                            ),
                            children: <AssignedTasksKanban onCreateSelfTask={handleCreateSelfTask} />,
                        },
                        {
                            key:   'self',
                            label: (
                                <Space size={6}>
                                    <span>Мои личные задачи</span>
                                    {selfCount > 0 && <Badge count={selfCount} color="#52c41a" />}
                                </Space>
                            ),
                            children: (
                                <SelfTasksTab
                                    autoOpenCreate={autoOpenCreate && activeTab === 'self'}
                                    onConsumedAutoOpen={() => setAutoOpenCreate(false)}
                                />
                            ),
                        },
                    ]}
                />
            </Card>
        </Space>
    );
};

export default WorkerTasksPage;
