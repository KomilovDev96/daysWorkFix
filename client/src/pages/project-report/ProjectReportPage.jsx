import React, { useState } from 'react';
import {
    Typography, Card, Form, DatePicker, Select, Button,
    Table, Space, Tag, Empty, Spin, message, Statistic, Row, Col, Progress
} from 'antd';
import { FilterOutlined, FileExcelOutlined, FolderOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ProjectReportPage = () => {
    const [submittedFilters, setSubmittedFilters] = useState(null);

    const { data: projects, isLoading: projectsLoading } = useQuery({
        queryKey: ['all-projects-list'],
        queryFn: async () => {
            const { data } = await apiClient.get('/projects');
            return data.data.projects;
        },
    });

    const { data: report, isLoading: reportLoading } = useQuery({
        queryKey: ['project-report', submittedFilters],
        queryFn: async () => {
            if (!submittedFilters?.projectId) return null;
            const { projectId } = submittedFilters;
            const { data } = await apiClient.get(`/reports/by-project/${projectId}`);
            return data.data;
        },
        enabled: !!submittedFilters?.projectId,
    });

    const exportExcel = async () => {
        if (!submittedFilters?.projectId) return;
        try {
            const { projectId } = submittedFilters;
            const response = await apiClient.get(`/reports/by-project/${projectId}/export`, { responseType: 'blob' });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const projectName = report?.project?.name || 'project';
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.setAttribute('download', `project-report-${projectName}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success('Отчёт успешно экспортирован');
        } catch {
            message.error('Не удалось экспортировать отчёт');
        }
    };

    const onSubmit = (values) => {
        setSubmittedFilters({ projectId: values.projectId });
    };

    const tasks = report?.project?.tasks || [];
    const stats = report?.stats || {};

    const taskColumns = [
        {
            title: 'Задача',
            dataIndex: 'title',
            key: 'title',
        },
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
            title: 'Тестирование',
            dataIndex: 'testingStatus',
            key: 'testingStatus',
            render: (s) => {
                const map = { completed: ['Завершено', 'green'], in_progress: ['В процессе', 'orange'], not_reviewed: ['Не проверено', 'default'] };
                const [label, color] = (map[s] || [s, 'default']);
                return <Tag color={color}>{label}</Tag>;
            },
        },
        {
            title: 'Часы',
            dataIndex: 'hours',
            key: 'hours',
            render: (h) => <Tag color="blue">{h} ч</Tag>,
        },
        {
            title: 'Заказчик',
            key: 'customer',
            render: (_, record) => record.customer?.name || <Text type="secondary">—</Text>,
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>
                    <FolderOutlined style={{ marginRight: 8 }} />
                    Отчёт по проекту
                </Title>
                <Button
                    type="primary"
                    icon={<FileExcelOutlined />}
                    onClick={exportExcel}
                    size="large"
                    style={{ backgroundColor: '#217346' }}
                    disabled={!tasks.length}
                >
                    Экспорт в Excel
                </Button>
            </div>

            <Card bordered={false} style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Form layout="inline" onFinish={onSubmit}>
                    <Form.Item name="projectId" label="Проект" rules={[{ required: true, message: 'Выберите проект' }]} style={{ minWidth: 280 }}>
                        <Select placeholder="Выберите проект" loading={projectsLoading} allowClear showSearch
                            filterOption={(input, option) => option.children?.toLowerCase().includes(input.toLowerCase())}
                        >
                            {projects?.map((p) => (
                                <Select.Option key={p._id} value={p._id}>{p.name}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
                            Сформировать
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            {reportLoading && <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />}

            {!reportLoading && report && (
                <>
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={6}>
                            <Card>
                                <Statistic title="Всего задач" value={stats.totalTasks || 0} prefix={<FolderOutlined />} />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic title="Выполнено" value={stats.completedTasks || 0} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic title="Затрачено часов" value={stats.totalHours || 0} suffix="ч" prefix={<ClockCircleOutlined />} />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Text type="secondary">Прогресс выполнения</Text>
                                <div style={{ marginTop: 8 }}>
                                    <Progress
                                        percent={stats.completionRate || 0}
                                        status={stats.completionRate === 100 ? 'success' : 'active'}
                                    />
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    {report.project && (
                        <Card size="small" style={{ marginBottom: 16 }}>
                            <Space>
                                <FolderOutlined />
                                <Text strong>{report.project.name}</Text>
                                {report.project.description && <Text type="secondary">— {report.project.description}</Text>}
                            </Space>
                        </Card>
                    )}

                    <Table
                        columns={taskColumns}
                        dataSource={tasks}
                        rowKey="_id"
                        pagination={{ pageSize: 15 }}
                        bordered
                        locale={{ emptyText: <Empty description="Нет задач у проекта" /> }}
                    />
                </>
            )}

            {!reportLoading && !report && submittedFilters && (
                <Empty description="Проект не найден" />
            )}

            {!submittedFilters && (
                <Empty description="Выберите проект и нажмите «Сформировать»" />
            )}
        </div>
    );
};

export default ProjectReportPage;
