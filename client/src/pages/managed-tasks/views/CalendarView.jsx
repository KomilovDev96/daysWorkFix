import React, { useState, useMemo } from 'react';
import { Calendar, Badge, Tag, Popover, Typography, Empty, Space } from 'antd';
import { FireOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const STATUS_COLOR = {
    pending:     'default',
    in_progress: 'processing',
    testing:     'warning',
    completed:   'success',
    cancelled:   'error',
};

const STATUS_LABEL = {
    pending:     'Ожидает',
    in_progress: 'В процессе',
    testing:     'Тестирование',
    completed:   'Выполнено',
    cancelled:   'Отменено',
};

const TYPE_COLOR = { monthly: 'purple', weekly: 'blue', daily: 'cyan', hourly: 'green' };

const TaskPopover = ({ task }) => (
    <div style={{ maxWidth: 260 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
            {task.isHot && <FireOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />}
            {task.title}
        </div>
        <Space wrap size={4} style={{ marginBottom: 6 }}>
            <Tag color={STATUS_COLOR[task.status]} style={{ margin: 0 }}>
                {STATUS_LABEL[task.status]}
            </Tag>
            <Tag color={TYPE_COLOR[task.type]} style={{ margin: 0 }}>{task.type}</Tag>
        </Space>
        {task.assignedTo?.length > 0 && (
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
                <UserOutlined style={{ marginRight: 4 }} />
                {task.assignedTo.map((w) => w.name || w).join(', ')}
            </div>
        )}
        {task.estimatedHours > 0 && (
            <div style={{ fontSize: 12, color: '#888' }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {task.actualHours || 0} / {task.estimatedHours} ч
            </div>
        )}
        {task.client && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                Заказчик: {task.client}
            </div>
        )}
    </div>
);

const CalendarView = ({ tasks, onEdit }) => {
    const [currentDate, setCurrentDate] = useState(dayjs());

    const tasksByDate = useMemo(() => {
        const map = {};
        tasks.forEach((t) => {
            if (!t.dueDate) return;
            const key = dayjs(t.dueDate).format('YYYY-MM-DD');
            if (!map[key]) map[key] = [];
            map[key].push(t);
        });
        return map;
    }, [tasks]);

    const cellRender = (current, info) => {
        if (info.type !== 'date') return info.originNode;
        const key   = current.format('YYYY-MM-DD');
        const items = tasksByDate[key];
        if (!items?.length) return null;

        return (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.slice(0, 3).map((t) => (
                    <li key={t._id} style={{ marginBottom: 2 }}>
                        <Popover
                            content={<TaskPopover task={t} />}
                            title={null}
                            trigger="hover"
                            placement="right"
                        >
                            <div
                                onClick={(e) => { e.stopPropagation(); onEdit && onEdit(t); }}
                                style={{ cursor: 'pointer' }}
                            >
                                <Badge
                                    status={STATUS_COLOR[t.status]}
                                    text={
                                        <Text
                                            style={{ fontSize: 11, maxWidth: 110 }}
                                            ellipsis={{ tooltip: t.title }}
                                        >
                                            {t.isHot && <FireOutlined style={{ color: '#ff4d4f', marginRight: 2 }} />}
                                            {t.title}
                                        </Text>
                                    }
                                />
                            </div>
                        </Popover>
                    </li>
                ))}
                {items.length > 3 && (
                    <li style={{ fontSize: 10, color: '#888' }}>+{items.length - 3} ещё</li>
                )}
            </ul>
        );
    };

    const tasksWithDates = tasks.filter((t) => t.dueDate);

    if (!tasksWithDates.length) {
        return (
            <Empty
                description={
                    <div style={{ textAlign: 'center' }}>
                        <div>Нет задач с дедлайном</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Укажите «Дедлайн» при создании задачи — они появятся в календаре
                        </Text>
                    </div>
                }
                style={{ padding: '40px 0' }}
            />
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {Object.entries(STATUS_COLOR).map(([s, c]) => (
                    <Badge key={s} status={c} text={
                        <Text style={{ fontSize: 12 }}>{STATUS_LABEL[s]}</Text>
                    } />
                ))}
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                    {tasksWithDates.length} задач с дедлайном
                </Text>
            </div>
            <Calendar
                cellRender={cellRender}
                value={currentDate}
                onPanelChange={(val) => setCurrentDate(val)}
                style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}
            />
        </div>
    );
};

export default CalendarView;
