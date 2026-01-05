const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

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

// ================= FRONTEND SERVE =================
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ================= SOCKET LOGIC =================
io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.id);

  socket.on('new-user-joined', (user) => {
    socket.user = user;

    // ❗ sirf dusron ko batao
    socket.broadcast.emit('user-joined', user);
  });

  socket.on('send', (data) => {
    // ✅ sabko message bhejo (sender + others)
    io.emit('receive', {
      message: data.message,
      user: data.user
    });
  });

  socket.on('disconnect', () => {
    if (socket.user) {
      socket.broadcast.emit('left', socket.user);
    }
    console.log('🔴 User disconnected:', socket.id);
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log('🚀 Server running on port', PORT);
});