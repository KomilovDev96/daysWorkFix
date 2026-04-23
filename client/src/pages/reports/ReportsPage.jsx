import React, { useState, useMemo } from 'react';
import {
    Typography, Card, Form, DatePicker, Select, Button,
    Table, Space, Tag, message, Badge,
} from 'antd';
import {
    FilterOutlined, FileExcelOutlined,
    UserOutlined, CalendarOutlined, CheckCircleOutlined,
    ClockCircleOutlined, BookOutlined,
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
        endDate:   dayjs().format('YYYY-MM-DD'),
        userId:    null,
    });

    const user    = useSelector((state) => state.auth.user);
    const isAdmin = user?.role === 'admin';

    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['users-list'],
        queryFn:  async () => {
            const { data } = await apiClient.get('/auth/users');
            return data.data.users;
        },
        enabled: isAdmin,
    });

    const { data: report, isLoading: reportLoading } = useQuery({
        queryKey: ['report', filters],
        queryFn:  async () => {
            const { startDate, endDate, userId } = filters;
            const apiEndDate = dayjs(endDate).add(1, 'day').format('YYYY-MM-DD');
            let url = `/reports/period?startDate=${startDate}&endDate=${apiEndDate}`;
            if (userId) url += `&userId=${userId}`;
            const { data } = await apiClient.get(url);
            return data.data;
        },
    });

    const exportExcel = async () => {
        try {
            const { startDate, endDate, userId } = filters;
            const apiEndDate = dayjs(endDate).add(1, 'day').format('YYYY-MM-DD');
            let url = `/reports/export?startDate=${startDate}&endDate=${apiEndDate}`;
            if (userId) url += `&userId=${userId}`;
            const response = await apiClient.get(url, { responseType: 'blob' });
            const blob     = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link     = document.createElement('a');
            link.href      = window.URL.createObjectURL(blob);
            link.setAttribute('download', `report-${startDate}-${endDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success('Отчет экспортирован');
        } catch {
            message.error('Не удалось экспортировать отчет');
        }
    };

    const onFilterSubmit = (values) => {
        setFilters({
            startDate: values.dateRange[0].format('YYYY-MM-DD'),
            endDate:   values.dateRange[1].format('YYYY-MM-DD'),
            userId:    values.userId,
        });
    };

    // Объединяем DayLog записи и выполненные ManagedTask в одну таблицу
    const combinedRows = useMemo(() => {
        const rows = [];

        // DayLog записи
        (report?.logs || []).forEach((log) => {
            rows.push({
                _id:       log._id,
                date:      log.date,
                userName:  log.userId?.name || '—',
                email:     log.userId?.email || '—',
                hours:     log.totalHours,
                title:     null,
                kind:      'log',   // дневной лог
            });
        });

        // Выполненные задачи
        (report?.managedTasks || []).forEach((task) => {
            rows.push({
                _id:      task._id,
                date:     task.dueDate,
                userName: task.createdBy?.name || user?.name || '—',
                email:    task.createdBy?.email || user?.email || '—',
                hours:    task.actualHours || task.estimatedHours || 0,
                title:    task.title,
                client:   task.client,
                isSelf:   task.isSelfTask,
                kind:     'task',  // задача
            });
        });

        // Сортируем по дате — свежие сверху
        rows.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
        return rows;
    }, [report, user]);

    const columns = [
        {
            title: 'Пользователь',
            key: 'userName',
            render: (_, r) => <Space><UserOutlined />{r.userName}</Space>,
        },
        {
            title: 'Дата',
            key: 'date',
            render: (_, r) => (
                <Space>
                    <CalendarOutlined />
                    {dayjs(r.date).format('DD.MM.YYYY')}
                    {dayjs(r.date).isSame(dayjs(), 'day') && (
                        <Tag color="green" style={{ margin: 0, fontSize: 10 }}>сегодня</Tag>
                    )}
                </Space>
            ),
        },
        {
            title: 'Запись',
            key: 'title',
            render: (_, r) => {
                if (r.kind === 'task') {
                    return (
                        <Space direction="vertical" size={0}>
                            <Space size={4}>
                                <CheckCircleOutlined style={{ color: '#22C55E' }} />
                                <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
                                <Tag color={r.isSelf ? 'green' : 'purple'} style={{ fontSize: 10 }}>
                                    {r.isSelf ? 'Личная' : 'От менеджера'}
                                </Tag>
                            </Space>
                            {r.client && (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    <UserOutlined /> {r.client}
                                </Text>
                            )}
                        </Space>
                    );
                }
                return (
                    <Space size={4}>
                        <BookOutlined style={{ color: '#1677ff' }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>Дневной лог</Text>
                    </Space>
                );
            },
        },
        {
            title: 'Часы',
            key: 'hours',
            width: 100,
            align: 'center',
            render: (_, r) => (
                <Tag color={r.kind === 'task' ? 'green' : 'blue'}>
                    <ClockCircleOutlined /> {r.hours} ч
                </Tag>
            ),
        },
        {
            title: 'Email',
            key: 'email',
            render: (_, r) => <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>,
        },
    ];

    const totalHours   = (report?.totalHours   || 0) + (report?.managedHours || 0);
    const doneCount    = report?.managedTasks?.length || 0;

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
                    disabled={!combinedRows.length}
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
                        userId:    filters.userId,
                    }}
                >
                    <Form.Item name="dateRange" label="Период">
                        <RangePicker />
                    </Form.Item>
                    {isAdmin && (
                        <Form.Item name="userId" label="Сотрудник" style={{ minWidth: 200 }}>
                            <Select placeholder="Фильтр по пользователю" allowClear loading={usersLoading}>
                                {users?.map((u) => (
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

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Всего часов</Text>
                    <Title level={3} style={{ marginTop: 8 }}>{totalHours}</Title>
                </Card>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Дней зафиксировано</Text>
                    <Title level={3} style={{ marginTop: 8 }}>{report?.daysWorked || 0}</Title>
                </Card>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Выполнено задач</Text>
                    <Title level={3} style={{ marginTop: 8, color: '#22C55E' }}>{doneCount}</Title>
                </Card>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Часов по задачам</Text>
                    <Title level={3} style={{ marginTop: 8, color: '#1677ff' }}>{report?.managedHours || 0}</Title>
                </Card>
            </div>

            {/* Единая таблица: логи + задачи */}
            <Table
                columns={columns}
                dataSource={combinedRows}
                rowKey="_id"
                loading={reportLoading}
                pagination={{ pageSize: 20 }}
                bordered
                rowClassName={(r) => r.kind === 'task' ? 'task-row-done' : ''}
            />
        </div>
    );
};

export default ReportsPage;
