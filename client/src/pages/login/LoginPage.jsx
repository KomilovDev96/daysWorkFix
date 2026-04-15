import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Layout } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../entities/user/model/authSlice';
import apiClient from '../../shared/api/apiClient';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const LoginPage = () => {
    const [loading, setLoading] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const { data } = await apiClient.post('/auth/login', values);
            dispatch(setCredentials({ user: data.data.user, token: data.token }));
            message.success('Вход выполнен успешно');
            const role = data.data.user.role;
            const dest = role === 'guest'          ? '/portal'
                       : role === 'admin'          ? '/admin-analytics'
                       : role === 'projectManager' ? '/managed-tasks'
                       : role === 'worker'         ? '/my-tasks'
                       : '/dashboard';
            navigate(dest);
        } catch (error) {
            console.error(error);
            message.error(error.response?.data?.message || 'Ошибка входа');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card style={{ width: 400, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={2}>Дневной журнал работы</Title>
                    <Text type="secondary">Система записи ежедневных задач для сотрудников</Text>
                </div>
                <Form
                    name="login_form"
                    initialValues={{ remember: true }}
                    onFinish={onFinish}
                    size="large"
                >
                    <Form.Item
                        name="email"
                        rules={[{ required: true, message: 'Пожалуйста, введите ваш Email!' }, { type: 'email', message: 'Некорректный Email!' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Электронная почта" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Пожалуйста, введите ваш пароль!' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} block>
                            Войти
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </Layout>
    );
};

export default LoginPage;
