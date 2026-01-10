const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ================= MIDDLEWARES =================
app.use(cors());
app.use(express.json());

// ================= FRONTEND SERVE =================
// backend -> ../frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ================= UPLOADS FOLDER =================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// ================= MULTER CONFIG =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ================= PROFILE UPLOAD API =================
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

// ================= SOCKET USERS STORE =================
const users = {};

// ================= SOCKET EVENTS =================
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // New user joins
  socket.on('new-user-joined', (user) => {
    users[socket.id] = {
      name: user.name,
      gender: user.gender,
      region: user.region,
      profilePicture: user.profilePicture || null
    };

    socket.broadcast.emit('user-joined', users[socket.id]);
  });

  // Sending messages
  socket.on('send', (messageData) => {
    // ✅ Use client data first, fallback to server stored user
    io.emit('receive', {
      message: messageData.message,
      user: messageData.user || users[socket.id],
      timestamp: messageData.timestamp || new Date().toLocaleTimeString()
    });
  });

  // Typing events
  socket.on('typing-start', () => {
    const user = users[socket.id];
    if (user) socket.broadcast.emit('user-typing', user.name);
  });

  socket.on('typing-stop', () => {
    socket.broadcast.emit('user-stop-typing');
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit('left', user);
      delete users[socket.id];
    }
    console.log('User disconnected:', socket.id);
  });
});

// ================= OPTIONAL API =================
app.get('/connected-users', (req, res) => {
  res.json({ users: Object.values(users) });
});

// ================= SERVER START =================
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log('Server running on port:', PORT);
});
