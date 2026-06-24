import React, { useState } from 'react';
import {
    Card, Button, Typography, Tag, Empty, Spin, Space, Image, Popconfirm, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, LinkOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiClient from '../../../shared/api/apiClient';
import PublishUpdateModal from './PublishUpdateModal';

const { Title, Text, Paragraph } = Typography;

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
    .replace(/\/+$/, '').replace('/api', '');
const fileSrc = (url) => `${API_BASE}/${url}`.replace(/([^:])\/\/+/g, '$1/');

const UpdatesTab = ({ projectId }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: updates, isLoading } = useQuery({
        queryKey: ['project-updates', projectId],
        queryFn: async () => {
            const { data } = await apiClient.get(`/board-projects/${projectId}/updates`);
            return data.data.updates;
        },
    });

    const remove = useMutation({
        mutationFn: (updateId) => apiClient.delete(`/board-projects/${projectId}/updates/${updateId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-updates', projectId] });
            queryClient.invalidateQueries({ queryKey: ['project-timeline', projectId] });
            message.success('Обновление удалено');
        },
        onError: () => message.error('Не удалось удалить'),
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>Обновления проекта</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                    Опубликовать обновление
                </Button>
            </div>

            {isLoading && <Spin style={{ display: 'block', margin: '40px auto' }} />}
            {!isLoading && !updates?.length && <Empty description="Обновлений пока нет" />}

            {updates?.map((u) => {
                const images = (u.files || []).filter((f) => f.kind === 'image');
                const others = (u.files || []).filter((f) => f.kind !== 'image');
                return (
                    <Card key={u._id} size="small" style={{ marginBottom: 12, borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <Space direction="vertical" size={2}>
                                <Text strong style={{ fontSize: 15 }}>{u.title}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {dayjs(u.createdAt).format('DD.MM.YYYY HH:mm')}
                                    {u.authorId?.name ? ` · ${u.authorId.name}` : ''}
                                </Text>
                            </Space>
                            <Space>
                                {u.progress != null && <Tag color="green">{u.progress}%</Tag>}
                                <Popconfirm title="Удалить обновление?" onConfirm={() => remove.mutate(u._id)}>
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        </div>
                        {u.body && <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{u.body}</Paragraph>}
                        {images.length > 0 && (
                            <Image.PreviewGroup>
                                <Space wrap style={{ marginTop: 8 }}>
                                    {images.map((f) => (
                                        <Image key={f._id} src={fileSrc(f.fileUrl)} width={90} height={70}
                                            style={{ objectFit: 'cover', borderRadius: 6 }} />
                                    ))}
                                </Space>
                            </Image.PreviewGroup>
                        )}
                        {others.length > 0 && (
                            <Space direction="vertical" style={{ marginTop: 8 }}>
                                {others.map((f) => (
                                    <a key={f._id} href={fileSrc(f.fileUrl)} target="_blank" rel="noreferrer">
                                        <PaperClipOutlined /> {f.originalName}
                                    </a>
                                ))}
                            </Space>
                        )}
                        {u.links?.length > 0 && (
                            <Space direction="vertical" style={{ marginTop: 8 }}>
                                {u.links.map((l, i) => (
                                    <a key={i} href={l.url} target="_blank" rel="noreferrer">
                                        <LinkOutlined /> {l.label || l.url}
                                    </a>
                                ))}
                            </Space>
                        )}
                    </Card>
                );
            })}

            <PublishUpdateModal open={modalOpen} projectId={projectId} onClose={() => setModalOpen(false)} />
        </div>
    );
};

export default UpdatesTab;
