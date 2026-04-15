const mongoose = require('mongoose');

const taskFileSchema = new mongoose.Schema({
    taskId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Task',
        required: [true, 'TaskFile must belong to a Task'],
    },
    title: {
        type: String,
        required: [true, 'A file must have a title or name'],
    },
    fileUrl: {
        type: String,
        required: [true, 'A file must have a URL'],
    },
    fileType: {
        type: String,
        required: [true, 'A file must have a type'],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const TaskFile = mongoose.model('TaskFile', taskFileSchema);

module.exports = TaskFile;
