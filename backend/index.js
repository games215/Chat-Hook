const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// ✅ **मुख्य सुधार: Socket.IO कॉन्फ़िगरेशन**
const io = new Server(server, {
  cors: {
    origin: "*", // सभी डोमेन की अनुमति
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'], // दोनों ट्रांसपोर्ट
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json());

// ✅ **फ्रंटएंड सर्व करें (Render के लिए जरूरी)**
app.use(express.static(path.join(__dirname, "public")));

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Uploads folder (Render-safe)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// ✅ **Multer में सिक्योरिटी फिल्टर जोड़ा**
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // ✅ सिर्फ इमेज फाइल्स की अनुमति
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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

// ✅ **Users store (मेमोरी में, production के लिए Redis/MongoDB use करें)**
const users = {};

io.on('connection', (socket) => {
  console.log('✅ New user connected:', socket.id);

  socket.on('new-user-joined', (user) => {
    // ✅ डेटा वैलिडेशन जोड़ा
    if (!user || !user.name || !user.gender || !user.region) {
      socket.emit('error', { message: 'Invalid user data' });
      return;
    }

    users[socket.id] = {
      name: user.name,
      gender: user.gender,
      region: user.region,
      profilePicture: user.profilePicture || null,
      socketId: socket.id,
      joinTime: new Date()
    };

    console.log('👤 User joined:', user.name);
    
    // ✅ सभी यूजर्स को notify करें (भेजने वाले को छोड़कर)
    socket.broadcast.emit('user-joined', users[socket.id]);
    
    // ✅ जो यूजर join किया है उसे भी confirmation दें
    socket.emit('user-joined-self', users[socket.id]);
  });

  socket.on('send', (messageData) => {
    const sender = users[socket.id];
    if (!sender) return;

    // ✅ मैसेज वैलिडेशन
    if (!messageData || !messageData.message || messageData.message.trim() === '') {
      socket.emit('error', { message: 'Message cannot be empty' });
      return;
    }

    console.log(`📨 Message from ${sender.name}: ${messageData.message}`);
    
    // ✅ सभी यूजर्स को मैसेज भेजें (भेजने वाले को छोड़कर)
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
    
    // ✅ भेजने वाले को confirmation दें
    socket.emit('message-sent', {
      message: messageData.message,
      timestamp: messageData.timestamp || new Date().toLocaleTimeString()
    });
  });

  socket.on('typing-start', () => {
    const user = users[socket.id];
    if (user) {
      // ✅ typing-stop में भी user.name भेजें
      socket.broadcast.emit('user-typing', user.name);
    }
  });

  socket.on('typing-stop', () => {
    const user = users[socket.id];
    if (user) {
      // ✅ किसने typing बंद की, यह भी बताएं
      socket.broadcast.emit('user-stop-typing', user.name);
    }
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      console.log('👋 User left:', user.name);
      socket.broadcast.emit('left', {
        name: user.name,
        gender: user.gender,
        region: user.region,
        profilePicture: user.profilePicture
      });
      delete users[socket.id];
    }
  });

  // ✅ Error handling
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Connected users API
app.get('/connected-users', (req, res) => {
  res.json({
    totalUsers: Object.keys(users).length,
    users: Object.values(users).map(user => ({
      name: user.name,
      gender: user.gender,
      region: user.region,
      onlineSince: user.joinTime
    }))
  });
});

// ✅ **Render के लिए SPA fallback (बहुत जरूरी)**
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ **PORT configuration**
const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port: ${PORT}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
  console.log(`📁 Frontend served from: ${path.join(__dirname, "public")}`);
});