import React, { useState } from 'react';
import {
    Typography, Card, Form, Input, Select, Button,
    Table, Space, Tag, Drawer, Popconfirm, message, Divider
} from 'antd';
import {
    UserAddOutlined, TeamOutlined, MailOutlined,
    LockOutlined, IdcardOutlined, EditOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../shared/api/apiClient';

const { Title, Text } = Typography;

const UsersPage = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // In the server task there was no GET /users but there was a POST /auth/register for admin
    // Since we don't have a specific GET /users endpoint, we could either implement it on server 
    // OR use what we have. Let's assume we want a user management page.
    // For the sake of this challenge, I'll fetch users via the report logic or assume /users exists
    // Actually, I'll just provide the Create Worker feature as requested.

    const { data: users, isLoading } = useQuery({
        queryKey: ['users-full-list'],
        queryFn: async () => {
            const { data } = await apiClient.get('/auth/users');
            return data.data.users;
        }
    });

    const registerMutation = useMutation({
        mutationFn: (userData) => apiClient.post('/auth/users', userData),
        onSuccess: () => {
            queryClient.invalidateQueries(['users-full-list']);
            setIsModalVisible(false);
            form.resetFields();
            message.success('Новый пользователь успешно зарегистрирован');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Ошибка регистрации'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => apiClient.patch(`/auth/users/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['users-full-list']);
            setIsModalVisible(false);
            setEditingUser(null);
            form.resetFields();
            message.success('Данные пользователя обновлены');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Ошибка обновления'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => apiClient.delete(`/auth/users/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['users-full-list']);
            message.success('Пользователь удален');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Ошибка удаления'),
    });

    const handleEdit = (user) => {
        setEditingUser(user);
        form.setFieldsValue({
            name: user.name,
            email: user.email,
            role: user.role,
        });
        setIsModalVisible(true);
    };

    const columns = [
        {
            title: 'Имя',
            dataIndex: 'name',
            key: 'name',
            render: (name) => <Space><IdcardOutlined />{name}</Space>,
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            render: (email) => <Space><MailOutlined />{email}</Space>,
        },
        {
            title: 'Роль',
            dataIndex: 'role',
            key: 'role',
            render: (role) => {
                const map = { admin: ['АДМИН', 'volcano'], projectManager: ['МЕНЕДЖЕР', 'purple'], worker: ['СОТРУДНИК', 'green'], guest: ['ГОСТЬ', 'blue'] };
                const [label, color] = map[role] || [role, 'default'];
                return <Tag color={color}>{label}</Tag>;
            },
        },
        {
            title: 'Действия',
            key: 'actions',
            render: (_, record) => (
                <Space size="middle">
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        type="link"
                    >
                        Изм.
                    </Button>
                    <Popconfirm
                        title="Удалить пользователя?"
                        description="Это действие нельзя отменить."
                        okText="Да"
                        cancelText="Нет"
                        onConfirm={() => deleteMutation.mutate(record._id)}
                    >
                        <Button
                            icon={<DeleteOutlined />}
                            danger
                            type="link"
                        >
                            Удал.
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const onFinish = (values) => {
        if (editingUser) {
            updateMutation.mutate({ id: editingUser._id, data: values });
        } else {
            registerMutation.mutate(values);
        }
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        setEditingUser(null);
        form.resetFields();
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}><TeamOutlined /> Управление пользователями</Title>
                <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    onClick={() => setIsModalVisible(true)}
                    size="large"
                >
                    Создать нового сотрудника
                </Button>
            </div>

            <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Table
                    columns={columns}
                    dataSource={users}
                    rowKey="_id"
                    loading={isLoading}
                    locale={{ emptyText: 'Данные пользователей отсутствуют. Используйте кнопку для добавления сотрудников.' }}
                    bordered
                />
            </Card>

            <Drawer
                title={<Title level={4}>{editingUser ? 'Редактировать пользователя' : 'Зарегистрировать нового участника'}</Title>}
                open={isModalVisible}
                onClose={handleCancel}
                placement="right"
                width="60%"
            >
                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Form.Item
                        name="name"
                        label="Полное имя"
                        rules={[{ required: true, message: 'Пожалуйста, введите полное имя' }]}
                    >
                        <Input prefix={<IdcardOutlined />} placeholder="напр. Иван Иванов" />
                    </Form.Item>

                    <Form.Item
                        name="email"
                        label="Адрес эл. почты"
                        rules={[
                            { required: true, message: 'Пожалуйста, введите Email' },
                            { type: 'email', message: 'Некорректный формат Email' }
                        ]}
                    >
                        <Input prefix={<MailOutlined />} placeholder="e.g. worker@example.com" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label={editingUser ? "Новый пароль (оставьте пустым для сохранения старого)" : "Начальный пароль"}
                        rules={[
                            { required: !editingUser, message: 'Пожалуйста, введите пароль' },
                            { min: 8, message: 'Пароль должен содержать минимум 8 символов' }
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Минимум 8 символов" />
                    </Form.Item>

                    <Form.Item
                        name="role"
                        label="Назначить роль"
                        initialValue="worker"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="worker">Сотрудник</Select.Option>
                            <Select.Option value="projectManager">Менеджер</Select.Option>
                            <Select.Option value="admin">Админ</Select.Option>
                            <Select.Option value="guest">Гость (Заказчик)</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={registerMutation.isPending || updateMutation.isPending}
                            block
                            size="large"
                        >
                            {editingUser ? 'Сохранить изменения' : 'Зарегистрировать пользователя'}
                        </Button>
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
};

export default UsersPage;
