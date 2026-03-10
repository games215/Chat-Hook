// client.js - Frontend logic for Chat Hook with Supabase Google Login

// ===== SUPABASE CONFIGURATION =====
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase configuration
const supabaseUrl = 'https://your-project-id.supabase.co'; // ✅ Replace with your Supabase URL
const supabaseAnonKey = 'your-anon-key'; // ✅ Replace with your Supabase anon key

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Socket.io connection
const socket = io();

// DOM Elements
const messageContainer = document.getElementById('message-container');
const messageForm = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const onlineUsersContainer = document.getElementById('onlineUsersContainer');
const userAvatar = document.getElementById('userAvatar');
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const profilePanel = document.getElementById('profilePanel');
const profileUsername = document.getElementById('profileUsername');
const profileCountry = document.getElementById('profileCountry');
const profilePicPreview = document.getElementById('profilePicPreview');
const profilePicInitial = document.getElementById('profilePicInitial');
const userProfileModal = document.getElementById('userProfileModal');
const modalUsername = document.getElementById('modalUsername');
const modalCountry = document.getElementById('modalCountry');
const modalAvatar = document.getElementById('modalAvatar');
const googleBtn = document.getElementById('googleBtn');

// Current user data
let currentUser = null;
let selectedUserId = null;
let jokeCount = 0;

// ===== CHECK SESSION ON PAGE LOAD =====
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // User is already logged in with Google
    checkUserProfile(session.user);
  } else {
    // Check local storage for manual login
    loadUserFromStorage();
  }
});

// ===== CHECK USER PROFILE FROM SUPABASE =====
async function checkUserProfile(supabaseUser) {
  // Check if user exists in localStorage
  const savedUser = localStorage.getItem('chatUser');
  let userData = savedUser ? JSON.parse(savedUser) : null;
  
  if (userData && userData.email === supabaseUser.email) {
    // Use existing profile
    currentUser = {
      ...userData,
      id: socket.id,
      email: supabaseUser.email
    };
  } else {
    // Create new user from Google data
    currentUser = {
      id: socket.id,
      name: supabaseUser.user_metadata.full_name || supabaseUser.email.split('@')[0],
      email: supabaseUser.email,
      gender: 'Other',
      country: 'United States',
      profilePic: supabaseUser.user_metadata.avatar_url || null,
      joinDate: new Date().getTime(),
      isGoogleUser: true,
      lastLogin: new Date().toISOString()
    };
    
    localStorage.setItem('chatUser', JSON.stringify(currentUser));
    localStorage.setItem('lastNameChange', new Date().getTime().toString());
  }
  
  updateUserAvatar();
  profileUsername.value = currentUser.name || '';
  profileCountry.value = currentUser.country || 'India';
  if (currentUser.profilePic) {
    showProfilePic(currentUser.profilePic);
  }
  
  socket.emit('user-joined', currentUser);
  joinModal.style.display = 'none';
  showSuccessAnimation(`Welcome back ${currentUser.name}!`);
}

// ===== GOOGLE LOGIN WITH SUPABASE =====
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
            hd: '' // Allows any Google account
          },
          redirectTo: window.location.origin // Redirect back to your app
        }
      });

      if (error) {
        console.error('Supabase Google Login Error:', error);
        alert('Google login failed: ' + error.message);
      }
      
      // Note: The OAuth redirect will happen automatically
      // After redirect, the page will reload and DOMContentLoaded will handle the session
      
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      alert('Google Sign-In failed: ' + error.message);
    }
  });
}

// Handle OAuth redirect (when user comes back from Google)
async function handleAuthRedirect() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return;
  }
  
  if (session) {
    checkUserProfile(session.user);
  }
}

// Check for OAuth redirect on load
handleAuthRedirect();

// Initialize user from localStorage (for manual login)
function loadUserFromStorage() {
    const savedUser = localStorage.getItem('chatUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            // Ensure user has an ID
            currentUser.id = socket.id;
            
            updateUserAvatar();
            profileUsername.value = currentUser.name || '';
            profileCountry.value = currentUser.country || 'India';
            if (currentUser.profilePic) {
                showProfilePic(currentUser.profilePic);
            }
            socket.emit('user-joined', currentUser);
            joinModal.style.display = 'none';
        } catch (e) {
            console.error('Error loading user:', e);
            showJoinModal();
        }
    } else {
        showJoinModal();
    }
}

