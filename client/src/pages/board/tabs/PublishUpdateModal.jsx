import React, { useState } from 'react';
import {
    Modal, Form, Input, InputNumber, Upload, Button, Space, message,
} from 'antd';
import { UploadOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../shared/api/apiClient';

const { TextArea } = Input;

// Модалка «Опубликовать обновление» — multipart POST со скриншотами/видео/файлами.
const PublishUpdateModal = ({ open, projectId, onClose }) => {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const queryClient = useQueryClient();

    const publish = useMutation({
        mutationFn: (formData) =>
            apiClient.post(`/board-projects/${projectId}/updates`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-updates', projectId] });
            queryClient.invalidateQueries({ queryKey: ['project-timeline', projectId] });
            message.success('Обновление опубликовано, клиент уведомлён');
            handleClose();
        },
        onError: () => message.error('Не удалось опубликовать обновление'),
    });

    const handleClose = () => {
        form.resetFields();
        setFileList([]);
        onClose();
    };

    const handleSubmit = async () => {
        const v = await form.validateFields();
        const fd = new FormData();
        fd.append('title', v.title);
        if (v.body) fd.append('body', v.body);
        if (v.progress != null) fd.append('progress', String(v.progress));
        const links = (v.links || []).filter((l) => l && l.url);
        if (links.length) fd.append('links', JSON.stringify(links));
        fileList.forEach((f) => fd.append('files', f.originFileObj || f));
        publish.mutate(fd);
    };

    return (
        <Modal
            title="Опубликовать обновление"
            open={open}
            onOk={handleSubmit}
            onCancel={handleClose}
            confirmLoading={publish.isPending}
            okText="Опубликовать"
            cancelText="Отмена"
            width={620}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item name="title" label="Заголовок" rules={[{ required: true, message: 'Введите заголовок' }]}>
                    <Input placeholder="Напр.: Завершена авторизация пользователей" />
                </Form.Item>
                <Form.Item name="body" label="Описание">
                    <TextArea rows={4} placeholder="Что сделано, детали обновления…" />
                </Form.Item>
                <Form.Item name="progress" label="Прогресс проекта (%)"
                    tooltip="Опционально — переопределит расчётный процент на портале">
                    <InputNumber min={0} max={100} style={{ width: 160 }} addonAfter="%" />
                </Form.Item>

                <Form.Item label="Ссылки">
                    <Form.List name="links">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...rest }) => (
                                    <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                        <Form.Item {...rest} name={[name, 'label']} style={{ marginBottom: 0 }}>
                                            <Input placeholder="Название" style={{ width: 180 }} />
                                        </Form.Item>
                                        <Form.Item {...rest} name={[name, 'url']} style={{ marginBottom: 0 }}
                                            rules={[{ required: true, message: 'URL' }, { type: 'url', message: 'Некорректный URL' }]}>
                                            <Input placeholder="https://…" style={{ width: 260 }} />
                                        </Form.Item>
                                        <MinusCircleOutlined onClick={() => remove(name)} />
                                    </Space>
                                ))}
                                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                                    Добавить ссылку
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Form.Item>

                <Form.Item label="Скриншоты / Видео / Файлы">
                    <Upload
                        multiple
                        beforeUpload={() => false}
                        fileList={fileList}
                        onChange={({ fileList: fl }) => setFileList(fl)}
                        listType="picture"
                    >
                        <Button icon={<UploadOutlined />}>Прикрепить файлы</Button>
                    </Upload>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default PublishUpdateModal;
