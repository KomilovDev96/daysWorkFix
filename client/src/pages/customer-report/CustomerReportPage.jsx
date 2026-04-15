import React, { useState } from 'react';
import {
    Typography, Card, Form, DatePicker, Input, Button,
    Table, Space, Tag, Empty, Spin, message, Statistic, Row, Col, Collapse, Progress
} from 'antd';
import { FilterOutlined, FileExcelOutlined, UserOutlined, ClockCircleOutlined, CheckCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

const CustomerReportPage = () => {
    const [submittedFilters, setSubmittedFilters] = useState(null);

    const { data: report, isLoading: reportLoading } = useQuery({
        queryKey: ['customer-report', submittedFilters],
        queryFn: async () => {
            if (!submittedFilters) return null;
            const { search, startDate, endDate } = submittedFilters;
            const apiEndDate = dayjs(endDate).add(1, 'day').format('YYYY-MM-DD');
            const params = new URLSearchParams({ search, startDate, endDate: apiEndDate });
            const { data } = await apiClient.get(`/reports/by-customer?${params.toString()}`);
            return data.data;
        },
        enabled: !!submittedFilters,
    });

    const exportExcel = async () => {
        if (!submittedFilters) return;
        try {
            const { search, startDate, endDate } = submittedFilters;
            const apiEndDate = dayjs(endDate).add(1, 'day').format('YYYY-MM-DD');
            const params = new URLSearchParams({ search, startDate, endDate: apiEndDate });
            const response = await apiClient.get(`/reports/by-customer/export?${params.toString()}`, { responseType: 'blob' });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.setAttribute('download', `customer-report-${search}-${startDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success('Отчёт успешно экспортирован');
        } catch {
            message.error('Не удалось экспортировать отчёт');
        }
    };

    const onSubmit = (values) => {
        setSubmittedFilters({
            search: values.search?.trim(),
            startDate: values.dateRange[0].format('YYYY-MM-DD'),
            endDate: values.dateRange[1].format('YYYY-MM-DD'),
        });
    };

    const taskColumns = [
        { title: 'Задача', dataIndex: 'title', key: 'title' },
        {
            title: 'Статус',
            dataIndex: 'status',
            key: 'status',
            render: (s) => {
                const map = { completed: ['Выполнено', 'green'], failed: ['Провалено', 'red'], pending: ['В процессе', 'blue'] };
                const [label, color] = map[s] || [s, 'default'];
                return <Tag color={color}>{label}</Tag>;
            },
        },
        {
            title: 'Проект',
            key: 'project',
            render: (_, record) => record.projectId?.name
                ? <Tag color="purple">{record.projectId.name}</Tag>
                : <Text type="secondary">—</Text>,
        },
        {
            title: 'Часы',
            dataIndex: 'hours',
            key: 'hours',
            render: (h) => <Tag color="blue">{h} ч</Tag>,
        },
        {
            title: 'Дата',
            key: 'date',
            render: (_, record) => dayjs(record.dayLogId?.date).format('YYYY-MM-DD'),
        },
    ];

    const customers = report?.customers || [];

    const totalTasks = customers.reduce((s, c) => s + c.totalTasks, 0);
    const totalHours = Number(customers.reduce((s, c) => s + c.totalHours, 0).toFixed(2));
    const totalCompleted = customers.reduce((s, c) => s + c.completedTasks, 0);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>
                    <UserOutlined style={{ marginRight: 8 }} />
                    Отчёт по заказчику
                </Title>
                <Button
                    type="primary"
                    icon={<FileExcelOutlined />}
                    onClick={exportExcel}
                    size="large"
                    style={{ backgroundColor: '#217346' }}
                    disabled={!customers.length}
                >
                    Экспорт в Excel
                </Button>
            </div>

            <Card bordered={false} style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Form
                    layout="inline"
                    onFinish={onSubmit}
                    initialValues={{ dateRange: [dayjs().startOf('month'), dayjs()] }}
                >
                    <Form.Item name="search" label="Заказчик" rules={[{ required: true, message: 'Введите поисковый запрос' }]}>
                        <Input placeholder="Имя, email или ID заказчика" prefix={<UserOutlined />} style={{ width: 260 }} />
                    </Form.Item>
                    <Form.Item name="dateRange" label="Период">
                        <RangePicker />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
                            Сформировать
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            {reportLoading && <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />}

            {!reportLoading && customers.length > 0 && (
                <>
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={6}>
                            <Card>
                                <Statistic title="Найдено заказчиков" value={customers.length} prefix={<TeamOutlined />} />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic title="Всего задач" value={totalTasks} prefix={<UserOutlined />} />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic title="Выполнено" value={totalCompleted} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic title="Затрачено часов" value={totalHours} suffix="ч" prefix={<ClockCircleOutlined />} />
                            </Card>
                        </Col>
                    </Row>

                    <Collapse accordion>
                        {customers.map((c, idx) => (
                            <Panel
                                key={idx}
                                header={
                                    <Space>
                                        <UserOutlined />
                                        <Text strong>{c.customerName}</Text>
                                        {c.customerEmail !== '—' && <Text type="secondary">{c.customerEmail}</Text>}
                                        <Tag color="blue">{c.totalTasks} задач</Tag>
                                        <Tag color="green">{c.completedTasks} выполнено</Tag>
                                        <Tag>{c.totalHours} ч</Tag>
                                        <Progress
                                            percent={c.completionRate}
                                            size="small"
                                            style={{ width: 100, marginBottom: 0 }}
                                            showInfo={false}
                                        />
                                        <Text type="secondary">{c.completionRate}%</Text>
                                    </Space>
                                }
                            >
                                <Table
                                    columns={taskColumns}
                                    dataSource={c.tasks}
                                    rowKey="_id"
                                    pagination={{ pageSize: 10 }}
                                    size="small"
                                    bordered
                                />
                            </Panel>
                        ))}
                    </Collapse>
                </>
            )}

            {!reportLoading && submittedFilters && customers.length === 0 && (
                <Empty description="Нет задач по данному заказчику за выбранный период" />
            )}

            {!submittedFilters && (
                <Empty description="Введите имя заказчика и нажмите «Сформировать»" />
            )}
        </div>
    );
};

export default CustomerReportPage;
