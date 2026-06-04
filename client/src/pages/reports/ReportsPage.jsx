import React, { useState, useMemo, useEffect } from 'react';
import {
    Typography, Card, Form, DatePicker, Select, Button,
    Table, Space, Tag, message, Drawer, Descriptions, Empty, Segmented, Row, Col, Statistic,
    Input, InputNumber, Popconfirm, Popover, Checkbox, Divider,
} from 'antd';
import {
    FilterOutlined, FileExcelOutlined,
    UserOutlined, CalendarOutlined, CheckCircleOutlined,
    ClockCircleOutlined, FolderOutlined, RobotOutlined, DollarOutlined,
    HourglassOutlined, EditOutlined, SaveOutlined, DeleteOutlined, CloseOutlined,
    PlusOutlined, SettingOutlined, DownOutlined, UpOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import apiClient from '../../shared/api/apiClient';
import {
    createTask, addComment, fetchTaskProjects, createTaskProject,
    fetchSavedClients, createSavedClient, deleteSavedClient,
    updateTask as updateManagedTask, deleteTask as deleteManagedTask,
} from '../../shared/api/managedTasksApi';
import CreatableSelect from '../../shared/ui/CreatableSelect';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const PRESETS = [
    { key: 'today',  label: 'Сегодня',     range: () => [dayjs(), dayjs()] },
    { key: 'yesterday', label: 'Вчера',    range: () => [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
    { key: 'week',   label: 'Эта неделя',  range: () => [dayjs().startOf('isoWeek'), dayjs()] },
    { key: 'month',  label: 'Этот месяц',  range: () => [dayjs().startOf('month'), dayjs()] },
    { key: '30d',    label: '30 дней',     range: () => [dayjs().subtract(30, 'day'), dayjs()] },
];

const STATUS_LABEL = {
    pending:     { text: 'Запланировано', color: 'orange', icon: <HourglassOutlined /> },
    completed:   { text: 'Завершено',     color: 'green',  icon: <CheckCircleOutlined /> },
    failed:      { text: 'Провалено',     color: 'red',    icon: null },
    in_progress: { text: 'В работе',      color: 'blue',   icon: null },
    testing:     { text: 'Тест',          color: 'purple', icon: null },
};

const KIND_LABEL = { work: '💼 Рабочая', external: '🌍 Внешняя' };

// Опции для формы создания задачи (как в «Мои задачи» — создаём ManagedTask)
const SELF_STATUS_OPTIONS = [
    { value: 'pending',     label: 'Ожидает' },
    { value: 'in_progress', label: 'В процессе' },
    { value: 'testing',     label: 'Тестирование' },
    { value: 'completed',   label: 'Выполнено' },
    { value: 'cancelled',   label: 'Отменено' },
];
const TASK_TYPE_OPTIONS = [
    { value: 'daily',   label: 'Дневная'   },
    { value: 'hourly',  label: 'Часовая'   },
    { value: 'weekly',  label: 'Недельная' },
    { value: 'monthly', label: 'Месячная'  },
];

const EXCEL_COLUMNS = [
    { key: 'organization', label: 'Организация' },
    { key: 'customer',     label: 'Заказчик' },
    { key: 'project',      label: 'Проект' },
    { key: 'description',  label: 'Описание задачи' },
    { key: 'executor',     label: 'Исполнитель' },
    { key: 'hours',        label: 'Затраченное время' },
    { key: 'status',       label: 'Статус' },
    { key: 'date',         label: 'Дата' },
];
const DEFAULT_COLS = EXCEL_COLUMNS.map((c) => c.key);
const STORAGE_KEY  = 'excelColsV1';

const ReportsPage = () => {
    const [drawerRow, setDrawerRow] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedCols, setSelectedCols] = useState(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_COLS; } catch { return DEFAULT_COLS; }
    });
    const [colsPopoverOpen, setColsPopoverOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [createDateMode, setCreateDateMode] = useState('today'); // 'today' | 'other'
    const [editForm] = Form.useForm();
    const [createForm] = Form.useForm();
    const [advForm] = Form.useForm();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (drawerRow && editMode) {
            editForm.setFieldsValue({
                title:         drawerRow.title || '',
                description:   drawerRow.description || '',
                hours:         drawerRow.hours || 0,
                customer:      drawerRow.customer?.name || '',
                status:        drawerRow.status || (drawerRow.source === 'managed' ? 'in_progress' : 'completed'),
                kind:          drawerRow.kind || 'work',
                paymentStatus: drawerRow.payment?.status || 'unpaid',
            });
        }
    }, [drawerRow, editMode, editForm]);

    const closeDrawer = () => {
        setDrawerRow(null);
        setEditMode(false);
    };

    const updateMutation = useMutation({
        mutationFn: async ({ id, patch }) => {
            const { data } = await apiClient.patch(`/tasks/${id}`, patch);
            return data.data.task;
        },
        onSuccess: (updated) => {
            message.success('Задача обновлена');
            queryClient.invalidateQueries({ queryKey: ['report'] });
            queryClient.invalidateQueries({ queryKey: ['upcoming-pending'] });
            setDrawerRow((r) => r ? { ...r, ...updated, customer: updated.customer } : r);
            setEditMode(false);
        },
        onError: (err) => {
            message.error('Не удалось обновить: ' + (err?.response?.data?.message || err.message));
        },
    });

    const createMutation = useMutation({
        // Создаём ManagedTask (как в «Мои задачи»); комментарий постим отдельным запросом
        mutationFn: async (payload) => {
            const { comment, ...body } = payload;
            const task = await createTask(body);
            if (comment?.trim()) {
                try { await addComment(task._id, comment.trim()); } catch {}
            }
            return task;
        },
        onSuccess: () => {
            message.success('Задача создана');
            queryClient.invalidateQueries({ queryKey: ['report'] });
            queryClient.invalidateQueries({ queryKey: ['upcoming-pending'] });
            setCreateOpen(false);
            createForm.resetFields();
            setCreateDateMode('today');
        },
        onError: (err) => {
            message.error('Не удалось создать: ' + (err?.response?.data?.message || err.message));
        },
    });

    const onCreateSubmit = () => {
        createForm.validateFields().then((vals) => {
            if (createDateMode === 'other' && !vals.customDate) {
                message.error('Выберите дату');
                return;
            }
            const date = createDateMode === 'today' ? dayjs() : vals.customDate;
            createMutation.mutate({
                title:          vals.title,
                client:         vals.client,
                project:        vals.project || null,
                status:         vals.status,
                type:           vals.type,
                estimatedHours: Number(vals.estimatedHours) || 0,
                actualHours:    Number(vals.actualHours)    || 0,
                description:    vals.description || '',
                isSelfTask:     true,
                startDate:      date.startOf('day').toISOString(),
                dueDate:        date.endOf('day').toISOString(),
                kind:           vals.kind || 'work',
                payment:        { status: vals.kind === 'external' && vals.paymentStatus === 'paid' ? 'paid' : 'unpaid' },
                comment:        vals.comment || '',
            });
        });
    };

    const deleteMutation = useMutation({
        mutationFn: async (id) => apiClient.delete(`/tasks/${id}`),
        onSuccess: () => {
            message.success('Задача удалена');
            queryClient.invalidateQueries({ queryKey: ['report'] });
            queryClient.invalidateQueries({ queryKey: ['upcoming-pending'] });
            closeDrawer();
        },
        onError: (err) => {
            message.error('Не удалось удалить: ' + (err?.response?.data?.message || err.message));
        },
    });

    const updateManagedMutation = useMutation({
        mutationFn: async ({ id, patch }) => updateManagedTask(id, patch),
        onSuccess: (updated) => {
            message.success('Задача обновлена');
            queryClient.invalidateQueries({ queryKey: ['report'] });
            queryClient.invalidateQueries({ queryKey: ['upcoming-pending'] });
            setDrawerRow((r) => r ? {
                ...r,
                title:       updated.title,
                description: updated.description,
                hours:       updated.actualHours || updated.estimatedHours || 0,
                status:      updated.status,
                kind:        updated.kind,
                customer:    updated.client ? { name: updated.client } : null,
                payment:     updated.payment,
            } : r);
            setEditMode(false);
        },
        onError: (err) => {
            message.error('Не удалось обновить: ' + (err?.response?.data?.message || err.message));
        },
    });

    const deleteManagedMutation = useMutation({
        mutationFn: async (id) => deleteManagedTask(id),
        onSuccess: () => {
            message.success('Задача удалена');
            queryClient.invalidateQueries({ queryKey: ['report'] });
            queryClient.invalidateQueries({ queryKey: ['upcoming-pending'] });
            closeDrawer();
        },
        onError: (err) => {
            message.error('Не удалось удалить: ' + (err?.response?.data?.message || err.message));
        },
    });

    const onEditSave = () => {
        editForm.validateFields().then((vals) => {
            const paymentPatch = vals.kind === 'external' ? {
                payment: {
                    ...(drawerRow.payment || {}),
                    status: vals.paymentStatus,
                    paidAt: vals.paymentStatus === 'paid'
                        ? (drawerRow.payment?.paidAt || new Date())
                        : null,
                },
            } : {};

            if (drawerRow.source === 'managed') {
                updateManagedMutation.mutate({
                    id: drawerRow._id,
                    patch: {
                        title:        vals.title,
                        description:  vals.description,
                        actualHours:  Number(vals.hours) || 0,
                        status:       vals.status,
                        kind:         vals.kind,
                        client:       vals.customer || '',
                        ...paymentPatch,
                    },
                });
            } else {
                updateMutation.mutate({
                    id: drawerRow._id,
                    patch: {
                        title:       vals.title,
                        description: vals.description,
                        hours:       Number(vals.hours) || 0,
                        status:      vals.status,
                        kind:        vals.kind,
                        customer:    vals.customer ? { name: vals.customer } : null,
                        ...paymentPatch,
                    },
                });
            }
        });
    };

    const [filters, setFilters] = useState({
        startDate:    dayjs().startOf('month').format('YYYY-MM-DD'),
        endDate:      dayjs().format('YYYY-MM-DD'),
        userId:       null,
        projectNames: [],
        kind:         'all',
        status:       'all',
        payment:      'all',
    });

    const user    = useSelector((state) => state.auth.user);
    const isAdmin = user?.role === 'admin';

    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['users-list'],
        queryFn:  async () => {
            const { data } = await apiClient.get('/auth/users');
            return data.data.users;
        },
        enabled: isAdmin,
    });

    const buildParams = (apiEndDate, { includeFilters = false } = {}) => {
        const { startDate, userId, projectNames, kind, status, payment } = filters;
        const params = new URLSearchParams({ startDate, endDate: apiEndDate });
        if (userId) params.set('userId', userId);
        (projectNames || []).forEach((p) => params.append('projectName', p));
        if (kind && kind !== 'all') params.set('kind', kind);
        if (includeFilters) {
            if (status && status !== 'all') params.set('status', status);
            if (payment && payment !== 'all') params.set('payment', payment);
        }
        return params;
    };

    // Проекты для привязки задачи в форме создания (ManagedTask.project = ObjectId)
    const { data: taskProjects = [] } = useQuery({
        queryKey: ['task-projects'],
        queryFn:  fetchTaskProjects,
    });

    // Сохранённые менеджеры/заказчики (список с возможностью добавлять/удалять)
    const { data: savedClients = [] } = useQuery({
        queryKey: ['saved-clients'],
        queryFn:  fetchSavedClients,
    });

    const createProjectMut = useMutation({
        mutationFn: (name) => createTaskProject({ name }),
        onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['task-projects'] }),
        onError:    (e) => message.error('Не удалось создать проект: ' + (e?.response?.data?.message || e.message)),
    });
    const createClientMut = useMutation({
        mutationFn: (name) => createSavedClient(name),
        onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['saved-clients'] }),
        onError:    (e) => message.error('Не удалось добавить: ' + (e?.response?.data?.message || e.message)),
    });
    const deleteClientMut = useMutation({
        mutationFn: (id) => deleteSavedClient(id),
        onSuccess:  () => { message.success('Удалено из списка'); queryClient.invalidateQueries({ queryKey: ['saved-clients'] }); },
        onError:    (e) => message.error('Не удалось удалить: ' + (e?.response?.data?.message || e.message)),
    });

    const { data: report, isLoading: reportLoading } = useQuery({
        queryKey: ['report', filters],
        queryFn:  async () => {
            const apiEndDate = dayjs(filters.endDate).add(1, 'day').format('YYYY-MM-DD');
            const { data } = await apiClient.get(`/reports/period?${buildParams(apiEndDate).toString()}`);
            return data.data;
        },
    });

    // Запланированные впереди (показываем ВСЕГДА — независимо от фильтра периода)
    const { data: upcomingReport } = useQuery({
        queryKey: ['upcoming-pending', filters.userId],
        queryFn:  async () => {
            const startDate = dayjs().format('YYYY-MM-DD');
            const endDate   = dayjs().add(90, 'day').format('YYYY-MM-DD');
            const params = new URLSearchParams({ startDate, endDate });
            if (filters.userId) params.set('userId', filters.userId);
            const { data } = await apiClient.get(`/reports/period?${params.toString()}`);
            return data.data;
        },
    });

