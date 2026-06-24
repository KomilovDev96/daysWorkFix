// Идемпотентная чистка осиротевших событий таймлайна.
//
// История: до фикса deleteUpdate удаление обновления НЕ удаляло связанные
// события (update_published / file_added / progress_changed с meta.updateId)
// и не откатывало portal.manualProgress. Скрипт убирает события, чей
// updateId больше не существует, и для затронутых проектов пересчитывает
// ручной прогресс по оставшимся обновлениям.
//
// Безопасен для повторного запуска: если осиротевших событий нет — no-op.

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ProjectEvent = require('../models/ProjectEvent');
const ProjectUpdate = require('../models/ProjectUpdate');
const BoardProject = require('../models/BoardProject');

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // События, привязанные к какому-либо обновлению.
        const linked = await ProjectEvent.find({ 'meta.updateId': { $ne: null } })
            .select('_id projectId meta')
            .lean();

        if (linked.length === 0) {
            console.log('[cleanupOrphanEvents] событий с updateId нет — нечего чистить');
            return process.exit(0);
        }

        // Множество ещё существующих обновлений.
        const updateIds = [...new Set(linked.map((e) => String(e.meta.updateId)))];
        const existing = await ProjectUpdate.find({ _id: { $in: updateIds } }).select('_id').lean();
        const alive = new Set(existing.map((u) => String(u._id)));

        const orphanEvents = linked.filter((e) => !alive.has(String(e.meta.updateId)));
        if (orphanEvents.length === 0) {
            console.log('[cleanupOrphanEvents] осиротевших событий нет — всё чисто');
            return process.exit(0);
        }

        const orphanIds = orphanEvents.map((e) => e._id);
        const affectedProjects = [...new Set(orphanEvents.map((e) => String(e.projectId)))];

        const del = await ProjectEvent.deleteMany({ _id: { $in: orphanIds } });
        console.log(`[cleanupOrphanEvents] удалено событий: ${del.deletedCount} (проектов: ${affectedProjects.length})`);

        // Пересчёт ручного прогресса для затронутых проектов.
        for (const projectId of affectedProjects) {
            const project = await BoardProject.findById(projectId).select('portal');
            if (!project || !project.portal) continue;
            const lastWithProgress = await ProjectUpdate.findOne({ projectId, progress: { $ne: null } })
                .sort({ createdAt: -1 })
                .select('progress')
                .lean();
            const next = lastWithProgress ? lastWithProgress.progress : null;
            if (project.portal.manualProgress !== next) {
                project.portal.manualProgress = next;
                await project.save();
                console.log(`[cleanupOrphanEvents] проект ${projectId}: manualProgress → ${next}`);
            }
        }

        console.log('[cleanupOrphanEvents] готово');
        process.exit(0);
    } catch (err) {
        console.error('[cleanupOrphanEvents] ошибка:', err.message);
        process.exit(1);
    }
})();
