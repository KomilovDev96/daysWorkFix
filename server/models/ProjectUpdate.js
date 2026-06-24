const mongoose = require('mongoose');

const updateFileSchema = new mongoose.Schema(
    {
        originalName: { type: String },
        fileUrl:      { type: String },   // uploads/...
        fileType:     { type: String },   // расширение
        kind:         { type: String, enum: ['image', 'video', 'file'], default: 'file' },
        uploadedAt:   { type: Date, default: Date.now },
    },
    { _id: true }
);

const projectUpdateSchema = new mongoose.Schema(
    {
        projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BoardProject', required: true, index: true },
        authorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        title:       { type: String, required: true, trim: true, maxlength: 200 },
        body:        { type: String, default: '', maxlength: 5000 },
        // Прогресс проекта на момент публикации (%); null = не указан вручную.
        progress:    { type: Number, default: null, min: 0, max: 100 },
        links:       [{ label: { type: String, default: '' }, url: { type: String, required: true } }],
        files:       [updateFileSchema],
        isPublished: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('ProjectUpdate', projectUpdateSchema);
