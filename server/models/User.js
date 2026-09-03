const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name'],
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 8,
        select: false,
    },
    role: {
        type: String,
        enum: ['admin', 'projectManager', 'worker', 'guest'],
        default: 'worker',
    },
    // Специализация исполнителя — только для группировки/отображения, на права доступа не влияет.
    specialization: {
        type: String,
        enum: ['frontend', 'backend', 'pm', 'tester', null],
        default: null,
    },
    telegramId: {
        type: String,
        default: null,
    },
    telegramLinkCode: {
        type: String,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    this.password = await bcrypt.hash(this.password, 12);
});

// Instance method to check password
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.index(
    { telegramId: 1 },
    { unique: true, partialFilterExpression: { telegramId: { $type: 'string' } } }
);
userSchema.index(
    { telegramLinkCode: 1 },
    { unique: true, partialFilterExpression: { telegramLinkCode: { $type: 'string' } } }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
