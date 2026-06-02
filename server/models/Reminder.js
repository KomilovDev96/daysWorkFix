const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        text: {
            type: String,
            required: [true, 'Текст напоминания обязателен'],
            trim: true,
        },
        fireAt: {
            type: Date,
            required: [true, 'Дата срабатывания обязательна'],
            index: true,
        },
        status: {
            type: String,
            enum: ['pending', 'sent', 'snoozed', 'cancelled'],
            default: 'pending',
            index: true,
        },
        sourceMessage: { type: String, default: '' },
        sentAt:        { type: Date, default: null },
        snoozeCount:   { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Композитный индекс для быстрого поиска due-напоминаний
reminderSchema.index({ status: 1, fireAt: 1 });
reminderSchema.index({ userId: 1, status: 1, fireAt: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
