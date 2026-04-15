const mongoose = require('mongoose');

const permissionsBlock = {
    canViewDashboard:     { type: Boolean, default: true },
    canViewReports:       { type: Boolean, default: true },
    canViewAnalytics:     { type: Boolean, default: true },
    canViewAssistant:     { type: Boolean, default: true },
    canViewTemplates:     { type: Boolean, default: true },
    canViewProjectReport: { type: Boolean, default: true },
    canViewCustomerReport:{ type: Boolean, default: true },
    canViewStartup:       { type: Boolean, default: true },
    canViewBoard:         { type: Boolean, default: true },
    canExportExcel:       { type: Boolean, default: true },
};

// Singleton — always one record in the collection
const appSettingsSchema = new mongoose.Schema({
    workerPermissions:  { ...permissionsBlock },
    managerPermissions: { ...permissionsBlock },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AppSettings', appSettingsSchema);
