import React, { useMemo, useRef, useState } from 'react';
import {
    Alert,
    Button,
    Card,
    Col,
    DatePicker,
    Divider,
    Empty,
    Form,
    Progress,
    Row,
    Segmented,
    Select,
    Space,
    Spin,
    Statistic,
    Tag,
    Timeline,
    Tooltip,
    Typography,
    message,
} from 'antd';
import {
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    FileExcelOutlined,
    FilterOutlined,
    FolderOutlined,
    ReloadOutlined,
    PictureOutlined,
    RobotOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../../shared/api/apiClient';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DEFAULT_RANGE = [
    dayjs().subtract(90, 'day'),
    dayjs(),
];

const GRANULARITY_OPTIONS = [
    { label: 'День', value: 'daily' },
    { label: 'Неделя', value: 'weekly' },
    { label: 'Месяц', value: 'monthly' },
    { label: 'Год', value: 'yearly' },
];

const GRANULARITY_LABELS = {
    daily: 'дня',
    weekly: 'недели',
    monthly: 'месяца',
    yearly: 'года',
};

const formatWeekLabel = (bucket) => {
    if (!bucket) return 'Нет данных';
    return `${bucket.label} (${dayjs(bucket.startDate).format('DD.MM')} - ${dayjs(bucket.endDate).format('DD.MM')})`;
};

