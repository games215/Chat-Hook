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

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= FRONTEND =================
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ================= UPLOADS =================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ================= API =================
app.post('/upload-profile', upload.single('profilePicture'), (req, res) => {
  res.json({
    success: true,
    fileUrl: req.file ? `/uploads/${req.file.filename}` : null
  });
});

// ================= SOCKET LOGIC =================
io.on('connection', (socket) => {
  console.log('🟢 Connected:', socket.id);

  // ✅ user attach to socket
  socket.on('new-user-joined', (user) => {
    socket.user = user;
    socket.broadcast.emit('user-joined', user);
  });

  // ✅ message handling
  socket.on('send', (data) => {
    if (!socket.user) return;

    io.emit('receive', {
      message: data.message,
      user: socket.user,
      senderId: socket.id
    });
  });

  socket.on('disconnect', () => {
    if (socket.user) {
      socket.broadcast.emit('left', socket.user);
    }
  });
});

// ================= START =================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
