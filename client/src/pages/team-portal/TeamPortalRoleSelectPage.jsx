import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Card, Row, Col, Result, Spin } from 'antd';
import { CodeOutlined, DatabaseOutlined, TeamOutlined, BugOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../shared/api/publicApi';

const { Title, Text } = Typography;

const ROLE_ICON = {
    frontend: <CodeOutlined />,
    backend: <DatabaseOutlined />,
    pm: <TeamOutlined />,
    tester: <BugOutlined />,
};
const ROLE_COLOR = { frontend: '#2f54eb', backend: '#08979c', pm: '#722ed1', tester: '#d4380d' };

// Публичная ссылка «для команды» — одна на спринт (/team-portal/:token). Здесь участник
// выбирает свою роль без входа в систему; дальше видит и двигает только задачи своей роли
// (PM видит и утверждает задачи всех ролей — см. TeamPortalBoardPage).
const TeamPortalRoleSelectPage = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['team-portal', token],
        queryFn: async () => {
            const { data } = await publicApi.get(`/team-portal/${token}`);
            return data.data;
        },
        retry: false,
    });

    if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
    if (isError || !data) {
        return (
            <Result
                status="404"
                title="Ссылка не найдена"
                subTitle="Ссылка недействительна или была отключена. Обратитесь к менеджеру проекта."
            />
        );
    }

    return (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '60px 16px' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <Text type="secondary">{data.project.name}</Text>
                <Title level={2} style={{ margin: '4px 0' }}>{data.sprint.name}</Title>
                <Text type="secondary">Выберите вашу роль, чтобы открыть доску спринта</Text>
            </div>
            <Row gutter={[16, 16]}>
                {data.roles.map((r) => (
                    <Col xs={12} sm={6} key={r.key}>
                        <Card
                            hoverable
                            style={{ textAlign: 'center', borderRadius: 12 }}
                            onClick={() => navigate(`/team-portal/${token}/${r.key}`)}
                        >
                            <div style={{ fontSize: 28, color: ROLE_COLOR[r.key], marginBottom: 8 }}>
                                {ROLE_ICON[r.key]}
                            </div>
                            <Text strong>{r.label}</Text>
                        </Card>
                    </Col>
                ))}
            </Row>
            <div style={{ textAlign: 'center', marginTop: 40 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>DaysWorkFix · azdev.uz</Text>
            </div>
        </div>
    );
};

export default TeamPortalRoleSelectPage;
