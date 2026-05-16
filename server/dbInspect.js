const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const User = require('./models/User');
const DayLog = require('./models/DayLog');
const Task = require('./models/Task');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('=== USERS ===');
    const users = await User.find().lean();
    users.forEach((u) => console.log(`- ${u.email} | role=${u.role} | tgId=${u.telegramId} | code=${u.telegramLinkCode}`));

    console.log('\n=== DAY LOGS (last 10) ===');
    const logs = await DayLog.find().sort({ date: -1 }).limit(10).populate('userId', 'email').lean();
    logs.forEach((l) => console.log(`- ${l._id} | user=${l.userId?.email} | date=${l.date.toISOString().slice(0,10)} | total=${l.totalHours}h`));

    console.log('\n=== TASKS (last 10) ===');
    const tasks = await Task.find().sort({ createdAt: -1 }).limit(10).lean();
    tasks.forEach((t) => console.log(`- ${t._id} | dayLog=${t.dayLogId} | "${t.title}" | ${t.hours}h | customer=${t.customer?.name}`));

    process.exit(0);
})();
