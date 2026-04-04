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
      ? process.env.APP_URL || 'https://chat-hook-1.onrender.com'
      : '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.APP_URL || 'https://chat-hook-1.onrender.com'
    : '*',
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
    env: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// Store online users
let onlineUsers = [];
let messageHistory = [];

// Helper to remove user by socket id
const removeUser = (socketId) => {
  const index = onlineUsers.findIndex(u => u.id === socketId);
  if (index !== -1) {
    const removed = onlineUsers.splice(index, 1)[0];
    return removed;
  }
  return null;
};

// Helper to find user by socket id
const findUser = (socketId) => {
  return onlineUsers.find(u => u.id === socketId);
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // User joins
  socket.on('new-user-joined', (userData) => {
    // Check if user already exists with this socket id
    const existingUser = findUser(socket.id);
    if (existingUser) {
      // Update existing user data
      existingUser.name = userData.name;
      existingUser.gender = userData.gender;
      existingUser.region = userData.region;
      existingUser.avatarStyle = userData.avatarStyle || 'avatar-gradient';
      existingUser.connectedAt = new Date().toISOString();
      console.log('User updated:', existingUser.name);
    } else {
      // Add new user
      const newUser = {
        id: socket.id,
        name: userData.name || 'Anonymous',
        gender: userData.gender || 'Not specified',
        region: userData.region || 'Unknown',
        avatarStyle: userData.avatarStyle || 'avatar-gradient',
        connectedAt: new Date().toISOString()
      };
      onlineUsers.push(newUser);
      console.log('New user joined:', newUser.name);
      
      // Broadcast join message
      const joinMsg = {
        text: `🎉 ${newUser.name} joined the chat!`,
        user: {
          id: 'system',
          name: 'System',
          gender: 'System',
          region: 'Chat Hook',
          avatarStyle: 'avatar-gradient'
        },
        timestamp: new Date().toISOString()
      };
      socket.broadcast.emit('receive', { 
        message: joinMsg.text, 
        user: joinMsg.user 
      });
    }
    
    // Send message history to the new user (last 50 messages)
    const recentHistory = messageHistory.slice(-50);
    recentHistory.forEach(msg => {
      socket.emit('receive', { message: msg.text, user: msg.user });
    });
    
    // Send welcome message
    const welcomeMsg = {
      text: `👋 Welcome ${userData.name || 'User'} to Chat Hook!`,
      user: {
        id: 'system',
        name: 'System',
        gender: 'System',
        region: 'Chat Hook',
        avatarStyle: 'avatar-gradient'
      },
      timestamp: new Date().toISOString()
    };
    socket.emit('receive', { 
      message: welcomeMsg.text, 
      user: welcomeMsg.user 
    });
    
    // Broadcast updated online users list
    io.emit('online-users', onlineUsers);
  });

  // Send message
  socket.on('send', (data) => {
    if (!data || !data.message) return;
    
    const messageData = {
      text: data.message,
      user: {
        id: socket.id,
        name: data.user?.name || 'Anonymous',
        gender: data.user?.gender || 'Not specified',
        region: data.user?.region || 'Unknown',
        avatarStyle: data.user?.avatarStyle || 'avatar-gradient'
      },
      timestamp: new Date().toISOString()
    };
    
    // Store in history (limit to 100 messages)
    messageHistory.push(messageData);
    if (messageHistory.length > 100) {
      messageHistory.shift();
    }
    
    // Broadcast to all users including sender
    io.emit('receive', { 
      message: messageData.text, 
      user: messageData.user 
    });
    console.log(`Message from ${messageData.user.name}: ${messageData.text.substring(0, 50)}`);
  });

  // Name change event
  socket.on('name-changed', (data) => {
    const user = findUser(socket.id);
    if (user) {
      user.name = data.newName;
      console.log(`User renamed: ${data.oldName} -> ${data.newName}`);
      
      // Broadcast name change message
      const nameChangeMsg = {
        text: `✏️ ${data.oldName} changed their name to ${data.newName}`,
        user: {
          id: 'system',
          name: 'System',
          gender: 'System',
          region: 'Chat Hook',
          avatarStyle: 'avatar-gradient'
        },
        timestamp: new Date().toISOString()
      };
      io.emit('receive', { 
        message: nameChangeMsg.text, 
        user: nameChangeMsg.user 
      });
      io.emit('online-users', onlineUsers);
    }
  });

  // Avatar change event
  socket.on('avatar-changed', (data) => {
    const user = findUser(socket.id);
    if (user && data.avatarStyle) {
      user.avatarStyle = data.avatarStyle;
      console.log(`Avatar changed for ${user.name}: ${data.avatarStyle}`);
      io.emit('online-users', onlineUsers);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    
    if (user) {
      console.log('User disconnected:', user.name);
      const leaveMsg = {
        text: `👋 ${user.name} left the chat`,
        user: {
          id: 'system',
          name: 'System',
          gender: 'System',
          region: 'Chat Hook',
          avatarStyle: 'avatar-gradient'
        },
        timestamp: new Date().toISOString()
      };
      io.emit('receive', { 
        message: leaveMsg.text, 
        user: leaveMsg.user 
      });
      io.emit('online-users', onlineUsers);
    } else {
      console.log('Socket disconnected (no user found):', socket.id);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Chat Hook Server running on port ${PORT}`);
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

process.on('SIGINT', () => {
  console.log('SIGINT received. Closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});