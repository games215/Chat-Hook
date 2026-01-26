const express = require('express'); 
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Socket.IO Setup with CORS Fix
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage });

app.post('/upload-profile', upload.single('profilePicture'), (req, res) => {
  const { name, gender, region } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
  res.json({ success: true, fileUrl });
});

const users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('new-user-joined', (user) => {
    users[socket.id] = { ...user, socketId: socket.id };
    socket.broadcast.emit('user-joined', users[socket.id]);
  });

  socket.on('send', (messageData) => {
    const sender = users[socket.id];
    if (!sender) return;
    socket.broadcast.emit('receive', {
      message: messageData.message,
      user: sender,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      socket.broadcast.emit('left', users[socket.id]);
      delete users[socket.id];
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log('Server running on port:', PORT));