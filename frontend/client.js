// ===================================================
// ✅ FIREBASE CONFIGURATION - ADD YOUR API KEY HERE
// ===================================================

// Firebase Config
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY", // ← अपना API Key यहाँ paste करें
  authDomain: "chat-hook-a64d5.firebaseapp.com",
  projectId: "chat-hook-a64d5",
  storageBucket: "chat-hook-a64d5.firebasestorage.app",
  messagingSenderId: "206101224749",
  appId: "1:206101224749:web:6a1ebe22258dfc0d47c7a4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

// ===================================================
// ✅ GOOGLE LOGIN FUNCTION
// ===================================================

function googleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;

      console.log("✅ Logged in:", user.displayName);
      console.log("📧 Email:", user.email);
      console.log("🖼️ Photo:", user.photoURL);

      // Auto-fill join form with Google user data
      if (joinName) {
        joinName.value = user.displayName || user.email.split('@')[0];
      }

      // Tumhara socket yaha username le sakta hai
      if (socket && socket.connected) {
        socket.emit("user-joined", user.displayName || user.email.split('@')[0]);
      }

      // Show welcome message
      showConfirmationMessage(`Welcome ${user.displayName || user.email.split('@')[0]}!`, 'success');

      // Store user in localStorage
      localStorage.setItem("chatHookUser", JSON.stringify({
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL
      }));

      alert("Welcome " + (user.displayName || user.email.split('@')[0]));
    })
    .catch((error) => {
      console.error("❌ Google Login Error:", error);
      
      let errorMessage = "Google login failed! ";
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage += "Popup was closed before completing login.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage += "Only one popup request allowed at a time.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += "Network error. Please check your connection.";
      } else {
        errorMessage += error.message;
      }
      
      showConfirmationMessage(errorMessage, 'error');
    });
}

// ===================================================
// ✅ ENSURE USER EXISTS IN DATABASE (Supabase function)
// ===================================================

/**
 * Ensure user exists in database
 * @param {object} authUser - Firebase auth user object
 */
async function ensureUserInDatabase(authUser) {
  // This function is for Supabase - keep as is
  // Check if user already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.uid)
    .single();

  if (!existingUser) {
    // Generate username from email
    const username = authUser.email.split("@")[0];
    const uniqueUsername = await generateUniqueUsername(username);

    await supabase.from("users").insert([
      {
        id: authUser.uid,
        username: uniqueUsername,
        name: authUser.displayName || "",
        avatar_url: authUser.photoURL || "",
        country: "",
        gender: ""
      }
    ]);

    console.log("✅ User added to users table");
  }
}

/**
 * Generate unique username for Supabase
 * @param {string} baseUsername - Base username from email
 * @returns {string} Unique username
 */
async function generateUniqueUsername(baseUsername) {
  let username = baseUsername;
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .single();

    if (!data) break;

    username = `${baseUsername}${counter}`;
    counter++;
  }

  return username;
}

// ===================================================
// ✅ FIREBASE AUTH STATE CHANGE LISTENER
// ===================================================

// Listen for auth state changes
auth.onAuthStateChanged(async (user) => {
  if (user) {
    console.log("✅ User is logged in:", user.email);

    // Store user in localStorage
    localStorage.setItem(
      "chatHookUser",
      JSON.stringify({
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL
      })
    );

    // Auto-fill join form with Google user data
    if (joinName) {
      joinName.value = user.displayName || user.email.split('@')[0];
    }

    // You can add additional logic here
    // For example, automatically join the chat
    setTimeout(() => {
      if (joinModal && joinModal.style.display !== 'none') {
        // Auto-submit join form if you want
        // joinForm.dispatchEvent(new Event('submit'));
      }
    }, 1000);
  } else {
    console.log("❌ User is logged out");
    localStorage.removeItem("chatHookUser");
  }
});

// ===================================================
// ✅ CHAT HOOK - REAL-TIME GLOBAL CHAT APPLICATION
// ===================================================

// ✅ **Socket.IO Connection for Render**
let socket;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

// ✅ **YOUR RENDER URL - https://chat-hook-1.onrender.com**
const RENDER_URL = 'https://chat-hook-1.onrender.com';

// ✅ **Initialize Socket Connection**
function initializeSocket() {
  console.log('🚀 Connecting to server:', RENDER_URL);
  
  socket = io(RENDER_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    path: '/socket.io/'
  });

  setupSocketEvents();
}

// ===================================================
// ✅ DOM ELEMENTS
// ===================================================
const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.getElementById('message-container');
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const joinName = document.getElementById('join-name');
const joinGender = document.getElementById('join-gender');
const joinRegion = document.getElementById('join-region');

