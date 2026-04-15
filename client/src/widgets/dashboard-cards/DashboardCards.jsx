import React from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import {
    CheckSquareOutlined,
    ClockCircleOutlined,
    CalendarOutlined,
    BarChartOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';

const DashboardCards = () => {
    const { user } = useSelector((state) => state.auth);

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const today = dayjs().format('YYYY-MM-DD');
            const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
            const startOfWeek = dayjs().startOf('week').format('YYYY-MM-DD');
            const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
            const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');

            const todayResp = await apiClient.get(`/reports/period?startDate=${today}&endDate=${tomorrow}&userId=${user?._id || ''}`);
            const weekResp = await apiClient.get(`/reports/period?startDate=${startOfWeek}&endDate=${tomorrow}&userId=${user?._id || ''}`);
            const monthResp = await apiClient.get(`/reports/period?startDate=${startOfMonth}&endDate=${endOfMonth}&userId=${user?._id || ''}`);

            return {
                today: todayResp.data.data,
                week: weekResp.data.data,
                month: monthResp.data.data,
            };
        },
    });

    if (isLoading) return <Spin size="large" />;

    const stats = [
        {
            title: "Задачи на сегодня",
            value: data?.today?.totalTasks || 0,
            icon: <CheckSquareOutlined style={{ color: '#1890ff' }} />,
            color: '#e6f7ff',
        },
        {
            title: "Часы сегодня",
            value: data?.today?.totalHours || 0,
            suffix: 'ч',
            icon: <ClockCircleOutlined style={{ color: '#52c41a' }} />,
            color: '#f6ffed',
        },
        {
            title: "Часы за неделю",
            value: data?.week?.totalHours || 0,
            suffix: 'ч',
            icon: <CalendarOutlined style={{ color: '#faad14' }} />,
            color: '#fffbe6',
        },
        {
            title: "Часы за месяц",
            value: data?.month?.totalHours || 0,
            suffix: 'ч',
            icon: <BarChartOutlined style={{ color: '#eb2f96' }} />,
            color: '#fff0f6',
        },
    ];

    return (
        <Row gutter={[16, 16]}>
            {stats.map((stat, index) => (
                <Col xs={24} sm={12} md={6} key={index}>
                    <Card bordered={false} style={{ backgroundColor: stat.color }}>
                        <Statistic
                            title={stat.title}
                            value={stat.value}
                            suffix={stat.suffix}
                            prefix={stat.icon}
                            valueStyle={{ color: '#3f3f3f', fontSize: '24px', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
            ))}
        </Row>
    );
};

export default DashboardCards;
