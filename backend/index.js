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

// ================= FRONTEND SERVE (FIXED) =================
// ⬇⬇⬇ IMPORTANT FIX ⬇⬇⬇
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ================= UPLOADS =================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
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
  const { name, gender, region } = req.body;

  if (!name || !gender || !region) {
    return res.status(400).json({ success: false });
  }

  res.json({
    success: true,
    fileUrl: req.file ? `/uploads/${req.file.filename}` : null
  });
});

// ================= SOCKET USERS =================
const users = {};

io.on('connection', (socket) => {
  socket.on('new-user-joined', (user) => {
    users[socket.id] = user;
    socket.broadcast.emit('user-joined', user);
  });

  socket.on('send', (msg) => {
    socket.broadcast.emit('receive', msg);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});