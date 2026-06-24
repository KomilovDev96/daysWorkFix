// Единая формула прогресса проекта (совпадает с фронтовой логикой портала).
const computeProgress = (project) => {
    const tasks = project.tasks || [];
    const total = tasks.filter((t) => t.status !== 'cancelled').length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const hours = Number(tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0).toFixed(1));
    const manual = project.portal?.manualProgress;
    const percent = (manual === 0 || manual)
        ? manual
        : (total ? Math.round((done / total) * 100) : 0);
    return { total, done, inProgress, todo, hours, percent };
};

// Публичная проекция задачи — без isPaid, заметок и внутренних контактов.
const publicTask = (t) => ({
    _id: t._id,
    title: t.title,
    status: t.status,
    hours: t.hours || 0,
    dueDate: t.dueDate || null,
});

// Публичная проекция обновления.
const publicUpdate = (u) => ({
    _id: u._id,
    title: u.title,
    body: u.body,
    progress: u.progress,
    links: u.links || [],
    files: (u.files || []).map((f) => ({
        originalName: f.originalName,
        fileUrl: f.fileUrl,
        fileType: f.fileType,
        kind: f.kind,
        uploadedAt: f.uploadedAt,
    })),
    createdAt: u.createdAt,
});

// Публичная проекция события таймлайна.
const publicEvent = (e) => ({
    _id: e._id,
    type: e.type,
    title: e.title,
    meta: e.meta || {},
    createdAt: e.createdAt,
});

// Полная публичная проекция проекта для портала клиента.
// manager — уже populated-объект (name) или null.
const publicProjectView = (project, { updates = [], events = [] } = {}) => {
    const progress = computeProgress(project);
    const manager = project.portal?.manager || project.createdBy || null;
    return {
        name: project.name,
        description: project.description,
        status: project.status,
        deadline: project.deadline || null,
        manager: manager ? { name: manager.name } : null,
        progress,
        tasks: (project.tasks || []).map(publicTask),
        updates: updates.map(publicUpdate),
        timeline: events.map(publicEvent),
        updatedAt: project.updatedAt,
    };
};

module.exports = { computeProgress, publicProjectView, publicUpdate, publicEvent };
