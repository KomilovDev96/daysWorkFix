import React, { useState, useMemo } from 'react';
import {
    Card, Row, Col, Statistic, Table, Select, DatePicker,
    Space, Typography, Tag, Tabs, Badge, Spin, Tooltip,
    Progress, Avatar, List, Empty, Divider,
} from 'antd';
import {
    FireOutlined, ClockCircleOutlined, CheckCircleOutlined,
    UserOutlined, TeamOutlined, CalendarOutlined,
    LineChartOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { fetchManagerStats, fetchAvailability, fetchWorkers } from '../../shared/api/managedTasksApi';
import ExportTasksButton from '../../shared/ui/ExportTasksButton';
import 'dayjs/locale/ru';
import localizedFormat from 'dayjs/plugin/localizedFormat';
dayjs.extend(localizedFormat);
dayjs.locale('ru');

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const TYPE_COLOR  = { monthly: 'purple', weekly: 'blue', daily: 'cyan', hourly: 'green' };
const TYPE_LABEL  = { monthly: 'Месячная', weekly: 'Недельная', daily: 'Дневная', hourly: 'Часовая' };
const STATUS_COLOR = { pending: '#faad14', in_progress: '#1677ff', completed: '#52c41a', cancelled: '#ff4d4f' };
const STATUS_LABEL = { pending: 'Ожидает', in_progress: 'В процессе', completed: 'Выполнено', cancelled: 'Отменено' };

// ── Вспомогательные компоненты ────────────────────────────────────────────────

const StatCard = ({ title, value, color, icon, suffix }) => (
    <Card size="small" style={{ height: '100%' }}>
        <Statistic
            title={title}
            value={value}
            valueStyle={color ? { color } : undefined}
            prefix={icon}
            suffix={suffix}
        />
    </Card>
);

// Круговая диаграмма через CSS (простая версия без ECharts)
const DonutStat = ({ label, done, total, color = '#1677ff' }) => {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
        <div style={{ textAlign: 'center' }}>
            <Progress
                type="circle"
                percent={pct}
                size={88}
                strokeColor={color}
                format={() => `${pct}%`}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>{label}</div>
            <div style={{ fontSize: 12 }}>{done} / {total}</div>
        </div>
    );
};

// ── Цвет ячейки календаря по загруженности ────────────────────────────────────
const dayColor = (totalHours) => {
    if (totalHours === 0) return { bg: '#f6ffed', border: '#b7eb8f', text: '#52c41a', label: 'Свободен' };
    if (totalHours < 4)   return { bg: '#e6f7ff', border: '#91d5ff', text: '#1677ff', label: `${totalHours}ч` };
    if (totalHours < 8)   return { bg: '#fff7e6', border: '#ffd591', text: '#fa8c16', label: `${totalHours}ч` };
    return                       { bg: '#fff1f0', border: '#ffa39e', text: '#ff4d4f', label: `${totalHours}ч` };
};

