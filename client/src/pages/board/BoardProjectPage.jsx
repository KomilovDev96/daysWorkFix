import React, { useState, useEffect } from 'react';
import {
    Typography, Card, Button, Table, Tag, Space, Modal, Form, Input,
    Select, DatePicker, message, Popconfirm, Drawer, InputNumber,
    Row, Col, Statistic, Progress, Empty, Tooltip, Badge, Checkbox,
    Avatar, List, Divider, Upload, Image, Tabs, Popover
} from 'antd';
import UpdatesTab from './tabs/UpdatesTab';
import TimelineTab from './tabs/TimelineTab';
import ProjectFilesTab from './tabs/ProjectFilesTab';
import PortalSettingsTab from './tabs/PortalSettingsTab';
import SprintsTab from './tabs/SprintsTab';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, FileExcelOutlined,
    ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined,
    UnorderedListOutlined, ArrowLeftOutlined, ExclamationCircleOutlined,
    TeamOutlined, UserAddOutlined, UserDeleteOutlined, MessageOutlined,
    SendOutlined, PaperClipOutlined, UploadOutlined, FileImageOutlined,
    FilePdfOutlined, FileOutlined, EyeOutlined, LinkOutlined,
    ApiOutlined, CopyOutlined, ReloadOutlined, UserOutlined, RocketOutlined,
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

// ── Task API Drawer ───────────────────────────────────────────────────────────
// Публичный API для приёма выполненных задач от фронтендщика/бэкендщика/пм без входа в систему.
const MODULE_META = {
    frontend: { label: 'Frontend', color: 'geekblue' },
    backend: { label: 'Backend', color: 'cyan' },
    pm: { label: 'PM', color: 'purple' },
    tester: { label: 'Tester', color: 'volcano' },
};

const buildTaskApiCurl = (endpoint, moduleKey) => `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Название задачи",
    "execRole": "${moduleKey}",
    "hours": 3,
    "amount": 150000,
    "customer": "Имя заказчика",
    "notes": "Комментарий (необязательно)"
  }'`;

const buildTaskApiBulkCurl = (endpoint) => `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tasks": [
      { "title": "Задача 1", "execRole": "frontend", "hours": 2, "amount": 100000 },
      { "title": "Задача 2", "execRole": "backend",  "hours": 3, "amount": 150000 }
    ]
  }'`;

const buildTaskApiFileCurl = (endpoint) => `curl -X POST "${endpoint}" \\
  -F "title=Название задачи" \\
  -F "execRole=frontend" \\
  -F "hours=3" \\
  -F "amount=150000" \\
  -F "files=@/путь/к/скриншоту.png" \\
  -F "files=@/путь/к/файлу2.pdf"`;

