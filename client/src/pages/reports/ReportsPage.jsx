import React, { useState, useMemo } from 'react';
import {
    Typography, Card, Form, DatePicker, Select, Button,
    Table, Space, Tag, message, Badge, Drawer, Descriptions, Empty,
} from 'antd';
import {
    FilterOutlined, FileExcelOutlined,
    UserOutlined, CalendarOutlined, CheckCircleOutlined,
    ClockCircleOutlined, BookOutlined,
    FolderOutlined, RobotOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import apiClient from '../../shared/api/apiClient';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ReportsPage = () => {
    const [drawerRow, setDrawerRow] = useState(null);

    const [filters, setFilters] = useState({
        startDate:    dayjs().startOf('month').format('YYYY-MM-DD'),
        endDate:      dayjs().format('YYYY-MM-DD'),
        userId:       null,
        projectNames: [],
        kind:         'all',
    });

    const user    = useSelector((state) => state.auth.user);
    const isAdmin = user?.role === 'admin';

    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['users-list'],
        queryFn:  async () => {
            const { data } = await apiClient.get('/auth/users');
            return data.data.users;
        },
        enabled: isAdmin,
    });

    const buildParams = (apiEndDate) => {
        const { startDate, userId, projectNames, kind } = filters;
        const params = new URLSearchParams({ startDate, endDate: apiEndDate });
        if (userId) params.set('userId', userId);
        (projectNames || []).forEach((p) => params.append('projectName', p));
        if (kind && kind !== 'all') params.set('kind', kind);
        return params;
    };

    const { data: report, isLoading: reportLoading } = useQuery({
        queryKey: ['report', filters],
        queryFn:  async () => {
            const apiEndDate = dayjs(filters.endDate).add(1, 'day').format('YYYY-MM-DD');
            const { data } = await apiClient.get(`/reports/period?${buildParams(apiEndDate).toString()}`);
            return data.data;
        },
    });

    const exportExcel = async () => {
        try {
            const { startDate, endDate, projectNames } = filters;
            const apiEndDate = dayjs(endDate).add(1, 'day').format('YYYY-MM-DD');
            const response = await apiClient.get(`/reports/export?${buildParams(apiEndDate).toString()}`, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href  = window.URL.createObjectURL(blob);
            const suffix = projectNames?.length
                ? `-${projectNames.slice(0, 3).map((n) => n.replace(/[^a-zа-я0-9_-]+/gi, '_')).join('+')}`
                : '';
            link.setAttribute('download', `report-${startDate}-${endDate}${suffix}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success('Отчет экспортирован');
        } catch {
            message.error('Не удалось экспортировать отчет');
        }
    };

    const onFilterSubmit = (values) => {
        setFilters({
            startDate:    values.dateRange[0].format('YYYY-MM-DD'),
            endDate:      values.dateRange[1].format('YYYY-MM-DD'),
            userId:       values.userId       || null,
            projectNames: values.projectNames || [],
            kind:         values.kind         || 'all',
        });
    };

    // Собираем плоский список Task внутри DayLog (проектные + сиротские/бот)
    const collectLogTasks = (log) => {
        const tasks = [];
        (log.projects || []).forEach((p) => {
            (p.tasks || []).forEach((t) => tasks.push({ ...t, projectName: p.name }));
        });
        (log.orphanTasks || []).forEach((t) => tasks.push({ ...t, projectName: null }));
        return tasks;
    };

    // Объединяем DayLog записи и выполненные ManagedTask в одну таблицу
    const combinedRows = useMemo(() => {
        const rows = [];

        // DayLog записи
        (report?.logs || []).forEach((log) => {
            const innerTasks = collectLogTasks(log);
            rows.push({
                _id:       log._id,
                date:      log.date,
                userName:  log.userId?.name || '—',
                email:     log.userId?.email || '—',
                hours:     log.dayHoursTotal ?? log.totalHours ?? 0,
                title:     null,
                kind:      'log',   // дневной лог
                innerTasks,
            });
        });

        // Выполненные задачи
        (report?.managedTasks || []).forEach((task) => {
            rows.push({
                _id:      task._id,
                date:     task.dueDate,
                userName: task.createdBy?.name || user?.name || '—',
                email:    task.createdBy?.email || user?.email || '—',
                hours:    task.actualHours || task.estimatedHours || 0,
                title:    task.title,
                client:   task.client,
                isSelf:   task.isSelfTask,
                kind:     'task',  // задача
            });
        });

        // Сортируем по дате — свежие сверху
        rows.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
        return rows;
    }, [report, user]);

    // Колонки таблицы внутренних Task (раскрытие DayLog-строки)
    const KIND_LABEL = { work: '💼 Рабочая', external: '🌍 Внешняя' };
    const PAY_LABEL  = { paid: '💰 Оплачено', unpaid: '⌛ Не оплачено' };
    const STATUS_LABEL = { pending: 'Ожидает', in_progress: 'В работе', testing: 'Тест', completed: 'Завершено', failed: 'Провалено' };

    const innerColumns = [
        {
            title: 'Задача', dataIndex: 'title', key: 'title',
            render: (v, r) => (
                <Space direction="vertical" size={0}>
                    <Space size={6}>
                        <Text strong style={{ fontSize: 13 }}>{v || '—'}</Text>
                        {r.kind === 'external' && <Tag color="orange" style={{ margin: 0 }}>Внешняя</Tag>}
                    </Space>
                    {r.description && <Text type="secondary" style={{ fontSize: 11 }}>{r.description}</Text>}
                </Space>
            ),
        },
        {
            title: 'Проект', key: 'projectName', width: 160,
            render: (_, r) => r.projectName
                ? <Tag icon={<FolderOutlined />} color="purple">{r.projectName}</Tag>
                : <Tag icon={<RobotOutlined />}>из бота</Tag>,
        },
        {
            title: 'Заказчик/Исполнитель', key: 'cust', width: 200,
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    {r.customer?.name && <Text style={{ fontSize: 12 }}><UserOutlined /> {r.customer.name}</Text>}
                    {r.executor && <Text type="secondary" style={{ fontSize: 11 }}>🛠 {r.executor}</Text>}
                </Space>
            ),
        },
        {
            title: 'Часы', dataIndex: 'hours', key: 'hours', width: 80, align: 'center',
            render: (v) => <Tag color="blue">{v}ч</Tag>,
        },
        {
            title: 'Тип/Оплата', key: 'kind', width: 180,
            render: (_, r) => {
                if (r.kind !== 'external') return <Text type="secondary">{KIND_LABEL.work}</Text>;
                const amount = r.payment?.amount ? `${Number(r.payment.amount).toLocaleString('ru-RU')} ${r.payment.currency || 'UZS'}` : null;
                return (
                    <Space direction="vertical" size={2}>
                        <Text>{KIND_LABEL.external}</Text>
                        <Tag color={r.payment?.status === 'paid' ? 'green' : 'orange'} style={{ margin: 0 }}>
                            {PAY_LABEL[r.payment?.status] || PAY_LABEL.unpaid}
                        </Tag>
                        {amount && <Text style={{ fontSize: 11 }}><DollarOutlined /> {amount}</Text>}
                    </Space>
                );
            },
        },
        {
            title: 'Статус', dataIndex: 'status', key: 'status', width: 100,
            render: (v) => <Tag color={v === 'completed' ? 'green' : 'default'}>{STATUS_LABEL[v] || v}</Tag>,
        },
    ];


    const columns = [
        {
            title: 'Пользователь',
            key: 'userName',
            render: (_, r) => <Space><UserOutlined />{r.userName}</Space>,
        },
        {
            title: 'Дата',
            key: 'date',
            render: (_, r) => (
                <Space>
                    <CalendarOutlined />
                    {dayjs(r.date).format('DD.MM.YYYY')}
                    {dayjs(r.date).isSame(dayjs(), 'day') && (
                        <Tag color="green" style={{ margin: 0, fontSize: 10 }}>сегодня</Tag>
                    )}
                </Space>
            ),
        },
        {
            title: 'Запись',
            key: 'title',
            render: (_, r) => {
                if (r.kind === 'task') {
                    return (
                        <Space direction="vertical" size={0}>
                            <Space size={4}>
                                <CheckCircleOutlined style={{ color: '#22C55E' }} />
                                <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
                                <Tag color={r.isSelf ? 'green' : 'purple'} style={{ fontSize: 10 }}>
                                    {r.isSelf ? 'Личная' : 'От менеджера'}
                                </Tag>
                            </Space>
                            {r.client && (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    <UserOutlined /> {r.client}
                                </Text>
                            )}
                        </Space>
                    );
                }
                const count = r.innerTasks?.length || 0;
                return (
                    <Space size={4}>
                        <BookOutlined style={{ color: '#1677ff' }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Дневной лог {count > 0 ? `— ${count} запис${count === 1 ? 'ь' : count < 5 ? 'и' : 'ей'}` : '(пусто)'}
                        </Text>
                    </Space>
                );
            },
        },
        {
            title: 'Часы',
            key: 'hours',
            width: 100,
            align: 'center',
            render: (_, r) => (
                <Tag color={r.kind === 'task' ? 'green' : 'blue'}>
                    <ClockCircleOutlined /> {r.hours} ч
                </Tag>
            ),
        },
        {
            title: 'Email',
            key: 'email',
            render: (_, r) => <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>,
        },
    ];

    const totalHours   = (report?.totalHours   || 0) + (report?.managedHours || 0);
    const doneCount    = report?.managedTasks?.length || 0;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>Центр отчетов</Title>
                <Button
                    type="primary"
                    icon={<FileExcelOutlined />}
                    onClick={exportExcel}
                    size="large"
                    style={{ backgroundColor: '#217346' }}
                    disabled={!combinedRows.length}
                >
                    Экспорт в Excel
                </Button>
            </div>

            <Card bordered={false} style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Form
                    layout="inline"
                    onFinish={onFilterSubmit}
                    initialValues={{
                        dateRange:    [dayjs(filters.startDate), dayjs(filters.endDate)],
                        userId:       filters.userId,
                        projectNames: filters.projectNames,
                        kind:         filters.kind,
                    }}
                >
                    <Form.Item name="dateRange" label="Период">
                        <RangePicker />
                    </Form.Item>
                    {isAdmin && (
                        <Form.Item name="userId" label="Сотрудник" style={{ minWidth: 200 }}>
                            <Select placeholder="Все" allowClear loading={usersLoading}>
                                {users?.map((u) => (
                                    <Select.Option key={u._id} value={u._id}>{u.name}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}
                    <Form.Item name="kind" label="Тип" style={{ minWidth: 180 }}>
                        <Select
                            options={[
                                { value: 'all',      label: 'Все' },
                                { value: 'work',     label: '💼 Рабочие' },
                                { value: 'external', label: '🌍 Внешние' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="projectNames" label="Проекты" style={{ minWidth: 260 }}>
                        <Select
                            mode="multiple"
                            placeholder="Все проекты"
                            allowClear
                            showSearch
                            maxTagCount="responsive"
                            options={(report?.availableProjects || []).map((p) => ({ value: p, label: p }))}
                            notFoundContent={reportLoading ? 'Загрузка…' : 'Нет проектов в периоде'}
                        />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
                            Фильтровать
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Всего часов</Text>
                    <Title level={3} style={{ marginTop: 8 }}>{totalHours}</Title>
                </Card>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Дней зафиксировано</Text>
                    <Title level={3} style={{ marginTop: 8 }}>{report?.daysWorked || 0}</Title>
                </Card>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Выполнено задач</Text>
                    <Title level={3} style={{ marginTop: 8, color: '#22C55E' }}>{doneCount}</Title>
                </Card>
                <Card size="small" style={{ textAlign: 'center' }}>
                    <Text type="secondary">Часов по задачам</Text>
                    <Title level={3} style={{ marginTop: 8, color: '#1677ff' }}>{report?.managedHours || 0}</Title>
                </Card>
            </div>

            {/* Единая таблица: логи + задачи */}
            <Table
                columns={columns}
                dataSource={combinedRows}
                rowKey="_id"
                loading={reportLoading}
                pagination={{ pageSize: 20 }}
                bordered
                rowClassName={(r) => r.kind === 'task' ? 'task-row-done' : ''}
                onRow={(r) => ({
                    onClick: () => setDrawerRow(r),
                    style:   { cursor: 'pointer' },
                })}
            />

            <Drawer
                open={!!drawerRow}
                onClose={() => setDrawerRow(null)}
                placement="right"
                width="70%"
                title={
                    drawerRow ? (
                        <Space>
                            <CalendarOutlined />
                            {dayjs(drawerRow.date).format('DD.MM.YYYY')}
                            <Text type="secondary" style={{ fontSize: 13 }}>· {drawerRow.userName}</Text>
                        </Space>
                    ) : null
                }
                destroyOnHidden
            >
                {drawerRow && (drawerRow.kind === 'log' ? (
                    <>
                        <Descriptions
                            size="small"
                            column={2}
                            bordered
                            style={{ marginBottom: 16 }}
                            items={[
                                { key: 'user',  label: 'Сотрудник', children: drawerRow.userName },
                                { key: 'mail',  label: 'Email',     children: drawerRow.email },
                                { key: 'hours', label: 'Часов',     children: <Tag color="blue"><ClockCircleOutlined /> {drawerRow.hours}ч</Tag> },
                                { key: 'cnt',   label: 'Записей',   children: drawerRow.innerTasks?.length || 0 },
                            ]}
                        />
                        <Title level={5}>Задачи дня</Title>
                        {drawerRow.innerTasks?.length ? (
                            <Table
                                size="small"
                                dataSource={drawerRow.innerTasks}
                                columns={innerColumns}
                                rowKey="_id"
                                pagination={false}
                            />
                        ) : (
                            <Empty description="Нет задач" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                    </>
                ) : (
                    <Descriptions
                        size="small"
                        column={1}
                        bordered
                        items={[
                            { key: 'title', label: 'Задача',     children: drawerRow.title || '—' },
                            { key: 'user',  label: 'Исполнитель', children: drawerRow.userName },
                            { key: 'cust',  label: 'Заказчик',   children: drawerRow.client || '—' },
                            { key: 'kind',  label: 'Источник',   children: <Tag color={drawerRow.isSelf ? 'green' : 'purple'}>{drawerRow.isSelf ? 'Личная' : 'От менеджера'}</Tag> },
                            { key: 'hours', label: 'Часов',      children: <Tag color="green"><ClockCircleOutlined /> {drawerRow.hours}ч</Tag> },
                            { key: 'date',  label: 'Дата',       children: dayjs(drawerRow.date).format('DD.MM.YYYY') },
                        ]}
                    />
                ))}
            </Drawer>
        </div>
    );
};

export default ReportsPage;
