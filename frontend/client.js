// ✅ **डायनामिक Socket.IO कनेक्शन (Render के लिए)**
let socket;
const currentUrl = window.location.origin;

// Socket.IO कनेक्शन सेटअप
if (currentUrl.includes('localhost')) {
  socket = io('http://localhost:8000');
} else {
  // Render या किसी hosting पर deploy करने के लिए
  socket = io(currentUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
}

// DOM elements
const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.getElementById('message-container');

// Store user data
let currentUser = {
  name: '',
  gender: '',
  region: '',
  profilePicture: ''
};

// ✅ **मैसेज append करने का function**
const appendMessage = (message, userData, isOwn = false) => {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${isOwn ? 'own' : 'other'}`;
  
  messageElement.innerHTML = `
    <div class="message-bubble">
      <div class="message-user">
        <img class="user-avatar" src="${userData.profilePicture}" alt="${userData.name}" />
        <div class="user-name">${userData.name}</div>
      </div>
      <div class="message-content">${message}</div>
      <div class="message-meta">
        <span>${userData.gender} • ${userData.region}</span>
        <span>${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
    </div>
  `;
  
  messageContainer.appendChild(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
};

// ✅ **सिस्टम मैसेज के लिए**
const appendSystemMessage = (message) => {
  const messageElement = document.createElement('div');
  messageElement.className = 'message';
  messageElement.innerHTML = `
    <div style="text-align: center; width: 100%;">
      <div style="display: inline-block; background: rgba(100, 100, 255, 0.2); color: var(--text-muted); padding: 8px 16px; border-radius: 15px; font-size: 14px;">
        ${message}
      </div>
    </div>
  `;
  messageContainer.appendChild(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
};

// ✅ **मैसेज भेजने का event**
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  
  // ✅ खाली मैसेज न भेजें
  if (!message || message === '') {
    showConfirmationMessage('Message cannot be empty!', 'error');
    return;
  }
  
  // ✅ Validation
  if (!currentUser.name) {
    showConfirmationMessage('Please join the chat first!', 'error');
    return;
  }
  
  appendMessage(message, currentUser, true);
  
  // Socket.IO के माध्यम से मैसेज भेजें
  socket.emit('send', { 
    message: message, 
    user: currentUser,
    timestamp: new Date().toLocaleTimeString()
  });
  
  messageInput.value = '';
  showConfirmationMessage('Message sent!');
});

// ✅ **Socket.IO Event Listeners**

// जब कोई नया यूजर join करता है
socket.on('user-joined', (user) => {
  console.log('User joined:', user.name);
  appendSystemMessage(`${user.name} joined the chat`);
});

// जब आप खुद join करते हैं
socket.on('user-joined-self', (user) => {
  console.log('You joined as:', user.name);
  appendSystemMessage(`You joined as ${user.name}`);
});

// मैसेज receive करने पर
socket.on('receive', (data) => {
  console.log('Message received from:', data.user.name);
  appendMessage(data.message, data.user, false);
});

// जब कोई यूजर chat छोड़ता है
socket.on('left', (user) => {
  console.log('User left:', user.name);
  appendSystemMessage(`${user.name} left the chat`);
});

// Connection status events
socket.on('connect', () => {
  console.log('✅ Connected to server');
  showConfirmationMessage('Connected to chat server!', 'success');
  updateConnectionStatus(true);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  showConfirmationMessage('Connection error! Trying to reconnect...', 'error');
  updateConnectionStatus(false);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
  showConfirmationMessage('Disconnected from server', 'error');
  updateConnectionStatus(false);
});

// ✅ **Connection status update function**
function updateConnectionStatus(connected) {
  const statusIndicator = document.querySelector('.status-indicator');
  const statusText = document.querySelector('.connection-status span');
  
  if (connected) {
    statusIndicator.style.background = '#00ff88';
    statusText.textContent = 'Connected';
  } else {
    statusIndicator.style.background = '#ff6b6b';
    statusText.textContent = 'Disconnected';
  }
}

// ✅ **Confirmation message function**
function showConfirmationMessage(message, type = 'success') {
  const confirmation = document.createElement('div');
  confirmation.className = 'confirmation-message';
  confirmation.textContent = message;
  confirmation.style.background = type === 'success' 
    ? 'rgba(0, 255, 136, 0.9)' 
    : 'rgba(255, 107, 107, 0.9)';
  
  document.body.appendChild(confirmation);
  
  setTimeout(() => {
    confirmation.remove();
  }, 2000);
}

// ✅ **Join form functionality**
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const joinName = document.getElementById('join-name');
const joinGender = document.getElementById('join-gender');
const joinRegion = document.getElementById('join-region');

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = joinName.value.trim();
  const gender = joinGender.value;
  const region = joinRegion.value;

  if (!name || !gender || !region) {
    alert('Please fill all fields!');
    return;
  }

  currentUser = { 
    name: name, 
    gender: gender, 
    region: region, 
    profilePicture: '' 
  };

  // Generate profile picture
  const colors = ['#0cf', '#8a2be2', '#00ff88', '#ff6b6b', '#feca57', '#48dbfb'];
  const color = colors[name.length % colors.length];
  const initial = name.charAt(0).toUpperCase();
  currentUser.profilePicture = `data:image/svg+xml;base64,${btoa(`
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

  // Socket.IO के माध्यम से join करें
  socket.emit('new-user-joined', currentUser);
  joinModal.style.display = 'none';
  appendSystemMessage(`You joined the chat as ${name}`);
  
  // Success animation
  const successAnimation = document.getElementById('join-success-animation');
  const successMessage = successAnimation.querySelector('.success-message');
  successMessage.textContent = `Welcome ${name} to Chat Hook!`;
  successAnimation.style.display = 'flex';
  
  setTimeout(() => {
    successAnimation.style.display = 'none';
  }, 2000);
});

// ✅ **Typing indicators**
let typingTimeout;
messageInput.addEventListener('input', () => {
  if (!currentUser.name) return;
  
  clearTimeout(typingTimeout);
  socket.emit('typing-start');
  
  typingTimeout = setTimeout(() => {
    socket.emit('typing-stop');
  }, 1000);
});

// जब कोई typing कर रहा है
socket.on('user-typing', (userName) => {
  // आप typing indicator implement कर सकते हैं
  console.log(`${userName} is typing...`);
});

socket.on('user-stop-typing', (userName) => {
  console.log(`${userName} stopped typing`);
});

// ✅ **Initialize on page load**
window.addEventListener('load', () => {
  console.log('Page loaded, showing join modal');
  joinModal.style.display = 'flex';
  
  // Auto-test connection
  setTimeout(() => {
    if (socket.connected) {
      console.log('✅ Socket.IO connection established successfully');
    } else {
      console.log('⚠️ Socket.IO connection pending...');
    }
  }, 1000);
});