const TaskApiDrawer = ({ open, project, onClose }) => {
    const queryClient = useQueryClient();

    const { data: taskApi, isLoading } = useQuery({
        queryKey: ['task-api', project?._id],
        queryFn: async () => {
            const { data } = await apiClient.get(`/board-projects/${project._id}/task-api`);
            return data.data.taskApi;
        },
        enabled: !!project?._id && open,
    });

    const toggle = useMutation({
        mutationFn: (enabled) => apiClient.patch(`/board-projects/${project._id}/task-api`, { enabled }),
        onSuccess: ({ data }) => {
            queryClient.setQueryData(['task-api', project._id], data.data.taskApi);
            message.success(data.data.taskApi.enabled ? 'API включён' : 'API выключен');
        },
        onError: () => message.error('Не удалось изменить статус API'),
    });

    const regenerate = useMutation({
        mutationFn: () => apiClient.post(`/board-projects/${project._id}/task-api/regenerate`),
        onSuccess: ({ data }) => {
            queryClient.setQueryData(['task-api', project._id], data.data.taskApi);
            message.success('Новый ключ создан, старый больше не работает');
        },
        onError: () => message.error('Не удалось создать новый ключ'),
    });

    const copy = (text, label = 'Скопировано') => {
        navigator.clipboard.writeText(text);
        message.success(label);
    };

    const endpoint = taskApi?.token ? `${API_BASE}/api/public/task-api/${taskApi.token}/tasks` : null;

    return (
        <Drawer
            title={<Space><ApiOutlined />Публичный API для задач: {project?.name}</Space>}
            open={open}
            onClose={onClose}
            width={520}
        >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Дайте эту ссылку и ключ фронтендщику, бэкендщику или пм — они смогут присылать сделанные
                задачи (с ценой и часами) напрямую в нужный модуль, без входа в систему.
            </Text>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text strong>API включён</Text>
                <Checkbox
                    checked={!!taskApi?.enabled}
                    disabled={isLoading || toggle.isPending}
                    onChange={(e) => toggle.mutate(e.target.checked)}
                />
            </div>

            {taskApi?.enabled && endpoint && (
                <>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>Ссылка (endpoint)</Text>
                    <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                        <Input value={endpoint} readOnly />
                        <Button icon={<CopyOutlined />} onClick={() => copy(endpoint, 'Ссылка скопирована')} />
                    </Space.Compact>

                    <Popconfirm
                        title="Сгенерировать новый ключ?"
                        description="Старая ссылка перестанет работать."
                        onConfirm={() => regenerate.mutate()}
                    >
                        <Button icon={<ReloadOutlined />} loading={regenerate.isPending} style={{ marginBottom: 20 }}>
                            Новый ключ
                        </Button>
                    </Popconfirm>

                    <Divider>Пример запроса — одна задача</Divider>

                    {Object.entries(MODULE_META).map(([key, { label, color }]) => {
                        const curl = buildTaskApiCurl(endpoint, key);
                        return (
                            <div key={key} style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <Tag color={color}>{label}</Tag>
                                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(curl, `Пример для ${label} скопирован`)}>
                                        Копировать
                                    </Button>
                                </div>
                                <pre style={{
                                    background: '#f5f5f5', padding: 12, borderRadius: 6,
                                    fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
                                }}>
                                    {curl}
                                </pre>
                            </div>
                        );
                    })}

                    <Divider>Пакетная отправка — несколько задач сразу</Divider>

                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text strong>Пример пакета (до 100 задач за запрос)</Text>
                            <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => copy(buildTaskApiBulkCurl(endpoint), 'Пример пакета скопирован')}
                            >
                                Копировать
                            </Button>
                        </div>
                        <pre style={{
                            background: '#f5f5f5', padding: 12, borderRadius: 6,
                            fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
                        }}>
                            {buildTaskApiBulkCurl(endpoint)}
                        </pre>
                    </div>

                    <Divider>Задача с файлами (скриншоты, PDF)</Divider>

                    <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
                        Файлы прикладываются только к одиночной задаче (не к пакету) — запрос отправляется как
                        multipart/form-data вместо JSON, до 10 файлов, поле <b>files</b> можно повторять.
                    </Text>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text strong>Пример с файлами (multipart)</Text>
                            <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => copy(buildTaskApiFileCurl(endpoint), 'Пример с файлами скопирован')}
                            >
                                Копировать
                            </Button>
                        </div>
                        <pre style={{
                            background: '#f5f5f5', padding: 12, borderRadius: 6,
                            fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
                        }}>
                            {buildTaskApiFileCurl(endpoint)}
                        </pre>
                    </div>

                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Поле <b>amount</b> — это цена задачи. Поле <b>execRole</b> обязательно в каждой задаче
                        (frontend / backend / pm / tester) и определяет, в какой модуль она попадёт. Задачи создаются
                        сразу со статусом «Выполнено». Для нескольких задач за раз — оберните их в <b>"tasks": [...]</b>.
                    </Text>
                </>
            )}

            {!taskApi?.enabled && !isLoading && (
                <Empty description="API выключен. Включите переключателем выше." />
            )}
        </Drawer>
    );
};

