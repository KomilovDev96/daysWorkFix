import React, { useMemo, useState } from 'react';
import {
    Button,
    Card,
    DatePicker,
    Empty,
    Form,
    Input,
    Select,
    Space,
    Spin,
    Tag,
    Typography,
    message,
} from 'antd';
import {
    DownloadOutlined,
    MessageOutlined,
    RobotOutlined,
    SendOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSelector } from 'react-redux';
import apiClient from '../../shared/api/apiClient';

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Title, Text } = Typography;

const INITIAL_RANGE = [dayjs().subtract(90, 'day'), dayjs()];

const QUICK_QUESTIONS = [
    'Дай сводку проекта за выбранный период',
    'Какая разница между последними неделями?',
    'Где основные риски по тестированию?',
    'Что сделать, чтобы повысить успеваемость?',
    'Сделай выгрузку отчета в Excel',
];

const markdownComponents = {
    h2: ({ ...props }) => (
        <Title level={5} style={{ marginTop: 8, marginBottom: 8 }} {...props} />
    ),
    p: ({ ...props }) => (
        <Text style={{ display: 'block', lineHeight: 1.7, marginBottom: 8 }} {...props} />
    ),
    ul: ({ ...props }) => (
        <ul style={{ margin: '8px 0 10px', paddingInlineStart: 18 }} {...props} />
    ),
    li: ({ ...props }) => (
        <li style={{ marginBottom: 4, lineHeight: 1.6 }} {...props} />
    ),
};