const exportExcel = async () => {
        try {
            const { startDate, endDate, projectNames } = filters;
            const apiEndDate = dayjs(endDate).add(1, 'day').format('YYYY-MM-DD');
            // includeFilters=true — Excel-экспорт уважает статус/оплату
            const params = buildParams(apiEndDate, { includeFilters: true });
            if (selectedCols.length !== DEFAULT_COLS.length) params.set('cols', selectedCols.join(','));
            const response = await apiClient.get(`/reports/export?${params.toString()}`, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href  = window.URL.createObjectURL(blob);
            const suffix = projectNames?.length
                ? `-${projectNames.slice(0, 3).map((n) => n.replace(/[^a-zа-я0-9_-]+/gi, '_')).join('+')}`
                : '';
            link.setAttribute('download', `report-${startDate}-${endDate}${suffix}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success('Отчет экспортирован');
        } catch {
            message.error('Не удалось экспортировать отчет');
        }
    };

    const applyPreset = (key) => {
        const preset = PRESETS.find((p) => p.key === key);
        if (!preset) return;
        const [from, to] = preset.range();
        setFilters((f) => ({ ...f, startDate: from.format('YYYY-MM-DD'), endDate: to.format('YYYY-MM-DD') }));
    };

    const activePreset = useMemo(() => {
        const start = dayjs(filters.startDate);
        const end   = dayjs(filters.endDate);
        for (const p of PRESETS) {
            const [from, to] = p.range();
            if (start.isSame(from, 'day') && end.isSame(to, 'day')) return p.key;
        }
        return null;
    }, [filters.startDate, filters.endDate]);

    const onFilterSubmit = (values) => {
        setFilters((f) => ({
            ...f,
            startDate:    values.dateRange[0].format('YYYY-MM-DD'),
            endDate:      values.dateRange[1].format('YYYY-MM-DD'),
            userId:       values.userId       || null,
            projectNames: values.projectNames || [],
            kind:         values.kind         || 'all',
            status:       values.status       || 'all',
            payment:      values.payment      || 'all',
        }));
    };

    // Все данные (для счётчиков) — без status-фильтра. Включает текущий период + upcoming pending.
    const allRows = useMemo(() => {
        const rows = [];
        const pushFromReport = (rep, sourceTag) => {
            (rep?.logs || []).forEach((log) => {
                const userName  = log.userId?.name  || user?.name  || '—';
                const userEmail = log.userId?.email || user?.email || '—';
                (log.projects || []).forEach((p) => {
                    (p.tasks || []).forEach((t) => rows.push({
                        ...t, _id: t._id, date: log.date,
                        userName, userEmail,
                        projectName: p.name, source: 'log',
                    }));
                });
                (log.orphanTasks || []).forEach((t) => rows.push({
                    ...t, _id: t._id, date: log.date,
                    userName, userEmail,
                    projectName: null, source: 'bot',
                }));
            });
            (rep?.managedTasks || []).forEach((t) => {
                rows.push({
                    _id: t._id,
                    date: t.dueDate || t.completedAt || t.createdAt,
                    userName:  t.createdBy?.name  || user?.name  || '—',
                    userEmail: t.createdBy?.email || user?.email || '—',
                    title: t.title,
                    description: t.description,
                    hours: t.actualHours || t.estimatedHours || 0,
                    status: t.status,
                    customer: t.client ? { name: t.client } : null,
                    kind: t.kind || 'work',
                    payment: t.payment || null,
                    shortCode: t.shortCode || null,
                    projectName: t.project?.name || null,
                    source: 'managed',
                    isSelf: t.isSelfTask,
                });
            });
        };
        pushFromReport(report);
        // Подмерджим pending из upcoming-выборки, которых ещё нет в основном списке
        const seen = new Set(rows.map((r) => String(r._id)));
        (upcomingReport?.logs || []).forEach((log) => {
            const userName  = log.userId?.name  || user?.name  || '—';
            const userEmail = log.userId?.email || user?.email || '—';
            (log.projects || []).forEach((p) => {
                (p.tasks || []).forEach((t) => {
                    if (t.status === 'pending' && !seen.has(String(t._id))) {
                        rows.push({ ...t, _id: t._id, date: log.date, userName, userEmail, projectName: p.name, source: 'log' });
                        seen.add(String(t._id));
                    }
                });
            });
            (log.orphanTasks || []).forEach((t) => {
                if (t.status === 'pending' && !seen.has(String(t._id))) {
                    rows.push({ ...t, _id: t._id, date: log.date, userName, userEmail, projectName: null, source: 'bot' });
                    seen.add(String(t._id));
                }
            });
        });
        rows.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
        return rows;
    }, [report, upcomingReport, user]);

    // С учётом status- и payment-фильтров (для таблицы)
    const flatTasks = useMemo(() => {
        let out = allRows;
        if (filters.status !== 'all') {
            out = out.filter((r) => r.status === filters.status);
        }
        if (filters.payment !== 'all') {
            out = out.filter((r) => {
                if (r.kind !== 'external') return false;
                return (r.payment?.status || 'unpaid') === filters.payment;
            });
        }
        return out;
    }, [allRows, filters.status, filters.payment]);

    // Сводка считается из allRows — чтобы числа не зависели от текущего фильтра
    const summary = useMemo(() => {
        const todayKey = dayjs().format('YYYY-MM-DD');
        const today = allRows.filter((t) => dayjs(t.date).format('YYYY-MM-DD') === todayKey);
        const todayDone = today.filter((t) => t.status === 'completed');
        const todayPlanned = today.filter((t) => t.status === 'pending');
        const periodDone = allRows.filter((t) => t.status === 'completed');
        const periodPlanned = allRows.filter((t) => t.status === 'pending');
        return {
            todayDoneCount: todayDone.length,
            todayDoneHours: todayDone.reduce((s, t) => s + (Number(t.hours) || 0), 0),
            todayPlannedCount: todayPlanned.length,
            periodTotalHours: allRows.reduce((s, t) => s + (Number(t.hours) || 0), 0),
            periodDoneCount: periodDone.length,
            periodPlannedCount: periodPlanned.length,
            periodTasksCount: allRows.length,
        };
    }, [allRows]);

    const columns = [
        {
            title: 'Дата',
            key: 'date',
            width: 130,
            render: (_, r) => {
                const d = dayjs(r.date);
                const isToday = d.isSame(dayjs(), 'day');
                const isTomorrow = d.isSame(dayjs().add(1, 'day'), 'day');
                const isYesterday = d.isSame(dayjs().subtract(1, 'day'), 'day');
                return (
                    <Space direction="vertical" size={0}>
                        <Space size={4}>
                            <CalendarOutlined />
                            <Text style={{ fontSize: 13 }}>{d.format('DD.MM.YYYY')}</Text>
                        </Space>
                        {isToday && <Tag color="green" style={{ margin: 0, fontSize: 10 }}>сегодня</Tag>}
                        {isTomorrow && <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>завтра</Tag>}
                        {isYesterday && <Tag style={{ margin: 0, fontSize: 10 }}>вчера</Tag>}
                    </Space>
                );
            },
        },
        ...(isAdmin ? [{
            title: 'Сотрудник', key: 'user', width: 160,
            render: (_, r) => <Space size={4}><UserOutlined />{r.userName}</Space>,
        }] : []),
        {
            title: 'Задача', key: 'title',
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: 13 }}>{r.title || '—'}</Text>
                    {r.description && (
                        <Text type="secondary" style={{ fontSize: 11 }} ellipsis={{ tooltip: r.description }}>
                            {r.description.length > 80 ? r.description.slice(0, 80) + '…' : r.description}
                        </Text>
                    )}
                    {r.source === 'bot' && <Tag icon={<RobotOutlined />} color="default" style={{ marginTop: 2, fontSize: 10 }}>из бота</Tag>}
                </Space>
            ),
        },
        {
            title: 'Проект', key: 'projectName', width: 160,
            render: (_, r) => r.projectName
                ? <Tag icon={<FolderOutlined />} color="purple">{r.projectName}</Tag>
                : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
        },
        {
            title: 'Заказчик', key: 'customer', width: 140,
            render: (_, r) => r.customer?.name
                ? <Space size={4}><UserOutlined style={{ color: '#888' }} /><Text style={{ fontSize: 12 }}>{r.customer.name}</Text></Space>
                : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
        },
        {
            title: 'Часы', key: 'hours', width: 90, align: 'center', sorter: (a, b) => (a.hours || 0) - (b.hours || 0),
            render: (_, r) => <Tag color="blue"><ClockCircleOutlined /> {r.hours || 0}ч</Tag>,
        },
        {
            title: 'Тип', key: 'kind', width: 110,
            render: (_, r) => {
                if (r.kind !== 'external') return <Text type="secondary" style={{ fontSize: 12 }}>{KIND_LABEL.work}</Text>;
                return (
                    <Space direction="vertical" size={2}>
                        <Text style={{ fontSize: 12 }}>{KIND_LABEL.external}</Text>
                        <Tag color={r.payment?.status === 'paid' ? 'green' : 'orange'} style={{ margin: 0, fontSize: 10 }}>
                            {r.payment?.status === 'paid' ? '💰 Оплачено' : '⌛ Не оплачено'}
                        </Tag>
                        {r.shortCode && <Tag style={{ margin: 0, fontSize: 10 }}>#{r.shortCode}</Tag>}
                    </Space>
                );
            },
        },
        {
            title: 'Статус', key: 'status', width: 140,
            filters: [
                { text: '✅ Завершено',     value: 'completed' },
                { text: '⏳ Запланировано', value: 'pending' },
            ],
            onFilter: (value, r) => r.status === value,
            render: (_, r) => {
                const s = STATUS_LABEL[r.status] || { text: r.status || '—', color: 'default', icon: null };
                return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
            },
        },
    ];

    const todayDateStr = dayjs().format('DD.MM.YYYY');

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <Title level={2} style={{ margin: 0 }}>Центр отчётов</Title>
                <Space>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            createForm.resetFields();
                            createForm.setFieldsValue({
                                type:           'daily',
                                estimatedHours: 1,
                                status:         'in_progress',
                                kind:           'work',
                                paymentStatus:  'unpaid',
                            });
                            setCreateDateMode('today');
                            setCreateOpen(true);
                        }}
                    >
                        Новая задача
                    </Button>
                    <Space.Compact>
                        <Button
                            icon={<FileExcelOutlined />}
                            onClick={exportExcel}
                            style={{ backgroundColor: '#217346', color: '#fff' }}
                            disabled={!flatTasks.length}
                        >
                            Экспорт в Excel
                        </Button>
                        <Popover
                            open={colsPopoverOpen}
                            onOpenChange={setColsPopoverOpen}
                            trigger="click"
                            placement="bottomRight"
                            title="Колонки в Excel"
                            content={
                                <div style={{ minWidth: 200 }}>
                                    <Checkbox.Group
                                        value={selectedCols}
                                        onChange={(vals) => {
                                            setSelectedCols(vals);
                                            localStorage.setItem(STORAGE_KEY, JSON.stringify(vals));
                                        }}
                                        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                                    >
                                        {EXCEL_COLUMNS.map((col) => (
                                            <Checkbox key={col.key} value={col.key}>{col.label}</Checkbox>
                                        ))}
                                    </Checkbox.Group>
                                </div>
                            }
                        >
                            <Button
                                icon={<SettingOutlined />}
                                style={{ backgroundColor: '#1a5c36', color: '#fff', borderLeft: '1px solid #155228' }}
                                title="Настройка колонок"
                            />
                        </Popover>
                    </Space.Compact>
                </Space>
            </div>

            {/* Friendly today summary */}
            <Card
                bordered={false}
                style={{
                    marginBottom: 16,
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #ecfdf5 100%)',
                    border: '1px solid #d1fae5',
                }}
            >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Сегодня · {todayDateStr}</Text>
                    <Space size="large" wrap>
                        <Space size={6}>
                            <CheckCircleOutlined style={{ color: '#22C55E', fontSize: 18 }} />
                            <Text strong style={{ fontSize: 16 }}>
                                Выполнено: {summary.todayDoneCount} {summary.todayDoneCount === 1 ? 'задача' : summary.todayDoneCount < 5 ? 'задачи' : 'задач'}
                            </Text>
                            {summary.todayDoneHours > 0 && (
                                <Text type="secondary" style={{ fontSize: 14 }}>· {summary.todayDoneHours}ч</Text>
                            )}
                        </Space>
                        {summary.todayPlannedCount > 0 && (
                            <Space size={6}>
                                <HourglassOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
                                <Text strong style={{ fontSize: 16 }}>
                                    Запланировано: {summary.todayPlannedCount}
                                </Text>
                            </Space>
                        )}
                        {summary.todayDoneCount === 0 && summary.todayPlannedCount === 0 && (
                            <Text type="secondary">Сегодня записей пока нет 🌤</Text>
                        )}
                    </Space>
                </Space>
            </Card>

            {/* Quick presets + range picker */}
            <Card
                bordered={false}
                style={{ marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                styles={{ body: { padding: 16 } }}
            >
                {/* Верхняя строка: пресеты + range + кнопка фильтров */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 500 }}>Период:</Text>
                        <Segmented
                            value={activePreset || undefined}
                            options={PRESETS.map((p) => ({ label: p.label, value: p.key }))}
                            onChange={applyPreset}
                        />
                        <RangePicker
                            value={[dayjs(filters.startDate), dayjs(filters.endDate)]}
                            onChange={(vals) => {
                                if (!vals) return;
                                setFilters((f) => ({
                                    ...f,
                                    startDate: vals[0].format('YYYY-MM-DD'),
                                    endDate:   vals[1].format('YYYY-MM-DD'),
                                }));
                            }}
                            format="DD.MM.YYYY"
                            allowClear={false}
                        />
                    </div>
                    <Button
                        icon={<SettingOutlined />}
                        onClick={() => setShowAdvanced((s) => !s)}
                        type={showAdvanced ? 'primary' : 'default'}
                        ghost={showAdvanced}
                    >
                        {showAdvanced ? 'Скрыть фильтры' : 'Больше фильтров'}
                        {showAdvanced ? <UpOutlined style={{ fontSize: 10, marginLeft: 4 }} /> : <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />}
                    </Button>
                </div>

                {/* Расширенные фильтры — сетка */}
                {showAdvanced && (
                    <>
                        <div style={{
                            height: 1,
                            background: '#f0f0f0',
                            margin: '16px 0',
                        }} />
                        <Form
                            form={advForm}
                            layout="vertical"
                            onFinish={onFilterSubmit}
                            initialValues={{
                                dateRange:    [dayjs(filters.startDate), dayjs(filters.endDate)],
                                userId:       filters.userId,
                                projectNames: filters.projectNames,
                                kind:         filters.kind,
                                status:       filters.status,
                                payment:      filters.payment,
                            }}
                        >
                            <Row gutter={[16, 0]}>
                                {isAdmin && (
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Form.Item name="userId" label="Сотрудник">
                                            <Select placeholder="Все" allowClear loading={usersLoading}>
                                                {users?.map((u) => (
                                                    <Select.Option key={u._id} value={u._id}>{u.name}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                )}
                                <Col xs={12} sm={12} md={8} lg={4}>
                                    <Form.Item name="kind" label="Тип">
                                        <Select
                                            options={[
                                                { value: 'all',      label: 'Все типы' },
                                                { value: 'work',     label: '💼 Рабочие' },
                                                { value: 'external', label: '🌍 Внешние' },
                                            ]}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={12} sm={12} md={8} lg={5}>
                                    <Form.Item name="status" label="Статус">
                                        <Select
                                            options={[
                                                { value: 'all',       label: 'Все статусы' },
                                                { value: 'completed', label: '✅ Завершено' },
                                                { value: 'pending',   label: '⏳ Запланировано' },
                                            ]}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={12} sm={12} md={8} lg={5}>
                                    <Form.Item name="payment" label="Оплата">
                                        <Select
                                            options={[
                                                { value: 'all',    label: 'Все' },
                                                { value: 'paid',   label: '💰 Оплачено' },
                                                { value: 'unpaid', label: '⌛ Не оплачено' },
                                            ]}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} md={12} lg={isAdmin ? 24 : 10}>
                                    <Form.Item name="projectNames" label="Проекты">
                                        <Select
                                            mode="multiple"
                                            placeholder="Все проекты"
                                            allowClear
                                            showSearch
                                            maxTagCount="responsive"
                                            options={(report?.availableProjects || []).map((p) => ({ value: p, label: p }))}
                                            notFoundContent={reportLoading ? 'Загрузка…' : 'Нет проектов в периоде'}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} md={12} lg={10}>
                                    <Form.Item name="dateRange" label="Свой период">
                                        <RangePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <Button
                                    onClick={() => {
                                        advForm.resetFields();
                                        setFilters((f) => ({
                                            ...f,
                                            userId: null, projectNames: [], kind: 'all', status: 'all', payment: 'all',
                                        }));
                                    }}
                                >
                                    Сбросить
                                </Button>
                                <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
                                    Применить
                                </Button>
                            </div>
                        </Form>
                    </>
                )}
            </Card>

            {/* Stat cards — clickable as status filters */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={12} sm={6}>
                    <Card
                        size="small"
                        hoverable
                        onClick={() => setFilters((f) => ({ ...f, status: 'all' }))}
                        style={{
                            textAlign: 'center',
                            cursor: 'pointer',
                            border: filters.status === 'all' ? '2px solid #1677ff' : undefined,
                        }}
                    >
                        <Statistic
                            title="Всего часов за период"
                            value={summary.periodTotalHours}
                            valueStyle={{ color: '#1677ff' }}
                            suffix="ч"
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card
                        size="small"
                        hoverable
                        onClick={() => setFilters((f) => ({ ...f, status: 'completed' }))}
                        style={{
                            textAlign: 'center',
                            cursor: 'pointer',
                            border: filters.status === 'completed' ? '2px solid #22C55E' : undefined,
                        }}
                    >
                        <Statistic
                            title={<Space size={4}>Сделано задач <Text type="secondary" style={{ fontSize: 11 }}>(клик — фильтр)</Text></Space>}
                            value={summary.periodDoneCount}
                            valueStyle={{ color: '#22C55E' }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card
                        size="small"
                        hoverable
                        onClick={() => setFilters((f) => ({ ...f, status: 'pending' }))}
                        style={{
                            textAlign: 'center',
                            cursor: 'pointer',
                            border: filters.status === 'pending' ? '2px solid #f59e0b' : undefined,
                        }}
                    >
                        <Statistic
                            title={<Space size={4}>Запланировано <Text type="secondary" style={{ fontSize: 11 }}>(клик — фильтр)</Text></Space>}
                            value={summary.periodPlannedCount}
                            valueStyle={{ color: '#f59e0b' }}
                            prefix={<HourglassOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                        <Statistic
                            title="Дней зафиксировано"
                            value={report?.daysWorked || 0}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Active filter indicators */}
            {(filters.status !== 'all' || filters.payment !== 'all') && (
                <div style={{ marginBottom: 12 }}>
                    <Space wrap>
                        {filters.status !== 'all' && (
                            <Tag
                                color={filters.status === 'completed' ? 'green' : 'orange'}
                                closable
                                onClose={() => setFilters((f) => ({ ...f, status: 'all' }))}
                                style={{ fontSize: 13, padding: '4px 10px' }}
                            >
                                Статус: {filters.status === 'completed' ? '✅ Завершённые' : '⏳ Запланированные (за все даты)'}
                            </Tag>
                        )}
                        {filters.payment !== 'all' && (
                            <Tag
                                color={filters.payment === 'paid' ? 'green' : 'volcano'}
                                closable
                                onClose={() => setFilters((f) => ({ ...f, payment: 'all' }))}
                                style={{ fontSize: 13, padding: '4px 10px' }}
                            >
                                Оплата: {filters.payment === 'paid' ? '💰 Оплачено' : '⌛ Не оплачено'} (только внешние)
                            </Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            · Excel при экспорте отразит эти же фильтры
                        </Text>
                    </Space>
                </div>
            )}

            {/* Table */}
            <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Table
                    columns={columns}
                    dataSource={flatTasks}
                    rowKey="_id"
                    loading={reportLoading}
                    pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (n) => `Всего: ${n}` }}
                    size="middle"
                    locale={{ emptyText: <Empty description="За выбранный период задач нет" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    onRow={(r) => ({
                        onClick: () => setDrawerRow(r),
                        style:   { cursor: 'pointer' },
                    })}
                />
            </Card>

            <Drawer
                open={!!drawerRow}
                onClose={closeDrawer}
                placement="right"
                width="50%"
                title={
                    drawerRow ? (
                        <Space>
                            <CalendarOutlined />
                            {dayjs(drawerRow.date).format('DD.MM.YYYY')}
                            <Text type="secondary" style={{ fontSize: 13 }}>· {drawerRow.title || '—'}</Text>
                        </Space>
                    ) : null
                }
                extra={drawerRow && (
                    editMode ? (
                        <Space>
                            <Button onClick={() => setEditMode(false)} icon={<CloseOutlined />}>Отмена</Button>
                            <Button
                                type="primary"
                                onClick={onEditSave}
                                loading={updateMutation.isPending || updateManagedMutation.isPending}
                                icon={<SaveOutlined />}
                            >
                                Сохранить
                            </Button>
                        </Space>
                    ) : (
                        <Space>
                            <Button onClick={() => setEditMode(true)} icon={<EditOutlined />}>Редактировать</Button>
                            <Popconfirm
                                title="Удалить задачу?"
                                description="Это действие нельзя отменить."
                                okText="Удалить"
                                okType="danger"
                                cancelText="Отмена"
                                onConfirm={() =>
                                    drawerRow.source === 'managed'
                                        ? deleteManagedMutation.mutate(drawerRow._id)
                                        : deleteMutation.mutate(drawerRow._id)
                                }
                            >
                                <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={deleteMutation.isPending || deleteManagedMutation.isPending}
                                />
                            </Popconfirm>
                        </Space>
                    )
                )}
                destroyOnHidden
            >
                {drawerRow && !editMode && (() => {
                    const s = STATUS_LABEL[drawerRow.status] || { text: '—', color: 'default' };
                    const isExternal = drawerRow.kind === 'external';
                    const isPaid = drawerRow.payment?.status === 'paid';
                    const items = [
                        { key: 'title',   label: 'Задача',      children: drawerRow.title || '—' },
                        { key: 'desc',    label: 'Описание',    children: drawerRow.description || '—' },
                        { key: 'project', label: 'Проект',      children: drawerRow.projectName || '—' },
                        { key: 'cust',    label: 'Заказчик',    children: drawerRow.customer?.name || '—' },
                        { key: 'exec',    label: 'Исполнитель', children: drawerRow.executor || drawerRow.userName },
                        { key: 'hours',   label: 'Часы',        children: <Tag color="blue"><ClockCircleOutlined /> {drawerRow.hours || 0}ч</Tag> },
                        { key: 'status',  label: 'Статус',      children: <Tag color={s.color} icon={s.icon}>{s.text}</Tag> },
                        { key: 'kind',    label: 'Тип',         children: KIND_LABEL[drawerRow.kind] || KIND_LABEL.work },
                    ];
                    if (isExternal) {
                        items.push({
                            key: 'pay',
                            label: 'Оплата',
                            children: (
                                <Space>
                                    <Tag color={isPaid ? 'green' : 'orange'}>
                                        {isPaid ? '💰 Оплачено' : '⌛ Не оплачено'}
                                    </Tag>
                                    {drawerRow.shortCode && (
                                        <Tag>код #{drawerRow.shortCode}</Tag>
                                    )}
                                    {isPaid && drawerRow.payment?.paidAt && (
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            · {dayjs(drawerRow.payment.paidAt).format('DD.MM.YYYY')}
                                        </Text>
                                    )}
                                </Space>
                            ),
                        });
                    }
                    items.push(
                        { key: 'date', label: 'Дата', children: dayjs(drawerRow.date).format('DD.MM.YYYY') },
                    );
                    return <Descriptions size="small" column={1} bordered items={items} />;
                })()}

                {drawerRow && editMode && (
                    <Form form={editForm} layout="vertical">
                        <Form.Item name="title" label="Задача" rules={[{ required: true, message: 'Укажи название' }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="description" label="Описание">
                            <Input.TextArea rows={3} />
                        </Form.Item>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item name="hours" label="Часы" rules={[{ required: true }]}>
                                    <InputNumber min={0} max={24} step={0.5} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="customer" label="Заказчик">
                                    <Input placeholder="Имя/название" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item name="status" label="Статус">
                                    <Select
                                        options={drawerRow.source === 'managed' ? [
                                            { value: 'pending',     label: '⏳ Ожидает' },
                                            { value: 'in_progress', label: '🔄 В процессе' },
                                            { value: 'testing',     label: '🧪 Тестирование' },
                                            { value: 'completed',   label: '✅ Завершено' },
                                            { value: 'cancelled',   label: '❌ Отменено' },
                                        ] : [
                                            { value: 'completed', label: '✅ Завершено' },
                                            { value: 'pending',   label: '⏳ Запланировано' },
                                        ]}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="kind" label="Тип">
                                    <Select
                                        options={[
                                            { value: 'work',     label: '💼 Рабочая' },
                                            { value: 'external', label: '🌍 Внешняя' },
                                        ]}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item
                            shouldUpdate={(prev, cur) => prev.kind !== cur.kind}
                            noStyle
                        >
                            {({ getFieldValue }) => getFieldValue('kind') === 'external' && (
                                <Form.Item name="paymentStatus" label="Оплата">
                                    <Select
                                        options={[
                                            { value: 'unpaid', label: '⌛ Не оплачено' },
                                            { value: 'paid',   label: '💰 Оплачено' },
                                        ]}
                                    />
                                </Form.Item>
                            )}
                        </Form.Item>
                    </Form>
                )}
            </Drawer>

            <Drawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Новая задача"
                placement="right"
                width="60%"
                destroyOnHidden
                footer={
                    <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                        <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
                        <Button type="primary" loading={createMutation.isPending} onClick={onCreateSubmit}>
                            Создать
                        </Button>
                    </Space>
                }
            >
                <Form form={createForm} layout="vertical">
                    <Form.Item label={<b>На какой день?</b>} style={{ marginBottom: 12 }}>
                        <Segmented
                            block
                            value={createDateMode}
                            onChange={setCreateDateMode}
                            options={[
                                { label: '📅 На сегодня',     value: 'today' },
                                { label: '📆 На другой день', value: 'other' },
                            ]}
                        />
                        {createDateMode === 'other' && (
                            <Form.Item name="customDate" noStyle rules={[{ required: true, message: 'Выберите дату' }]}>
                                <DatePicker style={{ width: '100%', marginTop: 8 }} format="DD.MM.YYYY" placeholder="Выберите дату" />
                            </Form.Item>
                        )}
                    </Form.Item>

                    <Divider style={{ margin: '0 0 12px' }} />

                    <Form.Item name="title" label="Название задачи" rules={[{ required: true, message: 'Введите название' }]}>
                        <Input placeholder="Что нужно сделать?" autoFocus />
                    </Form.Item>

                    <Form.Item name="client" label="Менеджер / Заказчик" rules={[{ required: true, message: 'Укажите менеджера или заказчика' }]}>
                        <CreatableSelect
                            placeholder="Выберите или добавьте"
                            options={(savedClients || []).map((c) => ({ value: c.name, label: c.name, _id: c._id }))}
                            onCreate={async (name) => { await createClientMut.mutateAsync(name); return name; }}
                            onDelete={(opt) => deleteClientMut.mutate(opt._id)}
                            creating={createClientMut.isPending}
                        />
                    </Form.Item>

                    <Form.Item name="project" label="Проект (необязательно)">
                        <CreatableSelect
                            placeholder="Без проекта"
                            options={(taskProjects || []).map((p) => ({ value: p._id, label: p.name, _id: p._id }))}
                            onCreate={async (name) => { const p = await createProjectMut.mutateAsync(name); return p._id; }}
                            creating={createProjectMut.isPending}
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
                                <Select options={TASK_TYPE_OPTIONS} />
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

                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="kind" label="Вид" rules={[{ required: true }]}>
                                <Select
                                    options={[
                                        { value: 'work',     label: '💼 Рабочая' },
                                        { value: 'external', label: '🌍 Внешняя' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            {/* Оплата появляется только у внешней задачи; у рабочей поле исчезает */}
                            <Form.Item shouldUpdate={(prev, cur) => prev.kind !== cur.kind} noStyle>
                                {({ getFieldValue }) => getFieldValue('kind') === 'external' && (
                                    <Form.Item name="paymentStatus" label="Оплата">
                                        <Select
                                            options={[
                                                { value: 'unpaid', label: '⌛ Не оплачено' },
                                                { value: 'paid',   label: '💰 Оплачено' },
                                            ]}
                                        />
                                    </Form.Item>
                                )}
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="description" label="Детали задачи">
                        <Input.TextArea autoSize={{ minRows: 3 }} placeholder="Подробное описание..." />
                    </Form.Item>

                    <Form.Item name="comment" label="Причина / Комментарий">
                        <Input.TextArea rows={2} placeholder="Причина, заметка или комментарий..." />
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
};

export default ReportsPage;