// ── API для задач конкретного спринта (без тумблера enabled — ключ есть = приём включён) ──
const SprintTaskApiDrawer = ({ open, project, sprint, onClose }) => {
    const queryClient = useQueryClient();

    const regenerate = useMutation({
        mutationFn: () => apiClient.post(`/board-projects/${project._id}/sprints/${sprint._id}/task-api-link`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            message.success('Ключ спринта создан, старый (если был) больше не работает');
        },
        onError: (e) => message.error(e.response?.data?.message || 'Не удалось создать ключ'),
    });

    const copy = (text, label = 'Скопировано') => {
        navigator.clipboard.writeText(text);
        message.success(label);
    };

    const endpoint = sprint?.taskApiToken ? `${API_BASE}/api/public/sprint-task-api/${sprint.taskApiToken}/tasks` : null;

    return (
        <Drawer
            title={<Space><ApiOutlined />API для задач спринта: {sprint?.name}</Space>}
            open={open}
            onClose={onClose}
            width={520}
        >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Дайте эту ссылку и ключ фронтендщику, бэкендщику, пм или тестировщику — задачи, отправленные
                через неё, автоматически попадут именно в спринт «{sprint?.name}», без входа в систему.
            </Text>

            {!endpoint ? (
                <Button type="primary" icon={<ApiOutlined />} loading={regenerate.isPending}
                    onClick={() => regenerate.mutate()}>
                    Получить ключ для этого спринта
                </Button>
            ) : (
                <>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>Ссылка (endpoint)</Text>
                    <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                        <Input value={endpoint} readOnly />
                        <Button icon={<CopyOutlined />} onClick={() => copy(endpoint, 'Ссылка скопирована')} />
                    </Space.Compact>

                    <Popconfirm
                        title="Сгенерировать новый ключ?"
                        description="Старая ссылка перестанет работать."
                        onConfirm={() => regenerate.mutate()}
                    >
                        <Button icon={<ReloadOutlined />} loading={regenerate.isPending} style={{ marginBottom: 20 }}>
                            Новый ключ
                        </Button>
                    </Popconfirm>

                    <Divider>Пример запроса — одна задача</Divider>

                    {Object.entries(MODULE_META).map(([key, { label, color }]) => {
                        const curl = buildTaskApiCurl(endpoint, key);
                        return (
                            <div key={key} style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <Tag color={color}>{label}</Tag>
                                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(curl, `Пример для ${label} скопирован`)}>
                                        Копировать
                                    </Button>
                                </div>
                                <pre style={{
                                    background: '#f5f5f5', padding: 12, borderRadius: 6,
                                    fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
                                }}>
                                    {curl}
                                </pre>
                            </div>
                        );
                    })}

                    <Divider>Пакетная отправка — несколько задач сразу</Divider>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text strong>Пример пакета (до 100 задач за запрос)</Text>
                            <Button size="small" icon={<CopyOutlined />}
                                onClick={() => copy(buildTaskApiBulkCurl(endpoint), 'Пример пакета скопирован')}>
                                Копировать
                            </Button>
                        </div>
                        <pre style={{
                            background: '#f5f5f5', padding: 12, borderRadius: 6,
                            fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
                        }}>
                            {buildTaskApiBulkCurl(endpoint)}
                        </pre>
                    </div>

                    <Divider>Задача с файлами (скриншоты, PDF)</Divider>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text strong>Пример с файлами (multipart)</Text>
                            <Button size="small" icon={<CopyOutlined />}
                                onClick={() => copy(buildTaskApiFileCurl(endpoint), 'Пример с файлами скопирован')}>
                                Копировать
                            </Button>
                        </div>
                        <pre style={{
                            background: '#f5f5f5', padding: 12, borderRadius: 6,
                            fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
                        }}>
                            {buildTaskApiFileCurl(endpoint)}
                        </pre>
                    </div>

                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Поле <b>execRole</b> обязательно в каждой задаче (frontend / backend / pm / tester).
                        Задача автоматически привяжется к спринту «{sprint?.name}» и создастся сразу
                        со статусом «Выполнено». Для нескольких задач за раз — оберните их в <b>"tasks": [...]</b>.
                    </Text>
                </>
            )}
        </Drawer>
    );
};

