import React, { useState, useMemo } from 'react';
import {
    Typography, Card, Input, Tag, Space, Button, message, Anchor, Row, Col, Divider, Tooltip,
} from 'antd';
import {
    SearchOutlined, CopyOutlined, RobotOutlined, MessageOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ─────────────────────────────────────────────────────────────────────────────
// Контент справочника
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
    {
        id: 'greetings',
        icon: '👋',
        title: 'Приветствие и общение',
        intro: 'Бот понимает обычные слова — здоровайся как с человеком.',
        items: [
            { text: 'привет',  hint: 'Друг­же­лю­бный ответ + подсказки что писать дальше' },
            { text: 'здарова', hint: 'То же самое, неформально' },
            { text: 'салом',   hint: 'Узбекское приветствие' },
            { text: 'доброе утро', hint: 'Понимает варианты «утра/день/вечер»' },
            { text: 'hello',   hint: 'И английский тоже' },
            { text: 'спасибо', hint: 'Ответит «всегда пожалуйста»' },
        ],
    },
    {
        id: 'tasks-basic',
        icon: '📌',
        title: 'Запись задач — основа',
        intro: 'Просто напиши свободным текстом что сделал. Бот сам разберёт.',
        items: [
            {
                text: 'сделал верстку Dashboard 2ч',
                hint: 'Простейшая форма: глагол + что + сколько часов',
            },
            {
                text: 'починил баг логина 30 мин',
                hint: '«минуты» бот переведёт в десятичные часы (0.5)',
            },
            {
                text: 'выполнил отчёт 3ч заказчик Амир',
                hint: 'Указал заказчика прямо в тексте — бот его подхватит',
            },
            {
                text: 'настроил CI/CD полчаса проект SmartSpace',
                hint: '«полчаса» = 0.5ч, плюс проект',
            },
        ],
    },
    {
        id: 'tasks-quotes',
        icon: '🔤',
        title: 'Точное название и подробности',
        intro: 'Хочешь чтобы бот не упрощал? Используй кавычки для названия. Длинные тексты (>30 символов) сохраняются как написал, слово в слово.',
        items: [
            {
                text: 'сделал "Починка авторизации" 1ч, токен протухал, перевыпускал через refresh',
                hint: 'В кавычках → точный title; остальное → description как ты написал',
            },
            {
                text: '«Релиз mobile v2.3» 4ч, собрал TestFlight, прошли smoke-тесты, отправил на ревью Apple',
                hint: 'Русские «кавычки» тоже работают',
            },
            {
                text: '2 часа делал дашборд для Амира, подключал charts, фиксил адаптив на iPad, добавил темную тему',
                hint: 'Длинное сообщение без кавычек — описание сохраняется целиком',
            },
        ],
    },
    {
        id: 'tasks-dates',
        icon: '📅',
        title: 'Прошлые и будущие даты',
        intro: 'Можно писать задним числом или планировать наперёд.',
        items: [
            {
                text: '21 мая сделал верстку для амира проект smartspace 3 часа',
                hint: 'Конкретная прошлая дата — попадёт в нужный день',
            },
            {
                text: 'вчера выполнил отчёт 3ч',
                hint: 'Относительные даты: «вчера», «позавчера», «5 дней назад»',
            },
            {
                text: 'завтра починю баг логина 1ч',
                hint: 'Будущее время → задача сохранится как ⏳ Запланировано',
            },
            {
                text: 'послезавтра нужно сделать интеграцию с CRM',
                hint: 'Тоже планируется на будущее',
            },
            {
                text: '15.06.2026 релиз — собрать билд',
                hint: 'Можно явно: ДД.ММ.ГГГГ',
            },
        ],
    },
    {
        id: 'tasks-external',
        icon: '🌍',
        title: 'Внешние задачи (халтура)',
        intro: 'Если работа «со стороны», «халтура», «левая» — бот пометит как 🌍 Внешняя и выдаст 4-значный код для оплаты.',
        items: [
            {
                text: 'халтура лендинг для друга 4ч заказчик Сергей',
                hint: 'Слова «халтура», «левый», «для друга», «калым» → kind = external',
            },
            {
                text: 'со стороны починил мерч-движок 2ч',
                hint: 'То же самое',
            },
        ],
    },
    {
        id: 'projects',
        icon: '📁',
        title: 'Проекты',
        intro: 'Когда упоминаешь проект — бот его запоминает в твоём списке. Видишь всю историю.',
        items: [
            { text: 'мои проекты',     hint: 'Покажет твой список проектов' },
            { text: 'какие у меня проекты',  hint: 'То же — другая формулировка' },
            { text: 'покажи проекты',  hint: 'Любое из этих' },
            { text: '/projects',       hint: 'Через команду' },
        ],
    },
    {
        id: 'planned',
        icon: '⏳',
        title: 'Запланированные задачи',
        intro: 'Список всех твоих pending-задач (включая просроченные).',
        items: [
            { text: 'запланированные', hint: 'Все pending-задачи' },
            { text: 'мои планы',       hint: 'То же' },
            { text: 'что запланировано', hint: 'То же' },
            { text: 'предстоящие',     hint: 'То же' },
            { text: '/planned',        hint: 'Команда' },
        ],
    },
    {
        id: 'today',
        icon: '📋',
        title: 'Что сегодня',
        intro: 'Дайджест задач на сегодня — сделанные и запланированные.',
        items: [
            { text: '/today', hint: 'Сегодняшние задачи с подсчётом часов' },
        ],
    },
    {
        id: 'payments',
        icon: '💰',
        title: 'Оплата по коду',
        intro: 'Внешние задачи получают код #0001, #0002, …. Используй его чтобы пометить оплату.',
        items: [
            { text: 'неоплаченные',    hint: 'Список всех unpaid внешних задач с кодами' },
            { text: 'не оплаченные',   hint: 'Срабатывает любая форма с «не опл…»' },
            { text: 'оплачено 0001',   hint: 'Помечает задачу #0001 как оплаченную' },
            { text: 'заплатил 0001',   hint: 'Любое из «оплатил/заплатил/уплачено» работает' },
            { text: 'оплатил за 0002', hint: 'Бот терпим к опечаткам типа «оплалатил»' },
            { text: '/unpaid',         hint: 'Команда — список неоплаченных' },
        ],
    },
    {
        id: 'reminders',
        icon: '🔔',
        title: 'Напоминания',
        intro: 'Бот может напомнить о чём угодно в нужный момент. Хранится отдельно от задач.',
        items: [
            {
                text: 'напомни завтра в 9 утра позвонить Амиру',
                hint: 'Точное время — придёт в Telegram в 09:00',
            },
            {
                text: 'напомни через 2 часа отправить отчёт',
                hint: 'Относительное время от текущего момента',
            },
            {
                text: 'напомни сегодня в 18:00 забрать ребёнка',
                hint: 'Любое время сегодня',
            },
            {
                text: 'напомни 15 июня про релиз',
                hint: 'Без времени → 09:00 по умолчанию',
            },
            { text: 'мои напоминания', hint: 'Список активных' },
            { text: '/reminders',     hint: 'Команда' },
        ],
    },
    {
        id: 'qa',
        icon: '🤔',
        title: 'Вопросы (Q&A)',
        intro: 'Поставь «?» в конце или начни с вопросительного слова — бот ответит на основе данных проекта/команды.',
        items: [
            { text: 'кто разработчик?',           hint: 'Информация о проекте' },
            { text: 'когда создан проект?',       hint: 'История' },
            { text: 'кто сегодня свободен?',      hint: 'Для админа — данные команды' },
            { text: 'сколько часов отработал X?', hint: 'Для админа/менеджера' },
            { text: 'что я делал на этой неделе?', hint: 'Личная статистика' },
        ],
    },
    {
        id: 'commands',
        icon: '⚙️',
        title: 'Команды',
        intro: 'Слэш-команды для быстрого доступа.',
        items: [
            { text: '/today',     hint: 'Что сегодня (задачи)' },
            { text: '/planned',   hint: 'Запланированные' },
            { text: '/projects',  hint: 'Мои проекты' },
            { text: '/unpaid',    hint: 'Неоплаченные внешние задачи' },
            { text: '/reminders', hint: 'Мои напоминания' },
            { text: '/about',     hint: 'О проекте' },
            { text: '/help',      hint: 'Что я умею' },
            { text: '/whoami',    hint: 'Кто я (имя, роль, email)' },
            { text: '/cancel',    hint: 'Отменить текущий черновик задачи' },
            { text: '/logout',    hint: 'Отвязать Telegram-аккаунт' },
        ],
    },
    {
        id: 'flow',
        icon: '💡',
        title: 'Полезно знать',
        intro: 'Несколько тонкостей которые помогут.',
        items: [
            {
                text: 'Бот доспрашивает что не указал',
                hint: 'Нет часов? Спросит. Нет описания? Спросит. Нет проекта? Покажет твой список + «новый».',
            },
            {
                text: 'Исполнитель = ты по умолчанию',
                hint: 'Не нужно указывать — автоматом подставляется. Если «делал Тимур» — будет Тимур.',
            },
            {
                text: 'Фото опционально',
                hint: 'На шаге фото можно прислать одно или несколько, либо «⏭ Пропустить».',
            },
            {
                text: 'Превью перед сохранением',
                hint: 'Бот покажет всё что разобрал. Не нравится дата/тип/оплата? Нажми кнопку или «❌ Отмена».',
            },
        ],
    },
];

