const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Enable CORS
app.use(cors());

// Set static folder for file uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routers
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/daylogs', require('./routes/logRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/templates', require('./routes/projectTemplateRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));
app.use('/api/startup', require('./routes/startupRoutes'));
app.use('/api/portal',  require('./routes/portalRoutes'));
app.use('/api/board-projects', require('./routes/boardProjectRoutes'));
app.use('/api/settings',      require('./routes/settingsRoutes'));
app.use('/api/managed-tasks', require('./routes/managedTaskRoutes'));

// Root path
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Daily Work Log API' });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});