// ── Канбан задач модуля ─────────────────────────────────────────────────────────
const KANBAN_COLUMNS = [
    { key: 'todo', label: 'К выполнению', color: '#8c8c8c', bg: '#f5f5f5', border: '#d9d9d9' },
    { key: 'in_progress', label: 'В процессе', color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
    { key: 'done', label: 'Выполнено', color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
];

// Клик по бейджу — выбрать/сменить/снять исполнителя. Поле необязательное:
// доступна опция «Без исполнителя», задачу можно оставить неназначенной.
const AssigneeTag = ({ task, users, onAssign }) => {
    const [open, setOpen] = useState(false);
    return (
        <Popover
            trigger="click"
            open={open}
            onOpenChange={setOpen}
            content={
                <Select
                    style={{ width: 220 }}
                    placeholder="Выбрать исполнителя"
                    showSearch
                    allowClear
                    autoFocus
                    value={task.assignedTo?._id || undefined}
                    optionFilterProp="label"
                    options={(users || []).map((u) => ({ value: u._id, label: u.name }))}
                    onChange={(userId) => { onAssign(task, userId || null); setOpen(false); }}
                    onClear={() => { onAssign(task, null); setOpen(false); }}
                />
            }
        >
            {task.assignedTo?.name ? (
                <Tag icon={<UserOutlined />} style={{ margin: 0, cursor: 'pointer' }}>
                    {task.assignedTo.name}
                </Tag>
            ) : (
                <Tag style={{ margin: 0, cursor: 'pointer', borderStyle: 'dashed', color: '#999' }} icon={<UserOutlined />}>
                    Назначить
                </Tag>
            )}
        </Popover>
    );
};

const TaskKanbanCard = ({ task, users, onEdit, onDelete, onMove, onFiles, onTogglePaid, onAssign }) => {
    const isFilled = Number(task.hours) > 0 && task.customer?.trim() && task.system?.trim() && task.dueDate;
    const priorityInfo = TASK_PRIORITY[task.priority] || { label: task.priority, color: 'default' };
    const overdue = task.dueDate && task.status !== 'done' && dayjs(task.dueDate).isBefore(dayjs(), 'day');
    const currentIdx = KANBAN_COLUMNS.findIndex((c) => c.key === task.status);
    const nextCol = KANBAN_COLUMNS[currentIdx + 1];
    const prevCol = KANBAN_COLUMNS[currentIdx - 1];

    return (
        <Card size="small" style={{ marginBottom: 8 }} bodyStyle={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                <Tooltip title={isFilled ? 'Заполнено' : 'Не все поля заполнены'}>
                    {isFilled
                        ? <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 3 }} />
                        : <ExclamationCircleOutlined style={{ color: '#faad14', marginTop: 3 }} />}
                </Tooltip>
                <Text strong style={{ fontSize: 13, flex: 1 }}>{task.title}</Text>
            </div>

            {task.description && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                    {task.description.length > 70 ? task.description.slice(0, 70) + '…' : task.description}
                </Text>
            )}

            <Space size={4} wrap style={{ marginBottom: 8 }}>
                <Tag color={priorityInfo.color} style={{ margin: 0 }}>{priorityInfo.label}</Tag>
                {task.hours > 0 && <Tag color="blue" style={{ margin: 0 }}>{task.hours} ч</Tag>}
                {task.customer && <Tag color="gold" style={{ margin: 0 }}>{task.customer}</Tag>}
                <AssigneeTag task={task} users={users} onAssign={onAssign} />
                {task.dueDate && (
                    <Tag color={overdue ? 'red' : 'default'} style={{ margin: 0 }}>
                        до {dayjs(task.dueDate).format('DD.MM')}{overdue ? ' ⚠️' : ''}
                    </Tag>
                )}
            </Space>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                <Space size={4}>
                    {prevCol && (
                        <Tooltip title={`Вернуть в «${prevCol.label}»`}>
                            <Button size="small" onClick={() => onMove(task, prevCol.key)}>←</Button>
                        </Tooltip>
                    )}
                    {nextCol && (
                        <Tooltip title={`Переместить в «${nextCol.label}»`}>
                            <Button size="small" type="primary" ghost onClick={() => onMove(task, nextCol.key)}>→</Button>
                        </Tooltip>
                    )}
                </Space>
                <Space size={4}>
                    <Tooltip title={task.isPaid ? 'Оплачено' : 'Не оплачено'}>
                        <Checkbox checked={!!task.isPaid} onChange={(e) => onTogglePaid(task, e.target.checked)} />
                    </Tooltip>
                    <Button size="small" icon={<PaperClipOutlined />}
                        type={task.files?.length ? 'primary' : 'default'} ghost={!!task.files?.length}
                        onClick={() => onFiles(task)}>
                        {task.files?.length || ''}
                    </Button>
                    <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(task)} />
                    <Popconfirm title="Удалить задачу?" onConfirm={() => onDelete(task)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            </div>
        </Card>
    );
};

const TaskKanbanColumn = ({ col, tasks, ...cardProps }) => (
    <div style={{ flex: '1 1 240px', minWidth: 240, maxWidth: 340 }}>
        <div style={{
            background: col.bg, border: `1px solid ${col.border}`, borderRadius: 8,
            padding: '8px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
        }}>
            <Text strong style={{ color: col.color, fontSize: 13 }}>{col.label}</Text>
            <Badge count={tasks.length} style={{ background: col.color, marginLeft: 'auto' }} />
        </div>
        {tasks.length === 0 ? (
            <div style={{ border: `1px dashed ${col.border}`, borderRadius: 6, padding: 16, textAlign: 'center', color: '#bbb', fontSize: 12 }}>
                Нет задач
            </div>
        ) : (
            tasks.map((t) => <TaskKanbanCard key={t._id} task={t} {...cardProps} />)
        )}
    </div>
);

const TaskKanbanBoard = ({ tasks, users, onEdit, onDelete, onMove, onFiles, onTogglePaid, onAssign }) => {
    const cancelled = tasks.filter((t) => t.status === 'cancelled');
    // Прогресс считается от общей суммы задач текущей доски (модуль + спринт) —
    // двигается сразу, как только карточка попадает в колонку «Выполнено».
    const total = tasks.length - cancelled.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Progress
                    percent={percent}
                    status={percent === 100 ? 'success' : 'active'}
                    style={{ flex: 1, maxWidth: 420 }}
                />
                <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    Готово {done} из {total}
                </Text>
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
                {KANBAN_COLUMNS.map((col) => (
                    <TaskKanbanColumn
                        key={col.key}
                        col={col}
                        tasks={tasks.filter((t) => t.status === col.key)}
                        users={users}
                        onEdit={onEdit} onDelete={onDelete} onMove={onMove}
                        onFiles={onFiles} onTogglePaid={onTogglePaid} onAssign={onAssign}
                    />
                ))}
            </div>
            {cancelled.length > 0 && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
                    Отменённых задач: {cancelled.length}
                </Text>
            )}
        </div>
    );
};

