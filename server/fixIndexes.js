const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const coll = mongoose.connection.collection('users');

        const indexes = await coll.indexes();
        console.log('Current indexes:', indexes.map((i) => i.name));

        for (const name of ['telegramId_1', 'telegramLinkCode_1']) {
            if (indexes.find((i) => i.name === name)) {
                await coll.dropIndex(name);
                console.log('Dropped', name);
            }
        }

        // Mongoose syncIndexes will recreate per schema
        const User = require('./models/User');
        await User.syncIndexes();
        console.log('Re-synced. New indexes:', (await coll.indexes()).map((i) => i.name));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();
