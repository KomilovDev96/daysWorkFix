import React, { useState } from 'react';
import {
    Typography, Card, Button, Table, Space, Tag, Drawer, Form,
    Input, InputNumber, Popconfirm, message, Empty, Tooltip, Divider
} from 'antd';
import {
    PlusOutlined, DeleteOutlined, EditOutlined,
    AppstoreOutlined, ClockCircleOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../shared/api/apiClient';

const { Title, Text } = Typography;

const TemplatesPage = () => {
    const queryClient = useQueryClient();
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [form] = Form.useForm();

    // ─── Queries ───────────────────────────────────────────────────────────────

    const { data: templates, isLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => {
            const { data } = await apiClient.get('/templates');
            return data.data.templates;
        },
    });

    // ─── Mutations ─────────────────────────────────────────────────────────────

    const createMutation = useMutation({
        mutationFn: (payload) => apiClient.post('/templates', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            setDrawerVisible(false);
            form.resetFields();
            message.success('Шаблон создан');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Ошибка создания шаблона'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }) => apiClient.patch(`/templates/${id}`, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            setDrawerVisible(false);
            setEditingTemplate(null);
            form.resetFields();
            message.success('Шаблон обновлён');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Ошибка обновления шаблона'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => apiClient.delete(`/templates/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            message.success('Шаблон удалён');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Ошибка удаления шаблона'),
    });

    // ─── Handlers ──────────────────────────────────────────────────────────────

    const handleOpenCreate = () => {
        setEditingTemplate(null);
        form.resetFields();
        form.setFieldsValue({ tasks: [{ title: '', description: '', estimatedHours: 1 }] });
        setDrawerVisible(true);
    };

    const handleOpenEdit = (template) => {
        setEditingTemplate(template);
        form.setFieldsValue({
            name: template.name,
            description: template.description,
            tasks: template.tasks?.length
                ? template.tasks.map((t) => ({
                    title: t.title,
                    description: t.description,
                    estimatedHours: t.estimatedHours,
                }))
                : [{ title: '', description: '', estimatedHours: 1 }],
        });
        setDrawerVisible(true);
    };

    const handleClose = () => {
        setDrawerVisible(false);
        setEditingTemplate(null);
        form.resetFields();
    };

    const handleFinish = (values) => {
        const payload = {
            name: values.name,
            description: values.description,
            tasks: (values.tasks || []).map((t, i) => ({
                title: t.title,
                description: t.description || '',
                estimatedHours: t.estimatedHours || 0,
                order: i,
            })),
        };

        if (editingTemplate) {
            updateMutation.mutate({ id: editingTemplate._id, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    // ─── Table columns ─────────────────────────────────────────────────────────

    const columns = [
        {
            title: 'Название шаблона',
            dataIndex: 'name',
            key: 'name',
            render: (name, record) => (
                <Space direction="vertical" size={2}>
                    <Text strong>{name}</Text>
                    {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>}
                </Space>
            ),
        },
        {
            title: 'Задач',
            dataIndex: 'tasks',
            key: 'tasksCount',
            width: 100,
            render: (tasks) => (
                <Tag icon={<UnorderedListOutlined />} color="blue">
                    {tasks?.length || 0}
                </Tag>
            ),
        },
        {
            title: 'Общее время (ч)',
            dataIndex: 'tasks',
            key: 'totalHours',
            width: 140,
            render: (tasks) => {
                const total = (tasks || []).reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
                return <Tag icon={<ClockCircleOutlined />} color="gold">{total} ч</Tag>;
            },
        },
        {
            title: 'Создан',
            dataIndex: ['createdBy', 'name'],
            key: 'createdBy',
            width: 140,
            render: (name) => <Text type="secondary">{name || '—'}</Text>,
        },
        {
            title: 'Действия',
            key: 'actions',
            width: 120,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Редактировать">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleOpenEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Удалить шаблон?"
                        description="Это действие нельзя отменить."
                        okText="Да"
                        cancelText="Нет"
                        onConfirm={() => deleteMutation.mutate(record._id)}
                    >
                        <Tooltip title="Удалить">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // Expandable row — показывает список задач шаблона
    const expandedRowRender = (record) => {
        if (!record.tasks?.length) {
            return <Text type="secondary">Задач нет</Text>;
        }

        return (
            <div style={{ padding: '8px 0' }}>
                {record.tasks.map((t, idx) => (
                    <div
                        key={t._id || idx}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            padding: '6px 0',
                            borderBottom: idx < record.tasks.length - 1 ? '1px solid #f0f0f0' : 'none',
                        }}
                    >
                        <Tag color="default" style={{ minWidth: 28, textAlign: 'center' }}>{idx + 1}</Tag>
                        <div style={{ flex: 1 }}>
                            <Text strong>{t.title}</Text>
                            {t.description && (
                                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{t.description}</Text>
                            )}
                        </div>
                        <Tag icon={<ClockCircleOutlined />} color="gold">{t.estimatedHours || 0} ч</Tag>
                    </div>
                ))}
            </div>
        );
    };

    // ─── Render ─────────────────────────────────────────────────────────────────

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>Шаблоны проектов</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                    Создать шаблон
                </Button>
            </div>

            <Card bordered={false}>
                <Table
                    columns={columns}
                    dataSource={templates || []}
                    rowKey="_id"
                    loading={isLoading}
                    expandable={{ expandedRowRender }}
                    locale={{ emptyText: <Empty description="Шаблонов ещё нет. Создайте первый!" /> }}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* ── Drawer ──────────────────────────────────────────────────────── */}
            <Drawer
                title={editingTemplate ? 'Редактировать шаблон' : 'Создать шаблон проекта'}
                open={drawerVisible}
                onClose={handleClose}
                placement="right"
                width="65%"
            >
                <Form form={form} layout="vertical" onFinish={handleFinish}>
                    <Form.Item
                        name="name"
                        label="Название шаблона"
                        rules={[{ required: true, message: 'Введите название' }]}
                    >
                        <Input placeholder="напр. Разработка фичи" />
                    </Form.Item>

                    <Form.Item name="description" label="Описание (необязательно)">
                        <Input.TextArea rows={2} placeholder="Краткое описание шаблона..." />
                    </Form.Item>

                    <Divider orientation="left">Задачи шаблона</Divider>

                    <Form.List name="tasks">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }, index) => (
                                    <Card
                                        key={key}
                                        size="small"
                                        style={{ marginBottom: 12, background: '#fafafa' }}
                                        title={<Text type="secondary">Задача #{index + 1}</Text>}
                                        extra={
                                            fields.length > 1 && (
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => remove(name)}
                                                />
                                            )
                                        }
                                    >
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'title']}
                                            label="Название задачи"
                                            rules={[{ required: true, message: 'Введите название' }]}
                                            style={{ marginBottom: 8 }}
                                        >
                                            <Input placeholder="напр. Написать тесты" />
                                        </Form.Item>

                                        <Form.Item
                                            {...restField}
                                            name={[name, 'description']}
                                            label="Описание"
                                            style={{ marginBottom: 8 }}
                                        >
                                            <Input placeholder="Что нужно сделать..." />
                                        </Form.Item>

                                        <Form.Item
                                            {...restField}
                                            name={[name, 'estimatedHours']}
                                            label="Ожидаемые часы"
                                            style={{ marginBottom: 0 }}
                                        >
                                            <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="0" />
                                        </Form.Item>
                                    </Card>
                                ))}

                                <Button
                                    type="dashed"
                                    onClick={() => add({ title: '', description: '', estimatedHours: 1 })}
                                    icon={<PlusOutlined />}
                                    block
                                    style={{ marginBottom: 24 }}
                                >
                                    Добавить задачу
                                </Button>
                            </>
                        )}
                    </Form.List>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            block
                            size="large"
                            loading={createMutation.isPending || updateMutation.isPending}
                        >
                            {editingTemplate ? 'Сохранить изменения' : 'Создать шаблон'}
                        </Button>
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
};

export default TemplatesPage;
