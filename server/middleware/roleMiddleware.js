const AppError = require('../utils/appError');

module.exports = (...roles) => {
    return (req, res, next) => {
        // roles ['admin', 'worker']. role='worker'
        if (!roles.includes(req.user.role)) {
            return next(
                new AppError('You do not have permission to perform this action', 403)
            );
        }

        next();
    };
};
