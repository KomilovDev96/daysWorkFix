import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Empty, Typography, Tag } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

const STATUS_COLOR = {
    pending:     '#8c8c8c',
    in_progress: '#1677ff',
    testing:     '#fa8c16',
    completed:   '#52c41a',
    cancelled:   '#ff4d4f',
};

const STATUS_LABEL = {
    pending:     'Ожидает',
    in_progress: 'В процессе',
    testing:     'Тестирование',
    completed:   'Выполнено',
    cancelled:   'Отменено',
};

const GanttView = ({ tasks, onEdit }) => {
    const ganttTasks = useMemo(() =>
        tasks.filter((t) => t.startDate && t.dueDate),
    [tasks]);

    const option = useMemo(() => {
        if (!ganttTasks.length) return null;

        const names   = ganttTasks.map((t) => t.title.length > 35 ? t.title.slice(0, 35) + '…' : t.title);
        const minDate = dayjs(Math.min(...ganttTasks.map((t) => new Date(t.startDate).getTime()))).subtract(1, 'day').toDate();
        const maxDate = dayjs(Math.max(...ganttTasks.map((t) => new Date(t.dueDate).getTime()))).add(1, 'day').toDate();

        const data = ganttTasks.map((t, i) => ({
            value: [
                i,
                new Date(t.startDate).getTime(),
                new Date(t.dueDate).getTime(),
                t.status,
                t.title,
                (t.assignedTo || []).map((w) => w.name || w).join(', ') || '—',
                t.estimatedHours || 0,
            ],
            itemStyle: { color: STATUS_COLOR[t.status] || '#8c8c8c' },
        }));

        return {
            tooltip: {
                formatter: (params) => {
                    const [, start, end, status, title, workers, hours] = params.value;
                    const s = dayjs(start).format('DD.MM.YYYY');
                    const e = dayjs(end).format('DD.MM.YYYY');
                    const diff = dayjs(end).diff(dayjs(start), 'day') + 1;
                    return [
                        `<b>${title}</b>`,
                        `Статус: ${STATUS_LABEL[status] || status}`,
                        `Период: ${s} → ${e} (${diff} дн.)`,
                        `Исполнители: ${workers}`,
                        hours ? `Часов: ${hours}` : '',
                    ].filter(Boolean).join('<br/>');
                },
            },
            grid: { top: 20, bottom: 30, left: '1%', right: '2%', containLabel: true },
            xAxis: {
                type: 'time',
                min: minDate,
                max: maxDate,
                axisLabel: { formatter: (val) => dayjs(val).format('DD.MM'), fontSize: 11 },
                splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
            },
            yAxis: {
                type: 'category',
                data: names,
                axisLabel: { fontSize: 11, width: 160, overflow: 'truncate' },
                axisTick: { alignWithLabel: true },
            },
            series: [{
                type: 'custom',
                renderItem: (params, api) => {
                    const categoryIndex = api.value(0);
                    const start  = api.coord([api.value(1), categoryIndex]);
                    const end    = api.coord([api.value(2), categoryIndex]);
                    const height = Math.max(api.size([0, 1])[1] * 0.55, 10);
                    const width  = Math.max(end[0] - start[0], 4);

                    return {
                        type: 'group',
                        children: [
                            {
                                type: 'rect',
                                shape: {
                                    x: start[0],
                                    y: start[1] - height / 2,
                                    width,
                                    height,
                                    r: 3,
                                },
                                style: api.style(),
                            },
                            width > 30 ? {
                                type: 'text',
                                style: {
                                    x: start[0] + 4,
                                    y: start[1],
                                    text: `${dayjs(api.value(1)).format('DD.MM')}`,
                                    fontSize: 10,
                                    fill: '#fff',
                                    textVerticalAlign: 'middle',
                                },
                            } : null,
                        ].filter(Boolean),
                    };
                },
                encode: { x: [1, 2], y: 0 },
                data,
            }],
        };
    }, [ganttTasks]);

    if (!ganttTasks.length) {
        return (
            <Empty
                description={
                    <div style={{ textAlign: 'center' }}>
                        <div>Нет задач с датами начала и окончания</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Укажите «Дату начала» и «Дедлайн» при создании задачи — они появятся на диаграмме
                        </Text>
                    </div>
                }
                style={{ padding: '40px 0' }}
            />
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                {Object.entries(STATUS_COLOR).map(([s, c]) => (
                    <Tag key={s} color={c} style={{ margin: 0 }}>{STATUS_LABEL[s]}</Tag>
                ))}
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                    Показано {ganttTasks.length} задач с датами
                </Text>
            </div>
            <ReactECharts
                option={option}
                style={{ height: Math.max(ganttTasks.length * 42 + 80, 300) }}
                opts={{ renderer: 'canvas' }}
                onEvents={{
                    click: (params) => {
                        const task = ganttTasks[params.value[0]];
                        if (task && onEdit) onEdit(task);
                    },
                }}
            />
        </div>
    );
};

export default GanttView;
