import React, { useState } from 'react';
import {
    Typography, Card, Button, Table, Tag, Space, Modal, Form, Input,
    Select, DatePicker, message, Popconfirm, Drawer, InputNumber,
    Row, Col, Statistic, Progress, Empty, Tooltip, Badge, Checkbox,
    Avatar, List, Divider, Upload, Image
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, FileExcelOutlined,
    ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined,
    UnorderedListOutlined, ArrowLeftOutlined, ExclamationCircleOutlined,
    TeamOutlined, UserAddOutlined, UserDeleteOutlined, MessageOutlined,
    SendOutlined, PaperClipOutlined, UploadOutlined, FileImageOutlined,
    FilePdfOutlined, FileOutlined, EyeOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const PROJECT_STATUS = {
    planning: { label: 'Планирование', color: 'default' },
    active: { label: 'Активный', color: 'green' },
    completed: { label: 'Завершён', color: 'blue' },
    paused: { label: 'На паузе', color: 'orange' },
};

const TASK_STATUS = {
    todo: { label: 'К выполнению', color: 'default' },
    in_progress: { label: 'В процессе', color: 'processing' },
    done: { label: 'Выполнено', color: 'success' },
    cancelled: { label: 'Отменено', color: 'error' },
};

const TASK_PRIORITY = {
    low: { label: 'Низкий', color: 'default' },
    medium: { label: 'Средний', color: 'blue' },
    high: { label: 'Высокий', color: 'orange' },
    critical: { label: 'Критический', color: 'red' },
};

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace('/api', '');

const getFileIcon = (type) => {
    if (['jpg','jpeg','png','gif','webp','svg'].includes(type)) return <FileImageOutlined style={{ color: '#1677ff' }} />;
    if (type === 'pdf') return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    return <FileOutlined style={{ color: '#8c8c8c' }} />;
};

const isImage = (type) => ['jpg','jpeg','png','gif','webp','svg'].includes(type);

// ── Files Drawer ──────────────────────────────────────────────────────────────
const FilesDrawer = ({ open, task, project, onClose, onUploaded }) => {
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const token = useSelector((s) => s.auth.token);

    const files = task?.files || [];

    const handleUpload = async ({ file, onSuccess, onError }) => {
        const formData = new FormData();
        formData.append('file', file);
        setUploading(true);
        try {
            const { data } = await apiClient.post(
                `/board-projects/${project._id}/tasks/${task._id}/files`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            onSuccess(data);
            onUploaded(data.data.project);
            message.success(`${file.name} загружен`);
        } catch {
            onError(new Error('Ошибка загрузки'));
            message.error('Не удалось загрузить файл');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (fileId) => {
        try {
            const { data } = await apiClient.delete(
                `/board-projects/${project._id}/tasks/${task._id}/files/${fileId}`
            );
            // после удаления обновляем через getOne
            const res = await apiClient.get(`/board-projects/${project._id}`);
            onUploaded(res.data.data.project);
            message.success('Файл удалён');
        } catch {
            message.error('Не удалось удалить файл');
        }
    };

    return (
        <Drawer
            title={
                <Space>
                    <PaperClipOutlined />
                    Файлы задачи: {task?.title}
                </Space>
            }
            open={open}
            onClose={onClose}
            width={460}
        >
            {/* Upload zone */}
            <Upload.Dragger
                customRequest={handleUpload}
                showUploadList={false}
                multiple={false}
                disabled={uploading}
                style={{ marginBottom: 20 }}
            >
                <p className="ant-upload-drag-icon">
                    <UploadOutlined style={{ fontSize: 32, color: '#1677ff' }} />
                </p>
                <p style={{ fontSize: 15 }}>Перетащите файл или нажмите для загрузки</p>
                <p style={{ color: '#999', fontSize: 12 }}>
                    Скриншоты, PDF, документы — до 5 МБ
                </p>
            </Upload.Dragger>

            {files.length === 0 && (
                <Empty description="Файлов нет" style={{ marginBottom: 16 }} />
            )}

            {/* File list */}
            <List
                dataSource={files}
                renderItem={(f) => (
                    <List.Item
                        key={f._id}
                        style={{ padding: '8px 0' }}
                        actions={[
                            <Tooltip title="Открыть" key="open">
                                <Button
                                    size="small"
                                    icon={<EyeOutlined />}
                                    onClick={() => {
                                        if (isImage(f.fileType)) {
                                            setPreviewUrl(`${API_BASE}/${f.fileUrl}`);
                                        } else {
                                            window.open(`${API_BASE}/${f.fileUrl}`, '_blank');
                                        }
                                    }}
                                />
                            </Tooltip>,
                            <Popconfirm key="del" title="Удалить файл?" onConfirm={() => handleDelete(f._id)}>
                                <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>,
                        ]}
                    >
                        <List.Item.Meta
                            avatar={
                                isImage(f.fileType)
                                    ? <Image
                                        src={`${API_BASE}/${f.fileUrl}`}
                                        width={40}
                                        height={40}
                                        style={{ objectFit: 'cover', borderRadius: 4 }}
                                        preview={false}
                                      />
                                    : <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 4, fontSize: 22 }}>
                                        {getFileIcon(f.fileType)}
                                      </div>
                            }
                            title={
                                <Text style={{ fontSize: 13 }} ellipsis={{ tooltip: f.originalName }}>
                                    {f.originalName}
                                </Text>
                            }
                            description={
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {f.fileType?.toUpperCase()} · {dayjs(f.uploadedAt).format('DD.MM.YYYY HH:mm')}
                                </Text>
                            }
                        />
                    </List.Item>
                )}
            />

            {/* Image preview */}
            <Image
                style={{ display: 'none' }}
                preview={{
                    visible: !!previewUrl,
                    src: previewUrl,
                    onVisibleChange: (v) => { if (!v) setPreviewUrl(null); },
                }}
            />
        </Drawer>
    );
};

// ── Clients Drawer ────────────────────────────────────────────────────────────
const ClientsDrawer = ({ open, project, users, clientForm, onClose, addClient, removeClient }) => {
    const { data: clientsData, isLoading } = useQuery({
        queryKey: ['project-clients', project?._id],
        queryFn: async () => {
            const { data } = await apiClient.get(`/board-projects/${project._id}`);
            return data.data.project.clients || [];
        },
        enabled: !!project?._id && open,
    });

    const clients = clientsData || project?.clients || [];
    const guests = users?.filter((u) => u.role === 'guest') || [];

    return (
        <Drawer
            title={`Клиенты проекта: ${project?.name}`}
            open={open}
            onClose={onClose}
            width={420}
        >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Клиенты (роль «Гость») видят прогресс проекта и могут оставлять комментарии.
            </Text>

            <Form form={clientForm} layout="inline" style={{ marginBottom: 20 }}
                onFinish={(v) => addClient.mutate({ projectId: project._id, userId: v.userId })}
            >
                <Form.Item name="userId" rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Select placeholder="Выберите клиента (гость)" style={{ minWidth: 220 }}>
                        {guests.map((u) => (
                            <Select.Option key={u._id} value={u._id}>
                                {u.name} — {u.email}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" icon={<UserAddOutlined />}
                        loading={addClient.isPending}>
                        Добавить
                    </Button>
                </Form.Item>
            </Form>

            {guests.length === 0 && (
                <Tag color="orange" style={{ marginBottom: 16 }}>
                    Нет пользователей с ролью «Гость». Создайте их в разделе Пользователи.
                </Tag>
            )}

            <Divider>Текущие клиенты</Divider>

            {clients.length === 0 && <Empty description="Нет клиентов" />}
            {clients.map((c) => (
                <Card key={c._id || c} size="small" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                            <Avatar style={{ background: '#1677ff' }}>
                                {(c.name || '?')[0].toUpperCase()}
                            </Avatar>
                            <div>
                                <Text strong>{c.name || '—'}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>{c.email}</Text>
                            </div>
                        </Space>
                        <Popconfirm title="Убрать клиента?" onConfirm={() =>
                            removeClient.mutate({ projectId: project._id, userId: c._id || c })
                        }>
                            <Button size="small" danger icon={<UserDeleteOutlined />} />
                        </Popconfirm>
                    </div>
                </Card>
            ))}
        </Drawer>
    );
};

// ── Comments Drawer ───────────────────────────────────────────────────────────
const CommentsDrawer = ({ open, project, user, onClose }) => {
    const queryClient = useQueryClient();
    const [text, setText] = useState('');

    const { data: comments } = useQuery({
        queryKey: ['project-comments', project?._id],
        queryFn: async () => {
            const { data } = await apiClient.get(`/portal/projects/${project._id}/comments`);
            return data.data.comments;
        },
        enabled: !!project?._id && open,
        refetchInterval: open ? 10000 : false,
    });

    const addComment = useMutation({
        mutationFn: (t) => apiClient.post(`/portal/projects/${project._id}/comments`, { text: t }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-comments', project._id] });
            setText('');
        },
        onError: () => message.error('Не удалось отправить'),
    });

    const deleteComment = useMutation({
        mutationFn: (cId) => apiClient.delete(`/portal/projects/${project._id}/comments/${cId}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-comments', project._id] }),
    });

    return (
        <Drawer title={`Комментарии: ${project?.name}`} open={open} onClose={onClose} width={460}>
            {(!comments || comments.length === 0) && (
                <Empty description="Комментариев пока нет" style={{ marginBottom: 16 }} />
            )}
            <List
                dataSource={comments || []}
                renderItem={(c) => {
                    const isGuest = c.userId?.role === 'guest';
                    const isOwn = String(c.userId?._id) === String(user?._id);
                    return (
                        <List.Item style={{ border: 'none', padding: '4px 0' }}>
                            <div style={{
                                width: '100%',
                                background: isGuest ? '#e6f4ff' : '#f6ffed',
                                border: `1px solid ${isGuest ? '#91caff' : '#b7eb8f'}`,
                                borderRadius: 10, padding: '8px 12px',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Space size={6}>
                                        <Avatar size={20} style={{ background: isGuest ? '#1677ff' : '#52c41a', fontSize: 10 }}>
                                            {c.userId?.name?.[0]?.toUpperCase()}
                                        </Avatar>
                                        <Text strong style={{ fontSize: 13 }}>
                                            {isGuest ? '🧑‍💼 Заказчик' : '👨‍💻 Команда'} — {c.userId?.name}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            {dayjs(c.createdAt).format('DD.MM HH:mm')}
                                        </Text>
                                    </Space>
                                    {(isOwn || user?.role === 'admin') && (
                                        <Popconfirm title="Удалить?" onConfirm={() => deleteComment.mutate(c._id)}>
                                            <DeleteOutlined style={{ color: '#ff4d4f', cursor: 'pointer' }} />
                                        </Popconfirm>
                                    )}
                                </div>
                                <Text style={{ fontSize: 14 }}>{c.text}</Text>
                            </div>
                        </List.Item>
                    );
                }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', gap: 8 }}>
                <Input.TextArea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Ответить заказчику..."
                    autoSize={{ minRows: 2 }}
                />
                <Button type="primary" icon={<SendOutlined />}
                    loading={addComment.isPending}
                    disabled={!text.trim()}
                    onClick={() => addComment.mutate(text.trim())}
                    style={{ height: 'auto' }}
                />
            </div>
        </Drawer>
    );
};

const BoardProjectPage = () => {
    const queryClient = useQueryClient();
    const user = useSelector((state) => state.auth.user);

    const [selectedProject, setSelectedProject] = useState(null);
    const [projectModal, setProjectModal] = useState({ open: false, item: null });
    const [taskModal, setTaskModal] = useState({ open: false, item: null });
    const [clientsDrawer, setClientsDrawer] = useState({ open: false, project: null });
    const [commentsDrawer, setCommentsDrawer] = useState({ open: false, project: null });
    const [filesDrawer, setFilesDrawer] = useState({ open: false, task: null });
    const [clientForm] = Form.useForm();
    const [projectForm] = Form.useForm();
    const [taskForm] = Form.useForm();

    // ── Queries ────────────────────────────────────────────────────────────────

    const { data: projects, isLoading } = useQuery({
        queryKey: ['board-projects'],
        queryFn: async () => {
            const { data } = await apiClient.get('/board-projects');
            return data.data.projects;
        },
    });

    const { data: users } = useQuery({
        queryKey: ['users-list'],
        queryFn: async () => {
            const { data } = await apiClient.get('/auth/users');
            return data.data.users;
        },
    });

    // Keep selectedProject in sync after mutations
    const currentProject = projects?.find((p) => p._id === selectedProject?._id) || selectedProject;

    // ── Mutations ──────────────────────────────────────────────────────────────

    const createProject = useMutation({
        mutationFn: (body) => apiClient.post('/board-projects', body),
        onSuccess: ({ data }) => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            message.success('Проект создан');
            setProjectModal({ open: false, item: null });
        },
        onError: () => message.error('Не удалось создать проект'),
    });

    const updateProject = useMutation({
        mutationFn: ({ id, body }) => apiClient.patch(`/board-projects/${id}`, body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            message.success('Проект обновлён');
            setProjectModal({ open: false, item: null });
        },
        onError: () => message.error('Не удалось обновить проект'),
    });

    const deleteProject = useMutation({
        mutationFn: (id) => apiClient.delete(`/board-projects/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            message.success('Проект удалён');
            if (selectedProject) setSelectedProject(null);
        },
        onError: () => message.error('Не удалось удалить проект'),
    });

    const addTask = useMutation({
        mutationFn: ({ projectId, body }) => apiClient.post(`/board-projects/${projectId}/tasks`, body),
        onSuccess: ({ data }) => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            setSelectedProject(data.data.project);
            message.success('Задача добавлена');
            setTaskModal({ open: false, item: null });
        },
        onError: () => message.error('Не удалось добавить задачу'),
    });

    const updateTask = useMutation({
        mutationFn: ({ projectId, taskId, body }) =>
            apiClient.patch(`/board-projects/${projectId}/tasks/${taskId}`, body),
        onSuccess: ({ data }) => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            setSelectedProject(data.data.project);
            message.success('Задача обновлена');
            setTaskModal({ open: false, item: null });
        },
        onError: () => message.error('Не удалось обновить задачу'),
    });

    const deleteTask = useMutation({
        mutationFn: ({ projectId, taskId }) =>
            apiClient.delete(`/board-projects/${projectId}/tasks/${taskId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            message.success('Задача удалена');
        },
        onError: () => message.error('Не удалось удалить задачу'),
    });

    const addClient = useMutation({
        mutationFn: ({ projectId, userId }) =>
            apiClient.post(`/portal/projects/${projectId}/clients`, { userId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            queryClient.invalidateQueries({ queryKey: ['project-clients', clientsDrawer.project?._id] });
            clientForm.resetFields();
            message.success('Клиент добавлен');
        },
        onError: () => message.error('Не удалось добавить клиента'),
    });

    const removeClient = useMutation({
        mutationFn: ({ projectId, userId }) =>
            apiClient.delete(`/portal/projects/${projectId}/clients/${userId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            queryClient.invalidateQueries({ queryKey: ['project-clients', clientsDrawer.project?._id] });
            message.success('Клиент удалён');
        },
        onError: () => message.error('Не удалось удалить клиента'),
    });

    // ── Handlers ───────────────────────────────────────────────────────────────

    const openCreateProject = () => {
        projectForm.resetFields();
        setProjectModal({ open: true, item: null });
    };

    const openEditProject = (item) => {
        projectForm.setFieldsValue({
            name: item.name,
            description: item.description,
            status: item.status,
            deadline: item.deadline ? dayjs(item.deadline) : null,
        });
        setProjectModal({ open: true, item });
    };

    const handleSaveProject = async () => {
        const values = await projectForm.validateFields();
        const body = { ...values, deadline: values.deadline ? values.deadline.toISOString() : null };
        if (projectModal.item) {
            updateProject.mutate({ id: projectModal.item._id, body });
        } else {
            createProject.mutate(body);
        }
    };

    const openCreateTask = () => {
        taskForm.resetFields();
        taskForm.setFieldsValue({ status: 'todo', priority: 'medium', hours: 0, system: currentProject?.name || '' });
        setTaskModal({ open: true, item: null });
    };

    const openEditTask = (task) => {
        taskForm.setFieldsValue({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            hours: task.hours,
            customer: task.customer || '',
            system: task.system || '',
            assignedTo: task.assignedTo?._id || null,
            dueDate: task.dueDate ? dayjs(task.dueDate) : null,
            notes: task.notes,
        });
        setTaskModal({ open: true, item: task });
    };

    const handleSaveTask = async () => {
        const values = await taskForm.validateFields();
        const body = { ...values, dueDate: values.dueDate ? values.dueDate.toISOString() : null };
        if (taskModal.item) {
            updateTask.mutate({ projectId: currentProject._id, taskId: taskModal.item._id, body });
        } else {
            addTask.mutate({ projectId: currentProject._id, body });
        }
    };

    const handleExcel = async (project, unpaidOnly = false) => {
        try {
            const response = await apiClient.get(`/board-projects/${project._id}/export`, {
                responseType: 'blob',
                params: unpaidOnly ? { unpaidOnly: 'true' } : {},
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            const suffix = unpaidOnly ? '_неоплаченные' : '';
            link.setAttribute('download', `${project.name}${suffix}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success(unpaidOnly ? 'Неоплаченные задачи экспортированы' : 'Excel экспортирован');
        } catch {
            message.error('Не удалось экспортировать');
        }
    };

    // ── Stats ──────────────────────────────────────────────────────────────────

    const getProjectStats = (p) => {
        const tasks = p.tasks || [];
        const done = tasks.filter((t) => t.status === 'done').length;
        const hours = Number(tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0).toFixed(1));
        const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        // Задача «заполнена» если есть часы > 0, заказчик, система и дата
        const filled = tasks.filter(
            (t) => Number(t.hours) > 0 && t.customer?.trim() && t.system?.trim() && t.dueDate
        ).length;
        const paid = tasks.filter((t) => t.isPaid).length;
        return { total: tasks.length, done, hours, rate, filled, paid };
    };

    // ── Project list view ──────────────────────────────────────────────────────

    if (!selectedProject) {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Title level={2}>
                        <ProjectOutlined style={{ marginRight: 8 }} />
                        Проекты
                    </Title>
                    <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreateProject}>
                        Новый проект
                    </Button>
                </div>

                {isLoading && <div style={{ textAlign: 'center', padding: 60 }}>Загрузка...</div>}

                {!isLoading && !projects?.length && (
                    <Empty description="Нет проектов. Создайте первый!" />
                )}

                <Row gutter={[16, 16]}>
                    {projects?.map((p) => {
                        const stats = getProjectStats(p);
                        const statusInfo = PROJECT_STATUS[p.status] || { label: p.status, color: 'default' };
                        return (
                            <Col xs={24} sm={12} lg={8} key={p._id}>
                                <Card
                                    hoverable
                                    onClick={() => setSelectedProject(p)}
                                    style={{ cursor: 'pointer' }}
                                    actions={[
                                        <Tooltip title="Экспорт Excel" key="excel">
                                            <Button
                                                type="text" size="small" icon={<FileExcelOutlined />}
                                                style={{ color: '#217346' }}
                                                onClick={(e) => { e.stopPropagation(); handleExcel(p); }}
                                            >
                                                Excel
                                            </Button>
                                        </Tooltip>,
                                        <Button
                                            key="edit" type="text" size="small" icon={<EditOutlined />}
                                            onClick={(e) => { e.stopPropagation(); openEditProject(p); }}
                                        >
                                            Изменить
                                        </Button>,
                                        <Popconfirm
                                            key="del" title="Удалить проект и все задачи?"
                                            onConfirm={(e) => { deleteProject.mutate(p._id); }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                                                Удалить
                                            </Button>
                                        </Popconfirm>,
                                    ]}
                                >
                                    <div style={{ marginBottom: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Text strong style={{ fontSize: 16 }}>{p.name}</Text>
                                            <Badge status={statusInfo.color} text={statusInfo.label} />
                                        </div>
                                        {p.description && (
                                            <Text type="secondary" style={{ fontSize: 13 }}>
                                                {p.description.length > 80 ? p.description.slice(0, 80) + '…' : p.description}
                                            </Text>
                                        )}
                                    </div>

                                    {/* Индикатор заполненности задач */}
                                    <div style={{ marginBottom: 10 }}>
                                        {stats.total === 0 ? (
                                            <Tag color="default">Задачи не добавлены</Tag>
                                        ) : stats.filled === stats.total ? (
                                            <Tag color="green">✓ Все задачи заполнены</Tag>
                                        ) : (
                                            <Tag color="orange">
                                                Заполнено {stats.filled} / {stats.total}
                                            </Tag>
                                        )}
                                    </div>

                                    <Row gutter={8} style={{ marginBottom: 12 }}>
                                        <Col span={8}>
                                            <Statistic title="Задач" value={stats.total} valueStyle={{ fontSize: 20 }} />
                                        </Col>
                                        <Col span={8}>
                                            <Statistic title="Готово" value={stats.done} valueStyle={{ fontSize: 20, color: '#3f8600' }} />
                                        </Col>
                                        <Col span={8}>
                                            <Statistic title="Часов" value={stats.hours} valueStyle={{ fontSize: 20 }} />
                                        </Col>
                                    </Row>

                                    <Progress
                                        percent={stats.rate}
                                        size="small"
                                        status={stats.rate === 100 ? 'success' : 'active'}
                                        format={(pct) => `${pct}%`}
                                    />

                                    {p.deadline && (
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                Дедлайн: {dayjs(p.deadline).format('DD.MM.YYYY')}
                                            </Text>
                                        </div>
                                    )}
                                </Card>
                            </Col>
                        );
                    })}
                </Row>

                {/* Create/Edit Project Modal */}
                <Modal
                    title={projectModal.item ? 'Редактировать проект' : 'Новый проект'}
                    open={projectModal.open}
                    onOk={handleSaveProject}
                    onCancel={() => setProjectModal({ open: false, item: null })}
                    confirmLoading={createProject.isPending || updateProject.isPending}
                    okText="Сохранить"
                    cancelText="Отмена"
                >
                    <Form form={projectForm} layout="vertical" style={{ marginTop: 16 }}>
                        <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
                            <Input placeholder="Название проекта" />
                        </Form.Item>
                        <Form.Item name="description" label="Описание">
                            <TextArea rows={3} placeholder="Краткое описание" />
                        </Form.Item>
                        <Form.Item name="status" label="Статус" initialValue="active">
                            <Select>
                                {Object.entries(PROJECT_STATUS).map(([val, { label }]) => (
                                    <Option key={val} value={val}>{label}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item name="deadline" label="Дедлайн">
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        );
    }

    // ── Task list view (inside project) ───────────────────────────────────────

    const stats = getProjectStats(currentProject);
    const statusInfo = PROJECT_STATUS[currentProject.status] || { label: currentProject.status, color: 'default' };

    const taskColumns = [
        {
            title: 'Задача',
            dataIndex: 'title',
            key: 'title',
            render: (title, record) => {
                const isFilled = Number(record.hours) > 0
                    && record.customer?.trim()
                    && record.system?.trim()
                    && record.dueDate;
                return (
                    <Space direction="vertical" size={0}>
                        <Space size={6}>
                            <Tooltip title={isFilled ? 'Заполнено' : 'Не все поля заполнены (часы, заказчик, система, дата)'}>
                                {isFilled
                                    ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                    : <ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                            </Tooltip>
                            <Text strong>{title}</Text>
                        </Space>
                        {record.description && (
                            <Text type="secondary" style={{ fontSize: 12, paddingLeft: 20 }}>
                                {record.description.length > 60 ? record.description.slice(0, 60) + '…' : record.description}
                            </Text>
                        )}
                    </Space>
                );
            },
        },
        {
            title: 'Статус',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (s) => {
                const info = TASK_STATUS[s] || { label: s, color: 'default' };
                return <Badge status={info.color} text={info.label} />;
            },
        },
        {
            title: 'Приоритет',
            dataIndex: 'priority',
            key: 'priority',
            width: 120,
            render: (p) => {
                const info = TASK_PRIORITY[p] || { label: p, color: 'default' };
                return <Tag color={info.color}>{info.label}</Tag>;
            },
        },
        {
            title: 'Часы',
            dataIndex: 'hours',
            key: 'hours',
            width: 90,
            render: (h) => <Tag color="blue">{h || 0} ч</Tag>,
        },
        {
            title: 'Оплачено',
            dataIndex: 'isPaid',
            key: 'isPaid',
            width: 100,
            align: 'center',
            render: (isPaid, record) => (
                <Checkbox
                    checked={!!isPaid}
                    onChange={(e) =>
                        updateTask.mutate({
                            projectId: currentProject._id,
                            taskId: record._id,
                            body: { isPaid: e.target.checked },
                        })
                    }
                />
            ),
        },
        {
            title: 'Заказчик',
            dataIndex: 'customer',
            key: 'customer',
            width: 140,
            render: (v) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>,
        },
        {
            title: 'Система',
            dataIndex: 'system',
            key: 'system',
            width: 110,
            render: (v) => v ? <Tag color="purple">{v}</Tag> : <Text type="secondary">—</Text>,
        },
        {
            title: 'Исполнитель',
            dataIndex: 'assignedTo',
            key: 'assignedTo',
            width: 140,
            render: (u) => u?.name ? <Tag>{u.name}</Tag> : <Text type="secondary">—</Text>,
        },
        {
            title: 'Дата',
            dataIndex: 'dueDate',
            key: 'dueDate',
            width: 110,
            render: (d) => d
                ? <Tag color="default">{dayjs(d).format('DD.MM.YYYY')}</Tag>
                : <Tag color="red">не указана</Tag>,
        },
        {
            title: 'Файлы',
            key: 'files',
            width: 90,
            align: 'center',
            render: (_, record) => {
                const count = record.files?.length || 0;
                return (
                    <Button
                        size="small"
                        icon={<PaperClipOutlined />}
                        onClick={() => setFilesDrawer({ open: true, task: record })}
                        type={count > 0 ? 'primary' : 'default'}
                        ghost={count > 0}
                    >
                        {count > 0 ? count : '+'}
                    </Button>
                );
            },
        },
        {
            title: '',
            key: 'actions',
            width: 100,
            render: (_, record) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEditTask(record)} />
                    <Popconfirm
                        title="Удалить задачу?"
                        onConfirm={() => deleteTask.mutate({ projectId: currentProject._id, taskId: record._id })}
                    >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedProject(null)}>
                        Все проекты
                    </Button>
                    <Title level={3} style={{ margin: 0 }}>
                        {currentProject.name}
                    </Title>
                    <Badge status={statusInfo.color} text={statusInfo.label} />
                </Space>
                <Space>
                    <Button
                        icon={<MessageOutlined />}
                        onClick={() => setCommentsDrawer({ open: true, project: currentProject })}
                    >
                        Комментарии
                    </Button>
                    {user?.role === 'admin' && (
                        <Button
                            icon={<TeamOutlined />}
                            onClick={() => setClientsDrawer({ open: true, project: currentProject })}
                        >
                            Клиенты
                        </Button>
                    )}
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => openEditProject(currentProject)}
                    >
                        Изменить
                    </Button>
                    <Button
                        icon={<FileExcelOutlined />}
                        style={{ color: '#217346', borderColor: '#217346' }}
                        onClick={() => handleExcel(currentProject)}
                        disabled={!currentProject.tasks?.length}
                    >
                        Экспорт Excel
                    </Button>
                    <Button
                        icon={<FileExcelOutlined />}
                        style={{ color: '#DC2626', borderColor: '#DC2626' }}
                        onClick={() => handleExcel(currentProject, true)}
                        disabled={!currentProject.tasks?.some(t => !t.isPaid)}
                    >
                        ❌ Неоплаченные
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateTask}>
                        Добавить задачу
                    </Button>
                </Space>
            </div>

            {/* Stats */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={4}>
                    <Card size="small">
                        <Statistic title="Всего задач" value={stats.total} prefix={<UnorderedListOutlined />} />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card size="small">
                        <Statistic title="Выполнено" value={stats.done} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card size="small">
                        <Statistic title="Часов" value={stats.hours} suffix="ч" prefix={<ClockCircleOutlined />} />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card size="small">
                        <Statistic
                            title="Оплачено"
                            value={stats.paid}
                            suffix={`/ ${stats.total}`}
                            valueStyle={{ color: stats.paid === stats.total && stats.total > 0 ? '#3f8600' : '#faad14' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small">
                        <Text type="secondary">Прогресс</Text>
                        <Progress
                            percent={stats.rate}
                            status={stats.rate === 100 ? 'success' : 'active'}
                            style={{ marginTop: 6 }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Task table */}
            <Table
                columns={taskColumns}
                dataSource={currentProject.tasks}
                rowKey="_id"
                pagination={{ pageSize: 15 }}
                bordered
                size="middle"
                locale={{ emptyText: <Empty description="Нет задач. Нажмите «Добавить задачу»" /> }}
            />

            {/* Edit Project Modal */}
            <Modal
                title="Редактировать проект"
                open={projectModal.open}
                onOk={handleSaveProject}
                onCancel={() => setProjectModal({ open: false, item: null })}
                confirmLoading={updateProject.isPending}
                okText="Сохранить"
                cancelText="Отмена"
            >
                <Form form={projectForm} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="name" label="Название" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="Описание">
                        <TextArea rows={3} />
                    </Form.Item>
                    <Form.Item name="status" label="Статус">
                        <Select>
                            {Object.entries(PROJECT_STATUS).map(([val, { label }]) => (
                                <Option key={val} value={val}>{label}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="deadline" label="Дедлайн">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Files Drawer */}
            <FilesDrawer
                open={filesDrawer.open}
                task={filesDrawer.task}
                project={currentProject}
                onClose={() => setFilesDrawer({ open: false, task: null })}
                onUploaded={(updatedProject) => {
                    setSelectedProject(updatedProject);
                    queryClient.invalidateQueries({ queryKey: ['board-projects'] });
                    // обновить task в drawer
                    const updatedTask = updatedProject.tasks.find(t => t._id === filesDrawer.task?._id);
                    if (updatedTask) setFilesDrawer(prev => ({ ...prev, task: updatedTask }));
                }}
            />

            {/* Clients Drawer */}
            <ClientsDrawer
                open={clientsDrawer.open}
                project={clientsDrawer.project}
                users={users}
                clientForm={clientForm}
                onClose={() => setClientsDrawer({ open: false, project: null })}
                addClient={addClient}
                removeClient={removeClient}
            />

            {/* Comments Drawer */}
            <CommentsDrawer
                open={commentsDrawer.open}
                project={commentsDrawer.project}
                user={user}
                onClose={() => setCommentsDrawer({ open: false, project: null })}
            />

            {/* Add/Edit Task Modal */}
            <Modal
                title={taskModal.item ? 'Редактировать задачу' : 'Новая задача'}
                open={taskModal.open}
                onOk={handleSaveTask}
                onCancel={() => setTaskModal({ open: false, item: null })}
                confirmLoading={addTask.isPending || updateTask.isPending}
                okText="Сохранить"
                cancelText="Отмена"
                width={600}
            >
                <Form form={taskForm} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="title" label="Название задачи" rules={[{ required: true, message: 'Введите название' }]}>
                        <Input placeholder="Что нужно сделать?" />
                    </Form.Item>
                    <Form.Item name="description" label="Описание">
                        <TextArea rows={3} placeholder="Подробное описание задачи" />
                    </Form.Item>
                    <Row gutter={12}>
                        <Col span={8}>
                            <Form.Item name="status" label="Статус">
                                <Select>
                                    {Object.entries(TASK_STATUS).map(([val, { label }]) => (
                                        <Option key={val} value={val}>{label}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="priority" label="Приоритет">
                                <Select>
                                    {Object.entries(TASK_PRIORITY).map(([val, { label }]) => (
                                        <Option key={val} value={val}>{label}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="hours" label="Часов">
                                <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="0" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="customer" label="Заказчик">
                                <Input placeholder="Имя заказчика" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="system" label="Система">
                                <Input placeholder="Название системы / модуля" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="assignedTo" label="Исполнитель">
                                <Select placeholder="Выберите сотрудника" allowClear>
                                    {users?.map((u) => (
                                        <Option key={u._id} value={u._id}>{u.name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dueDate" label="Срок выполнения">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="notes" label="Заметки">
                        <TextArea rows={2} placeholder="Дополнительные заметки" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default BoardProjectPage;
