const DayLog = require('../models/DayLog');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.createDayLog = catchAsync(async (req, res, next) => {
    // Allow nested routes
    if (!req.body.userId) req.body.userId = req.user.id;

    const newLog = await DayLog.create(req.body);

    res.status(201).json({
        status: 'success',
        data: {
            daylog: newLog
        }
    });
});

exports.getMyLogs = catchAsync(async (req, res, next) => {
    const logs = await DayLog.find({ userId: req.user.id }).sort({ date: -1 });

    res.status(200).json({
        status: 'success',
        results: logs.length,
        data: {
            daylogs: logs
        }
    });
});

exports.getDayLog = catchAsync(async (req, res, next) => {
    const log = await DayLog.findById(req.params.id).populate({
        path: 'projects',
        populate: {
            path: 'tasks',
            populate: { path: 'files' }
        }
    });

    if (!log) {
        return next(new AppError('No day log found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            daylog: log
        }
    });
});

exports.updateDayLog = catchAsync(async (req, res, next) => {
    const log = await DayLog.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    if (!log) {
        return next(new AppError('No day log found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            daylog: log
        }
    });
});

exports.deleteDayLog = catchAsync(async (req, res, next) => {
    const log = await DayLog.findByIdAndDelete(req.params.id);

    if (!log) {
        return next(new AppError('No day log found with that ID', 404));
    }

    res.status(204).json({
        status: 'success',
        data: null
    });
});
