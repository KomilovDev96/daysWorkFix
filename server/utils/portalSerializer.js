// Единая формула прогресса проекта (совпадает с фронтовой логикой портала).
// tasksOverride — если передан, считаем по нему (напр. по задачам активного спринта),
// иначе — по всем задачам проекта (используется внутренними уведомлениями).
const computeProgress = (project, tasksOverride = null) => {
    const tasks = tasksOverride || project.tasks || [];
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
// execRole/assignedTo нужны клиенту только для отрисовки канбана «кто где сейчас».
const publicTask = (t) => ({
    _id: t._id,
    title: t.title,
    status: t.status,
    execRole: t.execRole || null,
    assignedTo: t.assignedTo?.name ? { name: t.assignedTo.name } : null,
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
//
// Спринты: если у проекта есть хотя бы один спринт, клиенту показывается СНИМОК только
// активного видимого спринта (старые/скрытые спринты и их задачи наружу не идут).
// Проекты без спринтов (легаси/ещё не разбитые) — показывают все задачи как раньше.
const publicProjectView = (project, { updates = [], events = [] } = {}) => {
    const sprints = project.sprints || [];
    const activeSprint = sprints.find((s) => s.status === 'active' && s.visibleToClient) || null;

    let visibleTasks = project.tasks || [];
    if (sprints.length > 0) {
        visibleTasks = activeSprint
            ? visibleTasks.filter((t) => String(t.sprint) === String(activeSprint._id))
            : [];
    }
    visibleTasks = visibleTasks.filter((t) => t.status !== 'cancelled');

    const progress = computeProgress(project, sprints.length > 0 ? visibleTasks : null);
    const manager = project.portal?.manager || project.createdBy || null;

    return {
        name: project.name,
        description: project.description,
        status: project.status,
        deadline: project.deadline || null,
        manager: manager ? { name: manager.name } : null,
        progress,
        hasSprints: sprints.length > 0,
        activeSprint: activeSprint ? { name: activeSprint.name, description: activeSprint.description } : null,
        tasks: visibleTasks.map(publicTask),
        updates: updates.map(publicUpdate),
        timeline: events.map(publicEvent),
        updatedAt: project.updatedAt,
    };
};

module.exports = { computeProgress, publicProjectView, publicUpdate, publicEvent };
