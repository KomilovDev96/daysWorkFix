// Одноразовый бэкфилл таймлайна для существующих проектов.
// Для каждого BoardProject без события 'project_created' добавляет его,
// проставляя createdAt = дате создания проекта.
//
// Запуск:  node scripts/backfillPortalEvents.js
// (в Docker: docker compose exec api node scripts/backfillPortalEvents.js)

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BoardProject = require('../models/BoardProject');
const ProjectEvent = require('../models/ProjectEvent');

(async () => {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI не задан в .env');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const projects = await BoardProject.find({}).select('name createdAt');
    let created = 0;

    for (const p of projects) {
        const exists = await ProjectEvent.exists({ projectId: p._id, type: 'project_created' });
        if (exists) continue;
        await ProjectEvent.create({
            projectId: p._id,
            type: 'project_created',
            title: `Проект создан: ${p.name}`,
            createdAt: p.createdAt || new Date(),
        });
        created += 1;
    }

    console.log(`Готово. Проектов: ${projects.length}, добавлено событий project_created: ${created}`);
    await mongoose.disconnect();
    process.exit(0);
})().catch((e) => {
    console.error('Backfill error:', e.message);
    process.exit(1);
});
