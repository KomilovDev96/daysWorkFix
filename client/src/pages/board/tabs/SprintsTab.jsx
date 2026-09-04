import React, { useState } from 'react';
import {
    Card, Button, Modal, Form, Input, Space, Tag, Typography, Empty,
    Popconfirm, message, Switch, Tooltip, Radio,
} from 'antd';
import {
    PlusOutlined, RocketOutlined, FlagOutlined, DeleteOutlined,
    EditOutlined, CheckCircleOutlined, EyeOutlined, EyeInvisibleOutlined,
    ClockCircleOutlined, LinkOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiClient from '../../../shared/api/apiClient';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Спринты — именованные блоки задач («Спринт 1», «Спринт 2», ...). Активен всегда
// только один: он и уходит «снимком» в клиентский портал, остальные скрыты по умолчанию.
const SprintsTab = ({ project }) => {
    const queryClient = useQueryClient();
    const [modal, setModal] = useState({ open: false, item: null });
    const [form] = Form.useForm();

    const sprints = (project?.sprints || []).slice().reverse();

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board-projects'] });

    const createSprint = useMutation({
        mutationFn: (body) => apiClient.post(`/board-projects/${project._id}/sprints`, body),
        onSuccess: () => { invalidate(); message.success('Спринт создан'); setModal({ open: false, item: null }); },
        onError: (e) => message.error(e.response?.data?.message || 'Не удалось создать спринт'),
    });

    const updateSprint = useMutation({
        mutationFn: ({ sprintId, body }) => apiClient.patch(`/board-projects/${project._id}/sprints/${sprintId}`, body),
        onSuccess: () => { invalidate(); message.success('Спринт обновлён'); },
        onError: (e) => message.error(e.response?.data?.message || 'Не удалось обновить спринт'),
    });

    const deleteSprint = useMutation({
        mutationFn: (sprintId) => apiClient.delete(`/board-projects/${project._id}/sprints/${sprintId}`),
        onSuccess: () => { invalidate(); message.success('Спринт удалён, задачи вернулись в бэклог'); },
        onError: (e) => message.error(e.response?.data?.message || 'Не удалось удалить спринт'),
    });

    const getSprintLink = useMutation({
        mutationFn: (sprintId) => apiClient.post(`/board-projects/${project._id}/sprints/${sprintId}/link`),
        onSuccess: ({ data }) => {
            invalidate();
            navigator.clipboard.writeText(data.data.link);
            message.success('Ссылка на спринт скопирована');
        },
        onError: (e) => message.error(e.response?.data?.message || 'Не удалось получить ссылку'),
    });

    const copySprintLink = (token) => {
        navigator.clipboard.writeText(`${window.location.origin}/sprint-portal/${token}`);
        message.success('Ссылка на спринт скопирована');
    };

    const openCreate = () => {
        form.resetFields();
        form.setFieldsValue({ status: 'active' });
        setModal({ open: true, item: null });
    };

    const handleCreate = async () => {
        const values = await form.validateFields();
        createSprint.mutate(values);
    };

    return (
        <div style={{ maxWidth: 760 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <Title level={5} style={{ margin: 0 }}>Спринты проекта</Title>
                    <Text type="secondary">
                        Активный спринт виден клиенту в портале как снимок доски; старые скрыты автоматически.
                    </Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    Новый спринт
                </Button>
            </div>

            {sprints.length === 0 && (
                <Empty description="Спринтов пока нет — задачи видны как единый список без разбивки" />
            )}

            {sprints.map((s) => (
                <Card key={s._id} size="small" style={{ marginBottom: 12, borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <Space direction="vertical" size={2} style={{ flex: 1 }}>
                            <Space size={8} wrap>
                                <Text strong style={{ fontSize: 15 }}>{s.name}</Text>
                                {s.status === 'active' && <Tag color="green" icon={<RocketOutlined />}>Активен</Tag>}
                                {s.status === 'completed' && <Tag icon={<FlagOutlined />}>Завершён</Tag>}
                                {s.status === 'planning' && <Tag color="default" icon={<ClockCircleOutlined />}>Запланирован</Tag>}
                                {!s.visibleToClient && (
                                    <Tooltip title="Не показывается клиенту, даже если активен">
                                        <Tag icon={<EyeInvisibleOutlined />}>Скрыт от клиента</Tag>
                                    </Tooltip>
                                )}
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Начат {dayjs(s.createdAt).format('DD.MM.YYYY')}
                                {s.completedAt ? ` · завершён ${dayjs(s.completedAt).format('DD.MM.YYYY')}` : ''}
                            </Text>
                            {s.description && <Paragraph style={{ margin: '4px 0 0' }}>{s.description}</Paragraph>}
                        </Space>

                        <Space direction="vertical" align="end" size={6}>
                            <Space size={4}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Видно клиенту</Text>
                                <Switch
                                    size="small"
                                    checked={!!s.visibleToClient}
                                    loading={updateSprint.isPending}
                                    onChange={(checked) => updateSprint.mutate({ sprintId: s._id, body: { visibleToClient: checked } })}
                                />
                            </Space>
                            <Space size={4}>
                                {s.status !== 'active' ? (
                                    <Button size="small" icon={<RocketOutlined />}
                                        onClick={() => updateSprint.mutate({ sprintId: s._id, body: { status: 'active' } })}>
                                        Сделать активным
                                    </Button>
                                ) : (
                                    <Button size="small" icon={<CheckCircleOutlined />}
                                        onClick={() => updateSprint.mutate({ sprintId: s._id, body: { status: 'completed' } })}>
                                        Завершить
                                    </Button>
                                )}
                                <Popconfirm title="Удалить спринт? Задачи вернутся в бэклог." onConfirm={() => deleteSprint.mutate(s._id)}>
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                            <Space size={4}>
                                {s.token ? (
                                    <>
                                        <Button size="small" icon={<LinkOutlined />} onClick={() => copySprintLink(s.token)}>
                                            Ссылка для клиента
                                        </Button>
                                        <Popconfirm title="Обновить ссылку? Старая перестанет работать." onConfirm={() => getSprintLink.mutate(s._id)}>
                                            <Tooltip title="Новая ссылка">
                                                <Button size="small" icon={<ReloadOutlined />} loading={getSprintLink.isPending} />
                                            </Tooltip>
                                        </Popconfirm>
                                    </>
                                ) : (
                                    <Button size="small" icon={<LinkOutlined />} loading={getSprintLink.isPending}
                                        onClick={() => getSprintLink.mutate(s._id)}>
                                        Ссылка для клиента
                                    </Button>
                                )}
                            </Space>
                        </Space>
                    </div>
                </Card>
            ))}

            <Modal
                title="Новый спринт"
                open={modal.open}
                onOk={handleCreate}
                onCancel={() => setModal({ open: false, item: null })}
                confirmLoading={createSprint.isPending}
                okText="Создать"
                cancelText="Отмена"
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
                        <Input placeholder="Например: Спринт 3" />
                    </Form.Item>
                    <Form.Item name="description" label="Описание">
                        <TextArea rows={3} placeholder="Что входит в этот спринт" />
                    </Form.Item>
                    <Form.Item name="status" label="Статус">
                        <Radio.Group>
                            <Radio value="active">Активный — сразу видно клиенту</Radio>
                            <Radio value="planning">Запланирован — не виден клиенту, текущий активный не трогаем</Radio>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.status !== cur.status}>
                        {({ getFieldValue }) => getFieldValue('status') === 'active' && (
                            <Text type="warning" style={{ display: 'block', marginTop: -8 }}>
                                Текущий активный спринт автоматически завершится и перестанет быть виден клиенту.
                            </Text>
                        )}
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default SprintsTab;
