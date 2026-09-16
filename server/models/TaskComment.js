const mongoose = require('mongoose');

// Комментарий к конкретной задаче канбана (BoardProject.tasks[i]), а не к проекту целиком
// (для проектных комментариев есть отдельная модель ProjectComment). Используется и
// авторизованной страницей /board, и публичной командной ссылкой /team-portal/:token —
// поэтому автор хранится строкой (authorName), а не ссылкой на User: у публичного
// участника аккаунта в системе нет, он вводит имя вручную.
const taskCommentSchema = new mongoose.Schema(
    {
        project: { type: mongoose.Schema.Types.ObjectId, ref: 'BoardProject', required: true, index: true },
        taskId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        authorName: { type: String, required: true, trim: true, maxlength: 80 },
        role: { type: String, enum: ['frontend', 'backend', 'pm', 'tester', null], default: null },
        text: { type: String, required: true, trim: true, maxlength: 2000 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('TaskComment', taskCommentSchema);
