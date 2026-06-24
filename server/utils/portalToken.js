const crypto = require('crypto');

// Криптостойкий публичный токен портала (~32 симв., 192 бита энтропии).
// base64url — безопасен для URL (без +/=).
const generatePortalToken = () => crypto.randomBytes(24).toString('base64url');

// Генерация уникального токена с проверкой коллизии по переданной модели.
// model — mongoose-модель BoardProject; path — поле, где лежит токен.
const generateUniquePortalToken = async (model, path = 'portal.token') => {
    for (let i = 0; i < 10; i += 1) {
        const token = generatePortalToken();
        const exists = await model.exists({ [path]: token });
        if (!exists) return token;
    }
    throw new Error('Не удалось сгенерировать уникальный токен портала');
};

module.exports = { generatePortalToken, generateUniquePortalToken };
