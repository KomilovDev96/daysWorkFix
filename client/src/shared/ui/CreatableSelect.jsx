import React, { useState } from 'react';
import { Select, Input, Button, Space, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

/**
 * Селект с возможностью добавить новый вариант («плюсик») и опционально удалить
 * существующие (корзинка в строке). Совместим с antd v6 (popupRender).
 *
 * props:
 *  - value, onChange            — управляются Form.Item
 *  - options: [{ value, label, _id? }]
 *  - placeholder
 *  - onCreate(name) => value    — создать новый вариант, вернуть значение для выбора
 *  - onDelete(option)           — (опц.) удалить вариант из списка
 *  - creating                   — спиннер на кнопке «Добавить»
 *  - allowClear (по умолчанию true)
 */
const CreatableSelect = ({
    value, onChange, options = [], placeholder,
    onCreate, onDelete, creating = false, allowClear = true,
}) => {
    const [text, setText] = useState('');

    const handleCreate = async () => {
        const name = text.trim();
        if (!name || !onCreate) return;
        const newValue = await onCreate(name);
        setText('');
        if (newValue !== undefined && newValue !== null) onChange?.(newValue);
    };

    return (
        <Select
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            allowClear={allowClear}
            showSearch
            optionFilterProp="label"
            options={options}
            popupRender={(menu) => (
                <>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                    <Space.Compact style={{ display: 'flex', padding: '0 8px 4px' }}>
                        <Input
                            placeholder="Добавить новый…"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            onPressEnter={(e) => { e.preventDefault(); handleCreate(); }}
                        />
                        <Button type="primary" icon={<PlusOutlined />} loading={creating} onClick={handleCreate}>
                            Добавить
                        </Button>
                    </Space.Compact>
                </>
            )}
            optionRender={onDelete ? (option) => (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {option.label}
                    </span>
                    <DeleteOutlined
                        style={{ color: '#ff4d4f', flexShrink: 0 }}
                        title="Удалить из списка"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.stopPropagation(); onDelete(option.data); }}
                    />
                </div>
            ) : undefined}
        />
    );
};

export default CreatableSelect;
