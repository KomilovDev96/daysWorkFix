const mongoose = require('mongoose');

const aiInsightSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        default: null,
    },
    requestedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'AI insight must have requester'],
    },
    startDate: {
        type: Date,
        required: [true, 'AI insight must have startDate'],
    },
    endDate: {
        type: Date,
        required: [true, 'AI insight must have endDate'],
    },
    provider: {
        type: String,
        default: 'huggingface',
    },
    model: {
        type: String,
        required: [true, 'AI insight must have model'],
    },
    prompt: {
        type: String,
        required: [true, 'AI insight must save prompt'],
    },
    aiSummary: {
        type: String,
        required: [true, 'AI insight must have generated summary'],
    },
    aiRawResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    analyticsSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

aiInsightSchema.index({ userId: 1, startDate: 1, endDate: 1, createdAt: -1 });
aiInsightSchema.index({ requestedBy: 1, createdAt: -1 });

const AiInsight = mongoose.model('AiInsight', aiInsightSchema);

module.exports = AiInsight;
