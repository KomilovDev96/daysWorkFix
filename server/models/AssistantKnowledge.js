const mongoose = require('mongoose');

// Singleton record: знания ассистента о проекте
const assistantKnowledgeSchema = new mongoose.Schema({
    projectName:   { type: String, default: 'DaysWorkFix' },
    greeting:      { type: String, default: '' },
    about:         { type: String, default: '' },
    developer: {
        name:  { type: String, default: '' },
        role:  { type: String, default: '' },
        site:  { type: String, default: '' },
    },
    createdAt:     { type: String, default: '' }, // когда был создан проект (свободный текст)
    features:      { type: [String], default: [] },
    updatedAt:     { type: Date, default: Date.now },
});

assistantKnowledgeSchema.statics.getOrCreate = async function () {
    let doc = await this.findOne();
    if (!doc) doc = await this.create({});
    return doc;
};

module.exports = mongoose.model('AssistantKnowledge', assistantKnowledgeSchema);
