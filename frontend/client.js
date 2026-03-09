// ===================================================
// ✅ CHAT HOOK - REAL-TIME GLOBAL CHAT APPLICATION
// ✅ FULLY COMPATIBLE WITH RENDER.COM
// ===================================================

console.log("🔥 CLIENT JS LOADED - Version 1.0");

// ✅ **Appwrite Import Test**
import { account } from "./appwrite.js";
console.log("✅ Appwrite import successful:", account ? "Account object found" : "Account object missing");

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

// ✅ Login/Profile Elements
const loginScreen = document.getElementById('login-screen');
const profileScreen = document.getElementById('profile-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameSpan = document.getElementById('user-name');

console.log("✅ DOM elements loaded:", {
  form: !!form,
  messageInput: !!messageInput,
  joinModal: !!joinModal,
  loginScreen: !!loginScreen,
  profileScreen: !!profileScreen
});

// ===================================================
// ✅ USER DATA STORAGE
// ===================================================
let currentUser = {
  name: '',
  gender: '',
  region: '',
  profilePicture: '',
  socketId: '',
  email: '',
  googleUser: null
};

// ✅ Google Login Flag
let googleLoggedIn = false;

// Make currentUser globally available for HTML
window.currentUser = currentUser;

// ===================================================
// ✅ APPSYNC FUNCTIONS - REPLACED WITH APPCALL
// ===================================================

/**
 * Handle Google Login with Appwrite
 */
async function handleGoogleLogin() {
  console.log("🚀 handleGoogleLogin called");
  try {
    const loginBtn = document.getElementById('google-login-btn');
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '⏳ Redirecting to Google...';
    }

    console.log("📤 Redirecting to Google OAuth...");
    // Appwrite Google OAuth
    await account.createOAuth2Session(
      "google",
      "https://chat-hook-1.onrender.com",
      "https://chat-hook-1.onrender.com"
    );

  } catch (error) {
    console.error("❌ Google login error:", error);
    showConfirmationMessage("Google login failed: " + error.message, "error");
    
    const loginBtn = document.getElementById('google-login-btn');
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i>G</i> Login With Google';
    }
  }
}

/**
 * Check login status on page load - Appwrite version
 */
