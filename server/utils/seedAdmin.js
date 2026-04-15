const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const adminExists = await User.findOne({ role: 'admin' });

        if (adminExists) {
            console.log('Admin already exists');
            process.exit();
        }

        const admin = await User.create({
            name: 'Super Admin',
            email: 'admin@example.com',
            password: 'password123',
            role: 'admin'
        });

        console.log('Admin created successfully:');
        console.log('Email: admin@example.com');
        console.log('Password: password123');

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedAdmin();
