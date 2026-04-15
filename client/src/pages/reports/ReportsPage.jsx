import React, { useState } from 'react';
import {
    Typography, Card, Form, DatePicker, Select, Button,
    Table, Space, Tag, Empty, Spin, message, Divider
} from 'antd';
import {
    FilterOutlined, FileExcelOutlined, SearchOutlined,
    UserOutlined, CalendarOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ReportsPage = () => {
    const [filters, setFilters] = useState({
        startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD'),
        userId: null
    });

    const user = useSelector((state) => state.auth.user);
    const isAdmin = user?.role === 'admin';

    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['users-list'],
        queryFn: async () => {
            const { data } = await apiClient.get('/auth/users');
            return data.data.users;
        },
        enabled: isAdmin
    });

    const { data: report, isLoading: reportLoading } = useQuery({
        queryKey: ['report', filters],
        queryFn: async () => {
            const { startDate, endDate, userId } = filters;
            const apiEndDate = dayjs(endDate).add(1, 'day').format('YYYY-MM-DD');
            let url = `/reports/period?startDate=${startDate}&endDate=${apiEndDate}`;
            if (userId) url += `&userId=${userId}`;
            const { data } = await apiClient.get(url);
            return data.data;
        }
    });

    const exportExcel = async () => {
        try {
            const { startDate, endDate, userId } = filters;
            const apiEndDate = dayjs(endDate).add(1, 'day').format('YYYY-MM-DD');
            let url = `/reports/export?startDate=${startDate}&endDate=${apiEndDate}`;
            if (userId) url += `&userId=${userId}`;

            const response = await apiClient.get(url, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const filename = `work-log-report-${startDate}-${endDate}.xlsx`;

            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            message.success('Отчет успешно экспортирован');
        } catch (error) {
            console.error(error);
            message.error('Не удалось экспортировать отчет');
        }
    };

    const onFilterSubmit = (values) => {
        setFilters({
            startDate: values.dateRange[0].format('YYYY-MM-DD'),
            endDate: values.dateRange[1].format('YYYY-MM-DD'),
            userId: values.userId
        });
    };

    const columns = [
        {
            title: 'Пользователь',
            dataIndex: ['userId', 'name'],
            key: 'userName',
            render: (name) => <Space><UserOutlined />{name}</Space>,
        },
        {
            title: 'Дата',
            dataIndex: 'date',
            key: 'date',
            render: (date) => <Space><CalendarOutlined />{dayjs(date).format('YYYY-MM-DD')}</Space>,
        },
        {
            title: 'Всего часов',
            dataIndex: 'totalHours',
            key: 'totalHours',
            render: (hours) => <Tag color="blue">{hours} ч</Tag>,
        },
        {
            title: 'Email',
            dataIndex: ['userId', 'email'],
            key: 'email',
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>Центр отчетов</Title>
                <Button
                    type="primary"
                    icon={<FileExcelOutlined />}
                    onClick={exportExcel}
                    size="large"
                    style={{ backgroundColor: '#217346' }}
                    disabled={!report?.logs?.length}
                >
                    Экспорт в Excel
                </Button>
            </div>

            <Card bordered={false} style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Form
                    layout="inline"
                    onFinish={onFilterSubmit}
                    initialValues={{
                        dateRange: [dayjs(filters.startDate), dayjs(filters.endDate)],
                        userId: filters.userId
                    }}
                >
                    <Form.Item name="dateRange" label="Период">
                        <RangePicker />
                    </Form.Item>

                    {isAdmin && (
                        <Form.Item name="userId" label="Сотрудник" style={{ minWidth: 200 }}>
                            <Select placeholder="Фильтр по пользователю" allowClear loading={usersLoading}>
                                {users?.map(u => (
                                    <Select.Option key={u._id} value={u._id}>{u.name}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}

                    <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
                            Фильтровать
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Всего отработано часов</Text>
                    <Title level={3} style={{ marginTop: 8 }}>{report?.totalHours || 0}</Title>
                </Card>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Дней зафиксировано</Text>
                    <Title level={3} style={{ marginTop: 8 }}>{report?.daysWorked || 0}</Title>
                </Card>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Всего задач</Text>
                    <Title level={3} style={{ marginTop: 8 }}>{report?.totalTasks || 0}</Title>
                </Card>
            </div>

            <Table
                columns={columns}
                dataSource={report?.logs}
                rowKey="_id"
                loading={reportLoading}
                pagination={{ pageSize: 10 }}
                bordered
            />
        </div>
    );
};

export default ReportsPage;
