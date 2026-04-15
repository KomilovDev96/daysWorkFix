const mongoose = require('mongoose');

const projectCommentSchema = new mongoose.Schema(
    {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoardProject', required: true },
        userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        text:      { type: String, required: true, trim: true, maxlength: 2000 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('ProjectComment', projectCommentSchema);
