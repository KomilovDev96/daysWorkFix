import React, { useState } from 'react';
import {
    Typography, Card, Form, Input, Select, Button,
    Table, Space, Tag, Drawer, Popconfirm, message, Divider,
    Modal, Result
} from 'antd';
import {
    UserAddOutlined, TeamOutlined, MailOutlined,
    LockOutlined, IdcardOutlined, EditOutlined,
    DeleteOutlined, CopyOutlined, ReloadOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../shared/api/apiClient';

const { Title, Text } = Typography;

const UsersPage = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [credentialsModal, setCredentialsModal] = useState(null);
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
        onSuccess: (res, variables) => {
            queryClient.invalidateQueries(['users-full-list']);
            setIsModalVisible(false);
            form.resetFields();
            const code = res.data?.data?.telegramLinkCode;
            const user = res.data?.data?.user;
            setCredentialsModal({
                name: user?.name || variables.name,
                email: user?.email || variables.email,
                password: variables.password,
                role: user?.role || variables.role,
                telegramLinkCode: code,
            });
        },
        onError: (err) => message.error(err.response?.data?.message || 'Ошибка регистрации'),
    });

    const regenerateMutation = useMutation({
        mutationFn: (id) => apiClient.post(`/auth/users/${id}/regenerate-link-code`),
        onSuccess: (res, id) => {
            queryClient.invalidateQueries(['users-full-list']);
            const code = res.data?.data?.telegramLinkCode;
            Modal.success({
                title: 'Новый код для Telegram',
                content: (
                    <div>
                        <p>Передай этот код пользователю. Старая привязка Telegram сброшена.</p>
                        <Typography.Title level={2} copyable style={{ textAlign: 'center', letterSpacing: 4 }}>
                            {code}
                        </Typography.Title>
                    </div>
                ),
            });
        },
        onError: (err) => message.error(err.response?.data?.message || 'Ошибка'),
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
            specialization: user.specialization || undefined,
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
            title: 'Специализация',
            dataIndex: 'specialization',
            key: 'specialization',
            render: (spec) => {
                const map = { frontend: ['FRONTEND', 'geekblue'], backend: ['BACKEND', 'cyan'], pm: ['PM', 'purple'] };
                if (!spec || !map[spec]) return <Tag color="default">—</Tag>;
                const [label, color] = map[spec];
                return <Tag color={color}>{label}</Tag>;
            },
        },
        {
            title: 'Telegram',
            key: 'telegram',
            render: (_, record) => {
                if (record.telegramId) return <Tag color="cyan">привязан</Tag>;
                if (record.telegramLinkCode) return <Tag color="gold">код: {record.telegramLinkCode}</Tag>;
                return <Tag color="default">нет</Tag>;
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
                    <Button
                        icon={<ReloadOutlined />}
                        type="link"
                        loading={regenerateMutation.isPending}
                        onClick={() => regenerateMutation.mutate(record._id)}
                    >
                        TG-код
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

                    <Form.Item
                        name="specialization"
                        label="Специализация исполнителя (опционально)"
                    >
                        <Select allowClear placeholder="Не задана">
                            <Select.Option value="frontend">Frontend</Select.Option>
                            <Select.Option value="backend">Backend</Select.Option>
                            <Select.Option value="pm">Project Manager</Select.Option>
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

            <Modal
                open={!!credentialsModal}
                title="🎉 Пользователь создан"
                onCancel={() => setCredentialsModal(null)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setCredentialsModal(null)}>
                        Готово
                    </Button>,
                ]}
                width={520}
            >
                {credentialsModal && (
                    <div>
                        <p style={{ color: '#888' }}>
                            Передай эти данные пользователю. Пароль и Telegram-код больше нигде не появятся — сохрани их сейчас.
                        </p>
                        <Card size="small" style={{ marginTop: 12 }}>
                            <p><strong>Имя:</strong> {credentialsModal.name}</p>
                            <p><strong>Email:</strong> <Text copyable>{credentialsModal.email}</Text></p>
                            <p><strong>Пароль:</strong> <Text copyable>{credentialsModal.password}</Text></p>
                            <p><strong>Роль:</strong> {credentialsModal.role}</p>
                        </Card>
                        <Divider />
                        <div style={{ textAlign: 'center' }}>
                            <Text type="secondary">Код для привязки Telegram-бота:</Text>
                            <Title level={1} copyable style={{ letterSpacing: 8, marginTop: 8 }}>
                                {credentialsModal.telegramLinkCode}
                            </Title>
                            <Text type="secondary">
                                Отправь этот код боту <Text code>@daysworkfixbot</Text> для привязки.
                            </Text>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default UsersPage;
