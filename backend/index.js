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
// ✅ USER STORAGE WITH UPGRADED STRUCTURE
// ============================================
const users = {};

// ============================================
// ✅ HELPER FUNCTIONS
// ============================================
const getUserProfile = (userId) => {
  const user = users[userId];
  if (!user) return null;
  
  return {
    id: user.id,
    name: user.name,
    gender: user.gender,
    region: user.region,
    profilePicture: user.profilePicture || "",
    followers: user.followers.length,
    following: user.following.length,
    joinTime: user.joinTime
  };
};

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
// ✅ CONNECTED USERS API
// ============================================
app.get("/connected-users", (req, res) => {
  res.json({
    success: true,
    totalUsers: Object.keys(users).length,
    users: Object.values(users).map(user => ({
      id: user.id,
      name: user.name,
      gender: user.gender,
      region: user.region,
      profilePicture: user.profilePicture || "",
      followers: user.followers.length,
      following: user.following.length,
      onlineSince: user.joinTime
    }))
  });
});

// ============================================
// ✅ GET SPECIFIC USER PROFILE
// ============================================
app.get("/user/:userId", (req, res) => {
  const user = users[req.params.userId];
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  
  res.json({
    success: true,
    user: getUserProfile(req.params.userId)
  });
});

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
  // ✅ 1. USER JOINS CHAT (WITH PROFILE IMAGE)
  // ============================================
  socket.on("new-user-joined", (userData) => {
    console.log("👤 New user joining:", userData.name);
    
    // Validate user data
    if (!userData || !userData.name || !userData.gender || !userData.region) {
      socket.emit("join-error", { message: "Please provide all details" });
      return;
    }
    
    // Check if username already exists
    const existingUser = Object.values(users).find(u => u.name.toLowerCase() === userData.name.toLowerCase());
    if (existingUser) {
      socket.emit("join-error", { message: "Username already taken! Please choose another name." });
      return;
    }
    
    // Store user info with UPGRADED STRUCTURE + PROFILE IMAGE
    users[socket.id] = {
      id: socket.id,
      name: userData.name,
      gender: userData.gender,
      region: userData.region,
      profilePicture: userData.profilePicture || "", // 🔥 PROFILE IMAGE STORED HERE
      joinTime: new Date(),
      
      // 🔥 FOLLOW SYSTEM FIELDS
      followers: [],      // Array of user IDs who follow this user
      following: [],      // Array of user IDs this user follows
      followRequests: []  // Array of user IDs who requested to follow
    };
    
    console.log(`✅ ${userData.name} joined the chat`);
    console.log(`📸 Profile picture: ${userData.profilePicture ? "Yes" : "No"}`);
    console.log(`📊 Follow system initialized for ${userData.name}`);
    
    // Notify the joining user
    socket.emit("user-joined-self", getUserProfile(socket.id));
    
    // Notify all other users
    socket.broadcast.emit("user-joined", getUserProfile(socket.id));
    
    // Update online count for everyone
    io.emit("online-users-update", {
      count: Object.keys(users).length,
      users: Object.values(users).map(u => ({
        id: u.id,
        name: u.name,
        gender: u.gender,
        region: u.region,
        profilePicture: u.profilePicture || "",
        followers: u.followers.length,
        following: u.following.length
      }))
    });
  });

  // ============================================
  // ✅ 2. SEND MESSAGE (WITH PROFILE IMAGE)
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
    
    // Prepare message with user info INCLUDING PROFILE IMAGE
    const fullMessage = {
      message: messageData.message,
      user: {
        id: sender.id,
        name: sender.name,
        gender: sender.gender,
        region: sender.region,
        profilePicture: sender.profilePicture || "", // 🔥 PROFILE IMAGE IN MESSAGE
        followers: sender.followers.length,
        following: sender.following.length
      },
      timestamp: messageData.timestamp || new Date().toLocaleTimeString(),
      messageId: Date.now() + "-" + socket.id
    };
    
    // Send to all users except sender
    socket.broadcast.emit("receive", fullMessage);
    
    // Also send to sender (for consistency)
    socket.emit("receive", fullMessage);
    
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
      socket.broadcast.emit("user-typing", {
        name: user.name,
        id: user.id,
        profilePicture: user.profilePicture || ""
      });
    }
  });

  socket.on("typing-stop", () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit("user-stop-typing", user.name);
    }
  });

  // ============================================
  // ✅ 4. SEND FOLLOW REQUEST
  // ============================================
  socket.on("send-follow-request", ({ toUserId }) => {
    const sender = users[socket.id];
    const receiver = users[toUserId];

    if (!sender) {
      socket.emit("follow-error", { message: "You need to join chat first!" });
      return;
    }

    if (!receiver) {
      socket.emit("follow-error", { message: "User not found!" });
      return;
    }

    // Check if already following
    if (receiver.followers.includes(socket.id)) {
      socket.emit("follow-error", { message: "You are already following this user!" });
      return;
    }

    // Check if request already sent
    if (receiver.followRequests.includes(socket.id)) {
      socket.emit("follow-error", { message: "Follow request already sent!" });
      return;
    }

    // Can't follow yourself
    if (toUserId === socket.id) {
      socket.emit("follow-error", { message: "You cannot follow yourself!" });
      return;
    }

    // Add request
    receiver.followRequests.push(socket.id);
    
    console.log(`🔔 Follow request from ${sender.name} to ${receiver.name}`);

    // 🔥 Send notification to receiver with sender's profile
    io.to(toUserId).emit("new-follow-request", {
      from: sender.name,
      fromId: socket.id,
      fromProfilePicture: sender.profilePicture || "",
      fromGender: sender.gender,
      timestamp: new Date().toISOString()
    });

    // Confirm to sender
    socket.emit("follow-request-sent", {
      to: receiver.name,
      toId: toUserId
    });
  });

  // ============================================
  // ✅ 5. ACCEPT FOLLOW REQUEST
  // ============================================
  socket.on("accept-follow", ({ fromUserId }) => {
    const receiver = users[socket.id]; // jisne accept kiya
    const sender = users[fromUserId];

    if (!receiver || !sender) {
      socket.emit("follow-error", { message: "User not found!" });
      return;
    }

    // Check if request exists
    if (!receiver.followRequests.includes(fromUserId)) {
      socket.emit("follow-error", { message: "No follow request found!" });
      return;
    }

    // Remove request
    receiver.followRequests = receiver.followRequests.filter(
      id => id !== fromUserId
    );

    // Add followers/following (avoid duplicates)
    if (!receiver.followers.includes(fromUserId)) {
      receiver.followers.push(fromUserId);
    }
    
    if (!sender.following.includes(socket.id)) {
      sender.following.push(socket.id);
    }

    console.log(`✅ ${sender.name} is now following ${receiver.name}`);

    // 🔥 Update both users with full profile data
    io.to(socket.id).emit("follow-updated", {
      followers: receiver.followers.length,
      following: receiver.following.length,
      message: `${sender.name} started following you`,
      followerProfile: {
        name: sender.name,
        profilePicture: sender.profilePicture || "",
        id: sender.id
      }
    });

    io.to(fromUserId).emit("follow-updated", {
      followers: sender.followers.length,
      following: sender.following.length,
      message: `You are now following ${receiver.name}`,
      followingProfile: {
        name: receiver.name,
        profilePicture: receiver.profilePicture || "",
        id: receiver.id
      }
    });

    // Notify both users about the updated follower list
    io.to(socket.id).emit("followers-updated", {
      followers: receiver.followers.map(id => ({
        id: users[id].id,
        name: users[id].name,
        profilePicture: users[id].profilePicture || "",
        gender: users[id].gender
      }))
    });

    io.to(fromUserId).emit("following-updated", {
      following: sender.following.map(id => ({
        id: users[id].id,
        name: users[id].name,
        profilePicture: users[id].profilePicture || "",
        gender: users[id].gender
      }))
    });

    // Update online users list for everyone
    io.emit("online-users-update", {
      count: Object.keys(users).length,
      users: Object.values(users).map(u => ({
        id: u.id,
        name: u.name,
        gender: u.gender,
        region: u.region,
        profilePicture: u.profilePicture || "",
        followers: u.followers.length,
        following: u.following.length
      }))
    });
  });

  // ============================================
  // ✅ 6. REJECT FOLLOW REQUEST
  // ============================================
  socket.on("reject-follow", ({ fromUserId }) => {
    const receiver = users[socket.id];
    
    if (!receiver) return;
    
    // Remove request
    receiver.followRequests = receiver.followRequests.filter(
      id => id !== fromUserId
    );
    
    socket.emit("follow-request-rejected", {
      fromId: fromUserId
    });
    
    // Notify sender that request was rejected
    io.to(fromUserId).emit("follow-request-rejected-notification", {
      by: receiver.name
    });
  });

  // ============================================
  // ✅ 7. UNFOLLOW USER
  // ============================================
  socket.on("unfollow-user", ({ toUserId }) => {
    const unfollower = users[socket.id];
    const target = users[toUserId];
    
    if (!unfollower || !target) return;
    
    // Remove from target's followers
    target.followers = target.followers.filter(id => id !== socket.id);
    
    // Remove from unfollower's following
    unfollower.following = unfollower.following.filter(id => id !== toUserId);
    
    console.log(`❌ ${unfollower.name} unfollowed ${target.name}`);
    
    // Update both users
    io.to(socket.id).emit("follow-updated", {
      followers: unfollower.followers.length,
      following: unfollower.following.length,
      message: `You unfollowed ${target.name}`
    });
    
    io.to(toUserId).emit("follow-updated", {
      followers: target.followers.length,
      following: target.following.length,
      message: `${unfollower.name} unfollowed you`
    });
    
    // Update online users list
    io.emit("online-users-update", {
      count: Object.keys(users).length,
      users: Object.values(users).map(u => ({
        id: u.id,
        name: u.name,
        gender: u.gender,
        region: u.region,
        profilePicture: u.profilePicture || "",
        followers: u.followers.length,
        following: u.following.length
      }))
    });
  });

  // ============================================
  // ✅ 8. GET MY FOLLOWERS/FOLLOWING
  // ============================================
  socket.on("get-my-followers", () => {
    const user = users[socket.id];
    if (!user) return;
    
    const followersList = user.followers.map(id => ({
      id: users[id].id,
      name: users[id].name,
      profilePicture: users[id].profilePicture || "",
      gender: users[id].gender,
      region: users[id].region
    }));
    
    const followingList = user.following.map(id => ({
      id: users[id].id,
      name: users[id].name,
      profilePicture: users[id].profilePicture || "",
      gender: users[id].gender,
      region: users[id].region
    }));
    
    const requestsList = user.followRequests.map(id => ({
      id: users[id].id,
      name: users[id].name,
      profilePicture: users[id].profilePicture || "",
      gender: users[id].gender,
      region: users[id].region
    }));
    
    socket.emit("my-followers-data", {
      followers: followersList,
      following: followingList,
      requests: requestsList
    });
  });

  // ============================================
  // ✅ 9. CHECK IF FOLLOWING
  // ============================================
  socket.on("check-following", ({ userId }, callback) => {
    const user = users[socket.id];
    if (!user || !callback) return;
    
    const isFollowing = user.following.includes(userId);
    const hasRequested = user.followRequests.includes(userId);
    
    callback({
      isFollowing,
      hasRequested
    });
  });

  // ============================================
  // ✅ 10. UPDATE PROFILE PICTURE
  // ============================================
  socket.on("update-profile-picture", ({ profilePicture }) => {
    const user = users[socket.id];
    if (!user) return;
    
    user.profilePicture = profilePicture;
    console.log(`📸 ${user.name} updated profile picture`);
    
    // Broadcast to all users
    io.emit("profile-picture-updated", {
      userId: socket.id,
      name: user.name,
      profilePicture: profilePicture
    });
    
    // Update online users list
    io.emit("online-users-update", {
      count: Object.keys(users).length,
      users: Object.values(users).map(u => ({
        id: u.id,
        name: u.name,
        gender: u.gender,
        region: u.region,
        profilePicture: u.profilePicture || "",
        followers: u.followers.length,
        following: u.following.length
      }))
    });
  });

  // ============================================
  // ✅ 11. USER DISCONNECTS
  // ============================================
  socket.on("disconnect", () => {
    const user = users[socket.id];
    
    if (user) {
      console.log(`👋 ${user.name} disconnected`);
      
      // Notify all users
      io.emit("left", {
        id: user.id,
        name: user.name,
        gender: user.gender,
        region: user.region,
        profilePicture: user.profilePicture || ""
      });
      
      // Remove user
      delete users[socket.id];
      
      // Update online count
      io.emit("online-users-update", {
        count: Object.keys(users).length,
        users: Object.values(users).map(u => ({
          id: u.id,
          name: u.name,
          gender: u.gender,
          region: u.region,
          profilePicture: u.profilePicture || "",
          followers: u.followers.length,
          following: u.following.length
        }))
      });
    } else {
      console.log("ℹ️ Anonymous user disconnected:", socket.id);
    }
  });

  // ============================================
  // ✅ 12. ERROR HANDLING
  // ============================================
  socket.on("error", (error) => {
    console.error("Socket error:", error);
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
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📁 Frontend: ${frontendPath}`);
  console.log("=".repeat(50)); 
  console.log("✅ Endpoints:");
  console.log("   /              - Chat application");
  console.log("   /health        - Health check");
  console.log("   /connected-users - Online users");
  console.log("   /user/:userId  - Get user profile");
  console.log("=".repeat(50));
  console.log("✅ Features Added:");
  console.log("   📸 Profile Picture Support");
  console.log("   📌 Follow/Unfollow System");
  console.log("   📌 Follow Requests");
  console.log("   📌 Accept/Reject Follow");
  console.log("   📌 Real-time Chat with Images");
  console.log("   📌 Typing Indicators");
  console.log("   📌 Online Users List");
  console.log("=".repeat(50));
});