// ── Календарная сетка (месяц) ─────────────────────────────────────────────────
const WorkerCalendar = ({ month, availData }) => {
    const startOfMonth = month.startOf('month');
    const daysInMonth  = month.daysInMonth();

    // byDate map
    const byDate = useMemo(() => {
        const m = {};
        (availData || []).forEach((d) => { m[d.date] = d; });
        return m;
    }, [availData]);

    const firstDow = (startOfMonth.day() + 6) % 7; // Пн=0
    const cells = [];

    // Пустые ячейки до первого числа
    for (let i = 0; i < firstDow; i++) cells.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = month.date(d).format('YYYY-MM-DD');
        const dayData = byDate[dateKey];
        const hours   = dayData?.totalEstimated || 0;
        cells.push({ d, dateKey, dayData, hours });
    }

    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    return (
        <div>
            {/* Шапка дней недели */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                {weekDays.map((wd) => (
                    <div key={wd} style={{ textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#666', padding: '4px 0' }}>
                        {wd}
                    </div>
                ))}
            </div>
            {/* Ячейки */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {cells.map((cell, idx) => {
                    if (!cell) return <div key={`empty-${idx}`} />;
                    const { d, dateKey, dayData, hours } = cell;
                    const { bg, border, text, label } = dayColor(hours);
                    const isWeekend = (idx % 7) >= 5;

                    return (
                        <Tooltip
                            key={dateKey}
                            title={
                                dayData?.tasks?.length ? (
                                    <div>
                                        {dayData.tasks.map((t, i) => (
                                            <div key={i} style={{ marginBottom: 4 }}>
                                                <div style={{ fontWeight: 600 }}>{t.title}</div>
                                                <div style={{ fontSize: 11, opacity: 0.85 }}>
                                                    {t.estimatedHours}ч · {STATUS_LABEL[t.status]}
                                                    {t.assignedBy ? ` · от ${t.assignedBy.name}` : ''}
                                                    {t.project ? ` · 📁 ${t.project}` : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : null
                            }
                            placement="top"
                        >
                            <div style={{
                                background:   isWeekend ? (hours > 0 ? bg : '#fafafa') : bg,
                                border:       `1px solid ${isWeekend ? '#d9d9d9' : border}`,
                                borderRadius: 6,
                                padding:      '6px 4px',
                                textAlign:    'center',
                                cursor:       dayData?.tasks?.length ? 'pointer' : 'default',
                                minHeight:    52,
                            }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: isWeekend ? '#999' : '#333' }}>{d}</div>
                                <div style={{ fontSize: 11, color: isWeekend && hours === 0 ? '#bbb' : text, marginTop: 2 }}>
                                    {isWeekend && hours === 0 ? '—' : label}
                                </div>
                                {dayData?.tasks?.length > 0 && (
                                    <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>
                                        {dayData.tasks.length} задач
                                    </div>
                                )}
                            </div>
                        </Tooltip>
                    );
                })}
            </div>
            {/* Легенда */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                {[
                    { bg: '#f6ffed', border: '#b7eb8f', label: 'Свободен (0ч)' },
                    { bg: '#e6f7ff', border: '#91d5ff', label: 'Занят до 4ч' },
                    { bg: '#fff7e6', border: '#ffd591', label: 'Занят 4–7ч' },
                    { bg: '#fff1f0', border: '#ffa39e', label: 'Загружен полностью (≥8ч)' },
                ].map(({ bg, border, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <div style={{ width: 14, height: 14, background: bg, border: `1px solid ${border}`, borderRadius: 3 }} />
                        {label}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Вкладка 1 — МОЙ ОТЧЁТ
// ═══════════════════════════════════════════════════════════════════════════════

const MyReportTab = () => {
    const [range, setRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);

    const params = useMemo(() => ({
        startDate: range?.[0]?.toISOString(),
        endDate:   range?.[1]?.toISOString(),
    }), [range]);

    const { data, isLoading } = useQuery({
        queryKey: ['manager-stats', params],
        queryFn:  () => fetchManagerStats(params),
    });

    const totals   = data?.totals   ?? {};
    const tasks    = data?.tasks    ?? [];
    const workers  = data?.workers  ?? [];
    const byType   = data?.byType   ?? {};

    const taskColumns = [
        {
            title: 'Задача', dataIndex: 'title', key: 'title',
            render: (v, r) => (
                <Space>
                    {r.isHot && <FireOutlined style={{ color: '#ff4d4f' }} />}
                    <span>{v}</span>
                </Space>
            ),
        },
        {
            title: 'Тип', dataIndex: 'type', key: 'type', width: 110,
            render: (v) => <Tag color={TYPE_COLOR[v]}>{TYPE_LABEL[v]}</Tag>,
        },
        {
            title: 'Статус', dataIndex: 'status', key: 'status', width: 130,
            render: (v) => <Badge color={STATUS_COLOR[v]} text={STATUS_LABEL[v]} />,
        },
        {
            title: 'Исполнители', key: 'workers', width: 180,
            render: (_, r) => (r.assignedTo || []).map((w) => (
                <Tag key={w._id}>{w.name}</Tag>
            )),
        },
        {
            title: 'Часы', key: 'hours', width: 100, align: 'center',
            render: (_, r) => (
                <Text type="secondary">{r.actualHours || 0} / {r.estimatedHours || 0}ч</Text>
            ),
        },
        {
            title: 'Дедлайн', dataIndex: 'dueDate', key: 'dueDate', width: 110,
            render: (v) => v ? dayjs(v).format('DD.MM.YYYY') : '—',
        },
    ];

    return (
        <Spin spinning={isLoading}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">

                {/* Фильтр по дате + экспорт */}
                <Space wrap>
                    <RangePicker
                        value={range}
                        onChange={(d) => setRange(d || [])}
                        format="DD.MM.YYYY"
                        allowClear={false}
                    />
                    <ExportTasksButton />
                </Space>

                {/* Карточки статистики */}
                <Row gutter={[12, 12]}>
                    <Col xs={12} sm={8} md={4}>
                        <StatCard title="Всего задач"   value={totals.total     ?? 0} icon={<UnorderedListOutlined />} />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                        <StatCard title="Выполнено"     value={totals.completed ?? 0} color="#52c41a" icon={<CheckCircleOutlined />} />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                        <StatCard title="В процессе"    value={totals.inProgress ?? 0} color="#1677ff" />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                        <StatCard title="Горячих"       value={totals.hot       ?? 0} color="#ff4d4f" icon={<FireOutlined />} />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                        <StatCard title="Часов (план)"  value={totals.totalHours ?? 0}  color="#722ed1" icon={<ClockCircleOutlined />} suffix="ч" />
                    </Col>
                    <Col xs={12} sm={8} md={4}>
                        <StatCard title="Часов (факт)"  value={totals.actualHours ?? 0} color="#13c2c2" icon={<ClockCircleOutlined />} suffix="ч" />
                    </Col>
                </Row>

                <Row gutter={16}>
                    {/* Прогресс выполнения */}
                    <Col xs={24} md={8}>
                        <Card title="Выполнение" size="small" style={{ height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
                                <DonutStat label="Выполнено"  done={totals.completed  ?? 0} total={totals.total ?? 0} color="#52c41a" />
                                <DonutStat label="В процессе" done={totals.inProgress ?? 0} total={totals.total ?? 0} color="#1677ff" />
                            </div>
                        </Card>
                    </Col>

                    {/* По типам */}
                    <Col xs={24} md={8}>
                        <Card title="По типам задач" size="small" style={{ height: '100%' }}>
                            {Object.entries(byType).length === 0 ? (
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных" />
                            ) : Object.entries(byType).map(([type, cnt]) => (
                                <div key={type} style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                        <Tag color={TYPE_COLOR[type]}>{TYPE_LABEL[type]}</Tag>
                                        <Text type="secondary">{cnt}</Text>
                                    </div>
                                    <Progress
                                        percent={totals.total > 0 ? Math.round(cnt / totals.total * 100) : 0}
                                        showInfo={false}
                                        strokeColor={TYPE_COLOR[type] === 'purple' ? '#722ed1'
                                            : TYPE_COLOR[type] === 'blue' ? '#1677ff'
                                            : TYPE_COLOR[type] === 'cyan' ? '#13c2c2' : '#52c41a'}
                                        size="small"
                                    />
                                </div>
                            ))}
                        </Card>
                    </Col>

                    {/* Мои воркеры */}
                    <Col xs={24} md={8}>
                        <Card title="Мои сотрудники" size="small" style={{ height: '100%' }}>
                            {workers.length === 0 ? (
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет назначений" />
                            ) : (
                                <List
                                    size="small"
                                    dataSource={workers}
                                    renderItem={(w) => (
                                        <List.Item style={{ padding: '6px 0' }}>
                                            <List.Item.Meta
                                                avatar={<Avatar icon={<UserOutlined />} size="small" />}
                                                title={<Text strong style={{ fontSize: 13 }}>{w.name}</Text>}
                                                description={
                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                        {w.taskCount} задач · {w.totalHours}ч
                                                    </Text>
                                                }
                                            />
                                        </List.Item>
                                    )}
                                />
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* Таблица задач */}
                <Card title="Список задач" size="small">
                    <Table
                        dataSource={tasks}
                        columns={taskColumns}
                        rowKey="_id"
                        size="small"
                        pagination={{ pageSize: 15, size: 'small' }}
                        locale={{ emptyText: 'Нет задач за выбранный период' }}
                    />
                </Card>

            </Space>
        </Spin>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Вкладка 2 — ОТЧЁТ ПО ВОРКЕРУ
// ═══════════════════════════════════════════════════════════════════════════════

const WorkerReportTab = () => {
    const [workerId,   setWorkerId]   = useState(null);
    const [calMonth,   setCalMonth]   = useState(dayjs());
    const [rangeMode,  setRangeMode]  = useState('month'); // 'month' | 'range'
    const [range,      setRange]      = useState([]);

    const { data: workers = [], isLoading: wLoading } = useQuery({
        queryKey: ['workers'],
        queryFn:  fetchWorkers,
    });

    const availParams = useMemo(() => {
        if (!workerId) return null;
        if (rangeMode === 'month') {
            return {
                workerId,
                startDate: calMonth.startOf('month').toISOString(),
                endDate:   calMonth.endOf('month').toISOString(),
            };
        }
        return {
            workerId,
            startDate: range[0]?.toISOString(),
            endDate:   range[1]?.toISOString(),
        };
    }, [workerId, rangeMode, calMonth, range]);

    const { data: availData, isLoading: availLoading } = useQuery({
        queryKey: ['worker-availability', availParams],
        queryFn:  () => fetchAvailability(availParams),
        enabled:  !!availParams,
    });

    const availability    = availData?.availability    ?? [];
    const assignedManagers = availData?.assignedByManagers ?? [];
    const worker          = availData?.worker;

    // Сводные метрики
    const totalBusyDays   = availability.filter((d) => d.date !== 'no_date' && d.totalEstimated >= 8).length;
    const totalFreeDays   = availability.filter((d) => d.date !== 'no_date' && d.totalEstimated === 0).length;
    const totalHours      = availability.reduce((s, d) => s + d.totalEstimated, 0);
    const totalTasks      = availability.reduce((s, d) => s + d.tasks.length, 0);

    // Задачи без даты
    const noDateTasks     = availability.find((d) => d.date === 'no_date');

    const detailColumns = [
        {
            title: 'Дата', dataIndex: 'date', key: 'date', width: 130,
            render: (v) => v === 'no_date' ? <Tag color="default">Без даты</Tag> : dayjs(v).format('DD.MM.YYYY (ddd)'),
            sorter: (a, b) => a.date.localeCompare(b.date),
        },
        {
            title: 'Занято', dataIndex: 'totalEstimated', key: 'total', width: 90, align: 'center',
            render: (v) => {
                const { text } = dayColor(v);
                return <span style={{ color: text, fontWeight: 600 }}>{v}ч</span>;
            },
        },
        {
            title: 'Свободно', dataIndex: 'freeHours', key: 'free', width: 90, align: 'center',
            render: (v) => <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{v}ч</span>,
        },
        {
            title: 'Загрузка', key: 'load', width: 120,
            render: (_, r) => (
                <Progress
                    percent={Math.min(100, Math.round(r.totalEstimated / 8 * 100))}
                    size="small"
                    strokeColor={r.isBusy ? '#ff4d4f' : r.totalEstimated > 4 ? '#fa8c16' : '#52c41a'}
                    showInfo={false}
                />
            ),
        },
        {
            title: 'Задачи', key: 'tasks',
            render: (_, row) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {row.tasks.map((t) => (
                        <Tooltip
                            key={t._id}
                            title={
                                <div>
                                    <div><b>{t.title}</b></div>
                                    <div>{STATUS_LABEL[t.status]} · {t.estimatedHours}ч</div>
                                    {t.assignedBy && <div>Назначил: {t.assignedBy.name}</div>}
                                                    {t.project && <div>📁 {t.project}</div>}
                                </div>
                            }
                        >
                            <Tag
                                color={t.isHot ? 'red' : TYPE_COLOR[t.type]}
                                style={{ cursor: 'default', marginBottom: 2 }}
                            >
                                {t.isHot && <FireOutlined />} {t.title.length > 18 ? t.title.slice(0, 18) + '…' : t.title}
                            </Tag>
                        </Tooltip>
                    ))}
                </div>
            ),
        },
    ];

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">

            {/* Фильтры */}
            <Card size="small">
                <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} sm={8}>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="Выберите сотрудника"
                            loading={wLoading}
                            options={workers.map((w) => ({ value: w._id, label: w.name }))}
                            onChange={setWorkerId}
                            value={workerId}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                        />
                    </Col>
                    <Col xs={24} sm={6}>
                        <Select
                            style={{ width: '100%' }}
                            value={rangeMode}
                            onChange={setRangeMode}
                            options={[
                                { value: 'month', label: 'По месяцу' },
                                { value: 'range', label: 'Произвольный период' },
                            ]}
                        />
                    </Col>
                    <Col xs={24} sm={10}>
                        {rangeMode === 'month' ? (
                            <DatePicker
                                picker="month"
                                value={calMonth}
                                onChange={(d) => d && setCalMonth(d)}
                                format="MMMM YYYY"
                                allowClear={false}
                                style={{ width: '100%' }}
                            />
                        ) : (
                            <RangePicker
                                value={range}
                                onChange={(d) => setRange(d || [])}
                                format="DD.MM.YYYY"
                                style={{ width: '100%' }}
                            />
                        )}
                    </Col>
                </Row>
            </Card>

            {!workerId ? (
                <Empty description="Выберите сотрудника для просмотра отчёта" />
            ) : (
                <Spin spinning={availLoading}>

                    {/* Информация о воркере + кто назначил задачи */}
                    {worker && (
                        <Row gutter={16}>
                            <Col xs={24} md={14}>
                                <Card size="small" title={
                                    <Space><UserOutlined /><span>{worker.name}</span><Text type="secondary" style={{ fontSize: 12 }}>{worker.email}</Text></Space>
                                }>
                                    <Row gutter={[12, 12]}>
                                        <Col span={6}>
                                            <Statistic title="Задач назначено" value={totalTasks} />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic title="Загружено часов" value={totalHours} suffix="ч" valueStyle={{ color: '#722ed1' }} />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic
                                                title="Полных дней"
                                                value={totalBusyDays}
                                                valueStyle={{ color: '#ff4d4f' }}
                                                suffix={<CalendarOutlined />}
                                            />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic
                                                title="Свободных дней"
                                                value={totalFreeDays}
                                                valueStyle={{ color: '#52c41a' }}
                                                suffix={<CalendarOutlined />}
                                            />
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>

                            <Col xs={24} md={10}>
                                <Card
                                    size="small"
                                    title={<Space><TeamOutlined />Кто назначил задачи</Space>}
                                    style={{ height: '100%' }}
                                >
                                    {assignedManagers.length === 0 ? (
                                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных" />
                                    ) : (
                                        <List
                                            size="small"
                                            dataSource={assignedManagers}
                                            renderItem={(m) => (
                                                <List.Item style={{ padding: '4px 0' }}>
                                                    <List.Item.Meta
                                                        avatar={<Avatar icon={<UserOutlined />} size="small" style={{ background: '#722ed1' }} />}
                                                        title={<Text strong style={{ fontSize: 13 }}>{m.name}</Text>}
                                                        description={
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                {m.taskCount} задач · {m.totalHours}ч
                                                            </Text>
                                                        }
                                                    />
                                                </List.Item>
                                            )}
                                        />
                                    )}
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Календарь (только в режиме "По месяцу") */}
                    {rangeMode === 'month' && availability.length > 0 && (
                        <Card
                            title={<Space><CalendarOutlined />{calMonth.format('MMMM YYYY')}</Space>}
                            size="small"
                        >
                            <WorkerCalendar
                                month={calMonth}
                                availData={availability.filter((d) => d.date !== 'no_date')}
                            />
                        </Card>
                    )}

                    {/* Задачи без даты */}
                    {noDateTasks && noDateTasks.tasks.length > 0 && (
                        <Card title="Задачи без даты" size="small">
                            {noDateTasks.tasks.map((t) => (
                                <Tag
                                    key={t._id}
                                    color={t.isHot ? 'red' : 'default'}
                                    style={{ marginBottom: 4 }}
                                >
                                    {t.isHot && <FireOutlined />} {t.title} ({t.estimatedHours}ч)
                                    {t.assignedBy ? ` · ${t.assignedBy.name}` : ''}
                                </Tag>
                            ))}
                        </Card>
                    )}

                    {/* Детальная таблица по датам */}
                    {availability.filter((d) => d.date !== 'no_date').length > 0 && (
                        <Card title="Детальная таблица по дням" size="small">
                            <Table
                                dataSource={availability.filter((d) => d.date !== 'no_date')}
                                columns={detailColumns}
                                rowKey="date"
                                size="small"
                                pagination={false}
                                rowClassName={(r) => r.isBusy ? 'ant-table-row-danger' : ''}
                            />
                        </Card>
                    )}

                    {workerId && !availLoading && availability.length === 0 && (
                        <Empty description="Нет задач за выбранный период" />
                    )}

                </Spin>
            )}
        </Space>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Главная страница
// ═══════════════════════════════════════════════════════════════════════════════

const ManagerWorkReportPage = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Title level={3} style={{ margin: 0 }}>
            <LineChartOutlined style={{ marginRight: 8 }} />
            Отчёт по работе
        </Title>

        <Tabs
            defaultActiveKey="my"
            items={[
                {
                    key:      'my',
                    label:    <Space><UserOutlined />Мой отчёт</Space>,
                    children: <MyReportTab />,
                },
                {
                    key:      'worker',
                    label:    <Space><TeamOutlined />Отчёт сотрудника</Space>,
                    children: <WorkerReportTab />,
                },
            ]}
        />
    </Space>
);

export default ManagerWorkReportPage;
