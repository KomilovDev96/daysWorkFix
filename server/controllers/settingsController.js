const AppSettings = require('../models/AppSettings');
const catchAsync  = require('../utils/catchAsync');

const getOrCreate = async () => {
    let s = await AppSettings.findOne();
    if (!s) s = await AppSettings.create({});
    return s;
};

exports.getSettings = catchAsync(async (req, res) => {
    const settings = await getOrCreate();
    res.status(200).json({ status: 'success', data: { settings } });
});

exports.updateSettings = catchAsync(async (req, res) => {
    const settings = await getOrCreate();

    if (req.body.workerPermissions) {
        settings.workerPermissions = {
            ...settings.workerPermissions.toObject(),
            ...req.body.workerPermissions,
        };
    }
    if (req.body.managerPermissions) {
        settings.managerPermissions = {
            ...settings.managerPermissions.toObject(),
            ...req.body.managerPermissions,
        };
    }

    settings.updatedAt = new Date();
    await settings.save();

    res.status(200).json({ status: 'success', data: { settings } });
});
