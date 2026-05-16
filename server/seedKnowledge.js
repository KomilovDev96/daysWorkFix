const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const AssistantKnowledge = require('./models/AssistantKnowledge');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const doc = await AssistantKnowledge.getOrCreate();
    doc.projectName = 'DaysWorkFix';
    doc.greeting    = 'Привет! 👋 Я ассистент проекта DaysWorkFix — помогаю быстро записывать рабочее время и отвечать на вопросы о проекте.';
    doc.about       = 'DaysWorkFix — это система учёта рабочего времени для команд: сотрудники фиксируют, что сделали и сколько времени потратили; менеджеры видят отчёты, аналитику и могут управлять задачами. Через Telegram-бота можно записывать задачи голосом или текстом — ИИ сам разберёт сообщение в структурированную запись.';
    doc.developer   = {
        name: 'Очилов Азизбек',
        role: 'Руководитель azdev.uz',
        site: 'https://azdev.uz',
    };
    doc.createdAt   = 'Февраль 2026 года';
    doc.features    = [
        'Учёт рабочего времени по дням и задачам',
        'Управление проектами и шаблонами',
        'Доска задач (Kanban) для менеджеров',
        'Отчёты и аналитика по сотрудникам и проектам',
        'Экспорт данных в Excel',
        'Личный портал заказчика',
        'Telegram-бот: запись задач свободным текстом через локальный ИИ (Ollama / qwen2.5)',
        'Управление ролями: админ, менеджер, сотрудник, гость',
        'Стартап-проекты и их отслеживание',
    ];
    doc.updatedAt = new Date();
    await doc.save();

    console.log('✅ AssistantKnowledge seeded:');
    console.log(JSON.stringify(doc.toObject(), null, 2));
    process.exit(0);
})();
