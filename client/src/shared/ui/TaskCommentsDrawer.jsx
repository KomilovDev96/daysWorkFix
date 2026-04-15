import React, { useState, useRef, useEffect } from 'react';
import {
    Drawer, Input, Button, Space, Typography, Avatar,
    Spin, Popconfirm, Tag, Empty, Badge,
} from 'antd';
import {
    SendOutlined, DeleteOutlined, UserOutlined,
    CommentOutlined, ExperimentOutlined, CheckCircleOutlined,
    ClockCircleOutlined, FireOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';
import { fetchComments, addComment, deleteComment } from '../api/managedTasksApi';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const { Text, Title } = Typography;

const STATUS_COLOR = {
    pending:     { color: '#8c8c8c', label: 'Ожидает',       icon: <ClockCircleOutlined /> },
    in_progress: { color: '#1677ff', label: 'В процессе',    icon: null },
    testing:     { color: '#fa8c16', label: 'Тестирование',  icon: <ExperimentOutlined /> },
    completed:   { color: '#52c41a', label: 'Выполнено',     icon: <CheckCircleOutlined /> },
    cancelled:   { color: '#ff4d4f', label: 'Отменено',      icon: null },
};

const ROLE_COLOR = {
    worker:         '#1677ff',
    projectManager: '#722ed1',
    admin:          '#ff4d4f',
};
const ROLE_LABEL = { worker: 'Сотрудник', projectManager: 'Менеджер', admin: 'Админ' };

// ── Один комментарий ──────────────────────────────────────────────────────────
const CommentItem = ({ comment, currentUserId, onDelete }) => {
    const isOwn    = String(comment.author?._id || comment.author) === String(currentUserId);
    const roleInfo = STATUS_COLOR[comment.author?.role] || {};
    const bgColor  = ROLE_COLOR[comment.author?.role] || '#aaa';

    return (
        <div style={{
            display:       'flex',
            flexDirection: isOwn ? 'row-reverse' : 'row',
            gap:           10,
            marginBottom:  16,
            alignItems:    'flex-start',
        }}>
            {/* Аватар */}
            <Avatar
                size={36}
                icon={<UserOutlined />}
                style={{ background: bgColor, flexShrink: 0 }}
            />

            {/* Пузырёк */}
            <div style={{ maxWidth: '72%' }}>
                {/* Имя + роль + время */}
                <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            6,
                    marginBottom:   4,
                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                }}>
                    <Text strong style={{ fontSize: 13 }}>
                        {comment.author?.name || 'Пользователь'}
                    </Text>
                    <Tag
                        style={{ margin: 0, fontSize: 11 }}
                        color={comment.author?.role === 'projectManager' ? 'purple'
                            : comment.author?.role === 'admin' ? 'red' : 'blue'}
                    >
                        {ROLE_LABEL[comment.author?.role] || comment.author?.role}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(comment.createdAt).fromNow()}
                    </Text>
                </div>

                {/* Текст */}
                <div style={{
                    background:   isOwn ? '#e6f4ff' : '#f5f5f5',
                    border:       `1px solid ${isOwn ? '#91caff' : '#e0e0e0'}`,
                    borderRadius: isOwn ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                    padding:      '10px 14px',
                    position:     'relative',
                    whiteSpace:   'pre-wrap',
                    wordBreak:    'break-word',
                    fontSize:     14,
                    lineHeight:   1.6,
                }}>
                    {comment.text}

                    {/* Кнопка удаления только своих */}
                    {isOwn && (
                        <Popconfirm
                            title="Удалить комментарий?"
                            onConfirm={() => onDelete(comment._id)}
                            okText="Да" cancelText="Нет"
                            placement={isOwn ? 'topLeft' : 'topRight'}
                        >
                            <Button
                                type="text" size="small" danger
                                icon={<DeleteOutlined />}
                                style={{
                                    position: 'absolute', top: 4, right: 4,
                                    opacity: 0.4, padding: '0 4px',
                                }}
                                className="comment-delete-btn"
                            />
                        </Popconfirm>
                    )}
                </div>

                {/* Точное время */}
                <Text type="secondary" style={{
                    fontSize: 11, marginTop: 2, display: 'block',
                    textAlign: isOwn ? 'right' : 'left',
                }}>
                    {dayjs(comment.createdAt).format('DD.MM.YYYY HH:mm')}
                </Text>
            </div>
        </div>
    );
};

