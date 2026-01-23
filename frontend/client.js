// ================= SOCKET CONNECTION =================
// SAME ORIGIN — Render + local dono pe kaam karega
const socket = io();

// ================= DOM =================
const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.querySelector('.send');

// ================= USER =================
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
  "Why did the math book look so sad? Because it had too many problems!"
];

// ================= MESSAGE APPEND =================
function append(message, position, user = null) {
  const div = document.createElement('div');

  if (user && user.profilePicture) {
    div.innerHTML = `
      <div class="message-with-avatar ${position}">
        <img src="${user.profilePicture}" class="message-avatar">
        <div class="message-content">
          <strong>${user.name}</strong>
          <div>${message}</div>
          <small>${user.gender} • ${user.region}</small>
        </div>
      </div>
    `;
  } else {
    div.classList.add('message', position);
    div.innerText = message;
  }

  messageContainer.append(div);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

// ================= SEND MESSAGE =================
form.addEventListener('submit', e => {
  e.preventDefault();
  const msg = messageInput.value.trim();
  if (!msg) return;

  append(msg, 'right', currentUser);

  // ✅ SERVER EXPECTS STRING ONLY
  socket.emit('send', msg);

  messageInput.value = '';
});

// ================= RECEIVE MESSAGE =================
socket.on('receive', data => {
  append(data.message, 'left', data.user);
});

// ================= JOIN MODAL =================
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const joinName = document.getElementById('join-name');
const joinGender = document.getElementById('join-gender');
const joinRegion = document.getElementById('join-region');
const joinPicture = document.getElementById('join-picture');
const profilePreview = document.getElementById('profile-preview');

joinPicture.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    profilePreview.src = ev.target.result;
    profilePreview.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

joinForm.addEventListener('submit', async e => {
  e.preventDefault();

  const name = joinName.value.trim();
  const gender = joinGender.value;
  const region = joinRegion.value.trim();
  const pictureFile = joinPicture.files[0];

  if (!name || !gender || !region) {
    alert('Fill all fields');
    return;
  }

  currentUser = { name, gender, region, profilePicture: '' };

  // ================= PROFILE UPLOAD =================
  if (pictureFile) {
    const formData = new FormData();
    formData.append('profile', pictureFile);

    try {
      const res = await fetch('/upload-profile', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        currentUser.profilePicture = data.imageUrl;
      }
    } catch {
      currentUser.profilePicture = URL.createObjectURL(pictureFile);
    }
  } else {
    currentUser.profilePicture = generateAvatar(name);
  }

  socket.emit('new-user-joined', currentUser);

  joinModal.style.display = 'none';
  append(`You joined as ${name}`, 'right', currentUser);
});

// ================= AVATAR =================
function generateAvatar(name) {
  const initial = name[0].toUpperCase();
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="#007bff"/>
      <text x="50%" y="60%" text-anchor="middle" font-size="40" fill="#fff">${initial}</text>
    </svg>
  `)}`;
}

// ================= COMEDY CLUB =================
function getNewJoke() {
  const joke = jokesDatabase[Math.floor(Math.random() * jokesDatabase.length)];
  currentJoke = joke;
  document.getElementById('joke-display').innerText = joke;
  jokeCount++;
  document.getElementById('joke-count').innerText = jokeCount;
}

function shareJokeToChat() {
  if (!currentJoke) return;
  append(`😂 ${currentJoke}`, 'right', currentUser);
  socket.emit('send', `😂 ${currentJoke}`);
}

// ================= SOCKET STATUS =================
socket.on('connect', () => {
  console.log('Connected');
});

socket.on('disconnect', () => {
  append('Disconnected from server', 'left');
});

// ================= INIT =================
window.onload = () => {
  joinModal.style.display = 'flex';
  getNewJoke();
};
