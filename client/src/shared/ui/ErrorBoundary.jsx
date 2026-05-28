import React from 'react';
import { Result, Button } from 'antd';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('UI ErrorBoundary:', error, info?.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <Result
                    status="error"
                    title="Что-то пошло не так"
                    subTitle={this.state.error?.message || 'Произошла непредвиденная ошибка. Попробуйте обновить страницу.'}
                    extra={[
                        <Button type="primary" key="home" onClick={this.handleReset}>На главную</Button>,
                        <Button key="reload" onClick={() => window.location.reload()}>Перезагрузить</Button>,
                    ]}
                />
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
