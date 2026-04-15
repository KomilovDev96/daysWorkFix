const TaskFile = require('../models/TaskFile');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.uploadFile = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please upload a file!', 400));
    }

    const { taskId, title } = req.body;

    if (!taskId) {
        return next(new AppError('A file must belong to a task!', 400));
    }

    const fileExt = req.file.originalname.split('.').pop();

    const newFile = await TaskFile.create({
        taskId,
        title: title || req.file.originalname,
        fileUrl: `uploads/${req.file.filename}`,
        fileType: fileExt
    });

    res.status(201).json({
        status: 'success',
        data: {
            file: newFile
        }
    });
});

exports.deleteFile = catchAsync(async (req, res, next) => {
    const file = await TaskFile.findByIdAndDelete(req.params.id);

    if (!file) {
        return next(new AppError('No file found with that ID', 404));
    }

    res.status(204).json({
        status: 'success',
        data: null
    });
});
