// Лёгкий in-memory rate-limiter без внешних зависимостей.
// Достаточен для защиты от перебора пароля портала: прод работает одним
// процессом (pm2), состояние живёт в памяти. Не подходит для кластера из N
// инстансов — тогда нужен внешний стор (Redis).

const buckets = new Map(); // key -> { count, resetAt }

// Периодическая очистка протухших корзин, чтобы Map не рос бесконечно.
setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(key);
    }
}, 5 * 60 * 1000).unref();

// Фабрика middleware. windowMs — окно, max — допустимое число запросов в окне,
// keyFn — как вычислить ключ (по умолчанию IP).
const rateLimit = ({ windowMs = 60 * 1000, max = 10, keyFn, message = 'Слишком много попыток, попробуйте позже' } = {}) =>
    (req, res, next) => {
        const key = (keyFn ? keyFn(req) : req.ip) || 'unknown';
        const now = Date.now();
        let b = buckets.get(key);

        if (!b || b.resetAt <= now) {
            b = { count: 0, resetAt: now + windowMs };
            buckets.set(key, b);
        }

        b.count += 1;
        if (b.count > max) {
            const retryAfter = Math.ceil((b.resetAt - now) / 1000);
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({ status: 'fail', message });
        }
        next();
    };

module.exports = rateLimit;
