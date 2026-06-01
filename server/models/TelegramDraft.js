const mongoose = require('mongoose');

const telegramDraftSchema = new mongoose.Schema({
    draftId:       { type: String, required: true, unique: true, index: true },
    chatId:        { type: Number, required: true, index: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parsed:        { type: mongoose.Schema.Types.Mixed, default: {} },
    photos:        { type: Array, default: [] },
    awaiting:      { type: String, default: null },
    photoStepDone: { type: Boolean, default: false },
    projectStepDone:  { type: Boolean, default: false },
    dateStepDone:     { type: Boolean, default: false },
    customerStepDone: { type: Boolean, default: false },
    createdAt:     { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});

module.exports = mongoose.model('TelegramDraft', telegramDraftSchema);
