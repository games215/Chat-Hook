const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

/* ================= MIDDLEWARES ================= */
app.use(cors());
app.use(express.json());

/* ================= SERVE FRONTEND (IMPORTANT) ================= */
// 👉 Render ko batata hai index.html kaha hai
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

/* ================= ROOT ================= */
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

/* ================= UPLOADS ================= */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

/* ================= PROFILE API ================= */
app.post('/upload-profile', upload.single('profilePicture'), (req, res) => {
  const { name, gender, region } = req.body;

  if (!name || !gender || !region) {
    return res.status(400).json({ success: false });
  }

  const filename = req.file ? req.file.filename : null;

  res.json({
    success: true,
    fileUrl: filename ? `/uploads/${filename}` : null
  });
});

/* ================= SOCKET USERS ================= */
const users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('new-user-joined', (user) => {
    users[socket.id] = user;
    socket.broadcast.emit('user-joined', user);
  });

  socket.on('send', (data) => {
    const sender = users[socket.id];
    if (!sender) return;

    // 🔒 safety: user attach
    socket.broadcast.emit('receive', {
      message: data.message,
      user: sender,
      timestamp: data.timestamp
    });
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit('left', user);
      delete users[socket.id];
    }
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000; // 🔥 Render FIX
server.listen(PORT, () => {
  console.log('Server running on port:', PORT);
});