const BoardProjectPage = () => {
    const queryClient = useQueryClient();
    const user = useSelector((state) => state.auth.user);

    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedModule, setSelectedModule] = useState(null);
    const [selectedSprintId, setSelectedSprintId] = useState('all');
    const [projectModal, setProjectModal] = useState({ open: false, item: null });
    const [taskModal, setTaskModal] = useState({ open: false, item: null });
    const [clientsDrawer, setClientsDrawer] = useState({ open: false, project: null });
    const [commentsDrawer, setCommentsDrawer] = useState({ open: false, project: null });
    const [taskApiDrawer, setTaskApiDrawer] = useState({ open: false, project: null });
    const [sprintTaskApiDrawer, setSprintTaskApiDrawer] = useState({ open: false, sprintId: null });
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
    const sprints = currentProject?.sprints || [];
    const activeSprint = sprints.find((s) => s.status === 'active') || null;

    // При открытии проекта — сразу переключаемся на его активный спринт (если он есть).
    useEffect(() => {
        setSelectedSprintId(activeSprint ? activeSprint._id : 'all');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProject?._id]);

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
            if (selectedProject) {
                setSelectedProject(null);
                setSelectedModule(null);
            }
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

    // Отдельная публичная ссылка на конкретный спринт (не общий портал проекта).
    const getSprintLink = useMutation({
        mutationFn: (sprintId) => apiClient.post(`/board-projects/${currentProject._id}/sprints/${sprintId}/link`),
        onSuccess: ({ data }) => {
            queryClient.invalidateQueries({ queryKey: ['board-projects'] });
            navigator.clipboard.writeText(data.data.link);
            message.success('Ссылка на спринт скопирована');
        },
        onError: (e) => message.error(e.response?.data?.message || 'Не удалось получить ссылку'),
    });

    const copySprintLink = (token) => {
        navigator.clipboard.writeText(`${window.location.origin}/sprint-portal/${token}`);
        message.success('Ссылка на спринт скопирована');
    };

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
            const sprint = selectedSprintId === 'none'
                ? null
                : selectedSprintId === 'all'
                    ? (activeSprint?._id || null)
                    : selectedSprintId;
            addTask.mutate({ projectId: currentProject._id, body: { ...body, execRole: selectedModule, sprint } });
        }
    };

    const handleExcel = async (project, unpaidOnly = false, sprint = null) => {
        try {
            const params = {};
            if (unpaidOnly) params.unpaidOnly = 'true';
            if (sprint) params.sprintId = sprint._id;
            const response = await apiClient.get(`/board-projects/${project._id}/export`, {
                responseType: 'blob',
                params,
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            const suffix = unpaidOnly ? '_неоплаченные' : '';
            const sprintSuffix = sprint ? `_${sprint.name}` : '';
            link.setAttribute('download', `${project.name}${sprintSuffix}${suffix}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success(unpaidOnly ? 'Неоплаченные задачи экспортированы' : 'Excel экспортирован');
        } catch {
            message.error('Не удалось экспортировать');
        }
    };

    // ── Stats ──────────────────────────────────────────────────────────────────

    const computeStats = (tasks) => {
        const done = tasks.filter((t) => t.status === 'done').length;
        const hours = Number(tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0).toFixed(1));
        const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        // Задача «заполнена» если есть часы > 0, заказчик, система и дата
        const filled = tasks.filter(
            (t) => Number(t.hours) > 0 && t.customer?.trim() && t.system?.trim() && t.dueDate
        ).length;
        const paid = tasks.filter((t) => t.isPaid).length;
        const paidHours = Number(tasks.filter((t) => t.isPaid).reduce((s, t) => s + (Number(t.hours) || 0), 0).toFixed(1));
        const unpaidHours = Number((hours - paidHours).toFixed(1));
        return { total: tasks.length, done, hours, rate, filled, paid, paidHours, unpaidHours };
    };

    const getProjectStats = (p) => computeStats(p.tasks || []);

    // Задачи, относящиеся к текущему пользователю: у воркера — только назначенные на него,
    // у остальных ролей — все задачи проекта (полный обзор).
    const getRelevantTasks = (p) => {
        const tasks = p.tasks || [];
        if (user?.role === 'worker') {
            return tasks.filter((t) => String(t.assignedTo?._id) === String(user._id));
        }
        return tasks;
    };

    // Заказ считается «оплаченным», если по нему есть задачи и все они оплачены.
    const isProjectPaid = (p) => {
        const relevant = getRelevantTasks(p);
        return relevant.length > 0 && relevant.every((t) => t.isPaid);
    };

    const getProjectSpecializations = (p) => {
        const relevant = getRelevantTasks(p);
        const fromAssignee = relevant.map((t) => t.assignedTo?.specialization);
        const fromExecRole = relevant.map((t) => t.execRole);
        return [...new Set([...fromAssignee, ...fromExecRole].filter(Boolean))];
    };

    // Задачи проекта, относящиеся к конкретному модулю (Frontend/Backend/PM).
    // Внутри уже открытого проекта показываем все задачи модуля, а не только назначенные
    // текущему пользователю — ограничение по роли действует лишь на списке проектов.
    const getModuleTasks = (p, moduleKey) => {
        const tasks = p.tasks || [];
        return tasks
            .filter((t) => (t.execRole || t.assignedTo?.specialization) === moduleKey)
            .filter((t) => {
                if (selectedSprintId === 'all') return true;
                if (selectedSprintId === 'none') return !t.sprint;
                return String(t.sprint) === String(selectedSprintId);
            });
    };

    const SPEC_LABELS = {
        frontend: ['FRONTEND', 'geekblue'],
        backend: ['BACKEND', 'cyan'],
        pm: ['PM', 'purple'],
        tester: ['ТЕСТИРОВЩИК', 'volcano'],
    };

    const copyPortalLink = (p) => {
        const link = `${window.location.origin}/portal/${p.portal.token}`;
        navigator.clipboard.writeText(link);
        message.success('Ссылка портала скопирована');
    };

    const renderProjectCard = (p) => {
        const stats = getProjectStats(p);
        const statusInfo = PROJECT_STATUS[p.status] || { label: p.status, color: 'default' };
        const specs = getProjectSpecializations(p);
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
                        ...(p.portal?.enabled && p.portal?.token ? [
                            <Tooltip title="Скопировать ссылку портала" key="portal-link">
                                <Button
                                    type="text" size="small" icon={<LinkOutlined />}
                                    onClick={(e) => { e.stopPropagation(); copyPortalLink(p); }}
                                >
                                    Ссылка
                                </Button>
                            </Tooltip>,
                        ] : []),
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

                    {specs.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            {specs.map((spec) => {
                                const [label, color] = SPEC_LABELS[spec] || [spec, 'default'];
                                return <Tag key={spec} color={color}>{label}</Tag>;
                            })}
                        </div>
                    )}

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
    };

    const renderModuleCard = (moduleKey) => {
        const [label, color] = SPEC_LABELS[moduleKey];
        const tasks = getModuleTasks(currentProject, moduleKey);
        const stats = computeStats(tasks);
        return (
            <Col xs={24} sm={12} lg={6} key={moduleKey}>
                <Card
                    hoverable
                    onClick={() => setSelectedModule(moduleKey)}
                    style={{ cursor: 'pointer', textAlign: 'center' }}
                >
                    <Tag color={color} style={{ fontSize: 14, padding: '4px 14px', marginBottom: 16 }}>
                        {label}
                    </Tag>
                    <Row gutter={8}>
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
                        style={{ marginTop: 16 }}
                    />
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
                        <Tag color="green">✅ Оплачено {stats.paidHours} ч</Tag>
                        <Tag color="red">❌ Не оплачено {stats.unpaidHours} ч</Tag>
                    </div>
                </Card>
            </Col>
        );
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

                {!isLoading && !!projects?.length && (
                    <>
                        {(() => {
                            const filtered = projects;
                            const paidProjects = filtered.filter(isProjectPaid);
                            const unpaidProjects = filtered.filter((p) => !isProjectPaid(p));
                            return (
                                <>
                                    {unpaidProjects.length > 0 && (
                                        <div style={{ marginBottom: 28 }}>
                                            <Title level={4} style={{ marginBottom: 12 }}>
                                                Не оплачено <Tag color="orange">{unpaidProjects.length}</Tag>
                                            </Title>
                                            <Row gutter={[16, 16]}>
                                                {unpaidProjects.map(renderProjectCard)}
                                            </Row>
                                        </div>
                                    )}

                                    {paidProjects.length > 0 && (
                                        <div>
                                            <Title level={4} style={{ marginBottom: 12 }}>
                                                Оплачено <Tag color="green">{paidProjects.length}</Tag>
                                            </Title>
                                            <Row gutter={[16, 16]}>
                                                {paidProjects.map(renderProjectCard)}
                                            </Row>
                                        </div>
                                    )}

                                    {filtered.length === 0 && (
                                        <Empty description="Нет заказов по выбранному фильтру" />
                                    )}
                                </>
                            );
                        })()}
                    </>
                )}

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

    // ── Module selection (Frontend / Backend / PM) ───────────────────────────────

    if (!selectedModule) {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedProject(null)}>
                            Все проекты
                        </Button>
                        <Title level={3} style={{ margin: 0 }}>{currentProject.name}</Title>
                    </Space>
                    {(user?.role === 'admin' || String(currentProject.createdBy?._id || currentProject.createdBy) === String(user?._id)) && (
                        <Button
                            icon={<ApiOutlined />}
                            onClick={() => setTaskApiDrawer({ open: true, project: currentProject })}
                        >
                            API для задач
                        </Button>
                    )}
                </div>

                {/* Переключатель спринта — влияет на то, какие задачи видны в модулях ниже */}
                {sprints.length > 0 && (() => {
                    const selectedSprintObj = sprints.find((s) => s._id === selectedSprintId) || null;
                    const sprintStatusMark = { active: '🟢 активен', planning: '🕐 запланирован', completed: '✓ завершён' };
                    return (
                        <Card size="small" style={{ marginBottom: 20, background: '#fafafa' }}>
                            <Space wrap align="center">
                                <RocketOutlined style={{ color: '#1677ff' }} />
                                <Text strong>Спринт:</Text>
                                <Select
                                    value={selectedSprintId}
                                    onChange={setSelectedSprintId}
                                    style={{ minWidth: 220 }}
                                    options={[
                                        { value: 'all', label: 'Все спринты' },
                                        ...sprints.slice().reverse().map((s) => ({
                                            value: s._id,
                                            label: `${s.name} ${sprintStatusMark[s.status] || ''}`,
                                        })),
                                        { value: 'none', label: 'Без спринта (бэклог)' },
                                    ]}
                                />
                                {activeSprint && (
                                    <Tag color="green">Активный: {activeSprint.name}</Tag>
                                )}
                                {selectedSprintObj && (
                                    <>
                                        {selectedSprintObj.token ? (
                                            <Button size="small" icon={<LinkOutlined />}
                                                onClick={() => copySprintLink(selectedSprintObj.token)}>
                                                Ссылка для клиента
                                            </Button>
                                        ) : (
                                            <Button size="small" icon={<LinkOutlined />}
                                                loading={getSprintLink.isPending}
                                                onClick={() => getSprintLink.mutate(selectedSprintObj._id)}>
                                                Ссылка для клиента
                                            </Button>
                                        )}
                                        <Button size="small" icon={<FileExcelOutlined />}
                                            style={{ color: '#217346', borderColor: '#217346' }}
                                            onClick={() => handleExcel(currentProject, false, selectedSprintObj)}>
                                            Excel по спринту
                                        </Button>
                                        <Button size="small" icon={<ApiOutlined />}
                                            onClick={() => setSprintTaskApiDrawer({ open: true, sprintId: selectedSprintObj._id })}>
                                            API по спринту
                                        </Button>
                                    </>
                                )}
                            </Space>
                        </Card>
                    );
                })()}

                <Title level={4} style={{ marginBottom: 16 }}>Выберите модуль</Title>

                <Row gutter={[16, 16]}>
                    {['frontend', 'backend', 'pm', 'tester'].map(renderModuleCard)}
                </Row>

                <TaskApiDrawer
                    open={taskApiDrawer.open}
                    project={taskApiDrawer.project}
                    onClose={() => setTaskApiDrawer({ open: false, project: null })}
                />

                <SprintTaskApiDrawer
                    open={sprintTaskApiDrawer.open}
                    project={currentProject}
                    sprint={sprints.find((s) => s._id === sprintTaskApiDrawer.sprintId) || null}
                    onClose={() => setSprintTaskApiDrawer({ open: false, sprintId: null })}
                />
            </div>
        );
    }

    // ── Task list view (inside project) ───────────────────────────────────────

    const moduleTasks = getModuleTasks(currentProject, selectedModule);
    const stats = computeStats(moduleTasks);
    const statusInfo = PROJECT_STATUS[currentProject.status] || { label: currentProject.status, color: 'default' };

    const taskColumns = [
        {
            title: 'Задача',
            dataIndex: 'title',
            key: 'title',
            width: 260,
            fixed: 'left',
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
            fixed: 'right',
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
                    <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedModule(null)}>
                        Модули
                    </Button>
                    <Title level={3} style={{ margin: 0 }}>
                        {currentProject.name}
                    </Title>
                    <Tag color={SPEC_LABELS[selectedModule]?.[1]}>{SPEC_LABELS[selectedModule]?.[0]}</Tag>
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
                        disabled={!moduleTasks.length}
                    >
                        Экспорт Excel
                    </Button>
                    <Button
                        icon={<FileExcelOutlined />}
                        style={{ color: '#DC2626', borderColor: '#DC2626' }}
                        onClick={() => handleExcel(currentProject, true)}
                        disabled={!moduleTasks.some(t => !t.isPaid)}
                    >
                        ❌ Неоплаченные
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateTask}>
                        Добавить задачу
                    </Button>
                </Space>
            </div>

            {/* Tabs: Обзор / Задачи / Обновления / Таймлайн / Файлы / Клиентский портал */}
            <Tabs
                defaultActiveKey="overview"
                items={[
                    {
                        key: 'overview',
                        label: 'Обзор',
                        children: (
                            <Row gutter={16} style={{ marginBottom: 16 }}>
                                <Col xs={12} md={3}>
                                    <Card size="small">
                                        <Statistic title="Всего задач" value={stats.total} prefix={<UnorderedListOutlined />} />
                                    </Card>
                                </Col>
                                <Col xs={12} md={3}>
                                    <Card size="small">
                                        <Statistic title="Выполнено" value={stats.done} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
                                    </Card>
                                </Col>
                                <Col xs={12} md={3}>
                                    <Card size="small">
                                        <Statistic title="Часов" value={stats.hours} suffix="ч" prefix={<ClockCircleOutlined />} />
                                    </Card>
                                </Col>
                                <Col xs={12} md={3}>
                                    <Card size="small">
                                        <Statistic
                                            title="Оплачено задач"
                                            value={stats.paid}
                                            suffix={`/ ${stats.total}`}
                                            valueStyle={{ color: stats.paid === stats.total && stats.total > 0 ? '#3f8600' : '#faad14' }}
                                        />
                                    </Card>
                                </Col>
                                <Col xs={12} md={3}>
                                    <Card size="small">
                                        <Statistic
                                            title="✅ Оплачено часов"
                                            value={stats.paidHours}
                                            suffix="ч"
                                            valueStyle={{ color: '#3f8600' }}
                                        />
                                    </Card>
                                </Col>
                                <Col xs={12} md={3}>
                                    <Card size="small">
                                        <Statistic
                                            title="❌ Не оплачено часов"
                                            value={stats.unpaidHours}
                                            suffix="ч"
                                            valueStyle={{ color: '#cf1322' }}
                                        />
                                    </Card>
                                </Col>
                                <Col xs={24} md={6}>
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
                        ),
                    },
                    {
                        key: 'tasks',
                        label: `Задачи (${stats.total})`,
                        children: moduleTasks.length === 0 ? (
                            <Empty description="Нет задач. Нажмите «Добавить задачу»" />
                        ) : (
                            <TaskKanbanBoard
                                tasks={moduleTasks}
                                users={users}
                                onEdit={openEditTask}
                                onDelete={(task) => deleteTask.mutate({ projectId: currentProject._id, taskId: task._id })}
                                onMove={(task, status) => updateTask.mutate({ projectId: currentProject._id, taskId: task._id, body: { status } })}
                                onFiles={(task) => setFilesDrawer({ open: true, task })}
                                onTogglePaid={(task, isPaid) => updateTask.mutate({ projectId: currentProject._id, taskId: task._id, body: { isPaid } })}
                                onAssign={(task, userId) => updateTask.mutate({ projectId: currentProject._id, taskId: task._id, body: { assignedTo: userId } })}
                            />
                        ),
                    },
                    {
                        key: 'table',
                        label: 'Таблица',
                        children: (
                            <Table
                                columns={taskColumns}
                                dataSource={moduleTasks}
                                rowKey="_id"
                                pagination={{ pageSize: 15 }}
                                bordered
                                size="middle"
                                scroll={{ x: 1400 }}
                                locale={{ emptyText: <Empty description="Нет задач. Нажмите «Добавить задачу»" /> }}
                            />
                        ),
                    },
                    { key: 'updates',  label: 'Обновления', children: <UpdatesTab projectId={currentProject._id} /> },
                    { key: 'timeline', label: 'Таймлайн',   children: <TimelineTab projectId={currentProject._id} /> },
                    { key: 'files',    label: 'Файлы',      children: <ProjectFilesTab project={currentProject} /> },
                    ...(['admin', 'projectManager', 'worker'].includes(user?.role)
                        ? [
                            { key: 'sprints', label: 'Спринты', children: <SprintsTab project={currentProject} /> },
                            { key: 'portal', label: 'Клиентский портал', children: <PortalSettingsTab projectId={currentProject._id} /> },
                        ]
                        : []),
                ]}
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
