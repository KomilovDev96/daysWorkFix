const AppError = require('./appError');

// Может ли актор утверждать задачи «на проверке» — переводить их в «Выполнено»
// или возвращать обратно «в работу» при ошибке. Для авторизованного /board это
// admin/projectManager либо воркер со специализацией pm; для публичной командной
// ссылки /team-portal/:token/:role это просто role === 'pm' (роль выбрана при входе).
const canApproveFromUser = (user) =>
    user?.role === 'admin' || user?.role === 'projectManager' || user?.specialization === 'pm';

// Проверяет переход статуса задачи и бросает AppError, если он не разрешён:
//   - в «Выполнено» можно только из «На проверке», и только тому, кто может утверждать;
//   - выйти из «На проверке» в любую другую сторону (кроме «Выполнено») тоже может только он —
//     это и есть решение «принял / вернул с ошибкой».
// Любые остальные переходы (todo <-> in_progress <-> review) разрешены всем.
const assertStatusTransition = (currentStatus, nextStatus, canApprove) => {
    if (!nextStatus || nextStatus === currentStatus) return;
    const wasReview = currentStatus === 'review';

    if (nextStatus === 'done' && !(wasReview && canApprove)) {
        throw new AppError(
            'Отметить задачу выполненной может только PM/менеджер — сначала переведите задачу «На проверку»',
            403
        );
    }
    if (wasReview && nextStatus !== 'done' && !canApprove) {
        throw new AppError('Вернуть задачу с проверки в работу может только PM/менеджер', 403);
    }
};

module.exports = { canApproveFromUser, assertStatusTransition };
