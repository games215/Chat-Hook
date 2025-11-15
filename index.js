const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Handle profile picture upload
app.post('/upload-profile', upload.single('profilePicture'), (req, res) => {
  const { name, gender, region } = req.body;
  if (!name || !gender || !region) {
    return res.status(400).json({ success: false, message: 'Missing user info' });
  }

  const filename = req.file ? req.file.filename : null;
  const fileUrl = req.file ? `http://localhost:8000/uploads/${filename}` : null;
  
  res.json({ 
    success: true, 
    filename,
    fileUrl 
  });
});

// Socket.IO logic
const users = {};

io.on('connection', socket => {
  console.log('New user connected:', socket.id);

  socket.on('new-user-joined', user => {
    console.log("New user joined:", user.name, user.gender, user.region);
    
    // Store user data with socket ID
    users[socket.id] = {
      ...user,
      socketId: socket.id,
      joinTime: new Date()
    };

    // Broadcast to all other users
    socket.broadcast.emit('user-joined', user);
  });

  socket.on('send', (messageData) => {
    const sender = users[socket.id];
    if (!sender) return;

    // Prepare message data with user info
    const broadcastData = {
      message: messageData.message,
      user: {
        name: sender.name,
        gender: sender.gender,
        region: sender.region,
        profilePicture: sender.profilePicture
      },
      timestamp: messageData.timestamp || new Date().toLocaleTimeString()
    };

    // Broadcast to all other users
    socket.broadcast.emit('receive', broadcastData);
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      // Broadcast user left with full user data
      socket.broadcast.emit('left', {
        name: user.name,
        gender: user.gender,
        region: user.region,
        profilePicture: user.profilePicture
      });
      delete users[socket.id];
      console.log('User left:', user.name);
    }
    console.log('User disconnected:', socket.id);
  });

  // Optional: Handle typing indicators
  socket.on('typing-start', () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit('user-typing', user.name);
    }
  });

  socket.on('typing-stop', () => {
    socket.broadcast.emit('user-stop-typing');
  });
});

// Get connected users (optional endpoint)
app.get('/connected-users', (req, res) => {
  const connectedUsers = Object.values(users).map(user => ({
    name: user.name,
    gender: user.gender,
    region: user.region,
    joinTime: user.joinTime
  }));
  res.json({ users: connectedUsers });
});

// CHANGED LINE - Now other devices can access
server.listen(8000, '0.0.0.0', () => {
  console.log('Server running on:');
  console.log('- http://localhost:8000 (Same device)');
  console.log('- http://YOUR-IP:8000 (Other devices)');
  console.log('To find your IP: ipconfig (Windows) / ifconfig (Mac)');
});