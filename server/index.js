require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const { db, isConfigured: dbConfigured } = require('./services/firebase');

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message || err);
});

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting for AI endpoints — MUST be registered BEFORE routes
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many AI requests, please wait a moment.' }
});
app.use('/api/generate-design', aiLimiter);
app.use('/api/generate-view', aiLimiter);
app.use('/api/renovate', aiLimiter);
app.use('/api/chat', aiLimiter);

// Static uploads fallback
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const uploadRoutes = require('./routes/upload');
const designRoutes = require('./routes/design');
const renovationRoutes = require('./routes/renovation');
const costRoutes = require('./routes/cost');
const chatRoutes = require('./routes/chat');
const projectRoutes = require('./routes/project');

app.use('/api', uploadRoutes);
app.use('/api', designRoutes);
app.use('/api', renovationRoutes);
app.use('/api', costRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', projectRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), database: dbConfigured ? 'firebase' : 'in-memory' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Socket.IO connection — real-time collaboration
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    // Notify others in the project
    socket.to(`project-${projectId}`).emit('user-joined', { socketId: socket.id, timestamp: Date.now() });
  });

  socket.on('leave-project', (projectId) => {
    socket.leave(`project-${projectId}`);
    socket.to(`project-${projectId}`).emit('user-left', { socketId: socket.id });
  });

  // Cursor presence — send to all others in the project room
  socket.on('cursor-update', ({ projectId, position, tab }) => {
    socket.to(`project-${projectId}`).emit('cursor-update', { socketId: socket.id, position, tab });
  });

  // Live design notification — when someone generates a new view
  socket.on('new-design-generated', ({ projectId, designId, viewAngle }) => {
    socket.to(`project-${projectId}`).emit('new-design-available', { designId, viewAngle, by: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 GenArchAI server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Firebase:    ${dbConfigured ? '✅ configured' : '⚠️  not set (in-memory mode)'}`);
  console.log(`   HuggingFace: ${process.env.HUGGINGFACE_API_KEY ? '✅ configured' : '⚠️  not set (mock mode)'}`);
  console.log(`   Groq:        ${process.env.GROQ_API_KEY ? '✅ configured' : '⚠️  not set (mock mode)'}`);
  console.log(`   Cloudinary:  ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ configured' : '⚠️  not set (local storage)'}`);
});
