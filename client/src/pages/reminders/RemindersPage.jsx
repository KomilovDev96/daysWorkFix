import React, { useState } from 'react';
import {
    Typography, Card, Button, Table, Tag, Space, Modal, Form, Input,
    DatePicker, message, Popconfirm, Empty, Segmented,
} from 'antd';
import {
    PlusOutlined, BellOutlined, EditOutlined, DeleteOutlined,
    CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_LABEL = {
    pending:   { text: 'Ожидает',  color: 'orange', icon: <ClockCircleOutlined /> },
    snoozed:   { text: 'Отложено', color: 'gold',   icon: <ClockCircleOutlined /> },
    sent:      { text: 'Отправлено', color: 'green', icon: <CheckCircleOutlined /> },
    cancelled: { text: 'Отменено', color: 'default', icon: null },
};

const RemindersPage = () => {
    const [filter, setFilter] = useState('active');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: reminders = [], isLoading } = useQuery({
        queryKey: ['reminders', filter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filter === 'all')      params.set('includeAll', 'true');
            else if (filter === 'sent') params.set('status', 'sent');
            const { data } = await apiClient.get(`/reminders/my?${params.toString()}`);
            return data.data.reminders;
        },
    });

    const upsertMutation = useMutation({
        mutationFn: async ({ id, payload }) => {
            if (id) {
                const { data } = await apiClient.patch(`/reminders/${id}`, payload);
                return data.data.reminder;
            }
            const { data } = await apiClient.post('/reminders', payload);
            return data.data.reminder;
        },
        onSuccess: () => {
            message.success(editing ? 'Напоминание обновлено' : 'Напоминание создано');
            queryClient.invalidateQueries({ queryKey: ['reminders'] });
            setModalOpen(false);
            setEditing(null);
            form.resetFields();
        },
        onError: (err) => message.error(err?.response?.data?.message || err.message),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => apiClient.delete(`/reminders/${id}`),
        onSuccess: () => {
            message.success('Удалено');
            queryClient.invalidateQueries({ queryKey: ['reminders'] });
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async (id) => apiClient.patch(`/reminders/${id}`, { status: 'cancelled' }),
        onSuccess: () => {
            message.success('Отменено');
            queryClient.invalidateQueries({ queryKey: ['reminders'] });
        },
    });

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ fireAt: dayjs().add(1, 'hour').startOf('hour') });
        setModalOpen(true);
    };

    const openEdit = (r) => {
        setEditing(r);
        form.setFieldsValue({
            text:   r.text,
            fireAt: dayjs(r.fireAt),
        });
        setModalOpen(true);
    };

    const onSubmit = () => {
        form.validateFields().then((vals) => {
            upsertMutation.mutate({
                id: editing?._id,
                payload: {
                    text:   vals.text,
                    fireAt: vals.fireAt.toISOString(),
                },
            });
        });
    };

    const columns = [
        {
            title: 'Когда', key: 'fireAt', width: 200,
            render: (_, r) => {
                const d = dayjs(r.fireAt);
                const now = dayjs();
                const diffMin = d.diff(now, 'minute');
                let label = '';
                if (r.status === 'sent') label = '';
                else if (diffMin < 0) label = ' (просрочено)';
                else if (diffMin < 60)  label = ` (через ${diffMin} мин)`;
                else if (diffMin < 24 * 60) label = ` (через ${Math.round(diffMin / 60)} ч)`;
                else label = ` (через ${Math.round(diffMin / (24 * 60))} дн)`;
                return (
                    <Space direction="vertical" size={0}>
                        <Text strong>{d.format('DD.MM.YYYY HH:mm')}</Text>
                        {label && <Text type="secondary" style={{ fontSize: 11 }}>{label}</Text>}
                    </Space>
                );
            },
            sorter: (a, b) => dayjs(a.fireAt).valueOf() - dayjs(b.fireAt).valueOf(),
        },
        {
            title: 'О чём', dataIndex: 'text', key: 'text',
            render: (v) => <Text>{v}</Text>,
        },
        {
            title: 'Статус', dataIndex: 'status', key: 'status', width: 140,
            render: (s) => {
                const m = STATUS_LABEL[s] || { text: s, color: 'default' };
                return <Tag color={m.color} icon={m.icon}>{m.text}</Tag>;
            },
        },
        {
            title: 'Действия', key: 'actions', width: 200,
            render: (_, r) => (
                <Space size={4}>
                    {(r.status === 'pending' || r.status === 'snoozed') && (
                        <>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                            <Popconfirm title="Отменить напоминание?" onConfirm={() => cancelMutation.mutate(r._id)}>
                                <Button size="small">Отменить</Button>
                            </Popconfirm>
                        </>
                    )}
                    <Popconfirm title="Удалить?" onConfirm={() => deleteMutation.mutate(r._id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={2} style={{ margin: 0 }}>
                    <BellOutlined /> Напоминания
                </Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    Новое напоминание
                </Button>
            </div>

            <Card bordered={false} style={{ marginBottom: 16 }}>
                <Space>
                    <Text type="secondary">Показывать:</Text>
                    <Segmented
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { label: 'Активные', value: 'active' },
                            { label: 'Отправленные', value: 'sent' },
                            { label: 'Все', value: 'all' },
                        ]}
                    />
                </Space>
            </Card>

            <Card bordered={false}>
                <Table
                    columns={columns}
                    dataSource={reminders}
                    rowKey="_id"
                    loading={isLoading}
                    pagination={{ pageSize: 25 }}
                    locale={{
                        emptyText: (
                            <Empty
                                description="Пока ничего"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        ),
                    }}
                />
            </Card>

            <Modal
                open={modalOpen}
                onCancel={() => { setModalOpen(false); setEditing(null); }}
                title={editing ? 'Редактировать напоминание' : 'Новое напоминание'}
                okText={editing ? 'Сохранить' : 'Создать'}
                cancelText="Отмена"
                onOk={onSubmit}
                confirmLoading={upsertMutation.isPending}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
                    <Form.Item name="text" label="О чём напомнить?" rules={[{ required: true, message: 'Опиши' }]}>
                        <Input.TextArea rows={2} placeholder="Например: позвонить Амиру про релиз" autoFocus />
                    </Form.Item>
                    <Form.Item name="fireAt" label="Когда?" rules={[{ required: true, message: 'Укажи дату и время' }]}>
                        <DatePicker
                            showTime={{ format: 'HH:mm' }}
                            format="DD.MM.YYYY HH:mm"
                            style={{ width: '100%' }}
                            minuteStep={5}
                        />
                    </Form.Item>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Напоминание придёт в Telegram в указанное время. Можно также написать боту «напомни …».
                    </Text>
                </Form>
            </Modal>
        </div>
    );
};

export default RemindersPage;
