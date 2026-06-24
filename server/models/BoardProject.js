const mongoose = require('mongoose');

const boardTaskSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        status: {
            type: String,
            enum: ['todo', 'in_progress', 'done', 'cancelled'],
            default: 'todo',
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
        },
        hours: { type: Number, default: 0, min: 0 },
        isPaid: { type: Boolean, default: false },
        customer: { type: String, default: '' },
        system: { type: String, default: '' },
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        dueDate: { type: Date, default: null },
        notes: { type: String, default: '' },
        files: [
            {
                originalName: { type: String },
                fileUrl:      { type: String },
                fileType:     { type: String },
                uploadedAt:   { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

// Настройки публичного клиентского портала проекта.
const portalSchema = new mongoose.Schema(
    {
        enabled:          { type: Boolean, default: false },
        // Публичный токен ссылки /portal/:token. sparse — чтобы много проектов без токена не конфликтовали по unique.
        token:            { type: String, default: null },
        // bcrypt-хэш пароля; null = ссылка открыта без пароля (опциональная защита).
        passwordHash:     { type: String, default: null },
        // «Ответственный менеджер» для отображения клиенту; фолбэк на createdBy, если не задан.
        manager:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        // Ручные каналы уведомлений клиента (у публичного клиента нет аккаунта).
        notifyEmail:      { type: String, default: '' },
        notifyTelegramId: { type: String, default: '' },
        // Ручной override процента прогресса; null = считать по задачам.
        manualProgress:   { type: Number, default: null, min: 0, max: 100 },
        createdAt:        { type: Date, default: null },
        revokedAt:        { type: Date, default: null },
    },
    { _id: false }
);

const boardProjectSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        status: {
            type: String,
            enum: ['planning', 'active', 'completed', 'paused'],
            default: 'active',
        },
        deadline: { type: Date, default: null },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        clients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        tasks: [boardTaskSchema],
        portal: { type: portalSchema, default: () => ({}) },
    },
    { timestamps: true }
);

// Уникальность токена только среди документов, где он задан (sparse partial index).
boardProjectSchema.index(
    { 'portal.token': 1 },
    { unique: true, partialFilterExpression: { 'portal.token': { $type: 'string' } } }
);

module.exports = mongoose.model('BoardProject', boardProjectSchema);
