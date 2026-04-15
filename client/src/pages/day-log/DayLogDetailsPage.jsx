import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Typography, Card, List, Button, Tag, Space, Divider,
    Drawer, Popconfirm, Form, Input, InputNumber, Select,
    Upload, message, Tooltip, Empty, Modal, Dropdown
} from 'antd';
import {
    PlusOutlined, UploadOutlined, FileTextOutlined,
    ClockCircleOutlined, DeleteOutlined, ArrowLeftOutlined,
    EditOutlined, FolderOutlined, FolderOpenOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DayLogDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Template apply modal state
    const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
    const [applyingTemplate, setApplyingTemplate] = useState(false);

    // Project modal state
    const [isProjectModalVisible, setIsProjectModalVisible] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [projectForm] = Form.useForm();

    // Task drawer state
    const [isTaskDrawerVisible, setIsTaskDrawerVisible] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [currentProjectId, setCurrentProjectId] = useState(null);
    const [taskForm] = Form.useForm();
    const [fileList, setFileList] = useState([]);

    // ─── Queries ───────────────────────────────────────────────────────────────

    const { data: templates } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => {
            const { data } = await apiClient.get('/templates');
            return data.data.templates;
        },
    });

    const { data: log, isLoading } = useQuery({
        queryKey: ['day-log', id],
        queryFn: async () => {
            const { data } = await apiClient.get(`/daylogs/${id}`);
            return data.data.daylog;
        },
    });

    // ─── Project mutations ──────────────────────────────────────────────────────

    const createProjectMutation = useMutation({
        mutationFn: (data) => apiClient.post('/projects', { ...data, dayLogId: id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['day-log', id] });
            setIsProjectModalVisible(false);
            projectForm.resetFields();
            message.success('Проект создан');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось создать проект'),
    });

    const updateProjectMutation = useMutation({
        mutationFn: ({ projectId, data }) => apiClient.patch(`/projects/${projectId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['day-log', id] });
            setIsProjectModalVisible(false);
            setEditingProject(null);
            projectForm.resetFields();
            message.success('Проект обновлён');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось обновить проект'),
    });

    const deleteProjectMutation = useMutation({
        mutationFn: (projectId) => apiClient.delete(`/projects/${projectId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['day-log', id] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            queryClient.invalidateQueries({ queryKey: ['my-logs'] });
            message.success('Проект удалён');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось удалить проект'),
    });

    // ─── Apply template ─────────────────────────────────────────────────────────

    const handleApplyTemplate = async (templateId) => {
        setApplyingTemplate(true);
        try {
            await apiClient.post(`/templates/${templateId}/apply`, { dayLogId: id });
            queryClient.invalidateQueries({ queryKey: ['day-log', id] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            queryClient.invalidateQueries({ queryKey: ['my-logs'] });
            setIsTemplateModalVisible(false);
            message.success('Шаблон применён — проект создан');
        } catch (err) {
            message.error(err.response?.data?.message || 'Не удалось применить шаблон');
        } finally {
            setApplyingTemplate(false);
        }
    };

    // ─── Task mutations ─────────────────────────────────────────────────────────

    const buildTaskPayload = (values) => {
        const customer = {
            name: values.customerName?.trim(),
            externalId: values.customerExternalId?.trim(),
            email: values.customerEmail?.trim(),
        };
        const hasCustomerInfo = Object.values(customer).some(Boolean);
        return {
            title: values.title,
            description: values.description,
            hours: values.hours,
            status: values.status || 'pending',
            testingStatus: values.testingStatus || 'not_reviewed',
            comment: values.comment,
            customer: hasCustomerInfo ? customer : {},
        };
    };

    const uploadFiles = async (taskId) => {
        try {
            const promises = fileList.map(item => {
                const formData = new FormData();
                formData.append('file', item);
                formData.append('taskId', taskId);
                formData.append('title', item.name);
                return apiClient.post('/files/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            });
            await Promise.all(promises);
            queryClient.invalidateQueries({ queryKey: ['day-log', id] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            queryClient.invalidateQueries({ queryKey: ['my-logs'] });
            setIsTaskDrawerVisible(false);
            taskForm.resetFields();
            setFileList([]);
            message.success('Задача и файлы успешно загружены');
        } catch {
            message.error('Задача добавлена, но некоторые файлы не удалось загрузить');
        }
    };

    const afterTaskSuccess = (taskId) => {
        if (fileList.length > 0) {
            uploadFiles(taskId);
        } else {
            queryClient.invalidateQueries({ queryKey: ['day-log', id] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            queryClient.invalidateQueries({ queryKey: ['my-logs'] });
            setIsTaskDrawerVisible(false);
            setEditingTask(null);
            taskForm.resetFields();
            setFileList([]);
        }
    };

    const addTaskMutation = useMutation({
        mutationFn: (newTask) => apiClient.post('/tasks', {
            ...newTask,
            dayLogId: id,
            projectId: currentProjectId,
        }),
        onSuccess: (resp) => {
            const taskId = resp.data.data.task._id;
            afterTaskSuccess(taskId);
            if (fileList.length === 0) message.success('Задача добавлена');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось добавить задачу'),
    });

    const updateTaskMutation = useMutation({
        mutationFn: ({ taskId, data }) => apiClient.patch(`/tasks/${taskId}`, data),
        onSuccess: (resp) => {
            const taskId = resp.data.data.task._id;
            afterTaskSuccess(taskId);
            if (fileList.length === 0) message.success('Задача обновлена');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось обновить задачу'),
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (taskId) => apiClient.delete(`/tasks/${taskId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['day-log', id] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            queryClient.invalidateQueries({ queryKey: ['my-logs'] });
            message.success('Задача удалена');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось удалить задачу'),
    });

    const deleteFileMutation = useMutation({
        mutationFn: (fileId) => apiClient.delete(`/files/${fileId}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['day-log', id]);
            message.success('Файл удалён');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось удалить файл'),
    });

    // ─── Handlers ──────────────────────────────────────────────────────────────

    const handleOpenAddTask = (projectId) => {
        setCurrentProjectId(projectId);
        setEditingTask(null);
        taskForm.resetFields();
        setFileList([]);
        setIsTaskDrawerVisible(true);
    };

    const handleEditTask = (task, projectId) => {
        setCurrentProjectId(projectId);
        setEditingTask(task);
        taskForm.setFieldsValue({
            title: task.title,
            description: task.description,
            hours: task.hours,
            status: task.status,
            testingStatus: task.testingStatus || 'not_reviewed',
            comment: task.comment,
            customerName: task.customer?.name,
            customerExternalId: task.customer?.externalId,
            customerEmail: task.customer?.email,
        });
        setFileList([]);
        setIsTaskDrawerVisible(true);
    };

    const handleTaskFinish = (values) => {
        const payload = buildTaskPayload(values);
        if (editingTask) {
            updateTaskMutation.mutate({ taskId: editingTask._id, data: payload });
        } else {
            addTaskMutation.mutate(payload);
        }
    };

    const handleCloseTaskDrawer = () => {
        setIsTaskDrawerVisible(false);
        setEditingTask(null);
        setCurrentProjectId(null);
        taskForm.resetFields();
        setFileList([]);
    };

    const handleOpenCreateProject = () => {
        setEditingProject(null);
        projectForm.resetFields();
        setIsProjectModalVisible(true);
    };

    const handleEditProject = (project) => {
        setEditingProject(project);
        projectForm.setFieldsValue({ name: project.name, description: project.description });
        setIsProjectModalVisible(true);
    };

    const handleProjectFinish = (values) => {
        if (editingProject) {
            updateProjectMutation.mutate({ projectId: editingProject._id, data: values });
        } else {
            createProjectMutation.mutate(values);
        }
    };

    // ─── Helpers ────────────────────────────────────────────────────────────────

    const getStatusTag = (status) => {
        switch (status) {
            case 'completed': return <Tag color="success">Выполнено</Tag>;
            case 'failed': return <Tag color="error">Не выполнено</Tag>;
            default: return <Tag color="processing">В процессе</Tag>;
        }
    };

    const getTestingStatusTag = (testingStatus) => {
        switch (testingStatus) {
            case 'completed': return <Tag color="success">Тестирование завершено</Tag>;
            case 'in_progress': return <Tag color="gold">Тестирование в процессе</Tag>;
            default: return <Tag color="default">Тестирование: не рассмотрено</Tag>;
        }
    };

    const getCustomerInfo = (customer) => {
        if (!customer) return null;
        const parts = [];
        if (customer.name) parts.push(`Имя: ${customer.name}`);
        if (customer.externalId) parts.push(`ID: ${customer.externalId}`);
        if (customer.email) parts.push(`Email: ${customer.email}`);
        return parts.length ? parts.join(' | ') : null;
    };

    const uploadProps = {
        onRemove: (file) => {
            setFileList(prev => {
                const idx = prev.indexOf(file);
                const next = prev.slice();
                next.splice(idx, 1);
                return next;
            });
        },
        beforeUpload: (file) => {
            setFileList(prev => [...prev, file]);
            return false;
        },
        fileList,
    };

    if (isLoading) return <Card loading />;

    // ─── Render ─────────────────────────────────────────────────────────────────

    return (
        <div>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')} style={{ marginBottom: 16 }}>
                Назад к панели
            </Button>

            <Card
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Title level={4} style={{ margin: 0 }}>
                            Журнал работы: {dayjs(log?.date).format('MMMM D, YYYY')}
                        </Title>
                        <Tag color="cyan" icon={<ClockCircleOutlined />}>
                            Всего: {log?.totalHours} часов
                        </Tag>
                    </div>
                }
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Title level={5} style={{ margin: 0 }}>Проекты</Title>
                    <Space>
                        <Button
                            icon={<AppstoreOutlined />}
                            onClick={() => setIsTemplateModalVisible(true)}
                            disabled={!templates?.length}
                            title={!templates?.length ? 'Нет шаблонов' : 'Применить шаблон'}
                        >
                            Применить шаблон
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateProject}>
                            Создать проект
                        </Button>
                    </Space>
                </div>

                {(!log?.projects || log.projects.length === 0) ? (
                    <Empty description="Нет проектов на этот день. Создайте первый проект." />
                ) : (
                    <Space direction="vertical" style={{ width: '100%' }} size={16}>
                        {log.projects.map((project) => (
                            <Card
                                key={project._id}
                                style={{ border: '1px solid #e8e8e8', borderRadius: 8 }}
                                bodyStyle={{ padding: '16px 20px' }}
                                title={
                                    <Space>
                                        <FolderOpenOutlined style={{ color: '#faad14', fontSize: 18 }} />
                                        <Text strong style={{ fontSize: 15 }}>{project.name}</Text>
                                        {project.description && (
                                            <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>
                                                — {project.description}
                                            </Text>
                                        )}
                                    </Space>
                                }
                                extra={
                                    <Space>
                                        <Button
                                            type="primary"
                                            size="small"
                                            icon={<PlusOutlined />}
                                            onClick={() => handleOpenAddTask(project._id)}
                                        >
                                            Добавить задачу
                                        </Button>
                                        <Tooltip title="Редактировать проект">
                                            <Button
                                                size="small"
                                                icon={<EditOutlined />}
                                                onClick={() => handleEditProject(project)}
                                            />
                                        </Tooltip>
                                        <Popconfirm
                                            title="Удалить проект?"
                                            description="Все задачи внутри проекта тоже будут удалены."
                                            okText="Да"
                                            cancelText="Нет"
                                            onConfirm={() => deleteProjectMutation.mutate(project._id)}
                                        >
                                            <Tooltip title="Удалить проект">
                                                <Button size="small" danger icon={<DeleteOutlined />} />
                                            </Tooltip>
                                        </Popconfirm>
                                    </Space>
                                }
                            >
                                <List
                                    itemLayout="vertical"
                                    dataSource={project.tasks || []}
                                    locale={{ emptyText: <Empty description="Нет задач в этом проекте" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                                    renderItem={(task) => (
                                        <List.Item
                                            key={task._id}
                                            extra={
                                                <Space>
                                                    <Tooltip title="Редактировать задачу">
                                                        <Button
                                                            type="text"
                                                            icon={<EditOutlined />}
                                                            onClick={() => handleEditTask(task, project._id)}
                                                        />
                                                    </Tooltip>
                                                    <Popconfirm
                                                        title="Удалить задачу?"
                                                        okText="Да"
                                                        cancelText="Нет"
                                                        onConfirm={() => deleteTaskMutation.mutate(task._id)}
                                                    >
                                                        <Tooltip title="Удалить задачу">
                                                            <Button type="text" danger icon={<DeleteOutlined />} />
                                                        </Tooltip>
                                                    </Popconfirm>
                                                </Space>
                                            }
                                        >
                                            <List.Item.Meta
                                                avatar={<FileTextOutlined style={{ fontSize: 22, color: '#1890ff' }} />}
                                                title={<strong>{task.title}</strong>}
                                                description={
                                                    <Space direction="vertical" style={{ width: '100%' }}>
                                                        <Space wrap>
                                                            <Tag color="gold">{task.hours} ч</Tag>
                                                            <Text type="secondary">{dayjs(task.createdAt).format('HH:mm')}</Text>
                                                            {getStatusTag(task.status)}
                                                            {getTestingStatusTag(task.testingStatus)}
                                                        </Space>
                                                        {getCustomerInfo(task.customer) && (
                                                            <Text type="secondary">Заказчик: {getCustomerInfo(task.customer)}</Text>
                                                        )}
                                                    </Space>
                                                }
                                            />
                                            {task.description && (
                                                <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                                                    {task.description}
                                                </Typography.Paragraph>
                                            )}
                                            {task.comment && (
                                                <div style={{ borderLeft: '3px solid #f0f0f0', paddingLeft: 8, marginBottom: 8 }}>
                                                    <Text type="secondary" italic>Комментарий: {task.comment}</Text>
                                                </div>
                                            )}
                                            {task.files && task.files.length > 0 && (
                                                <div style={{ marginTop: 8 }}>
                                                    <Text strong>Вложения:</Text>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                                        {task.files.map(file => (
                                                            <Space key={file._id} size={4}>
                                                                <Tag icon={<UploadOutlined />} color="processing">
                                                                    <a href={`http://localhost:5000/${file.fileUrl}`} target="_blank" rel="noopener noreferrer">
                                                                        {file.title}
                                                                    </a>
                                                                </Tag>
                                                                <Popconfirm
                                                                    title="Удалить файл?"
                                                                    description="Это действие нельзя отменить."
                                                                    okText="Да"
                                                                    cancelText="Нет"
                                                                    onConfirm={() => deleteFileMutation.mutate(file._id)}
                                                                >
                                                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                                                </Popconfirm>
                                                            </Space>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </List.Item>
                                    )}
                                />
                            </Card>
                        ))}
                    </Space>
                )}
            </Card>

            {/* ── Apply Template Modal ─────────────────────────────────────── */}
            <Modal
                title="Выбрать шаблон проекта"
                open={isTemplateModalVisible}
                onCancel={() => setIsTemplateModalVisible(false)}
                footer={null}
                width={520}
            >
                {templates?.length ? (
                    <Space direction="vertical" style={{ width: '100%' }} size={10}>
                        {templates.map((tmpl) => {
                            const totalHours = (tmpl.tasks || []).reduce((s, t) => s + (t.estimatedHours || 0), 0);
                            return (
                                <Card
                                    key={tmpl._id}
                                    size="small"
                                    hoverable
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleApplyTemplate(tmpl._id)}
                                    loading={applyingTemplate}
                                >
                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Space>
                                            <AppstoreOutlined style={{ color: '#6c8ef5' }} />
                                            <div>
                                                <div><strong>{tmpl.name}</strong></div>
                                                {tmpl.description && (
                                                    <div style={{ fontSize: 12, color: '#888' }}>{tmpl.description}</div>
                                                )}
                                            </div>
                                        </Space>
                                        <Space>
                                            <Tag color="blue">{tmpl.tasks?.length || 0} задач</Tag>
                                            <Tag color="gold">{totalHours} ч</Tag>
                                        </Space>
                                    </Space>
                                </Card>
                            );
                        })}
                    </Space>
                ) : (
                    <Empty description="Нет шаблонов" />
                )}
            </Modal>

            {/* ── Project Modal ─────────────────────────────────────────────── */}
            <Modal
                title={editingProject ? 'Редактировать проект' : 'Создать новый проект'}
                open={isProjectModalVisible}
                onCancel={() => { setIsProjectModalVisible(false); setEditingProject(null); projectForm.resetFields(); }}
                onOk={() => projectForm.submit()}
                okText={editingProject ? 'Сохранить' : 'Создать'}
                cancelText="Отмена"
                confirmLoading={createProjectMutation.isPending || updateProjectMutation.isPending}
            >
                <Form form={projectForm} layout="vertical" onFinish={handleProjectFinish} style={{ marginTop: 16 }}>
                    <Form.Item
                        name="name"
                        label="Название проекта"
                        rules={[{ required: true, message: 'Введите название проекта' }]}
                    >
                        <Input placeholder="напр. Редизайн сайта" />
                    </Form.Item>
                    <Form.Item name="description" label="Описание (необязательно)">
                        <Input.TextArea rows={3} placeholder="Краткое описание проекта..." />
                    </Form.Item>
                </Form>
            </Modal>

            {/* ── Task Drawer ───────────────────────────────────────────────── */}
            <Drawer
                title={editingTask ? 'Редактировать задачу' : 'Добавить задачу'}
                open={isTaskDrawerVisible}
                onClose={handleCloseTaskDrawer}
                placement="right"
                width="60%"
            >
                <Form form={taskForm} layout="vertical" onFinish={handleTaskFinish}>
                    <Form.Item
                        name="title"
                        label="Название задачи"
                        rules={[{ required: true, message: 'Пожалуйста, введите название задачи' }]}
                    >
                        <Input placeholder="напр. Реализация модуля авторизации" />
                    </Form.Item>
                    <Form.Item name="description" label="Описание задачи">
                        <Input.TextArea rows={4} placeholder="Опишите, что вы сделали..." />
                    </Form.Item>
                    <Form.Item
                        name="hours"
                        label="Затрачено часов"
                        rules={[{ required: true, message: 'Пожалуйста, введите количество часов' }]}
                    >
                        <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="status" label="Статус задачи" initialValue="pending">
                        <Select>
                            <Select.Option value="pending">В процессе</Select.Option>
                            <Select.Option value="completed">Выполнено</Select.Option>
                            <Select.Option value="failed">Не выполнено</Select.Option>
                        </Select>
                    </Form.Item>

                    <Divider orientation="left">Заказчик</Divider>
                    <Form.Item name="customerName" label="Имя заказчика">
                        <Input placeholder="Например: Acme Corp" />
                    </Form.Item>
                    <Form.Item name="customerExternalId" label="ID заказчика">
                        <Input placeholder="Например: CL-1024" />
                    </Form.Item>
                    <Form.Item
                        name="customerEmail"
                        label="Email заказчика"
                        rules={[{ type: 'email', message: 'Введите корректный email' }]}
                    >
                        <Input placeholder="Например: client@example.com" />
                    </Form.Item>

                    <Form.Item name="testingStatus" label="Статус тестирования" initialValue="not_reviewed">
                        <Select>
                            <Select.Option value="not_reviewed">Не рассмотрено</Select.Option>
                            <Select.Option value="in_progress">В процессе</Select.Option>
                            <Select.Option value="completed">Завершено</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item name="comment" label="Комментарий / Результат">
                        <Input.TextArea rows={2} placeholder="Введите комментарий или почему задача не выполнена..." />
                    </Form.Item>

                    <Divider orientation="left">Загрузить файлы {editingTask && '(Новые)'}</Divider>
                    <Form.Item label="Вложения">
                        <Upload {...uploadProps} listType="text" multiple>
                            <Button icon={<UploadOutlined />}>Выбрать файлы</Button>
                        </Upload>
                    </Form.Item>

                    <Form.Item style={{ marginTop: 24 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={addTaskMutation.isPending || updateTaskMutation.isPending}
                            block
                            size="large"
                        >
                            {editingTask ? 'Сохранить изменения' : 'Отправить задачу'}
                        </Button>
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
};

export default DayLogDetailsPage;