const AnalyticsPage = () => {
    const user = useSelector((state) => state.auth.user);
    const isAdmin = user?.role === 'admin';
    const [form] = Form.useForm();

    const [granularity, setGranularity] = useState('weekly');
    const [exportingAnalytics, setExportingAnalytics] = useState(false);
    const [generatingAi, setGeneratingAi] = useState(false);
    const performanceChartRef = useRef(null);
    const testingChartRef = useRef(null);
    const [filters, setFilters] = useState({
        startDate: DEFAULT_RANGE[0].format('YYYY-MM-DD'),
        endDate: DEFAULT_RANGE[1].format('YYYY-MM-DD'),
        userId: null,
    });

    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['users-list'],
        queryFn: async () => {
            const { data } = await apiClient.get('/auth/users');
            return data.data.users;
        },
        enabled: isAdmin,
    });

    const {
        data: analytics,
        isLoading: analyticsLoading,
        isFetching: analyticsFetching,
        refetch,
    } = useQuery({
        queryKey: ['analytics-report', filters],
        queryFn: async () => {
            const params = new URLSearchParams({
                startDate: filters.startDate,
                endDate: filters.endDate,
            });

            if (filters.userId) {
                params.set('userId', filters.userId);
            }

            const { data } = await apiClient.get(`/reports/analytics?${params.toString()}`);
            return data.data;
        },
    });

    const {
        data: aiInsights,
        isLoading: aiInsightsLoading,
        refetch: refetchAiInsights,
    } = useQuery({
        queryKey: ['analytics-ai-insights', filters],
        queryFn: async () => {
            const params = new URLSearchParams({
                startDate: filters.startDate,
                endDate: filters.endDate,
                limit: '8',
            });

            if (filters.userId) {
                params.set('userId', filters.userId);
            }

            const { data } = await apiClient.get(`/reports/insights?${params.toString()}`);
            return data.data.insights;
        },
    });

    const buckets = useMemo(() => analytics?.[granularity] || [], [analytics, granularity]);

    const performanceChartOption = useMemo(() => {
        if (!buckets.length) return null;

        return {
            tooltip: { trigger: 'axis' },
            legend: {
                data: ['Все задачи', 'Решено', 'Часы'],
                top: 6,
            },
            grid: {
                left: 36,
                right: 28,
                top: 46,
                bottom: 64,
            },
            xAxis: {
                type: 'category',
                data: buckets.map((item) => item.label),
                axisLabel: {
                    rotate: buckets.length > 12 ? 35 : 0,
                },
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Задачи',
                },
                {
                    type: 'value',
                    name: 'Часы',
                },
            ],
            series: [
                {
                    name: 'Все задачи',
                    type: 'bar',
                    barMaxWidth: 32,
                    data: buckets.map((item) => item.totalTasks),
                    itemStyle: { color: '#6c8ef5' },
                },
                {
                    name: 'Решено',
                    type: 'bar',
                    barMaxWidth: 32,
                    data: buckets.map((item) => item.completedTasks),
                    itemStyle: { color: '#27ae60' },
                },
                {
                    name: 'Часы',
                    type: 'line',
                    yAxisIndex: 1,
                    smooth: true,
                    symbolSize: 7,
                    data: buckets.map((item) => item.totalHours),
                    lineStyle: { width: 3, color: '#ff9f43' },
                    itemStyle: { color: '#ff9f43' },
                },
            ],
        };
    }, [buckets]);

    const testingStatusChartOption = useMemo(() => {
        if (!buckets.length) return null;

        return {
            tooltip: { trigger: 'axis' },
            legend: {
                data: ['Не рассмотрено', 'В тесте', 'Завершено'],
                top: 6,
            },
            grid: {
                left: 36,
                right: 24,
                top: 46,
                bottom: 64,
            },
            xAxis: {
                type: 'category',
                data: buckets.map((item) => item.label),
                axisLabel: {
                    rotate: buckets.length > 12 ? 35 : 0,
                },
            },
            yAxis: {
                type: 'value',
                name: 'Задачи',
            },
            series: [
                {
                    name: 'Не рассмотрено',
                    type: 'bar',
                    stack: 'testing',
                    barMaxWidth: 34,
                    data: buckets.map((item) => item.testingNotReviewed),
                    itemStyle: { color: '#95a5a6' },
                },
                {
                    name: 'В тесте',
                    type: 'bar',
                    stack: 'testing',
                    barMaxWidth: 34,
                    data: buckets.map((item) => item.testingInProgress),
                    itemStyle: { color: '#f1c40f' },
                },
                {
                    name: 'Завершено',
                    type: 'bar',
                    stack: 'testing',
                    barMaxWidth: 34,
                    data: buckets.map((item) => item.testingCompleted),
                    itemStyle: { color: '#2ecc71' },
                },
            ],
        };
    }, [buckets]);

    const onFilterSubmit = (values) => {
        const [start, end] = values.dateRange;

        setFilters({
            startDate: start.format('YYYY-MM-DD'),
            endDate: end.format('YYYY-MM-DD'),
            userId: values.userId || null,
        });
    };

    const weeklyInsights = analytics?.weeklyInsights;

    const recommendations = useMemo(() => {
        if (!analytics?.overview?.totalTasks) {
            return {
                score: 0,
                scoreColor: 'default',
                trendText: 'Недостаточно данных',
                trendColor: 'default',
                items: [
                    {
                        type: 'info',
                        title: 'Советы появятся после накопления задач',
                        description: 'Добавьте задачи за выбранный период, чтобы система оценила темп и дала рекомендации.',
                    },
                ],
            };
        }

        const totalTasks = analytics.overview.totalTasks || 0;
        const completionRate = Number(analytics.overview.completionRate || 0);
        const testingCompleted = analytics.overview.testingCompleted || 0;
        const testingInProgress = analytics.overview.testingInProgress || 0;
        const testingNotReviewed = analytics.overview.testingNotReviewed || 0;
        const testingCoverage = totalTasks ? (testingCompleted / totalTasks) * 100 : 0;
        const testingBacklog = testingInProgress + testingNotReviewed;

        const nonEmptyBuckets = buckets.filter((bucket) => bucket.totalTasks > 0);
        const latestBucket = nonEmptyBuckets[nonEmptyBuckets.length - 1];
        const previousBucket = nonEmptyBuckets.length > 1 ? nonEmptyBuckets[nonEmptyBuckets.length - 2] : null;

        const resolvedDelta = previousBucket
            ? latestBucket.completedTasks - previousBucket.completedTasks
            : 0;

        const completionDelta = previousBucket
            ? Number((latestBucket.completionRate - previousBucket.completionRate).toFixed(2))
            : 0;

        let score = 0;
        score += completionRate >= 75 ? 40 : completionRate >= 60 ? 30 : completionRate >= 45 ? 20 : 10;
        score += testingCoverage >= 70 ? 30 : testingCoverage >= 45 ? 20 : 10;
        score += resolvedDelta > 0 ? 20 : resolvedDelta === 0 ? 12 : 5;
        score += testingBacklog <= Math.ceil(totalTasks * 0.2) ? 10 : testingBacklog <= Math.ceil(totalTasks * 0.4) ? 7 : 3;
        score = Math.max(0, Math.min(100, Math.round(score)));

        const scoreColor = score >= 75 ? 'success' : score >= 50 ? 'gold' : 'error';
        const trendText = previousBucket
            ? resolvedDelta > 0
                ? 'Проект растет по темпу выполнения'
                : resolvedDelta < 0
                    ? 'Темп проекта снижается'
                    : 'Темп проекта стабилен'
            : 'Нужно минимум 2 периода для оценки тренда';
        const trendColor = previousBucket
            ? resolvedDelta > 0
                ? 'success'
                : resolvedDelta < 0
                    ? 'error'
                    : 'processing'
            : 'default';

        const items = [];

        if (previousBucket) {
            items.push({
                type: resolvedDelta >= 0 ? 'success' : 'warning',
                title: `Динамика за последние 2 ${GRANULARITY_LABELS[granularity]}`,
                description: `Изменение решенных задач: ${resolvedDelta >= 0 ? '+' : ''}${resolvedDelta}. Изменение конверсии: ${completionDelta >= 0 ? '+' : ''}${completionDelta}%.`,
            });
        }

        if (completionRate < 55) {
            items.push({
                type: 'warning',
                title: 'Низкая успеваемость по закрытию задач',
                description: `Сейчас завершено ${completionRate.toFixed(1)}%. Цель: минимум 60%. Рекомендация: дробить большие задачи на этапы и закрывать их в конце каждого периода.`,
            });
        } else {
            items.push({
                type: 'success',
                title: 'Хороший уровень выполнения задач',
                description: `Текущий показатель закрытия: ${completionRate.toFixed(1)}%. Продолжайте в том же темпе.`,
            });
        }

        if (testingBacklog > Math.ceil(totalTasks * 0.4)) {
            items.push({
                type: 'error',
                title: 'Есть риск по тестированию',
                description: `В тестировании или без рассмотрения: ${testingBacklog} из ${totalTasks} задач. Рекомендация: фиксировать слот на тест каждый день.`,
            });
        } else if (testingBacklog > 0) {
            items.push({
                type: 'warning',
                title: 'Тестирование требует внимания',
                description: `Незавершенное тестирование: ${testingBacklog} задач. Стоит закрыть их до следующего отчетного периода.`,
            });
        } else {
            items.push({
                type: 'success',
                title: 'Тестирование в порядке',
                description: 'Бэклог по тестированию отсутствует. Это хороший сигнал стабильности проекта.',
            });
        }

        return {
            score,
            scoreColor,
            trendText,
            trendColor,
            items,
        };
    }, [analytics, buckets, granularity]);

    const projectStats = analytics?.projectStats || [];

    const projectChartRef = useRef(null);

    const projectChartOption = useMemo(() => {
        if (!projectStats.length) return null;

        const names = projectStats.map((p) => p.projectName);
        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
            },
            legend: {
                data: ['Выполнено', 'В процессе', 'Не выполнено'],
                top: 6,
            },
            grid: {
                left: 160,
                right: 30,
                top: 46,
                bottom: 20,
            },
            xAxis: { type: 'value', name: 'Задачи' },
            yAxis: {
                type: 'category',
                data: names,
                axisLabel: {
                    width: 140,
                    overflow: 'truncate',
                },
            },
            series: [
                {
                    name: 'Выполнено',
                    type: 'bar',
                    stack: 'tasks',
                    barMaxWidth: 28,
                    data: projectStats.map((p) => p.completedTasks),
                    itemStyle: { color: '#27ae60' },
                    label: {
                        show: true,
                        position: 'inside',
                        formatter: (params) => params.value > 0 ? params.value : '',
                    },
                },
                {
                    name: 'В процессе',
                    type: 'bar',
                    stack: 'tasks',
                    barMaxWidth: 28,
                    data: projectStats.map((p) => p.pendingTasks),
                    itemStyle: { color: '#6c8ef5' },
                    label: {
                        show: true,
                        position: 'inside',
                        formatter: (params) => params.value > 0 ? params.value : '',
                    },
                },
                {
                    name: 'Не выполнено',
                    type: 'bar',
                    stack: 'tasks',
                    barMaxWidth: 28,
                    data: projectStats.map((p) => p.failedTasks),
                    itemStyle: { color: '#e74c3c' },
                    label: {
                        show: true,
                        position: 'inside',
                        formatter: (params) => params.value > 0 ? params.value : '',
                    },
                },
            ],
        };
    }, [projectStats]);

    const exportAnalyticsExcel = async () => {
        try {
            setExportingAnalytics(true);
            const params = new URLSearchParams({
                startDate: filters.startDate,
                endDate: filters.endDate,
            });

            if (filters.userId) {
                params.set('userId', filters.userId);
            }

            const response = await apiClient.get(`/reports/analytics/export?${params.toString()}`, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const filename = `analytics-report-${filters.startDate}-${filters.endDate}.xlsx`;

            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            message.success('Аналитика успешно экспортирована в Excel');
        } catch {
            message.error('Не удалось экспортировать аналитику');
        } finally {
            setExportingAnalytics(false);
        }
    };

    const shortenInsight = (text, maxLength = 220) => {
        if (!text) return '';
        return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    };

    const generateAiInsight = async (forceRefresh = false) => {
        try {
            setGeneratingAi(true);
            const payload = {
                startDate: filters.startDate,
                endDate: filters.endDate,
                forceRefresh,
            };

            if (filters.userId) {
                payload.userId = filters.userId;
            }

            const { data } = await apiClient.post('/reports/insights/generate', payload);
            const reused = data?.data?.reused;
            message.success(reused ? 'Загружен сохраненный AI-анализ из базы' : 'AI-анализ сгенерирован и сохранен');
            await refetchAiInsights();
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Не удалось получить AI-анализ';
            message.error(errorMessage);
        } finally {
            setGeneratingAi(false);
        }
    };

    const markdownComponents = {
        h2: ({ ...props }) => (
            <Title level={4} style={{ marginTop: 18, marginBottom: 10 }} {...props} />
        ),
        h3: ({ ...props }) => (
            <Title level={5} style={{ marginTop: 14, marginBottom: 8 }} {...props} />
        ),
        p: ({ ...props }) => (
            <Text style={{ display: 'block', lineHeight: 1.75, marginBottom: 10 }} {...props} />
        ),
        ul: ({ ...props }) => (
            <ul style={{ marginTop: 6, marginBottom: 12, paddingInlineStart: 20 }} {...props} />
        ),
        li: ({ ...props }) => (
            <li style={{ marginBottom: 6, lineHeight: 1.7 }} {...props} />
        ),
        strong: ({ ...props }) => (
            <strong style={{ color: '#102a43' }} {...props} />
        ),
    };

    const downloadImage = (dataUrl, filename) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const exportChartsAsPng = () => {
        const performanceChart = performanceChartRef.current?.getEchartsInstance();
        const testingChart = testingChartRef.current?.getEchartsInstance();

        if (!performanceChart && !testingChart) {
            message.info('Сначала загрузите графики для экспорта');
            return;
        }

        if (performanceChart) {
            const dataUrl = performanceChart.getDataURL({
                pixelRatio: 2,
                backgroundColor: '#ffffff',
            });
            downloadImage(dataUrl, `analytics-performance-${filters.startDate}-${filters.endDate}.png`);
        }

        if (testingChart) {
            const dataUrl = testingChart.getDataURL({
                pixelRatio: 2,
                backgroundColor: '#ffffff',
            });
            downloadImage(dataUrl, `analytics-testing-${filters.startDate}-${filters.endDate}.png`);
        }

        message.success('Графики скачаны в PNG');
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Title level={2} style={{ margin: 0 }}>Аналитика задач</Title>
                <Space>
                    <Button
                        icon={<FileExcelOutlined />}
                        type="primary"
                        onClick={exportAnalyticsExcel}
                        loading={exportingAnalytics}
                        style={{ backgroundColor: '#217346' }}
                    >
                        Скачать Excel
                    </Button>
                    <Button icon={<PictureOutlined />} onClick={exportChartsAsPng}>
                        Скачать графики PNG
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={analyticsFetching}>
                        Обновить
                    </Button>
                </Space>
            </div>

            <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Form
                    form={form}
                    layout="inline"
                    onFinish={onFilterSubmit}
                    initialValues={{
                        dateRange: DEFAULT_RANGE,
                        userId: null,
                    }}
                >
                    <Form.Item name="dateRange" label="Период" rules={[{ required: true, message: 'Выберите период' }]}>
                        <RangePicker />
                    </Form.Item>

                    {isAdmin && (
                        <Form.Item name="userId" label="Сотрудник" style={{ minWidth: 220 }}>
                            <Select placeholder="Все сотрудники" allowClear loading={usersLoading}>
                                {users?.map((u) => (
                                    <Select.Option key={u._id} value={u._id}>
                                        {u.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}

                    <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
                            Применить
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            {analyticsLoading ? (
                <Card>
                    <div style={{ minHeight: 220, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Spin size="large" />
                    </div>
                </Card>
            ) : (
                <>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={6}>
                            <Card>
                                <Statistic
                                    title="Всего часов"
                                    value={analytics?.overview?.totalHours || 0}
                                    prefix={<ClockCircleOutlined />}
                                    suffix="ч"
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card>
                                <Statistic
                                    title="Всего задач"
                                    value={analytics?.overview?.totalTasks || 0}
                                    prefix={<CalendarOutlined />}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card>
                                <Statistic
                                    title="Решено"
                                    value={analytics?.overview?.completedTasks || 0}
                                    prefix={<CheckCircleOutlined />}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card>
                                <Statistic
                                    title="Конверсия"
                                    value={analytics?.overview?.completionRate || 0}
                                    precision={1}
                                    suffix="%"
                                />
                            </Card>
                        </Col>
                    </Row>

                    <Card title="Советы по успеваемости и росту проекта">
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Space wrap>
                                <Tag color={recommendations.scoreColor}>
                                    Индекс эффективности: {recommendations.score}/100
                                </Tag>
                                <Tag color={recommendations.trendColor}>
                                    {recommendations.trendText}
                                </Tag>
                            </Space>
                            {recommendations.items.map((item, index) => (
                                <Alert
                                    key={`${item.title}-${index}`}
                                    type={item.type}
                                    showIcon
                                    message={item.title}
                                    description={item.description}
                                />
                            ))}
                        </Space>
                    </Card>

                    <Card
                        title={(
                            <Space>
                                <RobotOutlined />
                                <span>AI-консультант проекта</span>
                            </Space>
                        )}
                        extra={(
                            <Space>
                                <Button onClick={() => generateAiInsight(false)} loading={generatingAi}>
                                    Получить совет
                                </Button>
                                <Button type="primary" onClick={() => generateAiInsight(true)} loading={generatingAi}>
                                    Пересчитать AI
                                </Button>
                            </Space>
                        )}
                        style={{
                            border: '1px solid #dbe7ff',
                            background: 'linear-gradient(135deg, #f4f8ff 0%, #ffffff 55%)',
                        }}
                    >
                        {aiInsightsLoading ? (
                            <div style={{ minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Spin />
                            </div>
                        ) : !aiInsights?.length ? (
                            <Empty description="AI-анализ пока не создан">
                                <Button type="primary" onClick={() => generateAiInsight(false)} loading={generatingAi}>
                                    Сгенерировать первый анализ
                                </Button>
                            </Empty>
                        ) : (
                            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                <div style={{ border: '1px solid #dbe7ff', borderRadius: 10, background: '#ffffff', padding: 14 }}>
                                    <Space wrap style={{ marginBottom: 10 }}>
                                        <Tag color="blue">Источник: HuggingFace</Tag>
                                        <Tag color="purple">
                                            Сохранено: {dayjs(aiInsights[0].createdAt).format('YYYY-MM-DD HH:mm')}
                                        </Tag>
                                        {aiInsights[0].userId?.name && (
                                            <Tag color="geekblue">Сотрудник: {aiInsights[0].userId.name}</Tag>
                                        )}
                                    </Space>
                                    <div
                                        style={{
                                            border: '1px solid #eef3ff',
                                            borderRadius: 10,
                                            background: '#fdfdff',
                                            padding: 16,
                                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
                                        }}
                                    >
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={markdownComponents}
                                        >
                                            {aiInsights[0].aiSummary || ''}
                                        </ReactMarkdown>
                                    </div>
                                </div>

                                {aiInsights.length > 1 && (
                                    <Card size="small" title="История AI-анализов">
                                        <Timeline
                                            items={aiInsights.slice(1, 6).map((insight) => ({
                                                color: 'blue',
                                                children: (
                                                    <Space direction="vertical" size={2}>
                                                        <Text strong>{dayjs(insight.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
                                                        <Text type="secondary">{shortenInsight(insight.aiSummary)}</Text>
                                                    </Space>
                                                ),
                                            }))}
                                        />
                                    </Card>
                                )}
                            </Space>
                        )}
                    </Card>

                    <Card
                        title="Динамика задач и часов"
                        extra={(
                            <Segmented
                                value={granularity}
                                options={GRANULARITY_OPTIONS}
                                onChange={setGranularity}
                            />
                        )}
                    >
                        {performanceChartOption ? (
                            <ReactECharts ref={performanceChartRef} option={performanceChartOption} style={{ height: 380 }} />
                        ) : (
                            <Empty description="Нет данных за выбранный период" />
                        )}
                    </Card>

                    <Card title="Статусы тестирования">
                        {testingStatusChartOption ? (
                            <ReactECharts ref={testingChartRef} option={testingStatusChartOption} style={{ height: 340 }} />
                        ) : (
                            <Empty description="Нет данных по тестированию" />
                        )}
                    </Card>

                    <Card
                        title={(
                            <Space>
                                <FolderOutlined style={{ color: '#faad14' }} />
                                <span>Прогресс по проектам</span>
                            </Space>
                        )}
                        extra={
                            projectStats.length > 0 && (
                                <Tag color="blue">{projectStats.length} проект(ов)</Tag>
                            )
                        }
                    >
                        {!projectStats.length ? (
                            <Empty description="Нет данных по проектам за выбранный период" />
                        ) : (
                            <Space direction="vertical" style={{ width: '100%' }} size={16}>
                                <ReactECharts
                                    ref={projectChartRef}
                                    option={projectChartOption}
                                    style={{ height: Math.max(200, projectStats.length * 52 + 80) }}
                                />
                                <Divider style={{ margin: '8px 0' }} />
                                {projectStats.map((p) => (
                                    <div key={p.projectId || p.projectName}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Space>
                                                <FolderOutlined style={{ color: '#faad14' }} />
                                                <Text strong>{p.projectName}</Text>
                                                <Tag color="blue">{p.totalTasks} задач</Tag>
                                                <Tag color="gold">{p.totalHours} ч</Tag>
                                            </Space>
                                            <Text strong style={{ color: p.completionRate >= 75 ? '#27ae60' : p.completionRate >= 40 ? '#f39c12' : '#e74c3c' }}>
                                                {p.completionRate}%
                                            </Text>
                                        </div>
                                        <Tooltip title={`Выполнено: ${p.completedTasks} / В процессе: ${p.pendingTasks} / Не выполнено: ${p.failedTasks}`}>
                                            <Progress
                                                percent={p.completionRate}
                                                success={{ percent: p.completionRate, strokeColor: '#27ae60' }}
                                                trailColor={p.failedTasks > 0 ? '#ffe0de' : '#f0f0f0'}
                                                showInfo={false}
                                                strokeWidth={10}
                                            />
                                        </Tooltip>
                                    </div>
                                ))}
                            </Space>
                        )}
                    </Card>

                    <Card title="Сравнение недель">
                        {!weeklyInsights?.bestWeek ? (
                            <Alert
                                type="info"
                                showIcon
                                message="Недостаточно данных для сравнения недель"
                                description="Добавьте задачи за несколько недель, чтобы увидеть лучшую и слабую недели."
                            />
                        ) : (
                            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                <Row gutter={[16, 16]}>
                                    <Col xs={24} md={12}>
                                        <Card size="small" style={{ borderColor: '#27ae60' }}>
                                            <Space direction="vertical">
                                                <Text strong>Лучшая неделя</Text>
                                                <Tag color="success">{formatWeekLabel(weeklyInsights.bestWeek)}</Tag>
                                                <Text>Решено задач: <Text strong>{weeklyInsights.bestWeek.completedTasks}</Text></Text>
                                                <Text>Часы: <Text strong>{weeklyInsights.bestWeek.totalHours}</Text></Text>
                                            </Space>
                                        </Card>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Card size="small" style={{ borderColor: '#e67e22' }}>
                                            <Space direction="vertical">
                                                <Text strong>Слабая неделя</Text>
                                                <Tag color="warning">{formatWeekLabel(weeklyInsights.worstWeek)}</Tag>
                                                <Text>Решено задач: <Text strong>{weeklyInsights.worstWeek.completedTasks}</Text></Text>
                                                <Text>Часы: <Text strong>{weeklyInsights.worstWeek.totalHours}</Text></Text>
                                            </Space>
                                        </Card>
                                    </Col>
                                </Row>

                                <Card size="small" style={{ background: '#f9fbff' }}>
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <Text>
                                            За выбранный период решено задач: <Text strong>{weeklyInsights.totalResolvedTasks}</Text>
                                        </Text>
                                        {weeklyInsights.latestVsPrevious && (
                                            <Text>
                                                Текущая неделя vs предыдущая:
                                                <Tag color={weeklyInsights.latestVsPrevious.deltaResolvedTasks >= 0 ? 'success' : 'error'} style={{ marginInlineStart: 8 }}>
                                                    {weeklyInsights.latestVsPrevious.deltaResolvedTasks >= 0 ? '+' : ''}
                                                    {weeklyInsights.latestVsPrevious.deltaResolvedTasks} задач
                                                </Tag>
                                                <Tag color={weeklyInsights.latestVsPrevious.deltaHours >= 0 ? 'processing' : 'warning'}>
                                                    {weeklyInsights.latestVsPrevious.deltaHours >= 0 ? '+' : ''}
                                                    {weeklyInsights.latestVsPrevious.deltaHours} ч
                                                </Tag>
                                            </Text>
                                        )}
                                    </Space>
                                </Card>
                            </Space>
                        )}
                    </Card>
                </>
            )}
        </Space>
    );
};

export default AnalyticsPage;
