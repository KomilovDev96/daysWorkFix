import React, { useState } from 'react';
import {
    Typography, Card, Button, Table, Tag, Space, Modal, Form, Input,
    Select, DatePicker, message, Popconfirm, Avatar, Tooltip, Empty, Drawer
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined,
    RocketOutlined, UserAddOutlined, UserDeleteOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const STATUS_LABELS = {
    planning: { label: 'Планирование', color: 'default' },
    active: { label: 'Активный', color: 'green' },
    completed: { label: 'Завершён', color: 'blue' },
    paused: { label: 'На паузе', color: 'orange' },
};

const StartupPage = () => {
    const queryClient = useQueryClient();
    const user = useSelector((state) => state.auth.user);

    const [projectModal, setProjectModal] = useState({ open: false, item: null });
    const [membersDrawer, setMembersDrawer] = useState({ open: false, project: null });
    const [memberForm] = Form.useForm();
    const [form] = Form.useForm();

    const { data: projects, isLoading } = useQuery({
        queryKey: ['startup-projects'],
        queryFn: async () => {
            const { data } = await apiClient.get('/startup');
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

    const createMutation = useMutation({
        mutationFn: (body) => apiClient.post('/startup', body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['startup-projects'] });
            message.success('Проект создан');
            setProjectModal({ open: false, item: null });
        },
        onError: () => message.error('Не удалось создать проект'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, body }) => apiClient.patch(`/startup/${id}`, body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['startup-projects'] });
            message.success('Проект обновлён');
            setProjectModal({ open: false, item: null });
        },
        onError: () => message.error('Не удалось обновить проект'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => apiClient.delete(`/startup/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['startup-projects'] });
            message.success('Проект удалён');
        },
        onError: () => message.error('Не удалось удалить проект'),
    });

    const addMemberMutation = useMutation({
        mutationFn: ({ projectId, userId }) => apiClient.post(`/startup/${projectId}/members`, { userId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['startup-projects'] });
            message.success('Участник добавлен');
            memberForm.resetFields();
        },
        onError: () => message.error('Не удалось добавить участника'),
    });

    const removeMemberMutation = useMutation({
        mutationFn: ({ projectId, userId }) => apiClient.delete(`/startup/${projectId}/members/${userId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['startup-projects'] });
            message.success('Участник удалён');
        },
        onError: () => message.error('Не удалось удалить участника'),
    });

    const openCreate = () => {
        form.resetFields();
        setProjectModal({ open: true, item: null });
    };

    const openEdit = (item) => {
        form.setFieldsValue({
            name: item.name,
            description: item.description,
            status: item.status,
            deadline: item.deadline ? dayjs(item.deadline) : null,
            goals: item.goals,
        });
        setProjectModal({ open: true, item });
    };

    const handleSave = async () => {
        const values = await form.validateFields();
        const body = {
            ...values,
            deadline: values.deadline ? values.deadline.toISOString() : undefined,
        };
        if (projectModal.item) {
            updateMutation.mutate({ id: projectModal.item._id, body });
        } else {
            createMutation.mutate(body);
        }
    };

    const openMembers = (project) => {
        memberForm.resetFields();
        setMembersDrawer({ open: true, project });
    };

    const currentProject = projects?.find((p) => p._id === membersDrawer.project?._id) || membersDrawer.project;

    const columns = [
        {
            title: 'Название',
            dataIndex: 'name',
            key: 'name',
            render: (name, record) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{name}</Text>
                    {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>}
                </Space>
            ),
        },
        {
            title: 'Статус',
            dataIndex: 'status',
            key: 'status',
            render: (s) => {
                const info = STATUS_LABELS[s] || { label: s, color: 'default' };
                return <Tag color={info.color}>{info.label}</Tag>;
            },
        },
        {
            title: 'Дедлайн',
            dataIndex: 'deadline',
            key: 'deadline',
            render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : <Text type="secondary">—</Text>,
        },
        {
            title: 'Команда',
            dataIndex: 'members',
            key: 'members',
            render: (members, record) => (
                <Space>
                    <Avatar.Group maxCount={4} size="small">
                        {members?.map((m) => (
                            <Tooltip key={m._id} title={m.name}>
                                <Avatar size="small" style={{ backgroundColor: '#1677ff' }}>
                                    {m.name?.[0]?.toUpperCase()}
                                </Avatar>
                            </Tooltip>
                        ))}
                    </Avatar.Group>
                    <Button size="small" icon={<TeamOutlined />} onClick={() => openMembers(record)}>
                        {members?.length || 0}
                    </Button>
                </Space>
            ),
        },
        {
            title: 'Создан',
            dataIndex: 'createdBy',
            key: 'createdBy',
            render: (u) => u?.name || '—',
        },
        {
            title: 'Действия',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                        Изменить
                    </Button>
                    <Popconfirm title="Удалить проект?" onConfirm={() => deleteMutation.mutate(record._id)}>
                        <Button size="small" danger icon={<DeleteOutlined />}>Удалить</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>
                    <RocketOutlined style={{ marginRight: 8 }} />
                    Стартап-проекты
                </Title>
                <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreate}>
                    Новый проект
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={projects}
                rowKey="_id"
                loading={isLoading}
                pagination={{ pageSize: 10 }}
                bordered
                locale={{ emptyText: <Empty description="Нет стартап-проектов" /> }}
            />

            {/* Create/Edit Modal */}
            <Modal
                title={projectModal.item ? 'Редактировать проект' : 'Новый стартап-проект'}
                open={projectModal.open}
                onOk={handleSave}
                onCancel={() => setProjectModal({ open: false, item: null })}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
                okText="Сохранить"
                cancelText="Отмена"
                width={600}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
                        <Input placeholder="Название проекта" />
                    </Form.Item>
                    <Form.Item name="description" label="Описание">
                        <TextArea rows={3} placeholder="Краткое описание" />
                    </Form.Item>
                    <Form.Item name="status" label="Статус" initialValue="planning">
                        <Select>
                            {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                                <Option key={val} value={val}>{label}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="deadline" label="Дедлайн">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="goals" label="Цели">
                        <TextArea rows={3} placeholder="Цели проекта" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Members Drawer */}
            <Drawer
                title={`Команда: ${currentProject?.name || ''}`}
                open={membersDrawer.open}
                onClose={() => setMembersDrawer({ open: false, project: null })}
                width={400}
            >
                <Title level={5} style={{ marginBottom: 12 }}>Добавить участника</Title>
                <Form form={memberForm} layout="inline" style={{ marginBottom: 24 }}
                    onFinish={(values) => {
                        addMemberMutation.mutate({ projectId: currentProject._id, userId: values.userId });
                    }}
                >
                    <Form.Item name="userId" rules={[{ required: true }]} style={{ flex: 1 }}>
                        <Select placeholder="Выберите сотрудника" style={{ minWidth: 200 }}>
                            {users?.map((u) => (
                                <Option key={u._id} value={u._id}>
                                    {u.name} ({u.email})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<UserAddOutlined />}
                            loading={addMemberMutation.isPending}>
                            Добавить
                        </Button>
                    </Form.Item>
                </Form>

                <Title level={5} style={{ marginBottom: 12 }}>Участники</Title>
                {currentProject?.members?.length === 0 && (
                    <Empty description="Нет участников" />
                )}
                {currentProject?.members?.map((m) => (
                    <Card key={m._id} size="small" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Space>
                                <Avatar style={{ backgroundColor: '#1677ff' }}>
                                    {m.name?.[0]?.toUpperCase()}
                                </Avatar>
                                <div>
                                    <Text strong>{m.name}</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: 12 }}>{m.email}</Text>
                                </div>
                            </Space>
                            <Popconfirm
                                title="Удалить из команды?"
                                onConfirm={() => removeMemberMutation.mutate({ projectId: currentProject._id, userId: m._id })}
                            >
                                <Button size="small" danger icon={<UserDeleteOutlined />} />
                            </Popconfirm>
                        </div>
                    </Card>
                ))}
            </Drawer>
        </div>
    );
};

export default StartupPage;