async function checkLoginStatus() {
  console.log("🔍 Checking login status...");
  try {
    const user = await account.get();
    console.log("✅ User found:", user);
    
    if (user) {
      currentUser.name = user.name;
      currentUser.email = user.email;
      currentUser.profilePicture = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0cf&color=fff&size=100`;
      currentUser.googleUser = user;

      renderProfileScreen(currentUser);
      
      // Hide join modal
      if (joinModal) joinModal.style.display = 'none';
      
      // Show profile container
      const profileContainer = document.getElementById('profile-container');
      if (profileContainer) profileContainer.style.display = 'block';
      
      // Update profile trigger
      const profileTrigger = document.getElementById('profile-trigger');
      if (profileTrigger) profileTrigger.textContent = user.name.charAt(0).toUpperCase();
      
      // Update profile info
      const profileInfo = document.getElementById('profile-info');
      if (profileInfo) {
        profileInfo.innerHTML = `
          <img class="profile-avatar" src="${currentUser.profilePicture}" alt="${user.name}">
          <div>
            <div class="profile-name">${user.name}</div>
            <div class="profile-email">${user.email}</div>
          </div>
        `;
      }
      
      // Pre-fill join form
      const joinNameField = document.getElementById('join-name');
      if (joinNameField) joinNameField.value = user.name;
      
      // Enable form fields
      document.querySelectorAll('#form-fields input, #form-fields select').forEach(field => {
        field.disabled = false;
      });
      document.getElementById('form-fields')?.classList.add('active');
      
      googleLoggedIn = true;
      
      showConfirmationMessage(`Welcome back, ${user.name}!`, 'success');
    }
  } catch (error) {
    console.log("ℹ️ No active session:", error.message);
    renderLoginScreen();
  }
}

/**
 * Handle logout with Appwrite
 */
async function handleLogout() {
  console.log("🚪 handleLogout called");
  try {
    await account.deleteSession("current");
    console.log("✅ Session deleted");
    
    sessionStorage.clear();
    
    // Reset user data
    currentUser = {
      name: '',
      gender: '',
      region: '',
      profilePicture: '',
      socketId: '',
      email: '',
      googleUser: null
    };
    
    googleLoggedIn = false;
    
    renderLoginScreen();
    
    // Reset join modal
    if (joinModal) {
      joinModal.style.display = 'flex';
    }
    
    // Reset form fields
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
      googleBtn.style.display = 'block';
      googleBtn.disabled = false;
      googleBtn.innerHTML = '<i>G</i> Login With Google';
    }
    
    document.getElementById('google-user-info')?.style.setProperty('display', 'none');
    document.getElementById('google-login-status')?.innerHTML = '';
    
    document.querySelectorAll('#form-fields input, #form-fields select').forEach(field => {
      field.disabled = true;
      if (field.id === 'join-name') field.value = '';
      if (field.id === 'join-birthday') field.value = '';
      if (field.id === 'join-gender') field.value = '';
      if (field.id === 'join-region') field.value = '';
    });
    
    document.getElementById('form-fields')?.classList.remove('active');
    document.getElementById('join-chat-btn')?.setAttribute('disabled', 'disabled');
    
    showConfirmationMessage('Logged out successfully', 'success');
    
    // Emit leave event
    if (socket && socket.connected) {
      socket.emit('left', { name: 'User' });
    }
    
  } catch (error) {
    console.error("❌ Logout error:", error);
    showConfirmationMessage('Logout failed: ' + error.message, 'error');
  }
}

/**
 * Render login screen
 */
function renderLoginScreen() {
  console.log("👤 Rendering login screen");
  if (loginScreen) {
    loginScreen.classList.remove('hidden');
  }
  if (profileScreen) {
    profileScreen.classList.add('hidden');
  }
}

/**
 * Render profile screen
 * @param {object} user - User data
 */
function renderProfileScreen(user) {
  console.log("👤 Rendering profile screen for:", user.name);
  if (profileScreen && userNameSpan) {
    userNameSpan.textContent = user.name || 'User';
    profileScreen.classList.remove('hidden');
  }
  if (loginScreen) {
    loginScreen.classList.add('hidden');
  }
}

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
  
  messageElement.innerHTML = `
    <div class="message-bubble">
      <div class="message-user">
        <img class="user-avatar" src="${userData.profilePicture || `https://ui-avatars.com/api/?name=${userData.name}&background=0cf&color=fff`}" alt="${userData.name}">
        <div class="user-name">${userData.name}</div>
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
 * Show temporary confirmation message
 * @param {string} message - Message to display
 * @param {string} type - Message type (success/error)
 */
function showConfirmationMessage(message, type = 'success') {
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
  confirmation.style.animation = 'slideIn 0.3s ease-out';
  
  document.body.appendChild(confirmation);
  
  setTimeout(() => {
    confirmation.style.opacity = '0';
    confirmation.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.remove();
      }
    }, 500);
  }, 2000);
}

