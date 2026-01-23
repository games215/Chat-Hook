// Connect to the Socket.IO server
const socket = io("https://yourbackend.replit.app");


// DOM elements
const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.querySelector('.send');

// Store user data
let currentUser = {
  name: '',
  gender: '',
  region: '',
  profilePicture: ''
};

// COMEDY CLUB VARIABLES
let currentJoke = '';
let jokeCount = 0;
let likeCount = 0;

// Pre-loaded jokes database
const jokesDatabase = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "Why did the scarecrow win an award? He was outstanding in his field!",
  "Why don't eggs tell jokes? They'd crack each other up!",
  "What do you call a fake noodle? An impasta!",
  "Why did the math book look so sad? Because it had too many problems!",
  "What do you call a bear with no teeth? A gummy bear!",
  "Why couldn't the bicycle stand up by itself? It was two tired!",
  "What do you call a sleeping bull? A bulldozer!",
  "Why don't skeletons fight each other? They don't have the guts!",
  "What do you call a fish wearing a crown? King of the sea!",
  "Why did the coffee file a police report? It got mugged!",
  "What do you call a pony with a sore throat? A little hoarse!",
  "Why did the tomato turn red? Because it saw the salad dressing!",
  "What do you call a snowman with a suntan? A puddle!",
  "Why don't sharks eat clowns? Because they taste funny!"
];

// Append message to chat container with profile picture
const append = (message, position, userData = null) => {
  const messageElement = document.createElement('div');
  
  if (userData && userData.profilePicture) {
    // Message with profile picture
    messageElement.innerHTML = `
      <div class="message-with-avatar ${position}">
        <img src="${userData.profilePicture}" alt="${userData.name}" class="message-avatar">
        <div class="message-content">
          <div class="message-sender">${userData.name}</div>
          <div class="message-text">${message}</div>
          <div class="message-info">${userData.gender} • ${userData.region}</div>
        </div>
      </div>
    `;
  } else {
    // System message or simple message
    messageElement.innerText = message;
    messageElement.classList.add('message', position);
  }
  
  messageContainer.append(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
};

// Handle message send
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;
  
  // Send message with user data
  const messageData = {
    message: message,
    user: currentUser,
    timestamp: new Date().toLocaleTimeString()
  };
  
  append(`You: ${message}`, 'right', currentUser);
  socket.emit('send', messageData);
  messageInput.value = '';
});

// ------- COMEDY CLUB FUNCTIONS -------
function openComedyClub() {
  document.getElementById('comedy-modal').style.display = 'flex';
}

function closeComedyClub() {
  document.getElementById('comedy-modal').style.display = 'none';
}

function getNewJoke() {
  if (jokesDatabase.length === 0) {
    document.getElementById('joke-display').textContent = "No jokes available! Add some jokes first.";
    return;
  }
  
  const randomIndex = Math.floor(Math.random() * jokesDatabase.length);
  currentJoke = jokesDatabase[randomIndex];
  document.getElementById('joke-display').textContent = currentJoke;
  
  // Update counts
  jokeCount++;
  document.getElementById('joke-count').textContent = jokeCount;
  
  // Add laughter animation
  createLaughterAnimation();
  
  // Auto-like after 3 seconds if user enjoys
  setTimeout(() => {
    if (document.getElementById('comedy-modal').style.display === 'flex') {
      likeCount++;
      document.getElementById('like-count').textContent = likeCount;
    }
  }, 3000);
}

function shareJokeToChat() {
  if (currentJoke && socket && currentUser.name) {
    const messageData = {
      message: `😂 Comedy Club Joke: ${currentJoke}`,
      user: currentUser,
      timestamp: new Date().toLocaleTimeString(),
      isJoke: true
    };
    
    append(`You: ${messageData.message}`, 'right', currentUser);
    socket.emit('send', messageData);
    closeComedyClub();
    
    // Add special effect for joke sharing
    createJokeSharedAnimation();
  } else if (!currentUser.name) {
    alert("Please join the chat first to share jokes!");
  } else {
    alert("No joke to share! Get a new joke first.");
  }
}

function addNewJoke() {
  const newJokeInput = document.getElementById('new-joke-input');
  const newJoke = newJokeInput.value.trim();
  
  if (newJoke) {
    jokesDatabase.push(newJoke);
    newJokeInput.value = '';
    
    // Show success message
    showComedyMessage('Thanks for your joke! It has been added to our collection.');
    
    // Auto-show the new joke
    currentJoke = newJoke;
    document.getElementById('joke-display').textContent = currentJoke;
    createLaughterAnimation();
    
    // Update joke count
    jokeCount++;
    document.getElementById('joke-count').textContent = jokeCount;
    
    // Share to all users that new joke was added
    if (socket && currentUser.name) {
      const messageData = {
        message: `🎭 ${currentUser.name} added a new joke to Comedy Club!`,
        user: currentUser,
        timestamp: new Date().toLocaleTimeString()
      };
      socket.emit('send', messageData);
    }
  } else {
    showComedyMessage('Please write a joke first!');
  }
}