// ===================================================
// ✅ USER DATA STORAGE
// ===================================================
let currentUser = {
  name: '',
  gender: '',
  region: '',
  profilePicture: '',
  socketId: ''
};

// ===================================================
// ✅ MESSAGE DISPLAY FUNCTIONS
// ===================================================

/**
 * Append a message to the chat container
 * @param {string} message - The message text
 * @param {object} userData - User information
 * @param {boolean} isOwn - Whether it's user's own message
 */
const appendMessage = (message, userData, isOwn = false) => {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${isOwn ? 'own' : 'other'}`;
  
  const time = new Date().toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  // Get initial for avatar if no profile picture
  const initial = userData.name ? userData.name.charAt(0).toUpperCase() : '?';
  
  // Create avatar HTML
  let avatarHtml;
  if (userData.profilePicture) {
    avatarHtml = `<img class="user-avatar" src="${userData.profilePicture}" alt="${userData.name}">`;
  } else {
    const colors = ['#0cf', '#8a2be2', '#00ff88', '#ff6b6b', '#feca57', '#48dbfb'];
    const color = userData.name ? colors[userData.name.length % colors.length] : colors[0];
    avatarHtml = `<div class="user-avatar" style="background: linear-gradient(135deg, ${color}, ${color}99); display: flex; align-items: center; justify-content: center;">${initial}</div>`;
  }
  
  messageElement.innerHTML = `
    <div class="message-bubble">
      <div class="message-user">
        ${avatarHtml}
        <div class="user-name">${userData.name || 'Unknown'}</div>
      </div>
      <div class="message-content">${message}</div>
      <div class="message-meta">
        <span>${userData.gender || 'Unknown'} • ${userData.region || 'Unknown'}</span>
        <span>${time}</span>
      </div>
    </div>
  `;
  
  messageContainer.appendChild(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
};

/**
 * Append a system message (join/leave notifications)
 * @param {string} message - System message text
 * @param {string} type - Message type (info/success/error)
 */
const appendSystemMessage = (message, type = 'info') => {
  const messageElement = document.createElement('div');
  messageElement.className = 'system-message';
  
  const bgColor = type === 'success' ? 'rgba(0, 255, 136, 0.2)' : 
                  type === 'error' ? 'rgba(255, 107, 107, 0.2)' : 
                  'rgba(100, 100, 255, 0.2)';
  
  messageElement.innerHTML = `
    <div style="text-align: center; width: 100%; padding: 5px 0;">
      <div style="display: inline-block; background: ${bgColor}; color: var(--text-muted); padding: 6px 12px; border-radius: 12px; font-size: 13px; margin: 2px 0;">
        ${message}
      </div>
    </div>
  `;
  
  messageContainer.appendChild(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
};

// ===================================================
// ✅ MESSAGE SENDING FUNCTIONALITY
// ===================================================

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    
    // Validation
    if (!message) {
      showConfirmationMessage('Message cannot be empty!', 'error');
      return;
    }
    
    if (!currentUser.name) {
      showConfirmationMessage('Please join the chat first!', 'error');
      return;
    }
    
    if (!socket || !socket.connected) {
      showConfirmationMessage('Not connected to server!', 'error');
      return;
    }
    
    // Display message locally
    appendMessage(message, currentUser, true);
    
    // Send message to server
    socket.emit('send', { 
      message: message, 
      user: currentUser,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // Clear input
    messageInput.value = '';
    
    // Show confirmation
    showConfirmationMessage('Message sent!', 'success');
  });
}

// ===================================================
// ✅ SOCKET.IO EVENT LISTENERS
// ===================================================

function setupSocketEvents() {
  // ✅ Connection established
  socket.on('connect', () => {
    console.log('✅ Connected to server with ID:', socket.id);
    connectionAttempts = 0;
    showConfirmationMessage('Connected to chat server!', 'success');
    updateConnectionStatus(true);
    
    // Rejoin if user was already joined
    if (currentUser.name) {
      setTimeout(() => {
        socket.emit('new-user-joined', currentUser);
      }, 500);
    }
  });

  // ✅ User joined (others)
  socket.on('user-joined', (user) => {
    console.log('User joined:', user.name);
    appendSystemMessage(`${user.name} joined the chat`, 'info');
  });

  // ✅ Self joined confirmation
  socket.on('user-joined-self', (user) => {
    console.log('You joined as:', user.name);
    currentUser.socketId = socket.id;
    appendSystemMessage(`You joined as ${user.name}`, 'success');
  });

  // ✅ Receive message from others
  socket.on('receive', (data) => {
    console.log('Message received from:', data.user.name);
    appendMessage(data.message, data.user, false);
  });

  // ✅ User left
  socket.on('left', (user) => {
    console.log('User left:', user.name);
    appendSystemMessage(`${user.name} left the chat`, 'info');
  });

  // ✅ Message sent confirmation
  socket.on('message-sent', (data) => {
    console.log('Message sent confirmation:', data);
  });

  // ✅ Connection error
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    connectionAttempts++;
    
    if (connectionAttempts <= MAX_CONNECTION_ATTEMPTS) {
      showConfirmationMessage(`Connection error (Attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`, 'error');
    } else {
      showConfirmationMessage('Failed to connect to server. Please refresh.', 'error');
    }
    
    updateConnectionStatus(false);
  });

  // ✅ Disconnected
  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
    showConfirmationMessage('Disconnected from server', 'error');
    updateConnectionStatus(false);
  });

  // ✅ Typing indicators
  socket.on('user-typing', (userName) => {
    showTypingIndicator(userName);
  });

  socket.on('user-stop-typing', (userName) => {
    hideTypingIndicator(userName);
  });

  // ✅ Server error
  socket.on('error', (data) => {
    showConfirmationMessage(`Server Error: ${data.message}`, 'error');
  });
}

// ===================================================
// ✅ UI HELPER FUNCTIONS
// ===================================================

/**
 * Update connection status indicator
 * @param {boolean} connected - Connection status
 */
function updateConnectionStatus(connected) {
  const statusIndicator = document.querySelector('.status-indicator');
  const statusText = document.querySelector('.connection-status span');
  
  if (statusIndicator && statusText) {
    if (connected) {
      statusIndicator.style.background = '#00ff88';
      statusIndicator.style.boxShadow = '0 0 10px #00ff88';
      statusText.textContent = 'Connected';
      statusText.style.color = '#00ff88';
    } else {
      statusIndicator.style.background = '#ff6b6b';
      statusIndicator.style.boxShadow = '0 0 10px #ff6b6b';
      statusText.textContent = 'Disconnected';
      statusText.style.color = '#ff6b6b';
    }
  }
}

/**
 * Update online users count
 * @param {number} count - Number of online users
 */
function updateOnlineUsersCount(count) {
  const onlineCountElement = document.querySelector('.online-count');
  if (onlineCountElement) {
    onlineCountElement.textContent = `${count} online`;
  }
}

/**
 * Show temporary confirmation message
 * @param {string} message - Message to display
 * @param {string} type - Message type (success/error)
 */
function showConfirmationMessage(message, type = 'success') {
  // Remove any existing confirmation
  const existing = document.querySelector('.confirmation-message');
  if (existing) {
    existing.remove();
  }
  
  const confirmation = document.createElement('div');
  confirmation.className = 'confirmation-message';
  confirmation.textContent = message;
  confirmation.style.background = type === 'success' 
    ? 'rgba(0, 255, 136, 0.9)' 
    : 'rgba(255, 107, 107, 0.9)';
  
  confirmation.style.position = 'fixed';
  confirmation.style.top = '20px';
  confirmation.style.right = '20px';
  confirmation.style.padding = '12px 24px';
  confirmation.style.borderRadius = '10px';
  confirmation.style.color = 'white';
  confirmation.style.zIndex = '9999';
  confirmation.style.fontWeight = 'bold';
  confirmation.style.fontSize = '14px';
  confirmation.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  confirmation.style.animation = 'slideIn 0.3s ease';
  
  document.body.appendChild(confirmation);
  
  setTimeout(() => {
    confirmation.style.opacity = '0';
    confirmation.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.remove();
      }
    }, 500);
  }, 3000);
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

// ===================================================
// ✅ TYPING INDICATORS
// ===================================================
let typingTimeout;
let typingIndicator;

/**
 * Show typing indicator for a user
 * @param {string} userName - Name of typing user
 */
function showTypingIndicator(userName) {
  if (!typingIndicator) {
    typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.position = 'fixed';
    typingIndicator.style.bottom = '80px';
    typingIndicator.style.left = '20px';
    typingIndicator.style.background = 'rgba(0, 0, 0, 0.8)';
    typingIndicator.style.color = 'white';
    typingIndicator.style.padding = '10px 18px';
    typingIndicator.style.borderRadius = '20px';
    typingIndicator.style.fontSize = '14px';
    typingIndicator.style.zIndex = '9998';
    typingIndicator.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    document.body.appendChild(typingIndicator);
  }
  typingIndicator.textContent = `${userName} is typing...`;
  typingIndicator.style.display = 'block';
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    hideTypingIndicator();
  }, 2000);
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.style.display = 'none';
  }
}

// Typing detection
if (messageInput) {
  messageInput.addEventListener('input', () => {
    if (!currentUser.name || !socket || !socket.connected) return;
    
    clearTimeout(typingTimeout);
    socket.emit('typing-start');
    
    typingTimeout = setTimeout(() => {
      socket.emit('typing-stop');
    }, 1000);
  });
}

// ===================================================
// ✅ JOIN FORM FUNCTIONALITY
// ===================================================

if (joinForm) {
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = joinName.value.trim();
    const gender = joinGender.value;
    const region = joinRegion.value;

    // Validation
    if (!name || !gender || !region) {
      showConfirmationMessage('Please fill all fields!', 'error');
      return;
    }

    if (name.length < 2) {
      showConfirmationMessage('Name must be at least 2 characters!', 'error');
      return;
    }

    // Generate profile picture with avatar
    const colors = ['#0cf', '#8a2be2', '#00ff88', '#ff6b6b', '#feca57', '#48dbfb'];
    const color = colors[name.length % colors.length];
    const initial = name.charAt(0).toUpperCase();
    
    // Create SVG avatar
    const profilePicture = `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color}99;stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#grad)"/>
        <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="Arial, sans-serif" font-weight="bold">${initial}</text>
      </svg>
    `)}`;

    // Update current user
    currentUser = { 
      name: name, 
      gender: gender, 
      region: region, 
      profilePicture: profilePicture,
      socketId: ''
    };

    // Update user avatar in UI
    updateUserAvatar(name, profilePicture);

    // Initialize socket if not already
    if (!socket) {
      initializeSocket();
    }

    // Join chat via Socket.IO
    socket.emit('new-user-joined', currentUser);
    
    // Hide join modal
    if (joinModal) {
      joinModal.style.display = 'none';
    }
    
    // Show welcome message
    const welcomeMsg = `Welcome ${name} to Chat Hook!`;
    showConfirmationMessage(welcomeMsg, 'success');
    appendSystemMessage(welcomeMsg, 'success');
    
    // Focus on message input
    setTimeout(() => {
      if (messageInput) {
        messageInput.focus();
      }
    }, 300);
  });
}

