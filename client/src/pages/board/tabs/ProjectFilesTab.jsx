import React from 'react';
import { Typography, Empty, List, Image, Tag, Space, Spin } from 'antd';
import { PaperClipOutlined, FileImageOutlined, FilePdfOutlined, FileOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiClient from '../../../shared/api/apiClient';

const { Title, Text } = Typography;

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
    .replace(/\/+$/, '').replace('/api', '');
const fileSrc = (url) => `${API_BASE}/${url}`.replace(/([^:])\/\/+/g, '$1/');

const isImage = (type) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(type);
const icon = (type) => {
    if (isImage(type)) return <FileImageOutlined style={{ color: '#1677ff' }} />;
    if (type === 'pdf') return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    return <FileOutlined style={{ color: '#8c8c8c' }} />;
};

// Агрегирует файлы из задач проекта и из обновлений портала.
const ProjectFilesTab = ({ project }) => {
    const { data: updates, isLoading } = useQuery({
        queryKey: ['project-updates', project._id],
        queryFn: async () => {
            const { data } = await apiClient.get(`/board-projects/${project._id}/updates`);
            return data.data.updates;
        },
    });

    const items = [];
    (project.tasks || []).forEach((t) =>
        (t.files || []).forEach((f) => items.push({
            ...f, source: `Задача: ${t.title}`, key: `t-${f._id}`,
        }))
    );
    (updates || []).forEach((u) =>
        (u.files || []).forEach((f) => items.push({
            ...f, fileType: f.fileType, source: `Обновление: ${u.title}`, key: `u-${f._id}`,
        }))
    );

    if (isLoading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

    return (
        <div>
            <Title level={5}>Файлы проекта ({items.length})</Title>
            {!items.length && <Empty description="Файлов пока нет" />}
            <List
                dataSource={items}
                renderItem={(f) => (
                    <List.Item
                        actions={[
                            <a key="open" href={fileSrc(f.fileUrl)} target="_blank" rel="noreferrer">Открыть</a>,
                        ]}
                    >
                        <List.Item.Meta
                            avatar={isImage(f.fileType)
                                ? <Image src={fileSrc(f.fileUrl)} width={44} height={44}
                                    style={{ objectFit: 'cover', borderRadius: 4 }} preview={false} />
                                : <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 4, fontSize: 22 }}>{icon(f.fileType)}</div>}
                            title={<Text>{f.originalName}</Text>}
                            description={
                                <Space size={8}>
                                    <Tag>{f.fileType?.toUpperCase()}</Tag>
                                    <Text type="secondary" style={{ fontSize: 12 }}>{f.source}</Text>
                                    {f.uploadedAt && <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(f.uploadedAt).format('DD.MM.YYYY')}</Text>}
                                </Space>
                            }
                        />
                    </List.Item>
                )}
            />
        </div>
    );
};

export default ProjectFilesTab;
