// ================= SOCKET CONNECTION =================

// ❌ OLD (hardcoded – Render pe issue)
// const socket = io("https://yourbackend.replit.app");

// ✅ NEW (AUTO: localhost + Render dono ke liye)
const socket = io({
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  timeout: 20000
});

// ================= DOM ELEMENTS =================
const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.querySelector('.send');

// ================= USER DATA =================
let currentUser = {
  name: '',
  gender: '',
  region: '',
  profilePicture: ''
};

// ================= COMEDY CLUB VARIABLES =================
let currentJoke = '';
let jokeCount = 0;
let likeCount = 0;

// ================= JOKES DATABASE =================
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

// ================= APPEND MESSAGE =================
const append = (message, position, userData = null) => {
  const messageElement = document.createElement('div');

  if (userData && userData.profilePicture) {
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
    messageElement.innerText = message;
    messageElement.classList.add('message', position);
  }

  messageContainer.append(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
};

// ================= SEND MESSAGE =================
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  const messageData = {
    message: message,
    user: currentUser,
    timestamp: new Date().toLocaleTimeString()
  };

  append(`You: ${message}`, 'right', currentUser);
  socket.emit('send', messageData);
  messageInput.value = '';
});

// ================= COMEDY CLUB FUNCTIONS =================
function openComedyClub() {
  document.getElementById('comedy-modal').style.display = 'flex';
}

function closeComedyClub() {
  document.getElementById('comedy-modal').style.display = 'none';
}

function getNewJoke() {
  const randomIndex = Math.floor(Math.random() * jokesDatabase.length);
  currentJoke = jokesDatabase[randomIndex];
  document.getElementById('joke-display').textContent = currentJoke;
  jokeCount++;
  document.getElementById('joke-count').textContent = jokeCount;
}

function shareJokeToChat() {
  if (!currentUser.name) {
    alert("Please join the chat first!");
    return;
  }

  const messageData = {
    message: `😂 Comedy Club Joke: ${currentJoke}`,
    user: currentUser,
    timestamp: new Date().toLocaleTimeString()
  };

  append(`You: ${messageData.message}`, 'right', currentUser);
  socket.emit('send', messageData);
  closeComedyClub();
}

// ================= JOIN MODAL =================
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const joinName = document.getElementById('join-name');
const joinGender = document.getElementById('join-gender');
const joinRegion = document.getElementById('join-region');
const joinPicture = document.getElementById('join-picture');
const profilePreview = document.getElementById('profile-preview');

// ================= PROFILE PREVIEW =================
joinPicture.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      profilePreview.src = reader.result;
      profilePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

// ================= JOIN FORM SUBMIT =================
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

  currentUser = {
    name,
    gender,
    region,
    profilePicture: ''
  };

  // 🔥 FIX: localhost → relative URL
  if (pictureFile) {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('gender', gender);
    formData.append('region', region);
    formData.append('profilePicture', pictureFile);

    try {
      const response = await fetch('/upload-profile', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      currentUser.profilePicture = result.fileUrl || URL.createObjectURL(pictureFile);
    } catch (err) {
      currentUser.profilePicture = URL.createObjectURL(pictureFile);
    }
  }

  socket.emit('new-user-joined', currentUser);
  joinModal.style.display = 'none';
  append(`You joined the chat as ${name}`, 'right', currentUser);
});

// ================= SOCKET EVENTS =================
socket.on('user-joined', (user) => {
  append(`${user.name} joined the chat`, 'left', user);
});

socket.on('receive', (data) => {
  if (!data || !data.message) return;
  append(data.message, 'left', data.user);
});

socket.on('left', (user) => {
  append(`${user.name} left the chat`, 'left', user);
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  append('Disconnected from server', 'left');
});

// ================= ON LOAD =================
window.addEventListener('load', () => {
  joinModal.style.display = 'flex';
  getNewJoke();
});