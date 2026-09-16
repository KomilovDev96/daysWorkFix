import React, { useState, useEffect } from 'react';
import {
    Modal, Input, Button, List, Empty, Divider, Typography, Space,
    Upload, message, Tag,
} from 'antd';
import { SendOutlined, UploadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import publicApi, { PUBLIC_API_BASE } from '../../shared/api/publicApi';
import { getStoredAuthorName, setStoredAuthorName } from './authorName';

const { Text } = Typography;

// Комментарии + файлы конкретной задачи, открыто из публичной командной доски
// (без входа в систему — автор комментария вводит имя один раз, оно запоминается в браузере).
const TaskDetailModal = ({ open, task, token, role, onClose }) => {
    const queryClient = useQueryClient();
    const [commentText, setCommentText] = useState('');
    const [nameModalOpen, setNameModalOpen] = useState(false);
    const [nameInput, setNameInput] = useState('');

    useEffect(() => {
        if (open) setCommentText('');
    }, [open, task?._id]);

    const { data: comments, refetch: refetchComments } = useQuery({
        queryKey: ['team-portal-comments', task?._id],
        queryFn: async () => {
            const { data } = await publicApi.get(`/team-portal/${token}/tasks/${task._id}/comments`);
            return data.data.comments;
        },
        enabled: !!task?._id && open,
        refetchInterval: open ? 8000 : false,
    });

    const addComment = useMutation({
        mutationFn: ({ authorName, text }) =>
            publicApi.post(`/team-portal/${token}/${role}/tasks/${task._id}/comments`, { authorName, text }),
        onSuccess: () => {
            setCommentText('');
            refetchComments();
        },
        onError: (e) => message.error(e.response?.data?.message || 'Не удалось отправить'),
    });

    const uploadFile = useMutation({
        mutationFn: (file) => {
            const formData = new FormData();
            formData.append('file', file);
            return publicApi.post(`/team-portal/${token}/${role}/tasks/${task._id}/files`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: ({ data }) => {
            message.success('Файл загружен');
            queryClient.setQueryData(['team-portal-tasks', token, role], (old) =>
                old ? { ...old, tasks: old.tasks.map((t) => (t._id === data.data.task._id ? data.data.task : t)) } : old
            );
        },
        onError: (e) => message.error(e.response?.data?.message || 'Не удалось загрузить файл'),
    });

    const sendComment = (authorName) => {
        const text = commentText.trim();
        if (!text) return;
        addComment.mutate({ authorName, text });
    };

    const handleSendClick = () => {
        if (!commentText.trim()) return;
        const stored = getStoredAuthorName();
        if (!stored) {
            setNameModalOpen(true);
            return;
        }
        sendComment(stored);
    };

    const confirmName = () => {
        const name = nameInput.trim();
        if (!name) return;
        setStoredAuthorName(name);
        setNameModalOpen(false);
        sendComment(name);
    };

    const files = task?.files || [];

    return (
        <Modal open={open} onCancel={onClose} footer={null} title={task?.title} width={520} destroyOnClose>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Файлы</Text>
            <Upload.Dragger
                customRequest={({ file, onSuccess, onError }) => {
                    uploadFile.mutate(file, {
                        onSuccess: (res) => { onSuccess(res); },
                        onError: (e) => onError(e),
                    });
                }}
                showUploadList={false}
                multiple={false}
                disabled={uploadFile.isPending}
                style={{ marginBottom: 12, padding: '8px 0' }}
            >
                <p style={{ margin: 0, fontSize: 13 }}>
                    <UploadOutlined style={{ marginRight: 6 }} />
                    Перетащите файл или нажмите для загрузки
                </p>
            </Upload.Dragger>

            {files.length === 0 ? (
                <Empty description="Файлов нет" style={{ marginBottom: 12 }} />
            ) : (
                <List
                    size="small"
                    dataSource={files}
                    style={{ marginBottom: 12 }}
                    renderItem={(f) => (
                        <List.Item>
                            <a href={`${PUBLIC_API_BASE}/${f.fileUrl}`} target="_blank" rel="noopener noreferrer">
                                <PaperClipOutlined style={{ marginRight: 6 }} />
                                {f.originalName}
                            </a>
                        </List.Item>
                    )}
                />
            )}

            <Divider style={{ margin: '12px 0' }} />

            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Комментарии</Text>
            {(!comments || comments.length === 0) && (
                <Empty description="Комментариев пока нет" style={{ marginBottom: 12 }} />
            )}
            <List
                dataSource={comments || []}
                renderItem={(c) => (
                    <List.Item style={{ border: 'none', padding: '4px 0' }}>
                        <div style={{
                            width: '100%', background: '#f6ffed', border: '1px solid #b7eb8f',
                            borderRadius: 10, padding: '8px 12px',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <Space size={6}>
                                    <Text strong style={{ fontSize: 13 }}>{c.authorName}</Text>
                                    {c.role && <Tag style={{ margin: 0 }}>{c.role}</Tag>}
                                </Space>
                                <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {dayjs(c.createdAt).format('DD.MM HH:mm')}
                                </Text>
                            </div>
                            <Text style={{ fontSize: 14 }}>{c.text}</Text>
                        </div>
                    </List.Item>
                )}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Input.TextArea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Написать комментарий..."
                    autoSize={{ minRows: 2 }}
                />
                <Button type="primary" icon={<SendOutlined />}
                    loading={addComment.isPending}
                    disabled={!commentText.trim()}
                    onClick={handleSendClick}
                    style={{ height: 'auto' }}
                />
            </div>

            <Modal
                open={nameModalOpen}
                title="Как вас зовут?"
                onOk={confirmName}
                onCancel={() => setNameModalOpen(false)}
                okText="Отправить"
                cancelText="Отмена"
            >
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    Имя запомнится в этом браузере и будет подставляться в следующих комментариях.
                </Text>
                <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Например: Азиз"
                    onPressEnter={confirmName}
                    autoFocus
                />
            </Modal>
        </Modal>
    );
};

export default TaskDetailModal;
