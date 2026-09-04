// Единая формула прогресса проекта (совпадает с фронтовой логикой портала).
// tasksOverride — если передан, считаем по нему (напр. по задачам видимых спринтов),
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

// Извлекает номер спринта из названия («Спринт 3» → 3) для естественной сортировки
// в клиентском портале; если номера нет — уходит в конец списка.
const sprintNumber = (name) => {
    const m = String(name || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
};

// Полная публичная проекция проекта для портала клиента.
// manager — уже populated-объект (name) или null.
//
// Спринты: клиенту показываются ВСЕ спринты, кроме завершённых (active + planning) —
// то есть текущая работа и весь согласованный роадмап впереди, но без старой истории.
// Каждый скрытый вручную (visibleToClient=false) или завершённый спринт наружу не идёт.
// Проекты без спринтов (легаси/ещё не разбитые) — показывают все задачи как раньше.
const publicProjectView = (project, { updates = [], events = [] } = {}) => {
    const allSprints = project.sprints || [];
    const hasSprints = allSprints.length > 0;

    const visibleSprints = allSprints
        .filter((s) => s.status !== 'completed' && s.visibleToClient)
        .slice()
        .sort((a, b) => sprintNumber(a.name) - sprintNumber(b.name));

    const sprintsView = visibleSprints.map((s) => ({
        _id: s._id,
        name: s.name,
        description: s.description,
        status: s.status,
        tasks: (project.tasks || [])
            .filter((t) => String(t.sprint) === String(s._id) && t.status !== 'cancelled')
            .map(publicTask),
    }));

    const legacyTasks = hasSprints
        ? []
        : (project.tasks || []).filter((t) => t.status !== 'cancelled');

    const progress = computeProgress(
        project,
        hasSprints ? (project.tasks || []).filter((t) =>
            visibleSprints.some((s) => String(s._id) === String(t.sprint))) : null
    );

    const manager = project.portal?.manager || project.createdBy || null;

    return {
        name: project.name,
        description: project.description,
        status: project.status,
        deadline: project.deadline || null,
        manager: manager ? { name: manager.name } : null,
        progress,
        hasSprints,
        sprints: sprintsView,
        tasks: legacyTasks.map(publicTask),
        updates: updates.map(publicUpdate),
        timeline: events.map(publicEvent),
        updatedAt: project.updatedAt,
    };
};

// Публичная проекция ОДНОГО спринта для его отдельной ссылки (/sprint-portal/:token).
// В отличие от publicProjectView, здесь неважно active/planning/completed — раз клиенту
// выдали именно эту ссылку, значит спринт нужно показать вне зависимости от общего статуса.
const publicSprintView = (project, sprint) => {
    const tasks = (project.tasks || [])
        .filter((t) => String(t.sprint) === String(sprint._id) && t.status !== 'cancelled')
        .map(publicTask);
    const manager = project.portal?.manager || project.createdBy || null;

    return {
        name: project.name,
        manager: manager ? { name: manager.name } : null,
        updatedAt: project.updatedAt,
        sprint: {
            _id: sprint._id,
            name: sprint.name,
            description: sprint.description,
            status: sprint.status,
            tasks,
        },
    };
};

module.exports = { computeProgress, publicProjectView, publicSprintView, publicUpdate, publicEvent };
