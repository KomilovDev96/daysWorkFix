import React from 'react';
import {
    Table, Tag, Space, Button, Tooltip, Badge, Avatar, Popconfirm, Typography,
} from 'antd';
import {
    EditOutlined, DeleteOutlined, FireOutlined, UserOutlined,
    ClockCircleOutlined, CalendarOutlined, CommentOutlined,
    CheckCircleOutlined, RollbackOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const TYPE_COLOR  = { monthly: 'purple', weekly: 'blue', daily: 'cyan', hourly: 'green' };
const TYPE_LABEL  = { monthly: 'Месячная', weekly: 'Недельная', daily: 'Дневная', hourly: 'Часовая' };
const STATUS_TAG  = { pending: 'default', in_progress: 'processing', testing: 'warning', completed: 'success', cancelled: 'error' };
const STATUS_LABEL = { pending: 'Ожидает', in_progress: 'В процессе', testing: 'Тестирование', completed: 'Выполнено', cancelled: 'Отменено' };

const TableView = ({ tasks, currentUserId, onEdit, onDelete, onApprove, onReject, onComment }) => {
    const columns = [
        {
            title: 'Задача',
            dataIndex: 'title',
            key: 'title',
            width: 260,
            render: (title, t) => (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        {t.isHot && <FireOutlined style={{ color: '#ff4d4f', flexShrink: 0 }} />}
                        <Text strong style={{ fontSize: 13 }}>{title}</Text>
                    </div>
                    {t.description && (
                        <Text type="secondary" style={{ fontSize: 11 }} ellipsis={{ tooltip: t.description }}>
                            {t.description}
                        </Text>
                    )}
                    {t.client && (
                        <div>
                            <Tag color="gold" style={{ margin: 0, fontSize: 10 }}>{t.client}</Tag>
                        </div>
                    )}
                </div>
            ),
            sorter: (a, b) => a.title.localeCompare(b.title),
        },
        {
            title: 'Тип',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (t) => <Tag color={TYPE_COLOR[t]} style={{ margin: 0 }}>{TYPE_LABEL[t]}</Tag>,
            filters: Object.entries(TYPE_LABEL).map(([v, l]) => ({ text: l, value: v })),
            onFilter: (val, r) => r.type === val,
        },
        {
            title: 'Статус',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (s) => <Badge status={STATUS_TAG[s]} text={STATUS_LABEL[s]} />,
            filters: Object.entries(STATUS_LABEL).map(([v, l]) => ({ text: l, value: v })),
            onFilter: (val, r) => r.status === val,
        },
        {
            title: 'Исполнители',
            dataIndex: 'assignedTo',
            key: 'assignedTo',
            width: 150,
            render: (workers) => (
                <Space wrap size={4}>
                    {(workers || []).map((w) => (
                        <Tooltip key={w._id || w} title={w.name || w}>
                            <Avatar size={22} icon={<UserOutlined />}
                                style={{ background: '#1677ff', cursor: 'default', flexShrink: 0 }} />
                        </Tooltip>
                    ))}
                </Space>
            ),
        },
        {
            title: 'Проект',
            dataIndex: 'project',
            key: 'project',
            width: 120,
            render: (p) => p?.name
                ? <Tag color="purple" style={{ margin: 0 }}>{p.name}</Tag>
                : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
        },
        {
            title: 'Часы',
            key: 'hours',
            width: 90,
            render: (_, t) => t.estimatedHours > 0
                ? (
                    <Text style={{ fontSize: 12 }}>
                        <ClockCircleOutlined style={{ marginRight: 3 }} />
                        {t.actualHours || 0}/{t.estimatedHours}
                    </Text>
                )
                : <Text type="secondary">—</Text>,
            sorter: (a, b) => (a.estimatedHours || 0) - (b.estimatedHours || 0),
        },
        {
            title: 'Дедлайн',
            dataIndex: 'dueDate',
            key: 'dueDate',
            width: 110,
            render: (d) => {
                if (!d) return <Text type="secondary">—</Text>;
                const isOverdue = dayjs(d).isBefore(dayjs(), 'day');
                return (
                    <Text style={{ color: isOverdue ? '#ff4d4f' : undefined, fontSize: 12 }}>
                        <CalendarOutlined style={{ marginRight: 3 }} />
                        {dayjs(d).format('DD.MM.YYYY')}
                        {isOverdue ? ' ⚠️' : ''}
                    </Text>
                );
            },
            sorter: (a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            },
            defaultSortOrder: 'ascend',
        },
        {
            title: 'Действия',
            key: 'actions',
            width: 160,
            fixed: 'right',
            render: (_, t) => (
                <Space size={4} wrap>
                    {t.status === 'testing' && (
                        <>
                            <Tooltip title="Одобрить">
                                <Button size="small" type="primary"
                                    icon={<CheckCircleOutlined />}
                                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                    onClick={() => onApprove(t._id)} />
                            </Tooltip>
                            <Tooltip title="Вернуть">
                                <Button size="small" icon={<RollbackOutlined />}
                                    onClick={() => onReject(t._id)} />
                            </Tooltip>
                        </>
                    )}
                    <Tooltip title={`Комментарии (${t.comments?.length || 0})`}>
                        <Badge count={t.comments?.length || 0} size="small" offset={[-2, 2]}>
                            <Button size="small" icon={<CommentOutlined />}
                                type={t.comments?.length > 0 ? 'primary' : 'default'}
                                ghost={t.comments?.length > 0}
                                onClick={() => onComment(t)} />
                        </Badge>
                    </Tooltip>
                    <Tooltip title="Редактировать">
                        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(t)} />
                    </Tooltip>
                    <Popconfirm title="Удалить задачу?" onConfirm={() => onDelete(t._id)}
                        okText="Да" cancelText="Нет">
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Table
            dataSource={tasks}
            columns={columns}
            rowKey="_id"
            size="small"
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
            rowClassName={(t) => t.isHot ? 'hot-row' : ''}
            locale={{ emptyText: 'Нет задач' }}
            style={{ '--hot-row-bg': '#fff1f0' }}
        />
    );
};

export default TableView;
