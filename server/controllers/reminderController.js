const Reminder = require('../models/Reminder');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const PRIVILEGED = ['admin'];

const canAccess = (reminder, user) =>
    PRIVILEGED.includes(user.role) ||
    String(reminder.userId) === String(user._id);

exports.listMyReminders = catchAsync(async (req, res) => {
    const { status, includeAll } = req.query;
    const query = { userId: req.user._id };
    if (status) query.status = status;
    else if (includeAll !== 'true') query.status = { $in: ['pending', 'snoozed'] };

    const reminders = await Reminder.find(query).sort({ fireAt: 1 }).lean();
    res.json({ status: 'success', data: { reminders } });
});

exports.createReminder = catchAsync(async (req, res, next) => {
    const { text, fireAt, sourceMessage } = req.body;
    if (!text || !text.trim()) return next(new AppError('text обязателен', 400));
    if (!fireAt || Number.isNaN(new Date(fireAt).getTime())) {
        return next(new AppError('fireAt должен быть валидной датой', 400));
    }

    const reminder = await Reminder.create({
        userId:        req.user._id,
        text:          text.trim(),
        fireAt:        new Date(fireAt),
        sourceMessage: sourceMessage || '',
    });

    res.status(201).json({ status: 'success', data: { reminder } });
});

exports.updateReminder = catchAsync(async (req, res, next) => {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return next(new AppError('Напоминание не найдено', 404));
    if (!canAccess(reminder, req.user)) return next(new AppError('Нет доступа', 403));

    const { text, fireAt, status } = req.body;
    if (text !== undefined) reminder.text = String(text).trim();
    if (fireAt !== undefined) {
        if (Number.isNaN(new Date(fireAt).getTime())) {
            return next(new AppError('fireAt невалидна', 400));
        }
        reminder.fireAt = new Date(fireAt);
        // Если перенесли время в будущее и статус был sent — снова pending
        if (reminder.fireAt > new Date() && reminder.status === 'sent') {
            reminder.status = 'snoozed';
        }
    }
    if (status !== undefined && ['pending', 'sent', 'snoozed', 'cancelled'].includes(status)) {
        reminder.status = status;
    }

    await reminder.save();
    res.json({ status: 'success', data: { reminder } });
});

exports.deleteReminder = catchAsync(async (req, res, next) => {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return next(new AppError('Напоминание не найдено', 404));
    if (!canAccess(reminder, req.user)) return next(new AppError('Нет доступа', 403));

    await Reminder.deleteOne({ _id: reminder._id });
    res.status(204).end();
});