// Show join modal
function showJoinModal() {
    joinModal.style.display = 'flex';
}

// Join form submission
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('join-name').value.trim();
    const gender = document.getElementById('join-gender').value;
    const region = document.getElementById('join-region').value;
    
    if (!name || !gender || !region) {
        alert('Please fill all fields');
        return;
    }
    
    // Check if name change is allowed (first time or after 30 days)
    const lastChange = localStorage.getItem('lastNameChange');
    const now = new Date().getTime();
    
    if (lastChange && (now - parseInt(lastChange)) < 30 * 24 * 60 * 60 * 1000) {
        const daysLeft = Math.ceil((30 * 24 * 60 * 60 * 1000 - (now - parseInt(lastChange))) / (24 * 60 * 60 * 1000));
        alert(`You can change your username again in ${daysLeft} days. Using your previous username.`);
        
        // Load previous user
        const savedUser = localStorage.getItem('chatUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
        }
    } else {
        // Create new user
        currentUser = {
            id: socket.id,
            name: name,
            gender: gender,
            country: region,
            profilePic: null,
            joinDate: now,
            isManual: true
        };
        
        localStorage.setItem('lastNameChange', now.toString());
        localStorage.setItem('chatUser', JSON.stringify(currentUser));
    }
    
    updateUserAvatar();
    socket.emit('user-joined', currentUser);
    joinModal.style.display = 'none';
    
    // Show success animation
    showSuccessAnimation('Welcome to Chat Hook!');
});

// Update user avatar display
function updateUserAvatar() {
    if (!currentUser) return;
    
    userAvatar.innerHTML = '';
    if (currentUser.profilePic) {
        const img = document.createElement('img');
        img.src = currentUser.profilePic;
        img.alt = currentUser.name;
        userAvatar.appendChild(img);
    } else {
        userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    }
}

// Show profile picture in preview
function showProfilePic(imageData) {
    profilePicPreview.innerHTML = '';
    const img = document.createElement('img');
    img.src = imageData;
    img.alt = 'Profile';
    profilePicPreview.appendChild(img);
    profilePicInitial.style.display = 'none';
}

// Handle profile picture upload
window.handleProfilePicUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert('File too large! Max 2MB allowed.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        showProfilePic(imageData);
        
        if (currentUser) {
            currentUser.profilePic = imageData;
            localStorage.setItem('chatUser', JSON.stringify(currentUser));
            updateUserAvatar();
            socket.emit('user-updated', currentUser);
        }
    };
    reader.readAsDataURL(file);
};

// Save profile changes
window.saveProfile = function() {
    if (!currentUser) return;
    
    const newName = profileUsername.value.trim();
    const newCountry = profileCountry.value;
    
    // Check if name changed
    if (newName !== currentUser.name) {
        const lastChange = localStorage.getItem('lastNameChange');
        const now = new Date().getTime();
        
        if (lastChange && (now - parseInt(lastChange)) < 30 * 24 * 60 * 60 * 1000) {
            const daysLeft = Math.ceil((30 * 24 * 60 * 60 * 1000 - (now - parseInt(lastChange))) / (24 * 60 * 60 * 1000));
            alert(`You can change your username again in ${daysLeft} days.`);
            profileUsername.value = currentUser.name;
            return;
        }
        
        localStorage.setItem('lastNameChange', now.toString());
    }
    
    currentUser.name = newName;
    currentUser.country = newCountry;
    
    localStorage.setItem('chatUser', JSON.stringify(currentUser));
    updateUserAvatar();
    socket.emit('user-updated', currentUser);
    
    toggleProfilePanel();
    showSuccessMessage('Profile updated successfully!');
};

// Toggle profile panel
window.toggleProfilePanel = function() {
    if (currentUser) {
        profileUsername.value = currentUser.name || '';
        profileCountry.value = currentUser.country || 'India';
    }
    profilePanel.classList.toggle('active');
};

// Send message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message && currentUser) {
        socket.emit('send-message', {
            text: message,
            user: currentUser,
            timestamp: new Date().toISOString()
        });
        messageInput.value = '';
    }
});

// Receive message
socket.on('message', (data) => {
    appendMessage(data);
});

// Load message history
socket.on('message-history', (messages) => {
    messageContainer.innerHTML = '';
    messages.forEach(msg => appendMessage(msg));
});