// ─────────────────────────────────────────────────────────────────────────────

const AIGuidePage = () => {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        if (!query.trim()) return SECTIONS;
        const q = query.toLowerCase();
        return SECTIONS
            .map((s) => ({
                ...s,
                items: s.items.filter(
                    (it) => it.text.toLowerCase().includes(q) || (it.hint || '').toLowerCase().includes(q),
                ),
            }))
            .filter((s) => s.items.length > 0 || s.title.toLowerCase().includes(q));
    }, [query]);

    const copy = (text) => {
        navigator.clipboard.writeText(text).then(
            () => message.success('Скопировано'),
            () => message.error('Не получилось скопировать'),
        );
    };

    const anchorItems = filtered.map((s) => ({
        key:   s.id,
        href:  `#${s.id}`,
        title: <Space size={6}><span>{s.icon}</span><span>{s.title}</span></Space>,
    }));

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Space align="center" size={12}>
                    <RobotOutlined style={{ fontSize: 28, color: '#6ba932' }} />
                    <Title level={2} style={{ margin: 0 }}>Справочник AI-ассистента</Title>
                </Space>
                <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                    Что и как можно писать боту в Telegram. Кликни на пример чтобы скопировать.
                </Paragraph>
            </div>

            <Card bordered={false} style={{ marginBottom: 16 }}>
                <Input
                    size="large"
                    placeholder="Поиск по примерам…"
                    prefix={<SearchOutlined />}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    allowClear
                />
            </Card>

            <Row gutter={16}>
                {/* Left nav */}
                <Col xs={0} md={6}>
                    <div style={{ position: 'sticky', top: 16 }}>
                        <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                            <Anchor
                                affix={false}
                                items={anchorItems}
                                offsetTop={80}
                                style={{ background: 'transparent' }}
                            />
                        </Card>
                    </div>
                </Col>

                {/* Main content */}
                <Col xs={24} md={18}>
                    {filtered.length === 0 && (
                        <Card><Text type="secondary">Ничего не нашлось по «{query}».</Text></Card>
                    )}

                    {filtered.map((section) => (
                        <Card
                            key={section.id}
                            id={section.id}
                            bordered={false}
                            style={{ marginBottom: 16, scrollMarginTop: 80 }}
                            title={
                                <Space size={8}>
                                    <span style={{ fontSize: 22 }}>{section.icon}</span>
                                    <span>{section.title}</span>
                                </Space>
                            }
                        >
                            {section.intro && (
                                <Paragraph type="secondary" style={{ marginTop: 0 }}>
                                    {section.intro}
                                </Paragraph>
                            )}

                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                {section.items.map((item, i) => (
                                    <div
                                        key={i}
                                        onClick={() => copy(item.text)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#f7faf3',
                                            border: '1px solid #e8f0e0',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#eef5e6'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f7faf3'; }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <Space size={6}>
                                                    <MessageOutlined style={{ color: '#6ba932', fontSize: 12 }} />
                                                    <Text strong style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}>
                                                        {item.text}
                                                    </Text>
                                                </Space>
                                                {item.hint && (
                                                    <div style={{ marginTop: 4, marginLeft: 18 }}>
                                                        <Text type="secondary" style={{ fontSize: 12 }}>{item.hint}</Text>
                                                    </div>
                                                )}
                                            </div>
                                            <Tooltip title="Скопировать">
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<CopyOutlined />}
                                                    onClick={(e) => { e.stopPropagation(); copy(item.text); }}
                                                />
                                            </Tooltip>
                                        </div>
                                    </div>
                                ))}
                            </Space>
                        </Card>
                    ))}

                    <Divider />
                    <Card size="small" bordered={false} style={{ background: '#f0f9ff' }}>
                        <Text>
                            💬 <Text strong>Подсказка:</Text> бот работает в Telegram. Сначала привяжи аккаунт —
                            в профиле получи 6-значный код и отправь его боту.
                        </Text>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default AIGuidePage;
