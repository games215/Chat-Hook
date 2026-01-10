// ==================== RENDER COMPATIBLE INDEX.JS ====================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// ✅ Render compatible Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for Render
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ✅ Middleware setup
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve static files from public directory
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));

// ✅ Uploads directory setup
const uploadDir = path.join(publicDir, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Multer configuration for file uploads
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
    cb(new Error('Only image files are allowed! (jpeg, jpg, png, gif, svg, webp)'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ==================== API ENDPOINTS ====================

// ✅ Profile upload API endpoint
app.post('/upload-profile', upload.single('profilePicture'), (req, res) => {
  try {
    console.log('Upload request received:', {
      body: req.body,
      file: req.file ? req.file.filename : 'No file'
    });

    const { name, gender, region } = req.body;

    // Validate required fields
    if (!name || !gender || !region) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, gender, region'
      });
    }

    let fileUrl = null;
    if (req.file) {
      // For Render, use relative path
      fileUrl = `/uploads/${req.file.filename}`;
      console.log('File uploaded successfully:', fileUrl);
    } else {
      console.log('No file uploaded, using default avatar');
    }

    res.json({
      success: true,
      message: 'Profile uploaded successfully',
      filename: req.file ? req.file.filename : null,
      fileUrl: fileUrl,
      user: {
        name: name,
        gender: gender,
        region: region
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
});

// ✅ Health check endpoint (Required for Render)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'Chat App Server',
    usersCount: Object.keys(users).length
  });
});

// ✅ Server info endpoint
app.get('/info', (req, res) => {
  res.json({
    name: 'Global Chat Application',
    version: '1.0.0',
    description: 'Real-time chat with Comedy Club feature',
    endpoints: {
      upload: 'POST /upload-profile',
      health: 'GET /health',
      info: 'GET /info',
      users: 'GET /connected-users'
    },
    uploadsDir: uploadDir,
    publicDir: publicDir
  });
});

// ✅ Connected users API
app.get('/connected-users', (req, res) => {
  const usersList = Object.values(users).map(user => ({
    id: user.id,
    name: user.name,
    gender: user.gender,
    region: user.region,
    joinTime: user.joinTime,
    online: true
  }));

  res.json({
    success: true,
    count: usersList.length,
    users: usersList
  });
});

// ==================== SOCKET.IO LOGIC ====================

// Store connected users
const users = {};

io.on('connection', (socket) => {
  console.log('✅ New user connected:', socket.id);
  
  // Send welcome message
  socket.emit('welcome', {
    message: 'Welcome to Global Chat!',
    serverTime: new Date().toISOString(),
    totalUsers: Object.keys(users).length
  });

  // Handle new user joining
  socket.on('new-user-joined', (user) => {
    console.log('👤 User joined:', user.name, 'Socket ID:', socket.id);
    
    // Store user data
    users[socket.id] = {
      id: socket.id,
      name: user.name,
      gender: user.gender,
      region: user.region,
      profilePicture: user.profilePicture || null,
      joinTime: new Date(),
      lastActive: new Date()
    };

    // Notify all other users
    socket.broadcast.emit('user-joined', users[socket.id]);
    
    // Send users list to the new user
    socket.emit('users-list', Object.values(users));
    
    // Send confirmation to the new user
    socket.emit('join-success', {
      message: `Welcome ${user.name}! You have joined the chat.`,
      user: users[socket.id]
    });
    
    console.log(`Total users online: ${Object.keys(users).length}`);
  });

  // Handle message sending
  socket.on('send', (messageData) => {
    const sender = users[socket.id];
    
    if (!sender) {
      console.log('⚠️ Unknown user tried to send message:', socket.id);
      socket.emit('error', { message: 'You must join the chat first!' });
      return;
    }

    // Update last active time
    users[socket.id].lastActive = new Date();

    const messageWithUser = {
      message: messageData.message,
      user: {
        name: sender.name,
        gender: sender.gender,
        region: sender.region,
        profilePicture: sender.profilePicture
      },
      timestamp: messageData.timestamp || new Date().toLocaleTimeString(),
      messageId: Date.now() + '-' + socket.id,
      isJoke: messageData.isJoke || false
    };

    console.log(`💬 Message from ${sender.name}: ${messageData.message.substring(0, 50)}...`);

    // Broadcast to all other users
    socket.broadcast.emit('receive', messageWithUser);
    
    // Send confirmation to sender
    socket.emit('message-sent', {
      messageId: messageWithUser.messageId,
      timestamp: messageWithUser.timestamp
    });
  });

  // Handle typing indicators
  socket.on('typing-start', () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit('user-typing', {
        name: user.name,
        id: socket.id
      });
    }
  });

  socket.on('typing-stop', () => {
    socket.broadcast.emit('user-stop-typing', socket.id);
  });

  // Handle private messages
  socket.on('private-message', (data) => {
    const { toUserId, message } = data;
    const sender = users[socket.id];
    
    if (sender && users[toUserId]) {
      const privateMessage = {
        from: {
          name: sender.name,
          id: socket.id,
          profilePicture: sender.profilePicture
        },
        message: message,
        timestamp: new Date().toLocaleTimeString(),
        messageId: Date.now() + '-' + socket.id
      };
      
      // Send to the recipient
      io.to(toUserId).emit('private-message-received', privateMessage);
      
      // Send confirmation to sender
      socket.emit('private-message-sent', {
        ...privateMessage,
        to: {
          name: users[toUserId].name,
          id: toUserId
        }
      });
    }
  });

  // Handle user activity
  socket.on('user-activity', () => {
    const user = users[socket.id];
    if (user) {
      user.lastActive = new Date();
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users[socket.id];
    
    if (user) {
      console.log('👋 User left:', user.name, 'Socket ID:', socket.id);
      
      // Notify other users
      socket.broadcast.emit('left', {
        name: user.name,
        gender: user.gender,
        region: user.region,
        profilePicture: user.profilePicture
      });
      
      // Remove from users list
      delete users[socket.id];
      
      // Update users list for remaining users
      io.emit('users-list-updated', Object.values(users));
      
      console.log(`Remaining users: ${Object.keys(users).length}`);
    } else {
      console.log('ℹ️ Unknown user disconnected:', socket.id);
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    socket.emit('error-message', { 
      message: 'An error occurred',
      error: error.message 
    });
  });

  // Ping-pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
});

// ==================== SERVER SETUP ====================

// ✅ Serve main HTML file for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      success: false,
      message: 'index.html not found in public directory',
      help: 'Please create an index.html file in the public folder'
    });
  }
});

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== START SERVER ====================

// ✅ PORT configuration for Render
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Required for Render

server.listen(PORT, HOST, () => {
  console.log('='.repeat(50));
  console.log('🚀 Global Chat Application Server Started');
  console.log('='.repeat(50));
  console.log(`📡 Server URL: http://${HOST}:${PORT}`);
  console.log(`🌍 Public directory: ${publicDir}`);
  console.log(`📁 Uploads directory: ${uploadDir}`);
  console.log(`⚡ Socket.IO enabled on port: ${PORT}`);
  console.log(`🔄 CORS enabled for all origins`);
  console.log('='.repeat(50));
  console.log('✅ Server is ready to accept connections');
});

// ✅ Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  
  // Notify all connected users
  io.emit('server-shutdown', {
    message: 'Server is shutting down for maintenance',
    timestamp: new Date().toISOString()
  });
  
  // Close server after 2 seconds
  setTimeout(() => {
    server.close(() => {
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
  }, 2000);
});

// Export for testing
module.exports = { app, server, io };