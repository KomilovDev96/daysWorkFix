// Публичная командная ссылка не требует входа в систему, поэтому автор комментария
// определяется вручную: имя запрашивается один раз и запоминается в этом браузере.
const KEY = 'teamPortalAuthorName';

export const getStoredAuthorName = () => {
    try {
        return localStorage.getItem(KEY) || '';
    } catch {
        return '';
    }
};

export const setStoredAuthorName = (name) => {
    try {
        localStorage.setItem(KEY, name);
    } catch {
        // приватный режим/заблокировано — просто не запомним между визитами
    }
};
