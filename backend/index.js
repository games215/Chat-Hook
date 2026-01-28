const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

// ============================================
// ✅ MIDDLEWARE
// ============================================
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// ✅ SERVE FRONTEND FILES
// ============================================
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

// ============================================
// ✅ SOCKET.IO SETUP (RENDER COMPATIBLE)
// ============================================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ============================================
// ✅ HEALTH CHECK (RENDER REQUIRED)
// ============================================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    usersOnline: Object.keys(users).length
  });
});

// ============================================
// ✅ USER STORAGE
// ============================================
const users = {};

// ============================================
// ✅ SOCKET.IO LOGIC - COMPLETE FEATURES
// ============================================
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);
  
  // Send connection confirmation
  socket.emit("connection-established", {
    message: "Connected to Chat Hook server",
    socketId: socket.id
  });

  // ============================================
  // ✅ 1. USER JOINS CHAT (WITH PROFILE)
  // ============================================
  socket.on("new-user-joined", (userData) => {
    console.log("👤 New user joining:", userData);
    
    // Validate user data
    if (!userData || !userData.name || !userData.gender || !userData.region) {
      socket.emit("join-error", { message: "Please provide all details" });
      return;
    }
    
    // Store user info
    users[socket.id] = {
      id: socket.id,
      name: userData.name,
      gender: userData.gender,
      region: userData.region,
      profilePicture: userData.profilePicture || "",
      joinTime: new Date()
    };
    
    console.log(`✅ ${userData.name} joined the chat`);
    
    // Notify the joining user
    socket.emit("user-joined-self", users[socket.id]);
    
    // Notify all other users
    socket.broadcast.emit("user-joined", users[socket.id]);
    
    // Update online count for everyone
    io.emit("online-users-update", {
      count: Object.keys(users).length,
      users: Object.values(users).map(u => u.name)
    });
  });

  // ============================================
  // ✅ 2. SEND MESSAGE (WITH USER INFO)
  // ============================================
  socket.on("send", (messageData) => {
    const sender = users[socket.id];
    
    if (!sender) {
      socket.emit("send-error", { message: "Join chat first!" });
      return;
    }
    
    if (!messageData || !messageData.message || messageData.message.trim() === "") {
      socket.emit("send-error", { message: "Message cannot be empty" });
      return;
    }
    
    console.log(`📨 Message from ${sender.name}: ${messageData.message}`);
    
    // Prepare message with user info
    const fullMessage = {
      message: messageData.message,
      user: {
        name: sender.name,
        gender: sender.gender,
        region: sender.region,
        profilePicture: sender.profilePicture
      },
      timestamp: messageData.timestamp || new Date().toLocaleTimeString(),
      messageId: Date.now() + "-" + socket.id
    };
    
    // Send to all users except sender
    socket.broadcast.emit("receive", fullMessage);
    
    // Confirm to sender
    socket.emit("message-sent", {
      message: messageData.message,
      timestamp: fullMessage.timestamp
    });
  });

  // ============================================
  // ✅ 3. TYPING INDICATORS
  // ============================================
  socket.on("typing-start", () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit("user-typing", user.name);
    }
  });

  socket.on("typing-stop", () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit("user-stop-typing", user.name);
    }
  });

  // ============================================
  // ✅ 4. USER DISCONNECTS
  // ============================================
  socket.on("disconnect", () => {
    const user = users[socket.id];
    
    if (user) {
      console.log(`👋 ${user.name} disconnected`);
      
      // Notify all users
      io.emit("left", {
        name: user.name,
        gender: user.gender,
        region: user.region,
        profilePicture: user.profilePicture
      });
      
      // Remove user
      delete users[socket.id];
      
      // Update online count
      io.emit("online-users-update", {
        count: Object.keys(users).length,
        users: Object.values(users).map(u => u.name)
      });
    } else {
      console.log("ℹ️ Anonymous user disconnected:", socket.id);
    }
  });

  // ============================================
  // ✅ 5. ERROR HANDLING
  // ============================================
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// ============================================
// ✅ CONNECTED USERS API
// ============================================
app.get("/connected-users", (req, res) => {
  res.json({
    success: true,
    totalUsers: Object.keys(users).length,
    users: Object.values(users).map(user => ({
      name: user.name,
      gender: user.gender,
      region: user.region,
      onlineSince: user.joinTime
    }))
  });
});

// ============================================
// ✅ SERVE FRONTEND FOR ALL ROUTES
// ============================================
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ============================================
// ✅ START SERVER (RENDER COMPATIBLE)
// ============================================
const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("=".repeat(50));
  console.log("🚀 CHAT HOOK SERVER STARTED");
  console.log("=".repeat(50));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: https://chat-hook-1.onrender.com`);
  console.log(`📁 Frontend: ${frontendPath}`);
  console.log("=".repeat(50));
  console.log("✅ Endpoints:");
  console.log("   /              - Chat application");
  console.log("   /health        - Health check");
  console.log("   /connected-users - Online users");
  console.log("=".repeat(50));
});