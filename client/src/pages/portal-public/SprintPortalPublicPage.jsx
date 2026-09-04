import React from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Card, Row, Col, Progress, Tag, Space, Result, Spin } from 'antd';
import { RocketOutlined, ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import publicApi from '../../shared/api/publicApi';
import { SprintKanban } from './SprintKanban';

const { Title, Text, Paragraph } = Typography;

// ── Публичная страница одного спринта — отдельная ссылка на снимок конкретного
// спринта (в отличие от /portal/:token, где видны сразу все активные/запланированные).
const SprintPortalPublicPage = () => {
    const { token } = useParams();

    const { data: project, isLoading, isError } = useQuery({
        queryKey: ['public-sprint-portal', token],
        queryFn: async () => {
            const { data } = await publicApi.get(`/sprint-portal/${token}`);
            return data.data.project;
        },
        retry: false,
        // Живое обновление доски: клиент видит перемещения карточек без перезагрузки страницы.
        refetchInterval: 5000,
        refetchIntervalInBackground: true,
    });

    if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
    if (isError || !project) {
        return <Result status="404" title="Ссылка не найдена"
            subTitle="Ссылка на спринт недействительна или была отключена. Обратитесь к вашему менеджеру." />;
    }

    const { sprint } = project;
    const tasks = sprint.tasks || [];
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 60px' }}>
            <div style={{ marginBottom: 24 }}>
                <Text type="secondary">{project.name}</Text>
                <Space align="center" size={12} wrap style={{ display: 'flex', marginTop: 4 }}>
                    {sprint.status === 'active'
                        ? <RocketOutlined style={{ color: '#52c41a', fontSize: 22 }} />
                        : <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 22 }} />}
                    <Title level={2} style={{ margin: 0 }}>{sprint.name}</Title>
                    <Tag color={sprint.status === 'active' ? 'green' : 'default'}>
                        {sprint.status === 'active' ? 'Активен' : 'Запланирован'}
                    </Tag>
                </Space>
                {sprint.description && (
                    <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 15 }}>{sprint.description}</Paragraph>
                )}
                {project.manager?.name && (
                    <Text type="secondary">Менеджер: <b>{project.manager.name}</b></Text>
                )}
            </div>

            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <Row gutter={16} align="middle">
                    <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                        <Progress type="dashboard" percent={percent} size={120}
                            strokeColor={percent === 100 ? '#52c41a' : '#6ba932'} />
                    </Col>
                    <Col xs={24} sm={18}>
                        <Row gutter={[16, 16]}>
                            {[
                                { label: 'Всего задач', value: tasks.length, color: '#000' },
                                { label: 'Выполнено',   value: done, color: '#52c41a' },
                                { label: 'В процессе',  value: inProgress, color: '#1677ff' },
                            ].map((s) => (
                                <Col xs={12} sm={8} key={s.label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                                    <Text type="secondary" style={{ fontSize: 13 }}>{s.label}</Text>
                                </Col>
                            ))}
                        </Row>
                        <Progress percent={percent} style={{ marginTop: 16 }}
                            strokeColor={percent === 100 ? '#52c41a' : '#1677ff'} />
                    </Col>
                </Row>
            </Card>

            <Card style={{ marginBottom: 24, borderRadius: 12 }} title="Доска спринта">
                <SprintKanban tasks={tasks} />
            </Card>

            <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                    Обновлено {dayjs(project.updatedAt).format('DD.MM.YYYY HH:mm')} · DaysWorkFix
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                    Сделано с <span style={{ color: '#eb2f96' }}>♥</span> командой{' '}
                    <a href="https://azdev.uz" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                        azdev.uz
                    </a>
                </Text>
            </div>
        </div>
    );
};

export default SprintPortalPublicPage;
