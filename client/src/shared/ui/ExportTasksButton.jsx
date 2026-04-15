import React, { useState } from 'react';
import {
    Button, Modal, Form, DatePicker, Typography,
    Space, Alert, Tag,
} from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { exportMyTasks } from '../api/managedTasksApi';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Скачивает blob как файл
const downloadBlob = (blob, filename) => {
    const url  = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
};

const ExportTasksButton = ({ buttonProps = {} }) => {
    const user       = useSelector((s) => s.auth.user);
    const isManager  = user?.role === 'projectManager';

    const [open,    setOpen]    = useState(false);
    const [loading, setLoading] = useState(false);
    const [form]    = Form.useForm();

    const handleExport = async () => {
        try {
            const vals = await form.validateFields();
            setLoading(true);

            const params = {};
            if (vals.range?.[0]) params.startDate = vals.range[0].startOf('day').toISOString();
            if (vals.range?.[1]) params.endDate   = vals.range[1].endOf('day').toISOString();

            const response = await exportMyTasks(params);
            const start = vals.range?.[0] ? vals.range[0].format('DD-MM-YYYY') : 'all';
            const end   = vals.range?.[1] ? vals.range[1].format('DD-MM-YYYY') : 'all';
            downloadBlob(response.data, `tasks_${user.name}_${start}_${end}.xlsx`);

            setOpen(false);
            form.resetFields();
        } catch (e) {
            if (e?.response) {
                // blob error — не показываем, файл просто не скачается
                console.error('Export error', e);
            }
            // form validation error — ничего не делаем
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                icon={<FileExcelOutlined />}
                onClick={() => setOpen(true)}
                style={{ color: '#52c41a', borderColor: '#52c41a' }}
                {...buttonProps}
            >
                Скачать XLS
            </Button>

            <Modal
                open={open}
                title={
                    <Space>
                        <DownloadOutlined style={{ color: '#52c41a' }} />
                        Экспорт выполненных задач
                    </Space>
                }
                onOk={handleExport}
                onCancel={() => { setOpen(false); form.resetFields(); }}
                okText="Скачать XLS"
                cancelText="Отмена"
                okButtonProps={{ loading, icon: <FileExcelOutlined />, style: { background: '#52c41a', borderColor: '#52c41a' } }}
                destroyOnHidden
                width={480}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>

                    {/* Инфо о пользователе */}
                    <div style={{
                        background: '#f5f5f5', borderRadius: 8, padding: '10px 14px',
                        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                        <div>
                            <Text strong>{user?.name}</Text>
                            <br />
                            <Tag color={isManager ? 'purple' : 'blue'} style={{ marginTop: 2 }}>
                                {isManager ? 'Менеджер' : 'Сотрудник'}
                            </Tag>
                        </div>
                    </div>

                    {/* Период */}
                    <Form.Item
                        name="range"
                        label="Период выгрузки"
                        rules={[{ required: true, message: 'Выберите период' }]}
                        initialValue={[dayjs().startOf('month'), dayjs()]}
                    >
                        <RangePicker
                            style={{ width: '100%' }}
                            format="DD.MM.YYYY"
                            presets={[
                                { label: 'Текущий месяц',    value: [dayjs().startOf('month'), dayjs()] },
                                { label: 'Прошлый месяц',    value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                                { label: 'Последние 7 дней', value: [dayjs().subtract(6, 'day'), dayjs()] },
                                { label: 'Последние 30 дней',value: [dayjs().subtract(29, 'day'), dayjs()] },
                                { label: 'Этот квартал',     value: [dayjs().startOf('quarter'), dayjs()] },
                            ]}
                        />
                    </Form.Item>

                    {/* Пояснение по заказчику */}
                    {isManager ? (
                        <Alert
                            type="success"
                            showIcon
                            message={
                                <Text style={{ fontSize: 13 }}>
                                    В колонке <b>Заказчик</b> будет подставлено значение, указанное
                                    при создании каждой задачи (поле «Заказчик» в форме задачи).
                                </Text>
                            }
                            style={{ marginBottom: 0 }}
                        />
                    ) : (
                        <Alert
                            type="info"
                            showIcon
                            message={
                                <Text style={{ fontSize: 13 }}>
                                    В колонке <b>Заказчик</b> будет автоматически указано имя менеджера,
                                    который назначил задачу.
                                </Text>
                            }
                            style={{ marginBottom: 0 }}
                        />
                    )}
                </Form>

                {/* Структура файла */}
                <div style={{
                    marginTop: 16,
                    background: '#fafafa',
                    border: '1px solid #e8e8e8',
                    borderRadius: 8,
                    padding: '10px 14px',
                }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                        Столбцы в файле:
                    </Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {[
                            'Пользователь', 'Дата', 'Кол-во задач',
                            'Названия задач', 'Детали задач',
                            'Причины / Комментарии', 'Часы', 'Период', 'Заказчик',
                        ].map((col) => (
                            <Tag key={col} style={{ fontSize: 11 }}>{col}</Tag>
                        ))}
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default ExportTasksButton;