function createLaughterAnimation() {
  const emojis = ['😂', '🤣', '😆', '😄', '🎭', '👏'];
  const comedyCard = document.querySelector('.comedy-card');
  
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const laughter = document.createElement('div');
      laughter.className = 'laughter-animation';
      laughter.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      laughter.style.left = Math.random() * 80 + 10 + '%';
      comedyCard.appendChild(laughter);
      
      setTimeout(() => {
        if (comedyCard.contains(laughter)) {
          comedyCard.removeChild(laughter);
        }
      }, 2000);
    }, i * 200);
  }
}

function createJokeSharedAnimation() {
  // Add special effect in chat when joke is shared
  const messageElement = document.createElement('div');
  messageElement.innerHTML = `
    <div style="text-align: center; margin: 10px 0;">
      <div style="display: inline-block; background: linear-gradient(135deg, #ff6b6b, #feca57); color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">
        🎭 Joke Shared to Chat!
      </div>
    </div>
  `;
  messageContainer.append(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function showComedyMessage(message) {
  const jokeDisplay = document.getElementById('joke-display');
  const originalText = jokeDisplay.textContent;
  
  jokeDisplay.textContent = message;
  jokeDisplay.style.color = '#feca57';
  jokeDisplay.style.fontWeight = 'bold';
  
  setTimeout(() => {
    jokeDisplay.textContent = originalText;
    jokeDisplay.style.color = '';
    jokeDisplay.style.fontWeight = '';
  }, 2000);
}

// Close modal when clicking outside
document.getElementById('comedy-modal').addEventListener('click', function(e) {
  if (e.target === this) {
    closeComedyClub();
  }
});

// Keyboard shortcuts for Comedy Club
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === 'j') {
    e.preventDefault();
    openComedyClub();
  }
  
  if (e.key === 'Escape') {
    closeComedyClub();
  }
});

// ------- JOIN MODAL LOGIC -------
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const joinName = document.getElementById('join-name');
const joinGender = document.getElementById('join-gender');
const joinRegion = document.getElementById('join-region');
const joinPicture = document.getElementById('join-picture');
const profilePreview = document.getElementById('profile-preview');

let joined = false;

// Profile picture preview
joinPicture.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      if (profilePreview) {
        profilePreview.src = e.target.result;
        profilePreview.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }
});

joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = joinName.value.trim();
  const gender = joinGender.value;
  const region = joinRegion.value.trim();
  const pictureFile = joinPicture.files[0];

  if (!name || !gender || !region) {
    alert('Please fill all fields!');
    return;
  }

  // Store user data
  currentUser = {
    name: name,
    gender: gender,
    region: region,
    profilePicture: ''
  };

  // Handle profile picture
  if (pictureFile) {
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('gender', gender);
      formData.append('region', region);
      formData.append('profilePicture', pictureFile);

      const response = await fetch('http://localhost:8000/upload-profile', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        currentUser.profilePicture = result.fileUrl || URL.createObjectURL(pictureFile);
      } else {
        // If upload fails, use the local file URL
        currentUser.profilePicture = URL.createObjectURL(pictureFile);
      }
    } catch (error) {
      console.error('Upload error:', error);
      // Use local file URL if upload fails
      currentUser.profilePicture = URL.createObjectURL(pictureFile);
    }
  } else {
    // Generate default avatar if no picture selected
    currentUser.profilePicture = generateDefaultAvatar(name);
  }

  // Join chat
  socket.emit('new-user-joined', currentUser);
  joinModal.style.display = 'none';
  joined = true;
  
  // Show join message
  append(`You joined the chat as ${name}`, 'right', currentUser);
  
  // Show comedy club welcome message
  setTimeout(() => {
    append(`🎭 Welcome to Comedy Club! Press Ctrl+J or click the Comedy button to start laughing!`, 'left');
  }, 1000);
});

// Generate default avatar
function generateDefaultAvatar(name) {
  const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'];
  const color = colors[name.length % colors.length];
  const initial = name.charAt(0).toUpperCase();
  
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="${color}"/>
      <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="Arial">${initial}</text>
    </svg>
  `)}`;
}

// When another user joins
socket.on('user-joined', (user) => {
  append(`${user.name} joined the chat`, 'left', user);
});

// Receive messages
socket.on('receive', (data) => {
  append(data.message, 'left', data.user);
});

// When someone leaves
socket.on('left', (user) => {
  append(`${user.name} left the chat`, 'left', user);
});

// Handle connection events
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  append('Disconnected from server', 'left');
});

// Show join modal initially
window.addEventListener('load', () => {
  joinModal.style.display = 'flex';
});

// Initialize comedy club
window.addEventListener('load', () => {
  // Pre-load first joke
  getNewJoke();
});