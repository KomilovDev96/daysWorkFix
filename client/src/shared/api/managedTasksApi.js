import apiClient from './apiClient';

// Задачи
export const fetchTasks        = (params) => apiClient.get('/managed-tasks', { params }).then(r => r.data.data);
export const fetchTask         = (id)     => apiClient.get(`/managed-tasks/${id}`).then(r => r.data.data.task);
export const createTask        = (body)   => apiClient.post('/managed-tasks', body).then(r => r.data.data.task);
export const updateTask        = (id, b)  => apiClient.patch(`/managed-tasks/${id}`, b).then(r => r.data.data.task);
export const deleteTask        = (id)     => apiClient.delete(`/managed-tasks/${id}`);

// Свободные часы воркера
export const fetchAvailability = (params) => apiClient.get('/managed-tasks/availability', { params }).then(r => r.data.data);

// Аналитика (admin)
export const fetchAdminAnalytics = (params) => apiClient.get('/managed-tasks/analytics', { params }).then(r => r.data.data);
export const exportMonthlyXls    = (params) => apiClient.get('/managed-tasks/analytics/export', { params, responseType: 'blob' });

// Комментарии
export const fetchComments  = (id)           => apiClient.get(`/managed-tasks/${id}/comments`).then(r => r.data.data.task);
export const addComment     = (id, text)     => apiClient.post(`/managed-tasks/${id}/comments`, { text }).then(r => r.data.data.comment);
export const deleteComment  = (id, commentId)=> apiClient.delete(`/managed-tasks/${id}/comments/${commentId}`);

// Проекты (для привязки задач)
export const fetchTaskProjects   = ()     => apiClient.get('/managed-tasks/projects').then(r => r.data.data.projects);
export const createTaskProject   = (body) => apiClient.post('/managed-tasks/projects', body).then(r => r.data.data.project);

// Отчёт менеджера
export const fetchManagerStats = (params) => apiClient.get('/managed-tasks/manager-stats', { params }).then(r => r.data.data);

// Экспорт своих выполненных задач (воркер и менеджер)
export const exportMyTasks = (params) => apiClient.get('/managed-tasks/export-my', { params, responseType: 'blob' });

// Пользователи
export const fetchWorkers  = () => apiClient.get('/auth/workers').then(r => r.data.data.users);
export const fetchManagers = () => apiClient.get('/auth/managers').then(r => r.data.data.users);

// Файлы задач
export const fetchTaskFiles  = (taskId)       => apiClient.get('/files', { params: { taskId } }).then(r => r.data.data.files);
export const uploadTaskFile  = (taskId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('taskId', taskId);
    return apiClient.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data.file);
};
export const deleteTaskFile  = (fileId)       => apiClient.delete(`/files/${fileId}`);