const AssistantPage = () => {
    const [form] = Form.useForm();
    const user = useSelector((state) => state.auth.user);
    const isAdmin = user?.role === 'admin';

    const [filters, setFilters] = useState({
        startDate: INITIAL_RANGE[0].format('YYYY-MM-DD'),
        endDate: INITIAL_RANGE[1].format('YYYY-MM-DD'),
        userId: null,
    });
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            role: 'assistant',
            text: '## Ответ\nЯ AI-ассистент проекта. Отвечаю только по данным вашей базы.\n\n## Ключевые метрики\n- Используйте фильтры периода выше.\n\n## Что делать дальше\n- Задайте вопрос или выберите быстрый вариант ниже.',
            createdAt: new Date().toISOString(),
            downloads: [],
            usedModel: null,
        },
    ]);

    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['users-list'],
        queryFn: async () => {
            const { data } = await apiClient.get('/auth/users');
            return data.data.users;
        },
        enabled: isAdmin,
    });

    const submitFilters = (values) => {
        const [start, end] = values.dateRange;
        setFilters({
            startDate: start.format('YYYY-MM-DD'),
            endDate: end.format('YYYY-MM-DD'),
            userId: values.userId || null,
        });
        message.success('Фильтр ассистента обновлен');
    };

    const downloadByEndpoint = async (action) => {
        try {
            const response = await apiClient.get(action.endpoint, { responseType: 'blob' });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            const filename = action.filename || 'report.xlsx';
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            message.success(`Файл "${filename}" скачан`);
        } catch (error) {
            message.error(error.response?.data?.message || 'Не удалось скачать файл');
        }
    };

    const historyPayload = useMemo(() => (
        messages
            .filter((item) => item.id !== 'welcome')
            .slice(-8)
            .map((item) => ({
                role: item.role,
                content: item.text,
            }))
    ), [messages]);

    const askAssistant = async (question) => {
        const cleanQuestion = String(question || '').trim();
        if (!cleanQuestion || sending) return;

        const userMessage = {
            id: `${Date.now()}-user`,
            role: 'user',
            text: cleanQuestion,
            createdAt: new Date().toISOString(),
            downloads: [],
            usedModel: null,
        };

        setMessages((prev) => [...prev, userMessage]);
        setDraft('');
        setSending(true);

        try {
            const payload = {
                message: cleanQuestion,
                startDate: filters.startDate,
                endDate: filters.endDate,
                history: historyPayload,
            };
            if (filters.userId) payload.userId = filters.userId;

            const { data } = await apiClient.post('/assistant/chat', payload);
            const assistantData = data.data;

            setMessages((prev) => [
                ...prev,
                {
                    id: `${Date.now()}-assistant`,
                    role: 'assistant',
                    text: assistantData.answer,
                    createdAt: new Date().toISOString(),
                    downloads: assistantData.downloads || [],
                    usedModel: assistantData.usedModel || null,
                },
            ]);
        } catch (error) {
            message.error(error.response?.data?.message || 'Не удалось получить ответ ассистента');
            setMessages((prev) => [
                ...prev,
                {
                    id: `${Date.now()}-assistant-error`,
                    role: 'assistant',
                    text: '## Ответ\nНе удалось обработать запрос.\n\n## Ключевые метрики\n- Ошибка соединения с AI сервисом.\n\n## Что делать дальше\n- Проверьте backend и попробуйте еще раз.',
                    createdAt: new Date().toISOString(),
                    downloads: [],
                    usedModel: null,
                },
            ]);
        } finally {
            setSending(false);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Title level={2} style={{ margin: 0 }}>
                    <RobotOutlined /> AI Ассистент проекта
                </Title>
                <Tag color="blue">
                    Работает только по данным вашей базы
                </Tag>
            </div>

            <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Form
                    form={form}
                    layout="inline"
                    onFinish={submitFilters}
                    initialValues={{
                        dateRange: INITIAL_RANGE,
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
                        <Button type="primary" htmlType="submit">
                            Применить фильтр
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            <Card
                title={(
                    <Space>
                        <MessageOutlined />
                        <span>Чат</span>
                    </Space>
                )}
                styles={{
                    body: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    },
                }}
            >
                {!messages.length ? (
                    <Empty description="Сообщений пока нет" />
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                minWidth: '38%',
                                background: msg.role === 'user' ? '#1677ff' : '#f6f9ff',
                                color: msg.role === 'user' ? '#ffffff' : '#1f2d3d',
                                border: msg.role === 'user' ? 'none' : '1px solid #dce9ff',
                                borderRadius: 12,
                                padding: 14,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            }}
                        >
                            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                    {msg.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}
                                    <Text style={{ color: msg.role === 'user' ? '#dce9ff' : '#4f5d75', fontSize: 12 }}>
                                        {msg.role === 'assistant' ? 'Ассистент' : 'Вы'}
                                    </Text>
                                </Space>
                                <Text style={{ color: msg.role === 'user' ? '#dce9ff' : '#4f5d75', fontSize: 11 }}>
                                    {dayjs(msg.createdAt).format('HH:mm')}
                                </Text>
                            </div>

                            {msg.role === 'assistant' ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                    {msg.text}
                                </ReactMarkdown>
                            ) : (
                                <Text style={{ color: '#ffffff', lineHeight: 1.7 }}>{msg.text}</Text>
                            )}

                            {msg.role === 'assistant' && msg.downloads?.length > 0 && (
                                <Space wrap style={{ marginTop: 10 }}>
                                    {msg.downloads.map((action) => (
                                        <Button
                                            key={`${msg.id}-${action.type}`}
                                            icon={<DownloadOutlined />}
                                            onClick={() => downloadByEndpoint(action)}
                                        >
                                            {action.label}
                                        </Button>
                                    ))}
                                </Space>
                            )}

                            {msg.role === 'assistant' && msg.usedModel && (
                                <Tag color="purple" style={{ marginTop: 10 }}>
                                    model: {msg.usedModel}
                                </Tag>
                            )}
                        </div>
                    ))
                )}

                <Card
                    size="small"
                    title="Быстрые вопросы"
                    styles={{ body: { display: 'flex', flexWrap: 'wrap', gap: 8 } }}
                >
                    {QUICK_QUESTIONS.map((question) => (
                        <Button key={question} onClick={() => askAssistant(question)} disabled={sending}>
                            {question}
                        </Button>
                    ))}
                </Card>

                <Space.Compact direction="vertical" style={{ width: '100%' }}>
                    <TextArea
                        rows={4}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Напишите вопрос по проекту. Ассистент отвечает только по данным базы..."
                        onPressEnter={(e) => {
                            if (!e.shiftKey) {
                                e.preventDefault();
                                askAssistant(draft);
                            }
                        }}
                    />
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary">Enter отправит сообщение, Shift+Enter — новая строка</Text>
                        <Button
                            type="primary"
                            icon={sending ? <Spin size="small" /> : <SendOutlined />}
                            onClick={() => askAssistant(draft)}
                            loading={sending}
                        >
                            Отправить
                        </Button>
                    </div>
                </Space.Compact>
            </Card>
        </Space>
    );
};

export default AssistantPage;
