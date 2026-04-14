const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*", methods: ["GET", "POST"], credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for media
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    usersOnline: Object.keys(users).length,
  });
});

// ============================================
// USER STORAGE
// ============================================
const users = {};       // socket.id -> user info
const usersByName = {}; // name -> full persistent user data

// ============================================
// SOCKET.IO LOGIC
// ============================================
io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  socket.emit("connection-established", {
    message: "Connected to Chat Hook server",
    socketId: socket.id,
  });

  // ============================================
  // JOIN — NO username conflict checking, everyone joins freely
  // ============================================
  socket.on("join", (userData, callback) => {
    if (!userData || !userData.name || !userData.gender || !userData.region) {
      if (callback) callback({ success: false, message: "Please provide all details" });
      return;
    }

    const name = userData.name.trim();
    const isRejoin = !!usersByName[name];

    // Merge persisted data with incoming data (incoming wins for profile fields)
    const persisted = usersByName[name] || {};
    const fullUser = {
      id: socket.id,
      name,
      gender: userData.gender,
      region: userData.region,
      avatarStyle: userData.avatarStyle || persisted.avatarStyle || "av-gradient",
      picEffect: userData.picEffect || persisted.picEffect || "pfx-none",
      photoUrl: userData.photoUrl !== undefined ? userData.photoUrl : (persisted.photoUrl || ""),
      bio: userData.bio !== undefined ? userData.bio : (persisted.bio || ""),
      youtube: userData.youtube !== undefined ? userData.youtube : (persisted.youtube || ""),
      instagram: userData.instagram !== undefined ? userData.instagram : (persisted.instagram || ""),
      mood: userData.mood !== undefined ? userData.mood : (persisted.mood || ""),
      followers: userData.followers || persisted.followers || [],
      following: userData.following || persisted.following || [],
      totalLikes: userData.totalLikes || persisted.totalLikes || 0,
      nameChangedOnce: userData.nameChangedOnce || persisted.nameChangedOnce || false,
      nameChangeTs: userData.nameChangeTs || persisted.nameChangeTs || 0,
      joinTime: persisted.joinTime || new Date(),
    };

    users[socket.id] = fullUser;
    usersByName[name] = fullUser;

    if (callback) callback({ success: true, user: fullUser });

    // Announce to others
    if (isRejoin) {
      socket.broadcast.emit("user-rejoined", fullUser);
    } else {
      socket.broadcast.emit("user-joined", fullUser);
    }

    // Send current online users list to the joining user
    socket.emit("online-users", Object.values(users));

    console.log(`${isRejoin ? "🔁 Rejoin" : "✅ Join"}: ${name}`);

    io.emit("online-users-update", {
      count: Object.keys(users).length,
      users: Object.values(users).map((u) => ({ name: u.name, region: u.region })),
    });
  });

  // ============================================
  // NEW-USER-JOINED (profile sync after join)
  // ============================================
  socket.on("new-user-joined", (userData) => {
    if (userData && userData.name && users[socket.id]) {
      const u = users[socket.id];
      u.photoUrl = userData.photoUrl !== undefined ? userData.photoUrl : u.photoUrl;
      u.avatarStyle = userData.avatarStyle || u.avatarStyle;
      u.picEffect = userData.picEffect || u.picEffect;
      u.bio = userData.bio !== undefined ? userData.bio : u.bio;
      u.mood = userData.mood !== undefined ? userData.mood : u.mood;
      u.followers = userData.followers || u.followers;
      u.following = userData.following || u.following;
      u.totalLikes = userData.totalLikes || u.totalLikes;
      if (usersByName[u.name]) Object.assign(usersByName[u.name], u);

      // Broadcast updated profile to ALL other users so they see latest photo/avatar
      socket.broadcast.emit("user-profile-updated", {
        name: u.name,
        avatarStyle: u.avatarStyle,
        picEffect: u.picEffect,
        photoUrl: u.photoUrl,
        bio: u.bio,
        mood: u.mood,
      });
    }
  });

  // ============================================
  // SEND MESSAGE (with media support)
  // ============================================
  socket.on("send", (messageData) => {
    const sender = users[socket.id];
    if (!sender) {
      socket.emit("send-error", { message: "Join chat first!" });
      return;
    }
    if (!messageData) return;
    if (!messageData.message?.trim() && !messageData.mediaData) return;

    // Update sender's latest profile data
    if (messageData.user) {
      const u = messageData.user;
      sender.avatarStyle = u.avatarStyle || sender.avatarStyle;
      sender.picEffect = u.picEffect || sender.picEffect;
      sender.photoUrl = u.photoUrl !== undefined ? u.photoUrl : sender.photoUrl;
      sender.bio = u.bio !== undefined ? u.bio : sender.bio;
      sender.mood = u.mood !== undefined ? u.mood : sender.mood;
      sender.followers = u.followers || sender.followers;
      sender.following = u.following || sender.following;
      sender.totalLikes = u.totalLikes || sender.totalLikes;
      if (usersByName[sender.name]) Object.assign(usersByName[sender.name], sender);
    }

    const fullMessage = {
      message: messageData.message || "",
      user: {
        name: sender.name,
        gender: sender.gender,
        region: sender.region,
        avatarStyle: sender.avatarStyle,
        picEffect: sender.picEffect,
        photoUrl: sender.photoUrl,
        bio: sender.bio,
        mood: sender.mood,
        followers: sender.followers,
        following: sender.following,
        totalLikes: sender.totalLikes,
      },
      mediaData: messageData.mediaData || null,
      mediaType: messageData.mediaType || null,
      timestamp: new Date().toLocaleTimeString(),
      messageId: Date.now() + "-" + socket.id,
    };

    // Broadcast to everyone except sender
    socket.broadcast.emit("receive", fullMessage);

    socket.emit("message-sent", {
      message: messageData.message,
      timestamp: fullMessage.timestamp,
    });

    console.log(`📨 ${sender.name}: ${messageData.message || "[media]"}`);
  });

  // ============================================
  // PROFILE UPDATE BROADCAST
  // ============================================
  socket.on("profile-updated", (userData) => {
    const user = users[socket.id];
    if (!user || !userData) return;

    Object.assign(user, {
      avatarStyle: userData.avatarStyle || user.avatarStyle,
      picEffect: userData.picEffect || user.picEffect,
      photoUrl: userData.photoUrl !== undefined ? userData.photoUrl : user.photoUrl,
      bio: userData.bio !== undefined ? userData.bio : user.bio,
      mood: userData.mood !== undefined ? userData.mood : user.mood,
      youtube: userData.youtube !== undefined ? userData.youtube : user.youtube,
      instagram: userData.instagram !== undefined ? userData.instagram : user.instagram,
    });
    if (usersByName[user.name]) Object.assign(usersByName[user.name], user);

    socket.broadcast.emit("user-profile-updated", {
      name: user.name,
      avatarStyle: user.avatarStyle,
      picEffect: user.picEffect,
      photoUrl: user.photoUrl,
      bio: user.bio,
      mood: user.mood,
    });

    console.log(`👤 Profile updated: ${user.name}`);
  });

  // ============================================
  // FOLLOW REQUEST
  // ============================================
  socket.on("follow-req", (data) => {
    if (!data || !data.from || !data.to) return;

    const fromUser = users[socket.id];
    if (!fromUser) return;

    if (!fromUser.following.includes(data.to)) {
      fromUser.following.push(data.to);
      if (usersByName[fromUser.name]) usersByName[fromUser.name].following = fromUser.following;
    }

    if (usersByName[data.to] && !usersByName[data.to].followers.includes(data.from)) {
      usersByName[data.to].followers.push(data.from);
      const targetSocket = Object.keys(users).find(sid => users[sid].name === data.to);
      if (targetSocket) users[targetSocket].followers = usersByName[data.to].followers;
    }

    const targetSocketId = Object.keys(users).find((sid) => users[sid].name === data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("follow-req", {
        from: data.from,
        to: data.to,
        fromUser: {
          name: fromUser.name,
          avatarStyle: fromUser.avatarStyle,
          picEffect: fromUser.picEffect,
          photoUrl: fromUser.photoUrl,
        },
        newFollowerCount: (usersByName[data.to]?.followers || []).length,
      });
    }

    socket.emit("follow-confirmed", {
      following: data.to,
      newFollowingCount: fromUser.following.length,
    });
  });

  // ============================================
  // UNFOLLOW
  // ============================================
  socket.on("unfollow-req", (data) => {
    if (!data || !data.from || !data.to) return;

    const fromUser = users[socket.id];
    if (!fromUser) return;

    fromUser.following = fromUser.following.filter((n) => n !== data.to);
    if (usersByName[fromUser.name]) usersByName[fromUser.name].following = fromUser.following;

    if (usersByName[data.to]) {
      usersByName[data.to].followers = usersByName[data.to].followers.filter((n) => n !== data.from);
      const targetSocket = Object.keys(users).find(sid => users[sid].name === data.to);
      if (targetSocket) users[targetSocket].followers = usersByName[data.to].followers;

      const targetSocketId = Object.keys(users).find((sid) => users[sid].name === data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("unfollow-notif", {
          from: data.from,
          newFollowerCount: usersByName[data.to].followers.length,
        });
      }
    }

    socket.emit("unfollow-confirmed", {
      unfollowed: data.to,
      newFollowingCount: fromUser.following.length,
    });
  });

  // ============================================
  // LIKE MESSAGE
  // ============================================
  socket.on("like-msg", (data) => {
    if (!data || !data.from || !data.to) return;

    if (usersByName[data.to]) {
      usersByName[data.to].totalLikes = (usersByName[data.to].totalLikes || 0) + 1;
      const targetSocket = Object.keys(users).find(sid => users[sid].name === data.to);
      if (targetSocket) users[targetSocket].totalLikes = usersByName[data.to].totalLikes;
    }

    const targetSocketId = Object.keys(users).find((sid) => users[sid].name === data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("like-msg", {
        from: data.from,
        to: data.to,
        fromUser: data.fromUser,
        newTotalLikes: usersByName[data.to]?.totalLikes || 0,
      });
    }
  });

  // ============================================
  // NAME CHANGE
  // ============================================
  socket.on("name-changed", (data) => {
    const user = users[socket.id];
    if (!user || !data.newName) return;

    const oldName = user.name;
    usersByName[data.newName] = { ...usersByName[oldName], name: data.newName };
    delete usersByName[oldName];

    user.name = data.newName;

    socket.broadcast.emit("name-changed-broadcast", {
      oldName,
      newName: data.newName,
      user,
    });
  });

  // ============================================
  // MOOD UPDATE
  // ============================================
  socket.on("mood-update", (data) => {
    const user = users[socket.id];
    if (!user) return;
    user.mood = data.mood || "";
    if (usersByName[user.name]) usersByName[user.name].mood = user.mood;
    socket.broadcast.emit("mood-updated", { name: user.name, mood: user.mood });
  });

  // ============================================
  // TYPING
  // ============================================
  socket.on("typing-start", () => {
    const user = users[socket.id];
    if (user) socket.broadcast.emit("user-typing", user.name);
  });
  socket.on("typing-stop", () => {
    const user = users[socket.id];
    if (user) socket.broadcast.emit("user-stop-typing", user.name);
  });

  // ============================================
  // GET USER PROFILE
  // ============================================
  socket.on("get-user-profile", (name, callback) => {
    const userData = usersByName[name];
    if (userData && callback) {
      callback({ success: true, user: userData });
    } else if (callback) {
      callback({ success: false });
    }
  });

  // ============================================
  // DISCONNECT
  // ============================================
  socket.on("disconnect", (reason) => {
    const user = users[socket.id];
    if (!user) {
      console.log("ℹ️ Anonymous disconnected:", socket.id);
      return;
    }

    console.log(`👋 ${user.name} disconnected (${reason})`);

    setTimeout(() => {
      const stillConnected = Object.keys(users).some(
        (sid) => users[sid].name === user.name && sid !== socket.id
      );

      delete users[socket.id];

      if (!stillConnected) {
        io.emit("left", {
          name: user.name,
          gender: user.gender,
          region: user.region,
        });
        io.emit("online-users-update", {
          count: Object.keys(users).length,
          users: Object.values(users).map((u) => ({ name: u.name })),
        });
      }
    }, 3000);
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// ============================================
// REST API
// ============================================
app.get("/connected-users", (req, res) => {
  res.json({
    success: true,
    totalUsers: Object.keys(users).length,
    users: Object.values(users).map((u) => ({
      name: u.name,
      gender: u.gender,
      region: u.region,
      onlineSince: u.joinTime,
    })),
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ============================================
// START
// ============================================
const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("=".repeat(50));
  console.log("🚀 CHAT HOOK SERVER STARTED");
  console.log("=".repeat(50));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: https://chat-hook-1.onrender.com`);
  console.log("=".repeat(50));
});