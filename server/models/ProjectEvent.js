const mongoose = require('mongoose');

// Append-only журнал событий проекта для таймлайна клиентского портала.
const EVENT_TYPES = [
    'project_created',
    'stage_completed',
    'update_published',
    'file_added',
    'deadline_changed',
    'progress_changed',
    'task_submitted_api',
    'sprint_started',
    'sprint_completed',
];

const projectEventSchema = new mongoose.Schema(
    {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoardProject', required: true, index: true },
        type:      { type: String, enum: EVENT_TYPES, required: true },
        title:     { type: String, required: true },   // «Завершён этап Backend API»
        meta:      { type: Object, default: {} },       // { updateId, oldDeadline, percent, ... }
        actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        createdAt: { type: Date, default: Date.now },
    },
    { timestamps: false }
);

const ProjectEvent = mongoose.model('ProjectEvent', projectEventSchema);
ProjectEvent.EVENT_TYPES = EVENT_TYPES;

module.exports = ProjectEvent;
