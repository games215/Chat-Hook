// ================= SOCKET CONNECTION =================

// ❌ OLD (hardcoded backend)
// const socket = io("https://yourbackend.replit.app");

// ✅ NEW (auto works on localhost + Render)
const socket = io(window.location.origin, {
  transports: ['websocket', 'polling']
});

// ✅ Debug helper (Render issues ke liye)
socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err.message);
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

// ================= COMEDY CLUB =================
let currentJoke = '';
let jokeCount = 0;
let likeCount = 0;

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

// ================= MESSAGE APPEND =================
const append = (message, position, userData = null) => {
  const messageElement = document.createElement('div');

  if (userData && userData.profilePicture) {
    messageElement.innerHTML = `
      <div class="message-with-avatar ${position}">
        <img src="${userData.profilePicture}" class="message-avatar">
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
    message,
    user: currentUser,
    timestamp: new Date().toLocaleTimeString()
  };

  append(`You: ${message}`, 'right', currentUser);
  socket.emit('send', messageData);
  messageInput.value = '';
});

// ================= COMEDY FUNCTIONS =================
function getNewJoke() {
  const index = Math.floor(Math.random() * jokesDatabase.length);
  currentJoke = jokesDatabase[index];
  document.getElementById('joke-display').textContent = currentJoke;
  jokeCount++;
  document.getElementById('joke-count').textContent = jokeCount;
}

function openComedyClub() {
  document.getElementById('comedy-modal').style.display = 'flex';
}

function closeComedyClub() {
  document.getElementById('comedy-modal').style.display = 'none';
}

function shareJokeToChat() {
  if (!currentUser.name) return alert("Join first!");

  const msg = `😂 Comedy Club Joke: ${currentJoke}`;
  append(`You: ${msg}`, 'right', currentUser);
  socket.emit('send', {
    message: msg,
    user: currentUser,
    timestamp: new Date().toLocaleTimeString()
  });
  closeComedyClub();
}

// ================= JOIN MODAL =================
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const joinName = document.getElementById('join-name');
const joinGender = document.getElementById('join-gender');
const joinRegion = document.getElementById('join-region');
const joinPicture = document.getElementById('join-picture');

joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = joinName.value.trim();
  const gender = joinGender.value;
  const region = joinRegion.value.trim();
  const pictureFile = joinPicture.files[0];

  currentUser = { name, gender, region, profilePicture: '' };

  if (pictureFile) {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('gender', gender);
    formData.append('region', region);
    formData.append('profilePicture', pictureFile);

    // ✅ Render-safe API
    const res = await fetch('/upload-profile', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    currentUser.profilePicture = data.fileUrl;
  }

  socket.emit('new-user-joined', currentUser);
  joinModal.style.display = 'none';
  append(`You joined as ${name}`, 'right', currentUser);
});

// ================= SOCKET EVENTS =================
socket.on('user-joined', (user) => {
  append(`${user.name} joined the chat`, 'left', user);
});

socket.on('receive', (data) => {
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

// ================= INIT =================
window.addEventListener('load', () => {
  joinModal.style.display = 'flex';
  getNewJoke();
});