// ── Основной компонент ────────────────────────────────────────────────────────
const TaskCommentsDrawer = ({ taskId, taskTitle, open, onClose }) => {
    const qc       = useQueryClient();
    const user     = useSelector((s) => s.auth.user);
    const [text, setText]   = useState('');
    const bottomRef         = useRef(null);

    const { data: taskData, isLoading } = useQuery({
        queryKey: ['task-comments', taskId],
        queryFn:  () => fetchComments(taskId),
        enabled:  !!taskId && open,
        refetchInterval: open ? 15000 : false, // авто-обновление каждые 15с
    });

    const comments = taskData?.comments ?? [];
    const status   = taskData?.status;
    const statusInfo = STATUS_COLOR[status] || {};

    // Прокрутка вниз при новых сообщениях
    useEffect(() => {
        if (comments.length > 0) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }, [comments.length]);

    const addMut = useMutation({
        mutationFn: () => addComment(taskId, text.trim()),
        onSuccess:  () => {
            setText('');
            qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
            // Обновляем и список задач чтобы счётчик комментариев был актуален
            qc.invalidateQueries({ queryKey: ['managed-tasks'] });
            qc.invalidateQueries({ queryKey: ['my-assigned-tasks'] });
            qc.invalidateQueries({ queryKey: ['my-self-tasks'] });
        },
    });

    const deleteMut = useMutation({
        mutationFn: (commentId) => deleteComment(taskId, commentId),
        onSuccess:  () => qc.invalidateQueries({ queryKey: ['task-comments', taskId] }),
    });

    const handleSend = () => {
        if (!text.trim()) return;
        addMut.mutate();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
    };

    return (
        <Drawer
            title={
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space>
                        <CommentOutlined />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>
                            {taskTitle || taskData?.title || 'Комментарии'}
                        </span>
                    </Space>
                    {status && (
                        <Tag
                            icon={statusInfo.icon}
                            color={status === 'testing' ? 'warning'
                                : status === 'completed' ? 'success'
                                : status === 'in_progress' ? 'processing'
                                : 'default'}
                            style={{ marginLeft: 0 }}
                        >
                            {statusInfo.label}
                        </Tag>
                    )}
                </Space>
            }
            open={open}
            onClose={onClose}
            width={480}
            styles={{ body: { display: 'flex', flexDirection: 'column', padding: 0, height: '100%' } }}
        >
            {/* Список комментариев */}
            <div style={{
                flex: 1, overflowY: 'auto',
                padding: '16px 20px',
                background: '#fafafa',
            }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                ) : comments.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <span>
                                Комментариев пока нет.<br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Напишите первый — опишите проблему или обновление по задаче.
                                </Text>
                            </span>
                        }
                        style={{ marginTop: 60 }}
                    />
                ) : (
                    <>
                        {comments.map((c) => (
                            <CommentItem
                                key={c._id}
                                comment={c}
                                currentUserId={user?._id}
                                onDelete={(id) => deleteMut.mutate(id)}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </>
                )}
            </div>

            {/* Поле ввода */}
            <div style={{
                padding:      '12px 16px',
                borderTop:    '1px solid #f0f0f0',
                background:   '#fff',
                flexShrink:   0,
            }}>
                <Input.TextArea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Напишите комментарий... (Ctrl+Enter для отправки)"
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    style={{ marginBottom: 8, borderRadius: 8 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        Ctrl+Enter — отправить
                    </Text>
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={addMut.isPending}
                        disabled={!text.trim()}
                        onClick={handleSend}
                    >
                        Отправить
                    </Button>
                </div>
            </div>
        </Drawer>
    );
};

export default TaskCommentsDrawer;
