const AppError = require('../utils/appError');

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });

        // Programming or other unknown error: don't leak error details
    } else {
        // Log error
        console.error('ERROR 💥', err);

        // Send generic message
        res.status(500).json({
            status: 'error',
            message: 'Something went wrong!'
        });
    }
};

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        let error = { ...err };
        error.message = err.message;

        // CastError: i.e. Invalid ID
        if (err.name === 'CastError') {
            const message = `Invalid ${err.path}: ${err.value}.`;
            error = new AppError(message, 400);
        }

        // Duplicate Key
        if (err.code === 11000) {
            const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
            const message = `Duplicate field value: ${value}. Please use another value!`;
            error = new AppError(message, 400);
        }

        // ValidationError
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(el => el.message);
            const message = `Invalid input data. ${errors.join('. ')}`;
            error = new AppError(message, 400);
        }

        // JWT Error
        if (err.name === 'JsonWebTokenError') error = new AppError('Invalid token. Please log in again!', 401);
        if (err.name === 'TokenExpiredError') error = new AppError('Your token has expired! Please log in again.', 401);

        sendErrorProd(error, res);
    }
};
