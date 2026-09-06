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
        amount: { type: Number, default: 0, min: 0 },
        isPaid: { type: Boolean, default: false },
        // Роль исполнителя для группировки задач без привязки к конкретному User (напр. при массовом импорте).
        execRole: { type: String, enum: ['frontend', 'backend', 'pm', 'tester', null], default: null },
        customer: { type: String, default: '' },
        system: { type: String, default: '' },
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        dueDate: { type: Date, default: null },
        notes: { type: String, default: '' },
        // Спринт (накопительная партия задач), к которому относится задача; null = вне спринтов (бэклог/легаси).
        sprint: { type: mongoose.Schema.Types.ObjectId, default: null },
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

// Спринт — именованный блок/партия задач (напр. «Спринт 1»). Показываем клиенту по одному
// активному спринту за раз через публичный портал, старые скрываются автоматически.
const sprintSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        status: { type: String, enum: ['planning', 'active', 'completed'], default: 'active' },
        // Разрешение показывать этот спринт в клиентском портале (по умолчанию — да, пока активен).
        visibleToClient: { type: Boolean, default: true },
        // Отдельная публичная ссылка именно на этот спринт (/sprint-portal/:token), независимая
        // от общего портала проекта. Работает для любого статуса (active/planning/completed) —
        // в отличие от общего портала, где скрыты завершённые; но подчиняется visibleToClient.
        token: { type: String, default: null },
        // Публичный API-токен для приёма выполненных задач именно в этот спринт (аналог
        // taskApi проекта, но без ручного тумблера enabled — наличие токена уже включает приём).
        taskApiToken: { type: String, default: null },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Публичный API для приёма выполненных задач от стороннего исполнителя (фронтенд/бэкенд/пм)
// без входа в систему — по постоянному токену проекта.
const taskApiSchema = new mongoose.Schema(
    {
        enabled:   { type: Boolean, default: false },
        token:     { type: String, default: null },
        createdAt: { type: Date, default: null },
        revokedAt: { type: Date, default: null },
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
        sprints: [sprintSchema],
        portal: { type: portalSchema, default: () => ({}) },
        taskApi: { type: taskApiSchema, default: () => ({}) },
    },
    { timestamps: true }
);

// Уникальность токена только среди документов, где он задан (sparse partial index).
boardProjectSchema.index(
    { 'portal.token': 1 },
    { unique: true, partialFilterExpression: { 'portal.token': { $type: 'string' } } }
);
boardProjectSchema.index(
    { 'taskApi.token': 1 },
    { unique: true, partialFilterExpression: { 'taskApi.token': { $type: 'string' } } }
);
boardProjectSchema.index(
    { 'sprints.token': 1 },
    { unique: true, partialFilterExpression: { 'sprints.token': { $type: 'string' } } }
);
boardProjectSchema.index(
    { 'sprints.taskApiToken': 1 },
    { unique: true, partialFilterExpression: { 'sprints.taskApiToken': { $type: 'string' } } }
);

module.exports = mongoose.model('BoardProject', boardProjectSchema);
