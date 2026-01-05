// ================= IMPORTS =================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// ================= EXPRESS & SERVER =================
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
// ⚠️ frontend folder must exist
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
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

// ================= SOCKET USERS =================
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

    socket.broadcast.emit('user-joined', users[socket.id]);
  });

  socket.on('send', (messageData) => {
    const sender = users[socket.id];
    if (!sender) return;

    socket.broadcast.emit('receive', {
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
      socket.broadcast.emit('user-typing', user.name);
    }
  });

  socket.on('typing-stop', () => {
    socket.broadcast.emit('user-stop-typing');
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit('left', user);
      delete users[socket.id];
      console.log('User left:', user.name);
    }
  });
});

// ================= OPTIONAL API =================
app.get('/connected-users', (req, res) => {
  res.json({
    users: Object.values(users)
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log('Server running on port:', PORT);
});