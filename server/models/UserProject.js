const mongoose = require('mongoose');

const userProjectSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        customer: {
            type: String,
            default: '',
            trim: true,
        },
        status: {
            type: String,
            enum: ['active', 'paused', 'completed'],
            default: 'active',
        },
        totalHours: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastTaskAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

userProjectSchema.index({ userId: 1, name: 1 }, { unique: true, collation: { locale: 'ru', strength: 2 } });

module.exports = mongoose.model('UserProject', userProjectSchema);
