import React, { useState } from 'react';
import { Typography, Button, Table, Space, Tag, Drawer, Popconfirm, Form, Input, InputNumber, DatePicker, message, Card } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardCards from '../../widgets/dashboard-cards/DashboardCards';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const DashboardPage = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data, isLoading } = useQuery({
        queryKey: ['my-logs'],
        queryFn: async () => {
            const { data } = await apiClient.get('/daylogs/my');
            return data.data.daylogs;
        },
    });

    const createLogMutation = useMutation({
        mutationFn: (newLog) => apiClient.post('/daylogs', newLog),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-logs'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            setIsModalVisible(false);
            form.resetFields();
            message.success('Запись за день создана успешно');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось создать запись'),
    });

    const updateLogMutation = useMutation({
        mutationFn: ({ id, data }) => apiClient.patch(`/daylogs/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-logs'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            setIsModalVisible(false);
            setEditingLog(null);
            form.resetFields();
            message.success('Запись успешно обновлена');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось обновить запись'),
    });

    const deleteLogMutation = useMutation({
        mutationFn: (id) => apiClient.delete(`/daylogs/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-logs'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            message.success('Запись удалена');
        },
        onError: (err) => message.error(err.response?.data?.message || 'Не удалось удалить запись'),
    });

    const handleEdit = (log) => {
        setEditingLog(log);
        form.setFieldsValue({
            date: dayjs(log.date)
        });
        setIsModalVisible(true);
    };

    const columns = [
        {
            title: 'Дата',
            dataIndex: 'date',
            key: 'date',
            render: (date) => dayjs(date).format('YYYY-MM-DD'),
        },
        {
            title: 'Всего часов',
            dataIndex: 'totalHours',
            key: 'totalHours',
            render: (hours) => <Tag color="blue">{hours} ч</Tag>,
        },
        {
            title: 'Действия',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/day/${record._id}`)}>
                        Подробнее
                    </Button>
                    <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                        Изм.
                    </Button>
                    <Popconfirm
                        title="Удалить день?"
                        description="Все задачи этого дня также будут удалены."
                        okText="Да"
                        cancelText="Нет"
                        onConfirm={() => deleteLogMutation.mutate(record._id)}
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            Удал.
                        </Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const onFinish = (values) => {
        const data = { date: values.date.toDate() };
        if (editingLog) {
            updateLogMutation.mutate({ id: editingLog._id, data });
        } else {
            createLogMutation.mutate(data);
        }
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        setEditingLog(null);
        form.resetFields();
    };

    return (
        <div style={{ paddingBottom: 24 }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <DashboardCards />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32 }}>
                    <Title level={3}>Мои записи за день</Title>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                        Новая запись за день
                    </Button>
                </div>

                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="_id"
                    loading={isLoading}
                    bordered
                />

                <Drawer
                    title={editingLog ? "Редактировать запись" : "Создать новую запись за день"}
                    open={isModalVisible}
                    onClose={handleCancel}
                    placement="right"
                    width="60%"
                >
                    <Form form={form} layout="vertical" onFinish={onFinish}>
                        <Form.Item
                            name="date"
                            label="Выберите дату"
                            rules={[{ required: true, message: 'Пожалуйста, выберите дату!' }]}
                            initialValue={dayjs()}
                        >
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={createLogMutation.isPending || updateLogMutation.isPending} block>
                                {editingLog ? 'Сохранить' : 'Создать'}
                            </Button>
                        </Form.Item>
                    </Form>
                </Drawer>
            </Space>
        </div>
    );
};

export default DashboardPage;
