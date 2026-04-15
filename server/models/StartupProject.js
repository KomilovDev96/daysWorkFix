const mongoose = require('mongoose');

const startupProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Название проекта обязательно'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['planning', 'active', 'completed', 'paused'],
        default: 'planning',
    },
    deadline: {
        type: Date,
        default: null,
    },
    goals: {
        type: String,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    members: [
        {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
        },
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const StartupProject = mongoose.model('StartupProject', startupProjectSchema);

module.exports = StartupProject;
