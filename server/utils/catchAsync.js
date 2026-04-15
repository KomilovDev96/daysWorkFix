/**
 * Catch errors in async functions and pass them to next middleware
 */
module.exports = fn => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};
