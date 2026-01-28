// ====================================================
// ✅ CHAT HOOK - REAL-TIME CHAT BACKEND SERVER
// ✅ FULLY COMPATIBLE WITH RENDER.COM
// ✅ VERSION: 2.0.0
// ====================================================

// Import required modules
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// ====================================================
// ✅ SOCKET.IO CONFIGURATION FOR RENDER
// ====================================================
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for Render
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Both transports for reliability
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true // Backward compatibility
});

// ====================================================
// ✅ MIDDLEWARE SETUP
// ====================================================
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====================================================
// ✅ SERVE FRONTEND FILES
// ====================================================
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

console.log(`📁 Frontend path: ${frontendPath}`);

// ====================================================
// ✅ HEALTH CHECK ENDPOINT (REQUIRED FOR RENDER)
// ====================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'Chat Hook Backend',
    version: '2.0.0',
    usersOnline: Object.keys(users).length,
    uptime: process.uptime()
  });
});

// ====================================================
// ✅ FILE UPLOAD CONFIGURATION
// ====================================================
const uploadDir = path.join(__dirname, 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadDir}`);
}

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Only image files are allowed!'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ====================================================
// ✅ API ROUTES
// ====================================================

// Root route - serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Profile upload API
app.post('/upload-profile', upload.single('profilePicture'), (req, res) => {
  try {
    const { name, gender, region } = req.body;

    // Validate required fields
    if (!name || !gender || !region) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, gender, region'
      });
    }

    const filename = req.file ? req.file.filename : null;
    const fileUrl = filename ? `/uploads/${filename}` : null;

    res.status(200).json({
      success: true,
      message: 'Profile uploaded successfully',
      data: {
        filename: filename,
        fileUrl: fileUrl,
        user: { name, gender, region }
      }
    });

  } catch (error) {
    console.error('❌ Profile upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during upload'
    });
  }
});

// Connected users API endpoint
app.get('/connected-users', (req, res) => {
  try {
    const usersList = Object.values(users).map(user => ({
      id: user.socketId,
      name: user.name,
      gender: user.gender,
      region: user.region,
      joinTime: user.joinTime,
      onlineFor: Math.floor((new Date() - user.joinTime) / 60000) + ' minutes',
      isOnline: true
    }));
    
    res.status(200).json({
      success: true,
      data: {
        totalUsers: Object.keys(users).length,
        users: usersList
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Connected users API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch connected users'
    });
  }
});

// Server info endpoint
app.get('/server-info', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      serverName: 'Chat Hook',
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      socketIO: 'Active',
      maxFileSize: '5MB',
      allowedFileTypes: ['jpeg', 'jpg', 'png', 'gif', 'svg', 'webp'],
      onlineUsers: Object.keys(users).length
    }
  });
});

// ====================================================
// ✅ USER STORAGE (In-memory, for production use Redis/MongoDB)
// ====================================================
const users = {};

// ====================================================
// ✅ SOCKET.IO EVENT HANDLERS
// ====================================================

io.on('connection', (socket) => {
  console.log(`✅ New user connected: ${socket.id}`);
  
  // Send connection confirmation
  socket.emit('connection-established', {
    message: 'Connected to Chat Hook server',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });

  // ====================================================
  // ✅ USER JOINS THE CHAT
  // ====================================================
  socket.on('new-user-joined', (userData) => {
    try {
      // Validate user data
      if (!userData || !userData.name || !userData.gender || !userData.region) {
        socket.emit('join-error', { 
          message: 'Invalid user data. Please provide name, gender, and region.' 
        });
        return;
      }

      // Sanitize input
      const sanitizedName = userData.name.trim().substring(0, 50);
      const sanitizedGender = userData.gender.trim().substring(0, 20);
      const sanitizedRegion = userData.region.trim().substring(0, 50);

      // Store user information
      users[socket.id] = {
        name: sanitizedName,
        gender: sanitizedGender,
        region: sanitizedRegion,
        profilePicture: userData.profilePicture || null,
        socketId: socket.id,
        joinTime: new Date(),
        lastActive: new Date()
      };

      console.log(`👤 User joined: ${sanitizedName} (${socket.id})`);

      // ✅ Notify the user who just joined
      socket.emit('user-joined-self', {
        user: users[socket.id],
        message: `Welcome ${sanitizedName} to Chat Hook!`,
        timestamp: new Date().toISOString()
      });

      // ✅ Notify all OTHER users that someone joined
      socket.broadcast.emit('user-joined', {
        user: users[socket.id],
        message: `${sanitizedName} joined the chat`,
        timestamp: new Date().toISOString(),
        onlineCount: Object.keys(users).length
      });

      // ✅ Update online users count for everyone
      io.emit('online-users-update', {
        count: Object.keys(users).length,
        users: Object.values(users).map(u => ({
          name: u.name,
          gender: u.gender,
          region: u.region
        }))
      });

    } catch (error) {
      console.error(`❌ Error in new-user-joined for ${socket.id}:`, error);
      socket.emit('join-error', { 
        message: 'Failed to join chat. Please try again.' 
      });
    }
  });

  // ====================================================
  // ✅ USER SENDS A MESSAGE
  // ====================================================
  socket.on('send', (messageData) => {
    try {
      const sender = users[socket.id];
      
      // Check if user is registered
      if (!sender) {
        socket.emit('send-error', { 
          message: 'You must join the chat before sending messages.' 
        });
        return;
      }

      // Validate message
      if (!messageData || !messageData.message || messageData.message.trim() === '') {
        socket.emit('send-error', { 
          message: 'Message cannot be empty.' 
        });
        return;
      }

      // Sanitize message
      const sanitizedMessage = messageData.message.trim().substring(0, 1000);
      
      console.log(`📨 Message from ${sender.name}: ${sanitizedMessage}`);

      // Prepare message payload
      const messagePayload = {
        message: sanitizedMessage,
        user: {
          name: sender.name,
          gender: sender.gender,
          region: sender.region,
          profilePicture: sender.profilePicture
        },
        timestamp: messageData.timestamp || new Date().toLocaleTimeString(),
        serverTime: new Date().toISOString(),
        messageId: Date.now() + '-' + socket.id
      };

      // ✅ Send message to all OTHER users
      socket.broadcast.emit('receive', messagePayload);

      // ✅ Send confirmation to the sender
      socket.emit('message-sent', {
        success: true,
        message: sanitizedMessage,
        timestamp: messageData.timestamp || new Date().toLocaleTimeString(),
        messageId: messagePayload.messageId
      });

      // Update user's last active time
      users[socket.id].lastActive = new Date();

    } catch (error) {
      console.error(`❌ Error in send for ${socket.id}:`, error);
      socket.emit('send-error', { 
        message: 'Failed to send message. Please try again.' 
      });
    }
  });

  // ====================================================
  // ✅ TYPING INDICATORS
  // ====================================================
  socket.on('typing-start', () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit('user-typing', {
        userName: user.name,
        userId: socket.id
      });
    }
  });

  socket.on('typing-stop', () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit('user-stop-typing', {
        userName: user.name,
        userId: socket.id
      });
    }
  });

  // ====================================================
  // ✅ USER DISCONNECTS
  // ====================================================
  socket.on('disconnect', () => {
    try {
      const user = users[socket.id];
      
      if (user) {
        console.log(`👋 User left: ${user.name} (${socket.id})`);
        
        // Remove user from storage
        delete users[socket.id];
        
        // ✅ Notify all users that someone left
        io.emit('left', {
          user: {
            name: user.name,
            gender: user.gender,
            region: user.region,
            profilePicture: user.profilePicture
          },
          message: `${user.name} left the chat`,
          timestamp: new Date().toISOString()
        });

        // ✅ Update online users count
        io.emit('online-users-update', {
          count: Object.keys(users).length,
          users: Object.values(users).map(u => u.name)
        });
      } else {
        console.log(`ℹ️ Anonymous user disconnected: ${socket.id}`);
      }

    } catch (error) {
      console.error(`❌ Error in disconnect for ${socket.id}:`, error);
    }
  });

  // ====================================================
  // ✅ ERROR HANDLING
  // ====================================================
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });

  // ====================================================
  // ✅ PING/PONG FOR CONNECTION HEALTH
  // ====================================================
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
});

// ====================================================
// ✅ CATCH-ALL ROUTE FOR SPA (Single Page Application)
// ====================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ====================================================
// ✅ ERROR HANDLING MIDDLEWARE
// ====================================================
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ====================================================
// ✅ 404 NOT FOUND HANDLER
// ====================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.url} not found`,
    availableRoutes: ['/', '/health', '/connected-users', '/server-info', '/upload-profile']
  });
});

