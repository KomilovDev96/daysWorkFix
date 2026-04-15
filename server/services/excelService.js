const ExcelJS = require('exceljs');

const styleHeader = (worksheet) => {
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
    };
};

const setWrapForColumns = (worksheet, columnKeys) => {
    columnKeys.forEach((colKey) => {
        worksheet.getColumn(colKey).alignment = { wrapText: true, vertical: 'middle' };
    });
};

const getTestingStatusLabel = (status) => {
    if (status === 'completed') return 'Завершено';
    if (status === 'in_progress') return 'В процессе';
    return 'Не рассмотрено';
};

exports.generateReport = async (reportData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Work Log Report');

    // Define columns
    worksheet.columns = [
        { header: 'Пользователь', key: 'user', width: 25 },
        { header: 'Дата', key: 'date', width: 15 },
        { header: 'Проект', key: 'projectName', width: 25 },
        { header: 'Кол-во задач', key: 'tasksCount', width: 15 },
        { header: 'Названия задач', key: 'taskNames', width: 30 },
        { header: 'Детали задач', key: 'tasks', width: 40 },
        { header: 'Заказчики', key: 'customers', width: 42 },
        { header: 'Статус тестирования', key: 'testingStatuses', width: 28 },
        { header: 'Причины / Комментарии', key: 'reasons', width: 40 },
        { header: 'Часы', key: 'totalHours', width: 15 },
        { header: 'Период', key: 'period', width: 30 }
    ];

    setWrapForColumns(worksheet, ['taskNames', 'tasks', 'customers', 'testingStatuses', 'reasons']);

    // Add data
    reportData.forEach(data => {
        const taskNamesOnly = data.tasks.map(t => `- ${t.title}`).join('\n');

        const taskDetails = data.tasks.map(t => {
            let taskStr = `- ${t.title}`;
            if (t.description) taskStr += `: ${t.description}`;
            if (t.hours) taskStr += ` (${t.hours}h)`;
            return taskStr;
        }).join('\n');

        const taskComments = data.tasks.filter(t => t.comment).map(t => `- ${t.comment}`).join('\n');

        const customers = data.tasks.map((t) => {
            const customerParts = [];

            if (t.customer?.name) customerParts.push(`Имя: ${t.customer.name}`);
            if (t.customer?.externalId) customerParts.push(`ID: ${t.customer.externalId}`);
            if (t.customer?.email) customerParts.push(`Email: ${t.customer.email}`);

            const customerText = customerParts.length ? customerParts.join(', ') : 'Не указан';
            return `- ${t.title}: ${customerText}`;
        }).join('\n');

        const testingStatuses = data.tasks.map((t) => (
            `- ${t.title}: ${getTestingStatusLabel(t.testingStatus)}`
        )).join('\n');

        worksheet.addRow({
            user: data.user.name,
            date: data.date.toLocaleDateString(),
            projectName: data.projectName || '—',
            tasksCount: data.tasks.length,
            taskNames: taskNamesOnly,
            tasks: taskDetails,
            customers,
            testingStatuses,
            reasons: taskComments,
            totalHours: data.totalHours,
            period: data.period
        });
    });

    styleHeader(worksheet);

    return workbook;
};

const createBucketsSheet = (workbook, sheetName, buckets) => {
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = [
        { header: 'Период', key: 'label', width: 20 },
        { header: 'Начало', key: 'startDate', width: 14 },
        { header: 'Конец', key: 'endDate', width: 14 },
        { header: 'Часы', key: 'totalHours', width: 12 },
        { header: 'Всего задач', key: 'totalTasks', width: 14 },
        { header: 'Решено', key: 'completedTasks', width: 12 },
        { header: 'В процессе', key: 'pendingTasks', width: 12 },
        { header: 'Провалено', key: 'failedTasks', width: 12 },
        { header: 'Тест: не рассмотрено', key: 'testingNotReviewed', width: 20 },
        { header: 'Тест: в процессе', key: 'testingInProgress', width: 18 },
        { header: 'Тест: завершено', key: 'testingCompleted', width: 16 },
        { header: 'Конверсия %', key: 'completionRate', width: 14 },
    ];

    (buckets || []).forEach((bucket) => {
        worksheet.addRow({
            label: bucket.label,
            startDate: bucket.startDate,
            endDate: bucket.endDate,
            totalHours: bucket.totalHours,
            totalTasks: bucket.totalTasks,
            completedTasks: bucket.completedTasks,
            pendingTasks: bucket.pendingTasks,
            failedTasks: bucket.failedTasks,
            testingNotReviewed: bucket.testingNotReviewed,
            testingInProgress: bucket.testingInProgress,
            testingCompleted: bucket.testingCompleted,
            completionRate: bucket.completionRate,
        });
    });

    styleHeader(worksheet);
};

exports.generateAnalyticsReport = async (analytics) => {
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Сводка');

    summarySheet.columns = [
        { header: 'Метрика', key: 'metric', width: 32 },
        { header: 'Значение', key: 'value', width: 30 },
    ];

    summarySheet.addRow({ metric: 'Период начала', value: analytics?.period?.startDate || '-' });
    summarySheet.addRow({ metric: 'Период конца', value: analytics?.period?.endDate || '-' });
    summarySheet.addRow({ metric: 'Всего часов', value: analytics?.overview?.totalHours || 0 });
    summarySheet.addRow({ metric: 'Всего задач', value: analytics?.overview?.totalTasks || 0 });
    summarySheet.addRow({ metric: 'Решено задач', value: analytics?.overview?.completedTasks || 0 });
    summarySheet.addRow({ metric: 'Задач в процессе', value: analytics?.overview?.pendingTasks || 0 });
    summarySheet.addRow({ metric: 'Провалено задач', value: analytics?.overview?.failedTasks || 0 });
    summarySheet.addRow({ metric: 'Тестирование завершено', value: analytics?.overview?.testingCompleted || 0 });
    summarySheet.addRow({ metric: 'Тестирование в процессе', value: analytics?.overview?.testingInProgress || 0 });
    summarySheet.addRow({ metric: 'Тестирование не рассмотрено', value: analytics?.overview?.testingNotReviewed || 0 });
    summarySheet.addRow({ metric: 'Конверсия, %', value: analytics?.overview?.completionRate || 0 });
    summarySheet.addRow({ metric: 'Лучший период (неделя)', value: analytics?.weeklyInsights?.bestWeek?.label || '-' });
    summarySheet.addRow({ metric: 'Слабый период (неделя)', value: analytics?.weeklyInsights?.worstWeek?.label || '-' });
    summarySheet.addRow({ metric: 'Решено задач за все недели', value: analytics?.weeklyInsights?.totalResolvedTasks || 0 });

    if (analytics?.weeklyInsights?.latestVsPrevious) {
        summarySheet.addRow({ metric: 'Изменение задач: последняя vs предыдущая неделя', value: analytics.weeklyInsights.latestVsPrevious.deltaResolvedTasks });
        summarySheet.addRow({ metric: 'Изменение часов: последняя vs предыдущая неделя', value: analytics.weeklyInsights.latestVsPrevious.deltaHours });
    }

    styleHeader(summarySheet);

    createBucketsSheet(workbook, 'По дням', analytics?.daily);
    createBucketsSheet(workbook, 'По неделям', analytics?.weekly);
    createBucketsSheet(workbook, 'По месяцам', analytics?.monthly);
    createBucketsSheet(workbook, 'По годам', analytics?.yearly);

    return workbook;
};
