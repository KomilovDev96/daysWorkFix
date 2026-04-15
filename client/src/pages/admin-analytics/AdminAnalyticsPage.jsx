import React, { useState } from 'react';
import {
    Card, Row, Col, Statistic, Table, Button, DatePicker, Space,
    Typography, Tag, Spin, message,
} from 'antd';
import {
    DownloadOutlined, FireOutlined, CheckCircleOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { fetchAdminAnalytics, exportMonthlyXls } from '../../shared/api/managedTasksApi';

const { Title } = Typography;

const AdminAnalyticsPage = () => {
    const [date, setDate] = useState(dayjs());
    const [downloading, setDownloading] = useState(false);

    const month = date.month() + 1;
    const year  = date.year();

    const { data, isLoading } = useQuery({
        queryKey: ['admin-analytics', year, month],
        queryFn:  () => fetchAdminAnalytics({ year, month }),
    });

    const handleExport = async () => {
        setDownloading(true);
        try {
            const res = await exportMonthlyXls({ year, month });
            const url  = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `tasks-${year}-${String(month).padStart(2, '0')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            message.error('Ошибка при скачивании');
        } finally {
            setDownloading(false);
        }
    };

    const managerColumns = [
        { title: 'Менеджер', dataIndex: 'name', key: 'name' },
        { title: 'Всего задач', dataIndex: 'total', key: 'total', align: 'center' },
        {
            title: 'Выполнено', key: 'completed', align: 'center',
            render: (_, r) => (
                <span style={{ color: '#52c41a', fontWeight: 600 }}>
                    {r.completed} / {r.total}
                </span>
            ),
        },
        {
            title: '% выполнения', key: 'pct', align: 'center',
            render: (_, r) => r.total ? `${Math.round(r.completed / r.total * 100)}%` : '—',
        },
        { title: 'Часов (план)', dataIndex: 'totalHours', key: 'totalHours', align: 'center' },
    ];

    const workerColumns = [
        { title: 'Сотрудник', dataIndex: 'name', key: 'name' },
        { title: 'Задач назначено', dataIndex: 'total', key: 'total', align: 'center' },
        {
            title: 'Выполнено', key: 'completed', align: 'center',
            render: (_, r) => (
                <span style={{ color: '#52c41a', fontWeight: 600 }}>
                    {r.completed} / {r.total}
                </span>
            ),
        },
        {
            title: '% выполнения', key: 'pct', align: 'center',
            render: (_, r) => r.total ? `${Math.round(r.completed / r.total * 100)}%` : '—',
        },
        { title: 'Часов (план)', dataIndex: 'totalHours', key: 'totalHours', align: 'center' },
    ];

    return (
        <Spin spinning={isLoading}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={3} style={{ margin: 0 }}>Аналитика задач</Title>
                    <Space>
                        <DatePicker
                            picker="month"
                            value={date}
                            onChange={(d) => d && setDate(d)}
                            format="MMMM YYYY"
                            allowClear={false}
                        />
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            loading={downloading}
                            onClick={handleExport}
                        >
                            Скачать XLS
                        </Button>
                    </Space>
                </div>

                {/* Сводка */}
                <Row gutter={16}>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic
                                title="Всего задач"
                                value={data?.totals?.tasks ?? 0}
                                prefix={<UnorderedListOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic
                                title="Выполнено"
                                value={data?.totals?.completed ?? 0}
                                valueStyle={{ color: '#52c41a' }}
                                prefix={<CheckCircleOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic
                                title="Горячих задач"
                                value={data?.totals?.hot ?? 0}
                                valueStyle={{ color: '#ff4d4f' }}
                                prefix={<FireOutlined />}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* По менеджерам */}
                <Card title="По менеджерам">
                    <Table
                        dataSource={data?.managers ?? []}
                        columns={managerColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        locale={{ emptyText: 'Нет данных за этот период' }}
                    />
                </Card>

                {/* По сотрудникам */}
                <Card title="По сотрудникам">
                    <Table
                        dataSource={data?.workers ?? []}
                        columns={workerColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        locale={{ emptyText: 'Нет данных за этот период' }}
                    />
                </Card>
            </Space>
        </Spin>
    );
};

export default AdminAnalyticsPage;
