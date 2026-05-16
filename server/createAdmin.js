const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const User = require('./models/User');

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');

        const email = 'admin@gmail.com';
        const password = 'Admin1234!';
        const name = 'Administrator';

        const existing = await User.findOne({ email });
        if (existing) {
            existing.name = name;
            existing.role = 'admin';
            existing.password = password;
            await existing.save();
            console.log('Admin updated:', existing.email);
        } else {
            const admin = await User.create({ name, email, password, role: 'admin' });
            console.log('Admin created:', admin.email);
        }

        console.log('\n=== ADMIN CREDENTIALS ===');
        console.log('Email:    ', email);
        console.log('Password: ', password);
        console.log('Role:     ', 'admin');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();
