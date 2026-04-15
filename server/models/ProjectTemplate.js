const mongoose = require('mongoose');

const templateTaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Task title is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    estimatedHours: {
        type: Number,
        default: 0,
        min: 0,
    },
    order: {
        type: Number,
        default: 0,
    },
}, { _id: true });

const projectTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Template must have a name'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Template must have a creator'],
    },
    tasks: [templateTaskSchema],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const ProjectTemplate = mongoose.model('ProjectTemplate', projectTemplateSchema);

module.exports = ProjectTemplate;
