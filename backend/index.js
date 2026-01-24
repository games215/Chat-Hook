const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// 🔥 Socket.IO setup (ONLY ADD)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'], // ✅ ADD
  allowEIO3: true                         // ✅ ADD
});

// Middlewares
app.use(cors());
app.use(express.json());

// Frontend serve karne ke liye
app.use(express.static(path.join(__dirname, "../frontend")));

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Uploads folder
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Profile upload API
app.post('/upload-profile', upload.single('profilePicture'), (req, res) => {
  const { name, gender, region } = req.body;

  if (!name || !gender || !region) {
    return res.status(400).json({
      success: false,
      message: 'Missing user info'
    });
  }

  const filename = req.file ? req.file.filename : null;
  const fileUrl = filename ? `/uploads/${filename}` : null;

  res.json({
    success: true,
    filename,
    fileUrl
  });
});

// Socket users store
const users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('new-user-joined', (user) => {
    users[socket.id] = {
      name: user.name,
      gender: user.gender,
      region: user.region,
      profilePicture: user.profilePicture || null,
      socketId: socket.id,
      joinTime: new Date()
    };

    io.emit('user-joined', users[socket.id]); // 🔁 CHANGE ONLY
  });

  socket.on('send', (messageData) => {
    const sender = users[socket.id];
    if (!sender) return;

    io.emit('receive', {                    // 🔁 CHANGE ONLY
      message: messageData.message,
      user: {
        name: sender.name,
        gender: sender.gender,
        region: sender.region,
        profilePicture: sender.profilePicture
      },
      timestamp: messageData.timestamp || new Date().toLocaleTimeString()
    });
  });

  socket.on('typing-start', () => {
    const user = users[socket.id];
    if (user) {
      io.emit('user-typing', user.name); // 🔁
    }
  });

  socket.on('typing-stop', () => {
    io.emit('user-stop-typing'); // 🔁
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      io.emit('left', {          // 🔁
        name: user.name,
        gender: user.gender,
        region: user.region,
        profilePicture: user.profilePicture
      });
      delete users[socket.id];
      console.log('User left:', user.name);
    }
  });
});

// Optional API
app.get('/connected-users', (req, res) => {
  res.json({
    users: Object.values(users)
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// PORT
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log('Server running on port:', PORT);
});
