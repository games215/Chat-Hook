// index.js - Backend server for Chat Hook
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.APP_URL 
      : 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.APP_URL 
    : 'http://localhost:3000',
  credentials: true
}));

// Serve static files
app.use(express.static(path.join(__dirname, './')));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check for auto deploy
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Store online users
let onlineUsers = [];
let messageHistory = [];

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // User joins
  socket.on('user-joined', (userData) => {
    const newUser = {
      ...userData,
      id: socket.id,
      socketId: socket.id,
      connectedAt: new Date().toISOString()
    };
    
    // Remove existing user with same ID if any
    onlineUsers = onlineUsers.filter(u => u.id !== socket.id);
    onlineUsers.push(newUser);
    
    // Send message history to new user
    socket.emit('message-history', messageHistory);
    
    // Broadcast to all users
    io.emit('online-users', onlineUsers);
    
    // Welcome message
    const welcomeMsg = {
      text: `👋 Welcome ${newUser.name} to Chat Hook!`,
      user: {
        id: 'system',
        name: 'System',
        country: 'Chat Hook'
      },
      timestamp: new Date().toISOString()
    };
    socket.emit('message', welcomeMsg);
    
    // Broadcast join message
    const joinMsg = {
      text: `🎉 ${newUser.name} joined the chat!`,
      user: {
        id: 'system',
        name: 'System',
        country: 'Chat Hook'
      },
      timestamp: new Date().toISOString()
    };
    socket.broadcast.emit('message', joinMsg);
  });

  // User updated (profile change)
  socket.on('user-updated', (updatedUser) => {
    const index = onlineUsers.findIndex(u => u.id === socket.id);
    if (index !== -1) {
      onlineUsers[index] = { ...updatedUser, id: socket.id };
      io.emit('online-users', onlineUsers);
      
      // Broadcast update message
      const updateMsg = {
        text: `✏️ ${updatedUser.name} updated their profile`,
        user: {
          id: 'system',
          name: 'System',
          country: 'Chat Hook'
        },
        timestamp: new Date().toISOString()
      };
      io.emit('message', updateMsg);
    }
  });

  // Send message
  socket.on('send-message', (messageData) => {
    const message = {
      ...messageData,
      id: Date.now() + Math.random().toString(36)
    };
    
    // Store in history (limit to 100 messages)
    messageHistory.push(message);
    if (messageHistory.length > 100) {
      messageHistory.shift();
    }
    
    // Broadcast to all users
    io.emit('message', message);
  });

  // Get user by ID
  socket.on('get-user', (userId, callback) => {
    const user = onlineUsers.find(u => u.id === userId);
    callback(user || null);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = onlineUsers.find(u => u.id === socket.id);
    onlineUsers = onlineUsers.filter(u => u.id !== socket.id);
    
    io.emit('online-users', onlineUsers);
    
    if (user) {
      const leaveMsg = {
        text: `👋 ${user.name} left the chat`,
        user: {
          id: 'system',
          name: 'System',
          country: 'Chat Hook'
        },
        timestamp: new Date().toISOString()
      };
      io.emit('message', leaveMsg);
    }
    
    console.log('User disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});