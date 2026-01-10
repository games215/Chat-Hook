const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: "*", // Production में specific domains डालें
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middlewares
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads folder
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadDir));

// Multer configuration for file uploads
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
  const allowedTypes = /jpeg|jpg|png|gif|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Profile upload API endpoint
app.post('/upload-profile', upload.single('profilePicture'), (req, res) => {
  try {
    const { name, gender, region } = req.body;

    if (!name || !gender || !region) {
      return res.status(400).json({
        success: false,
        message: 'Missing user information'
      });
    }

    let fileUrl = null;
    if (req.file) {
      fileUrl = `/uploads/${req.file.filename}`;
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

// Test endpoint
app.get('/test', (req, res) => {
  res.json({
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    usersCount: Object.keys(users).length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Chat Server API',
    endpoints: {
      upload: 'POST /upload-profile',
      users: 'GET /connected-users',
      test: 'GET /test'
    }
  });
});

// Store connected users
const users = {};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle new user joining
  socket.on('new-user-joined', (user) => {
    users[socket.id] = {
      id: socket.id,
      name: user.name,
      gender: user.gender,
      region: user.region,
      profilePicture: user.profilePicture || null,
      joinTime: new Date()
    };

    console.log('User joined:', user.name);
    
    // Notify all other users
    socket.broadcast.emit('user-joined', users[socket.id]);
    
    // Send current users list to the new user
    socket.emit('users-list', Object.values(users));
  });

  // Handle message sending
  socket.on('send', (messageData) => {
    const sender = users[socket.id];
    if (!sender) {
      console.log('Unknown user tried to send message');
      return;
    }

    const messageWithUser = {
      message: messageData.message,
      user: {
        name: sender.name,
        gender: sender.gender,
        region: sender.region,
        profilePicture: sender.profilePicture
      },
      timestamp: messageData.timestamp || new Date().toLocaleTimeString(),
      messageId: Date.now() + Math.random().toString(36).substr(2, 9)
    };

    // Broadcast to all other users
    socket.broadcast.emit('receive', messageWithUser);
    console.log('Message sent from:', sender.name);
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

  // Handle user typing privately to someone
  socket.on('private-typing', (data) => {
    const { toUserId } = data;
    const user = users[socket.id];
    if (user && users[toUserId]) {
      io.to(toUserId).emit('private-user-typing', {
        name: user.name,
        fromUserId: socket.id
      });
    }
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
        messageId: Date.now() + Math.random().toString(36).substr(2, 9)
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

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      // Notify other users
      socket.broadcast.emit('left', {
        name: user.name,
        gender: user.gender,
        region: user.region,
        profilePicture: user.profilePicture
      });
      
      console.log('User left:', user.name);
      delete users[socket.id];
      
      // Update users list for remaining users
      io.emit('users-list-updated', Object.values(users));
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// API to get connected users
app.get('/connected-users', (req, res) => {
  res.json({
    success: true,
    count: Object.keys(users).length,
    users: Object.values(users).map(user => ({
      id: user.id,
      name: user.name,
      gender: user.gender,
      region: user.region,
      joinTime: user.joinTime,
      online: true
    }))
  });
});

// API to get server status
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    connectedUsers: Object.keys(users).length
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;