const ProjectEvent = require('../models/ProjectEvent');

// Записать событие в таймлайн проекта. Не бросает наружу — таймлайн не должен
// ронять основную операцию (публикацию, апдейт проекта и т.д.).
const logProjectEvent = async (projectId, type, title, { meta = {}, actorId = null } = {}) => {
    try {
        return await ProjectEvent.create({ projectId, type, title, meta, actorId });
    } catch (e) {
        console.error('[projectEvents] logProjectEvent failed:', e.message);
        return null;
    }
};

module.exports = { logProjectEvent };
