const mongoose = require('mongoose');

const boardTaskSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        status: {
            type: String,
            enum: ['todo', 'in_progress', 'done', 'cancelled'],
            default: 'todo',
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
        },
        hours: { type: Number, default: 0, min: 0 },
        isPaid: { type: Boolean, default: false },
        customer: { type: String, default: '' },
        system: { type: String, default: '' },
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        dueDate: { type: Date, default: null },
        notes: { type: String, default: '' },
        files: [
            {
                originalName: { type: String },
                fileUrl:      { type: String },
                fileType:     { type: String },
                uploadedAt:   { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

const boardProjectSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        status: {
            type: String,
            enum: ['planning', 'active', 'completed', 'paused'],
            default: 'active',
        },
        deadline: { type: Date, default: null },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        clients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        tasks: [boardTaskSchema],
    },
    { timestamps: true }
);

module.exports = mongoose.model('BoardProject', boardProjectSchema);
