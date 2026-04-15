const mongoose = require('mongoose');
const DayLog = require('./DayLog');

const taskSchema = new mongoose.Schema({
    dayLogId: {
        type: mongoose.Schema.ObjectId,
        ref: 'DayLog',
        required: [true, 'Task must belong to a DayLog'],
    },
    projectId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Project',
        default: null,
    },
    title: {
        type: String,
        required: [true, 'A task must have a title'],
    },
    description: {
        type: String,
        trim: true,
    },
    hours: {
        type: Number,
        required: [true, 'A task must have hours spent'],
        min: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    customer: {
        name: {
            type: String,
            trim: true,
        },
        externalId: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid customer email'],
        },
    },
    testingStatus: {
        type: String,
        enum: ['not_reviewed', 'in_progress', 'completed'],
        default: 'not_reviewed',
    },
    comment: {
        type: String,
        trim: true,
    },
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual populate for files
taskSchema.virtual('files', {
    ref: 'TaskFile',
    foreignField: 'taskId',
    localField: '_id',
});

// Middleware to update DayLog's total hours when a task is created or deleted
taskSchema.statics.calcTotalHours = async function (dayLogId) {
    const stats = await this.aggregate([
        {
            $match: { dayLogId }
        },
        {
            $group: {
                _id: '$dayLogId',
                totalHours: { $sum: '$hours' }
            }
        }
    ]);

    if (stats.length > 0) {
        await DayLog.findByIdAndUpdate(dayLogId, {
            totalHours: stats[0].totalHours
        });
    } else {
        await DayLog.findByIdAndUpdate(dayLogId, {
            totalHours: 0
        });
    }
};

taskSchema.post('save', function () {
    this.constructor.calcTotalHours(this.dayLogId);
});

taskSchema.post(/^findOneAnd/, async function (doc, next) {
    if (doc) {
        await doc.constructor.calcTotalHours(doc.dayLogId);
    }
    next();
});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