/**
 * Update user avatar in the UI
 * @param {string} name - User name
 * @param {string} imageData - Profile picture data
 */
function updateUserAvatar(name, imageData) {
  const userAvatar = document.getElementById('userAvatar');
  if (userAvatar) {
    if (imageData) {
      userAvatar.innerHTML = `<img src="${imageData}" alt="${name}">`;
    } else {
      userAvatar.innerHTML = name.charAt(0).toUpperCase();
    }
  }
}

// ===================================================
// ✅ NOTIFICATION PERMISSION
// ===================================================

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then(permission => {
      console.log("Notification permission:", permission);
    });
  }
}

// ===================================================
// ✅ PAGE INITIALIZATION
// ===================================================

window.addEventListener('load', () => {
  console.log('🌐 Chat Hook Application Loaded');
  console.log('🌐 Server URL:', RENDER_URL);
  
  // Request notification permission
  requestNotificationPermission();
  
  // Initialize socket connection
  initializeSocket();
  
  // Check for existing session in localStorage
  const storedUser = localStorage.getItem("chatHookUser");
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      console.log("Found existing session for:", user.email);
      
      // Auto-fill join form
      if (joinName) {
        joinName.value = user.name || user.email.split('@')[0];
      }
    } catch (e) {
      console.error("Error parsing stored user:", e);
    }
  }
  
  // Check if user is already logged in via Firebase
  const currentFirebaseUser = auth.currentUser;
  if (currentFirebaseUser) {
    console.log("User already logged in via Firebase:", currentFirebaseUser.email);
    if (joinName) {
      joinName.value = currentFirebaseUser.displayName || currentFirebaseUser.email.split('@')[0];
    }
  }
  
  // Show join modal after short delay
  setTimeout(() => {
    if (joinModal) {
      joinModal.style.display = 'flex';
      // Focus on name input
      if (joinName) {
        joinName.focus();
      }
    }
  }, 800);
  
  // Auto-reconnect if disconnected
  setInterval(() => {
    if (socket && !socket.connected && socket.disconnected) {
      console.log('🔄 Attempting to reconnect...');
      socket.connect();
    }
  }, 5000);
});

// ===================================================
// ✅ ERROR HANDLING
// ===================================================

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showConfirmationMessage('An error occurred. Please refresh.', 'error');
});

// Unhandled promise rejection
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// ===================================================
// ✅ EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ===================================================

// Make functions available globally for HTML onclick handlers
window.googleLogin = googleLogin;
window.signInWithGoogle = googleLogin; // Alias for compatibility
window.showConfirmationMessage = showConfirmationMessage;