// Update online users
socket.on('online-users', (users) => {
    updateOnlineUsersList(users);
});

// Append message to container
function appendMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    const isOwn = data.user.id === currentUser?.id;
    messageElement.classList.add(isOwn ? 'own' : 'other');
    
    const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
        <div class="message-bubble">
            <div class="message-user">
                <div class="user-avatar" onclick="showUserProfile('${data.user.id}')">
                    ${data.user.profilePic ? 
                      `<img src="${data.user.profilePic}" alt="${data.user.name}">` : 
                      data.user.name.charAt(0).toUpperCase()}
                </div>
                <span class="user-name" onclick="showUserProfile('${data.user.id}')">
                    ${data.user.name}
                    <span class="verified-badge"><i class="fas fa-check"></i></span>
                </span>
            </div>
            <div class="message-content">${data.text}</div>
            <div class="message-meta">
                <span>${data.user.country || 'Unknown'}</span>
                <span>${time}</span>
            </div>
        </div>
    `;
    
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Update online users list
function updateOnlineUsersList(users) {
    if (!onlineUsersContainer) return;
    
    onlineUsersContainer.innerHTML = '';
    
    users.forEach(user => {
        if (user.id === currentUser?.id) return;
        
        const userElement = document.createElement('div');
        userElement.classList.add('online-user-item');
        userElement.onclick = () => showUserProfile(user.id);
        
        userElement.innerHTML = `
            <div class="online-user-status"></div>
            <div class="user-avatar-small">
                ${user.profilePic ? 
                  `<img src="${user.profilePic}" alt="${user.name}">` : 
                  user.name.charAt(0).toUpperCase()}
            </div>
            <div class="online-user-name">
                ${user.name}
                <span class="verified-badge"><i class="fas fa-check"></i></span>
            </div>
        `;
        
        onlineUsersContainer.appendChild(userElement);
    });
}

// Show user profile modal
window.showUserProfile = function(userId) {
    socket.emit('get-user', userId, (user) => {
        if (!user) return;
        
        selectedUserId = userId;
        modalUsername.innerHTML = `
            ${user.name}
            <span class="verified-badge"><i class="fas fa-check"></i></span>
        `;
        modalCountry.querySelector('span').textContent = user.country || 'Unknown';
        
        modalAvatar.innerHTML = user.profilePic ? 
            `<img src="${user.profilePic}" alt="${user.name}">` : 
            `<span>${user.name.charAt(0).toUpperCase()}</span>`;
        
        userProfileModal.classList.add('active');
    });
};

// Close user profile modal
window.closeUserProfileModal = function() {
    userProfileModal.classList.remove('active');
};

// Open private chat from modal
window.openPrivateChatFromModal = function() {
    if (!selectedUserId) return;
    closeUserProfileModal();
    // Will implement private chat feature
};

// Toggle online users list
window.toggleOnlineUsers = function() {
    document.getElementById('onlineUsersList').classList.toggle('active');
};

// Show success message
function showSuccessMessage(message) {
    const msg = document.createElement('div');
    msg.className = 'confirmation-message';
    msg.textContent = message;
    document.body.appendChild(msg);
    
    setTimeout(() => {
        msg.remove();
    }, 3000);
}

// Show success animation
function showSuccessAnimation(message) {
    const anim = document.getElementById('join-success-animation');
    anim.querySelector('.success-message').textContent = message;
    anim.style.display = 'flex';
    
    setTimeout(() => {
        anim.style.display = 'none';
    }, 2000);
}

// ========== ANIMATION FUNCTIONS ==========
window.openAnimationSelector = function() {
    document.getElementById('animation-modal').style.display = 'flex';
};

window.closeAnimationSelector = function() {
    document.getElementById('animation-modal').style.display = 'none';
};

window.submitAnimationSelection = function() {
    const active = document.querySelector('.animation-option.active');
    if (active) {
        const animation = active.dataset.animation;
        
        // Hide all animations
        document.querySelectorAll('.animation-container, .floating-shapes, .neon-grid, .liquid-rainbow, .cosmic-energy, .holographic-prism, .digital-rain, .particle-galaxy, .chat-hook-animation, .custom-name-animation, .john-cena-animation').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show selected animation
        if (animation === 'default') {
            document.getElementById('default-animation').style.display = 'block';
        } else if (animation === 'custom-name') {
            document.getElementById('custom-name-input-container').style.display = 'block';
            document.getElementById('custom-name-animation').style.display = 'block';
        } else {
            const animElement = document.getElementById(animation + '-animation');
            if (animElement) {
                animElement.style.display = 'block';
            }
        }
        
        localStorage.setItem('selectedAnimation', animation);
    }
    closeAnimationSelector();
};

window.activateCustomNameAnimation = function() {
    const name = document.getElementById('custom-name-input').value.trim();
    if (name) {
        // Create name particles
        const anim = document.getElementById('custom-name-animation');
        anim.innerHTML = '';
        
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'name-particle';
            particle.textContent = name.charAt(Math.floor(Math.random() * name.length));
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 5 + 's';
            particle.style.animationDuration = 10 + Math.random() * 10 + 's';
            anim.appendChild(particle);
        }
    }
};

// ========== COMEDY CLUB FUNCTIONS ==========
const jokes = [
    "Why don't scientists trust atoms? Because they make up everything! 😂",
    "What do you call a fake noodle? An impasta! 🍝",
    "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
    "What do you call a bear with no teeth? A gummy bear! 🐻",
    "Why don't eggs tell jokes? They'd crack each other up! 🥚",
    "What do you call a sleeping bull? A bulldozer! 🐂",
    "Why did the math book look sad? It had too many problems! 📚",
    "What do you call a fish with no eyes? A fsh! 🐠",
    "Why did the bicycle fall over? It was two-tired! 🚲",
    "What do you call a pig that does karate? A pork chop! 🥋",
    "Why did the cookie go to the doctor? It felt crumby! 🍪",
    "What do you call a belt made of watches? A waist of time! ⌚",
    "Why don't skeletons fight each other? They don't have the guts! 💀",
    "What do you call a factory that makes okay products? A satisfactory! 🏭",
    "Why did the coffee file a police report? It got mugged! ☕"
];

window.openComedyClub = function() {
    document.getElementById('comedy-modal').style.display = 'flex';
    document.getElementById('joke-count').textContent = jokeCount;
};

window.closeComedyClub = function() {
    document.getElementById('comedy-modal').style.display = 'none';
};

window.getNewJoke = function() {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    document.getElementById('joke-display').textContent = randomJoke;
    jokeCount++;
    document.getElementById('joke-count').textContent = jokeCount;
    
    // Create laughter animation
    const modal = document.querySelector('.comedy-card');
    const laugh = document.createElement('div');
    laugh.className = 'laughter-animation';
    laugh.textContent = '😂';
    laugh.style.left = Math.random() * 100 + '%';
    laugh.style.top = Math.random() * 100 + '%';
    modal.appendChild(laugh);
    
    setTimeout(() => laugh.remove(), 2000);
};

window.shareJokeToChat = function() {
    const joke = document.getElementById('joke-display').textContent;
    if (joke && currentUser && !joke.includes('Click')) {
        socket.emit('send-message', {
            text: '🤣 JOKE: ' + joke,
            user: currentUser,
            timestamp: new Date().toISOString()
        });
        closeComedyClub();
    }
};

window.addNewJoke = function() {
    const newJoke = document.getElementById('new-joke-input').value.trim();
    if (newJoke) {
        jokes.push(newJoke);
        document.getElementById('new-joke-input').value = '';
        alert('Joke added! Thanks for contributing! 🎉');
    }
};

// Weather and time update
function updateWeatherTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    // Random weather for demo
    const weathers = ['☀️ Sunny', '⛅ Partly Cloudy', '☁️ Cloudy', '🌧️ Rainy', '⛈️ Stormy', '❄️ Snowy'];
    const weather = weathers[Math.floor(Math.random() * weathers.length)];
    const temp = Math.floor(Math.random() * 15) + 20; // 20-35°C
    
    document.getElementById('weatherTime').innerHTML = 
        `${temp}°C ${weather} • ${timeStr} • ${dateStr}`;
}

setInterval(updateWeatherTime, 1000);
updateWeatherTime();

// Handle auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_IN' && session) {
        checkUserProfile(session.user);
    } else if (event === 'SIGNED_OUT') {
        // User signed out
        localStorage.removeItem('chatUser');
        currentUser = null;
        showJoinModal();
    }
});

// Logout function (optional)
window.logout = async function() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Logout error:', error);
    } else {
        localStorage.removeItem('chatUser');
        currentUser = null;
        showJoinModal();
    }
};