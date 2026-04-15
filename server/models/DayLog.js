const mongoose = require('mongoose');

const dayLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'DayLog must belong to a user'],
    },
    date: {
        type: Date,
        required: [true, 'DayLog must have a date'],
        default: Date.now,
    },
    totalHours: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual populate for tasks
dayLogSchema.virtual('tasks', {
    ref: 'Task',
    foreignField: 'dayLogId',
    localField: '_id',
});

// Virtual populate for projects
dayLogSchema.virtual('projects', {
    ref: 'Project',
    foreignField: 'dayLogId',
    localField: '_id',
});

const DayLog = mongoose.model('DayLog', dayLogSchema);

module.exports = DayLog;
