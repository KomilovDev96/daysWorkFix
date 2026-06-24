import axios from 'axios';

// Публичный API-клиент для клиентского портала по токену.
// БЕЗ JWT-интерсептора и БЕЗ редиректа на /login при 401 —
// портал открывается заказчиком без авторизации.
const BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : 'http://localhost:5000').replace(/\/+$/, '');

export const PUBLIC_API_BASE = BASE; // для построения URL файлов (uploads/...)

const publicApi = axios.create({
    baseURL: `${BASE}/api/public`,
    headers: { 'Content-Type': 'application/json' },
});

export default publicApi;
