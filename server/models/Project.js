const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    dayLogId: {
        type: mongoose.Schema.ObjectId,
        ref: 'DayLog',
        required: [true, 'Project must belong to a DayLog'],
    },
    name: {
        type: String,
        required: [true, 'A project must have a name'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    templateId: {
        type: mongoose.Schema.ObjectId,
        ref: 'ProjectTemplate',
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

projectSchema.virtual('tasks', {
    ref: 'Task',
    foreignField: 'projectId',
    localField: '_id',
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
