import React, { useState } from 'react';
import {
    Card, Switch, Typography, Input, Button, Space, Select, Tag, message,
    Divider, Row, Col, InputNumber, Popconfirm, Alert,
} from 'antd';
import {
    CopyOutlined, ReloadOutlined, LinkOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../shared/api/apiClient';

const { Title, Text, Paragraph } = Typography;

const PortalSettingsTab = ({ projectId }) => {
    const queryClient = useQueryClient();
    const [password, setPassword] = useState('');

    const { data: portal, isLoading } = useQuery({
        queryKey: ['project-portal', projectId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/board-projects/${projectId}/portal`);
            return data.data.portal;
        },
    });

    const { data: users } = useQuery({
        queryKey: ['users-list'],
        queryFn: async () => {
            const { data } = await apiClient.get('/auth/users');
            return data.data.users;
        },
    });

    const patch = useMutation({
        mutationFn: (body) => apiClient.patch(`/board-projects/${projectId}/portal`, body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-portal', projectId] }),
        onError: () => message.error('Не удалось сохранить настройки'),
    });

    const regenerate = useMutation({
        mutationFn: () => apiClient.post(`/board-projects/${projectId}/portal/regenerate`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-portal', projectId] });
            message.success('Сгенерирована новая ссылка');
        },
        onError: () => message.error('Не удалось сгенерировать ссылку'),
    });

    // Ссылка из бэкенда (APP_PUBLIC_URL) либо текущий origin при пустом конфиге.
    const link = portal?.token
        ? (portal.link && portal.link.startsWith('http') ? portal.link : `${window.location.origin}/portal/${portal.token}`)
        : null;

    const copy = () => {
        navigator.clipboard.writeText(link);
        message.success('Ссылка скопирована');
    };

    const managers = (users || []).filter((u) => ['admin', 'projectManager'].includes(u.role));

    if (isLoading) return <Card loading />;

    return (
        <div style={{ maxWidth: 720 }}>
            <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Title level={5} style={{ margin: 0 }}>Публичный портал</Title>
                        <Text type="secondary">Заказчик видит прогресс по ссылке без авторизации</Text>
                    </div>
                    <Switch
                        checked={portal?.enabled}
                        loading={patch.isPending}
                        onChange={(checked) => patch.mutate({ enabled: checked })}
                        checkedChildren="Вкл" unCheckedChildren="Выкл"
                    />
                </div>

                {portal?.enabled && link && (
                    <>
                        <Divider style={{ margin: '16px 0' }} />
                        <Text type="secondary">Публичная ссылка:</Text>
                        <Row gutter={16} align="middle" style={{ marginTop: 6 }}>
                            <Col flex="auto">
                                <Space.Compact style={{ width: '100%' }}>
                                    <Input value={link} readOnly prefix={<LinkOutlined />} />
                                    <Button icon={<CopyOutlined />} onClick={copy}>Копировать</Button>
                                    <Popconfirm title="Сгенерировать новую ссылку? Старая перестанет работать."
                                        onConfirm={() => regenerate.mutate()}>
                                        <Button icon={<ReloadOutlined />} loading={regenerate.isPending}>Новая</Button>
                                    </Popconfirm>
                                </Space.Compact>
                                {!portal.link?.startsWith('http') && (
                                    <Alert style={{ marginTop: 10 }} type="info" showIcon
                                        message="Env APP_PUBLIC_URL не задан — ссылка построена от текущего домена." />
                                )}
                            </Col>
                            <Col>
                                <div style={{ textAlign: 'center', padding: 8, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                                    <QRCodeSVG value={link} size={104} level="M" />
                                    <div><Text type="secondary" style={{ fontSize: 11 }}>QR для клиента</Text></div>
                                </div>
                            </Col>
                        </Row>
                    </>
                )}
            </Card>

            <Card title={<Space><LockOutlined />Защита паролем (опционально)</Space>} style={{ marginBottom: 16 }}>
                {portal?.hasPassword
                    ? <Tag color="green" icon={<LockOutlined />}>Пароль установлен</Tag>
                    : <Tag icon={<UnlockOutlined />}>Без пароля — ссылка открыта</Tag>}
                <Space.Compact style={{ width: '100%', marginTop: 12 }}>
                    <Input.Password value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="Новый пароль для портала" />
                    <Button type="primary" disabled={!password}
                        onClick={() => { patch.mutate({ password }); setPassword(''); message.success('Пароль установлен'); }}>
                        Установить
                    </Button>
                </Space.Compact>
                {portal?.hasPassword && (
                    <Button danger type="link" style={{ paddingLeft: 0, marginTop: 8 }}
                        onClick={() => patch.mutate({ password: '' })}>
                        Снять пароль
                    </Button>
                )}
            </Card>

            <Card title="Параметры и уведомления">
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Text type="secondary">Ответственный менеджер</Text>
                        <Select
                            style={{ width: '100%', marginTop: 4 }}
                            allowClear placeholder="По умолчанию — создатель"
                            value={portal?.manager || undefined}
                            onChange={(val) => patch.mutate({ manager: val || null })}
                            options={managers.map((u) => ({ value: u._id, label: `${u.name} (${u.role})` }))}
                        />
                    </Col>
                    <Col xs={24} sm={12}>
                        <Text type="secondary">Ручной прогресс (%)</Text>
                        <InputNumber
                            style={{ width: '100%', marginTop: 4 }} min={0} max={100}
                            placeholder="Авто (по задачам)"
                            defaultValue={portal?.manualProgress ?? undefined}
                            onBlur={(e) => {
                                const v = e.target.value;
                                patch.mutate({ manualProgress: v === '' ? null : Number(v) });
                            }}
                        />
                    </Col>
                    <Col xs={24} sm={12}>
                        <Text type="secondary">Email клиента (фаза 2)</Text>
                        <Input
                            style={{ marginTop: 4 }} placeholder="client@example.com"
                            defaultValue={portal?.notifyEmail}
                            onBlur={(e) => patch.mutate({ notifyEmail: e.target.value })}
                        />
                    </Col>
                    <Col xs={24} sm={12}>
                        <Text type="secondary">Telegram chatId клиента</Text>
                        <Input
                            style={{ marginTop: 4 }} placeholder="напр. 646727639"
                            defaultValue={portal?.notifyTelegramId}
                            onBlur={(e) => patch.mutate({ notifyTelegramId: e.target.value })}
                        />
                    </Col>
                </Row>
                <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                    Уведомления об обновлениях шлются в Telegram: на указанный chatId и привязанным
                    guest-клиентам проекта. Email — в следующей фазе.
                </Paragraph>
            </Card>
        </div>
    );
};

export default PortalSettingsTab;
