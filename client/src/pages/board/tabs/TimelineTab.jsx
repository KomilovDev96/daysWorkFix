import React from 'react';
import { Timeline, Typography, Empty, Spin } from 'antd';
import {
    CheckCircleOutlined, ClockCircleOutlined, FlagOutlined, FileAddOutlined,
    CalendarOutlined, RocketOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiClient from '../../../shared/api/apiClient';

const { Title, Text } = Typography;

const EVENT_ICON = {
    project_created:  <RocketOutlined style={{ color: '#1677ff' }} />,
    stage_completed:  <FlagOutlined style={{ color: '#52c41a' }} />,
    update_published: <CheckCircleOutlined style={{ color: '#6ba932' }} />,
    file_added:       <FileAddOutlined style={{ color: '#722ed1' }} />,
    deadline_changed: <CalendarOutlined style={{ color: '#faad14' }} />,
    progress_changed: <ClockCircleOutlined style={{ color: '#1677ff' }} />,
    sprint_started:   <RocketOutlined style={{ color: '#722ed1' }} />,
    sprint_completed: <TrophyOutlined style={{ color: '#faad14' }} />,
};

const TimelineTab = ({ projectId }) => {
    const { data: events, isLoading } = useQuery({
        queryKey: ['project-timeline', projectId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/board-projects/${projectId}/timeline`);
            return data.data.events;
        },
    });

    if (isLoading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

    return (
        <div>
            <Title level={5}>История событий</Title>
            {!events?.length && <Empty description="Событий пока нет" />}
            {events?.length > 0 && (
                <Timeline
                    style={{ marginTop: 16 }}
                    items={events.map((e) => ({
                        dot: EVENT_ICON[e.type],
                        children: (
                            <div>
                                <Text style={{ fontSize: 14 }}>{e.title}</Text>
                                <div><Text type="secondary" style={{ fontSize: 12 }}>
                                    {dayjs(e.createdAt).format('DD.MM.YYYY HH:mm')}
                                </Text></div>
                            </div>
                        ),
                    }))}
                />
            )}
        </div>
    );
};

export default TimelineTab;
