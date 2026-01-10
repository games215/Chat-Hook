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
app.use(express.urlencoded({ extended: true }));

// ================= FRONTEND (IMPORTANT FIX) =================
// frontend folder ko serve karo
app.use(express.static(path.join(__dirname, '../frontend')));

// root route pe index.html bhejo
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ================= UPLOAD FOLDER =================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ================= API ROUTES =================
app.get('/test', (req, res) => {
  res.send('Server working fine');
});

app.post('/upload-profile', upload.single('profile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({
    success: true,
    imageUrl: `/uploads/${req.file.filename}`
  });
});

// ================= SOCKET LOGIC =================
let users = [];

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('new-user-joined', user => {
    socket.user = user;
    users.push(user);
    io.emit('connected-users', users);
  });

  socket.on('send', message => {
    const messageWithUser = {
      message,
      user: socket.user,
      messageId: Date.now(),
      timestamp: new Date().toISOString()
    };

    socket.broadcast.emit('receive', messageWithUser);

    socket.emit('message-sent', {
      messageId: messageWithUser.messageId,
      timestamp: messageWithUser.timestamp
    });
  });

  socket.on('disconnect', () => {
    if (socket.user) {
      users = users.filter(u => u.name !== socket.user.name);
      io.emit('connected-users', users);
    }
    console.log('User disconnected:', socket.id);
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