// Add CSS animation for confirmation
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
      ...currentUser,
      name: name, 
      gender: gender, 
      region: region, 
      profilePicture: profilePicture,
      socketId: ''
    };

    // Save to session storage
    sessionStorage.setItem('chatHookUser', JSON.stringify({
      name: name,
      email: currentUser.email || '',
      picture: profilePicture
    }));

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
    
    // Show profile screen
    renderProfileScreen(currentUser);
    
    // Show profile container
    const profileContainer = document.getElementById('profile-container');
    if (profileContainer) profileContainer.style.display = 'block';
    
    // Update profile trigger
    const profileTrigger = document.getElementById('profile-trigger');
    if (profileTrigger) profileTrigger.textContent = initial;
    
    // Update profile info
    const profileInfo = document.getElementById('profile-info');
    if (profileInfo) {
      profileInfo.innerHTML = `
        <img class="profile-avatar" src="${profilePicture}" alt="${name}">
        <div>
          <div class="profile-name">${name}</div>
          <div class="profile-email">${currentUser.email || ''}</div>
        </div>
      `;
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

// ===================================================
// ✅ JOIN CHAT BUTTON HANDLER
// ===================================================

function handleJoinChat() {
  const name = document.getElementById('join-name')?.value.trim();
  const birthday = document.getElementById('join-birthday')?.value;
  const gender = document.getElementById('join-gender')?.value;
  const region = document.getElementById('join-region')?.value;

  if (!googleLoggedIn) {
    showConfirmationMessage('Please login with Google first!', 'error');
    return;
  }

  if (!name || !birthday || !gender || !region) {
    showConfirmationMessage('Please fill all fields!', 'error');
    return;
  }

  showJoinSuccessAnimation(name);
}

// ===================================================
// ✅ JOIN SUCCESS ANIMATION
// ===================================================

function showJoinSuccessAnimation(userName) {
  const successAnimation = document.getElementById('join-success-animation');
  if (successAnimation) {
    const successMessage = successAnimation.querySelector('.success-message');
    if (successMessage) {
      successMessage.textContent = `Welcome ${userName} to Chat Hook!`;
    }
    successAnimation.style.display = 'flex';
    
    setTimeout(() => {
      successAnimation.style.display = 'none';
      // Trigger join form submission
      const joinForm = document.getElementById('join-form');
      if (joinForm) {
        joinForm.dispatchEvent(new Event('submit'));
      }
    }, 2000);
  }
}

// ===================================================
// ✅ CHECK JOIN FORM COMPLETION
// ===================================================

function checkJoinFormComplete() {
  const name = document.getElementById('join-name')?.value.trim();
  const birthday = document.getElementById('join-birthday')?.value;
  const gender = document.getElementById('join-gender')?.value;
  const region = document.getElementById('join-region')?.value;
  
  const joinBtn = document.getElementById('join-chat-btn');
  
  if (joinBtn) {
    if (googleLoggedIn && name && birthday && gender && region) {
      joinBtn.disabled = false;
      joinBtn.classList.add('active');
    } else {
      joinBtn.disabled = true;
      joinBtn.classList.remove('active');
    }
  }
}

// Add event listeners for form completion check
document.addEventListener('DOMContentLoaded', () => {
  const joinName = document.getElementById('join-name');
  const joinBirthday = document.getElementById('join-birthday');
  const joinGender = document.getElementById('join-gender');
  const joinRegion = document.getElementById('join-region');
  
  if (joinName) joinName.addEventListener('input', checkJoinFormComplete);
  if (joinBirthday) joinBirthday.addEventListener('change', checkJoinFormComplete);
  if (joinGender) joinGender.addEventListener('change', checkJoinFormComplete);
  if (joinRegion) joinRegion.addEventListener('change', checkJoinFormComplete);
});

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
// ✅ EVENT LISTENERS
// ===================================================

// Login button event
if (loginBtn) {
  loginBtn.addEventListener('click', handleGoogleLogin);
}

// Logout button event
if (logoutBtn) {
  logoutBtn.addEventListener('click', handleLogout);
}

// ===================================================
// ✅ PAGE INITIALIZATION
// ===================================================

window.addEventListener('load', () => {
  console.log('🌐 Chat Hook Application Loaded');
  console.log('🌐 Server URL:', RENDER_URL);
  
  // Check login status first (Appwrite)
  checkLoginStatus();
  
  // Request notification permission
  requestNotificationPermission();

  
  // Show join modal if not logged in
  setTimeout(() => {
     if (!googleLoggedIn && joinModal) {
      joinModal.style.display = 'flex';
      const joinNameField = document.getElementById('join-name');
      if (joinNameField) {
        joinNameField.focus();
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
// ✅ EXPORT FUNCTIONS FOR HTML
// ===================================================

// Make functions globally available for HTML onclick events
window.handleGoogleLogin = handleGoogleLogin;
window.handleJoinChat = handleJoinChat;
window.handleLogout = handleLogout;
window.checkJoinFormComplete = checkJoinFormComplete;
window.showJoinSuccessAnimation = showJoinSuccessAnimation;
window.openAnimationSelector = openAnimationSelector;
window.closeAnimationSelector = closeAnimationSelector;
window.submitAnimationSelection = submitAnimationSelection;
window.activateCustomNameAnimation = activateCustomNameAnimation;
window.openComedyClub = openComedyClub;
window.closeComedyClub = closeComedyClub;
window.getNewJoke = getNewJoke;
window.shareJokeToChat = shareJokeToChat;
window.addNewJoke = addNewJoke;
window.appendMessage = appendMessage; // Make appendMessage available
window.appendSystemMessage = appendSystemMessage; // Make appendSystemMessage available

console.log("✅ All functions exported to window:", {
  handleGoogleLogin: !!window.handleGoogleLogin,
  handleJoinChat: !!window.handleJoinChat,
  handleLogout: !!window.handleLogout,
  openAnimationSelector: !!window.openAnimationSelector
});

// Animation functions (stubs - actual implementation in HTML)
function openAnimationSelector() {
  console.log('🎨 openAnimationSelector called');
  const modal = document.getElementById('animation-modal');
  if (modal) modal.style.display = 'flex';
}

function closeAnimationSelector() {
  console.log('🎨 closeAnimationSelector called');
  const modal = document.getElementById('animation-modal');
  if (modal) modal.style.display = 'none';
}

function submitAnimationSelection() {
  console.log('🎨 submitAnimationSelection called');
  closeAnimationSelector();
  showConfirmationMessage('Animation changed!', 'success');
}

function activateCustomNameAnimation() {
  console.log('🎨 activateCustomNameAnimation called');
  const nameInput = document.getElementById('custom-name-input');
  if (nameInput && nameInput.value.trim()) {
    showConfirmationMessage('Custom animation activated for: ' + nameInput.value.trim(), 'success');
  } else {
    alert('Please enter a name first');
  }
}

function openComedyClub() {
  console.log('😂 openComedyClub called');
  const modal = document.getElementById('comedy-modal');
  if (modal) modal.style.display = 'flex';
}

function closeComedyClub() {
  console.log('😂 closeComedyClub called');
  const modal = document.getElementById('comedy-modal');
  if (modal) modal.style.display = 'none';
}

function getNewJoke() {
  console.log('😂 getNewJoke called');
  const jokes = [
    "Why don't scientists trust atoms? Because they make up everything!",
    "Why did the scarecrow win an award? He was outstanding in his field!",
    "Why don't eggs tell jokes? They'd crack each other up!",
    "What do you call a fake noodle? An impasta!",
    "Why did the math book look so sad? Because it had too many problems!"
  ];
  const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
  const jokeDisplay = document.getElementById('joke-display');
  if (jokeDisplay) {
    jokeDisplay.textContent = randomJoke;
    window.currentJoke = randomJoke;
  }
}

function shareJokeToChat() {
  console.log('😂 shareJokeToChat called');
  const joke = document.getElementById('joke-display')?.textContent;
  if (joke && joke !== 'Click "New Joke" to start laughing!' && currentUser.name) {
    appendMessage(`😂 Comedy Club Joke: ${joke}`, currentUser, true);
    if (socket && socket.connected) {
      socket.emit('send', { message: `😂 Comedy Club Joke: ${joke}`, user: currentUser });
    }
    closeComedyClub();
  } else if (!currentUser.name) {
    showConfirmationMessage('Please join the chat first!', 'error');
  }
}

function addNewJoke() {
  console.log('😂 addNewJoke called');
  const newJoke = document.getElementById('new-joke-input')?.value.trim();
  if (newJoke) {
    showConfirmationMessage('Joke added! Thanks for contributing!', 'success');
    document.getElementById('new-joke-input').value = '';
  }
}

console.log("✅ CLIENT JS FULLY LOADED - All systems go!");