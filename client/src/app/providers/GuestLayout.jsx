import React from 'react';
import { Layout, Button, theme } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../entities/user/model/authSlice';

const { Header, Content } = Layout;

const GuestLayout = () => {
    const dispatch  = useDispatch();
    const navigate  = useNavigate();
    const user      = useSelector((s) => s.auth.user);
    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Header style={{
                background: colorBgContainer,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 32px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
                <span style={{ fontWeight: 700, fontSize: 18 }}>
                    Клиентский портал
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: '#666' }}>{user?.name}</span>
                    <Button icon={<LogoutOutlined />} danger onClick={handleLogout}>
                        Выйти
                    </Button>
                </div>
            </Header>
            <Content style={{ maxWidth: 1100, margin: '32px auto', width: '100%', padding: '0 16px' }}>
                <Outlet />
            </Content>
        </Layout>
    );
};

export default GuestLayout;
