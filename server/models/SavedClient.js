const mongoose = require('mongoose');

// Сохранённый менеджер / заказчик — переиспользуемый список имён для формы задач.
// Хранит только имя (поле ManagedTask.client остаётся строкой); удаление из списка
// не затрагивает уже созданные задачи.
const savedClientSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Имя обязательно'],
            trim: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
);

// У одного пользователя имена уникальны (без дублей в списке)
savedClientSchema.index({ createdBy: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SavedClient', savedClientSchema);