// ====================================================
// ✅ START SERVER
// ====================================================
const PORT = process.env.PORT || 8000;
const HOST = '0.0.0.0'; // Important for Render

server.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log('🚀 CHAT HOOK BACKEND SERVER STARTED');
  console.log('='.repeat(60));
  console.log(`📡 Server URL: http://${HOST}:${PORT}`);
  console.log(`🌐 Live URL: https://chat-hook-1.onrender.com`);
  console.log(`📁 Frontend: ${frontendPath}`);
  console.log(`📁 Uploads: ${uploadDir}`);
  console.log(`⚡ Socket.IO: Ready on /socket.io/`);
  console.log('='.repeat(60));
  console.log('✅ Available Endpoints:');
  console.log('   GET  /              - Frontend application');
  console.log('   GET  /health        - Health check');
  console.log('   GET  /connected-users - List online users');
  console.log('   GET  /server-info   - Server information');
  console.log('   POST /upload-profile - Upload profile picture');
  console.log('='.repeat(60));
  console.log('🔧 Debug:');
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Node version: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log('='.repeat(60));
  console.log('💡 Tip: Open https://chat-hook-1.onrender.com in browser');
  console.log('='.repeat(60));
});

// ====================================================
// ✅ GRACEFUL SHUTDOWN HANDLER
// ====================================================
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  
  // Close all socket connections
  io.close(() => {
    console.log('✅ Socket.IO server closed');
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for testing
module.exports = { app, server, io };