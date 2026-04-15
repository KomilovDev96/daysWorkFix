const mongoose = require('mongoose');

const managedTaskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Название задачи обязательно'],
            trim: true,
        },
        description: { type: String, default: '' },

        // Иерархия: monthly → weekly → daily → hourly
        type: {
            type: String,
            enum: ['monthly', 'weekly', 'daily', 'hourly'],
            required: true,
        },

        // null = корневая задача (monthly), иначе ссылка на родителя
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ManagedTask',
            default: null,
        },

        // Привязка к проекту (необязательно)
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BoardProject',
            default: null,
        },

        // Кто создал (projectManager или worker для своих задач)
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        // Кому назначена (воркеры)
        assignedTo: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],

        status: {
            type: String,
            enum: ['pending', 'in_progress', 'testing', 'completed', 'cancelled'],
            default: 'pending',
        },

        isHot: { type: Boolean, default: false },

        // Заказчик — указывает менеджер при создании задачи (имя клиента / компании / себя)
        client: { type: String, default: '', trim: true },

        // Задача созданная самим воркером для себя
        isSelfTask: { type: Boolean, default: false },

        estimatedHours: { type: Number, default: 0, min: 0 },
        actualHours:    { type: Number, default: 0, min: 0 },

        startDate: { type: Date, default: null },
        dueDate:   { type: Date, default: null },

        comments: [
            {
                text:      { type: String, required: true, trim: true },
                author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Виртуальное поле — дочерние задачи
managedTaskSchema.virtual('children', {
    ref:          'ManagedTask',
    localField:   '_id',
    foreignField: 'parentId',
});

module.exports = mongoose.model('ManagedTask', managedTaskSchema);
