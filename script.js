const firebaseConfig = {
  apiKey: "AIzaSyBwLrCKI3pFQGBp9RHunEOMchratxl5va0",
  authDomain: "winnickconnection.firebaseapp.com",
  databaseURL: "https://winnickconnection-default-rtdb.firebaseio.com",
  projectId: "winnickconnection",
  storageBucket: "winnickconnection.firebasestorage.app",
  messagingSenderId: "591164149666",
  appId: "1:591164149666:web:858da589fbd596948aacfb"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const profilesRef = database.ref('profiles');
const messagesRef = database.ref('messages');
const presenceRef = database.ref('presence');
const ADMIN_EMAILS = [
  "winnickp720@gmail.com",
  "admin1@example.com",
  "admin2@example.com"
];
let currentUser = null;
let isAdmin = false;
let lastProfilesSnapshot = null;
let lastMessagesSnapshot = null;
let currentChatRef = null;
let activeChatUserId = null;
let unreadChatRooms = [];
let profilesLoaded = false;
let chatLoaded = false;
const presenceMap = {};

function isAdminEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  return ADMIN_EMAILS.some(adminEmail =>
    adminEmail.trim().toLowerCase() === normalizedEmail
  );
}

function enforceAdminAccess(user) {
  if (!user) {
    isAdmin = false;
    return false;
  }

  const signedInEmail = user.email || '';
  isAdmin = isAdminEmail(signedInEmail);

  console.log('Signed in as:', signedInEmail);
  console.log('Admin list:', ADMIN_EMAILS);
  console.log('Is Admin:', isAdmin);

  return true;
}

function addProfile() {
  if (!currentUser) {
    alert('Please sign in or create an account to manage your profile.');
    showPage('authPage');
    return;
  }

  const name = document.getElementById('name').value;
  const course = document.getElementById('course').value;
  const contact = document.getElementById('contact').value;
  const about = document.getElementById('about').value;
  const photoInput = document.getElementById('photo');
  const currentPhoto = document.getElementById('currentPhotoURL').value;
  let photoURL = currentPhoto || "";

  if (!name || !course || !contact) {
    alert('Please fill in name, course, and contact');
    return;
  }

  if (photoInput.files[0]) {
    const file = photoInput.files[0];
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const MAX_WIDTH = 500;
        const scaleSize = MAX_WIDTH / img.width;

        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        photoURL = canvas.toDataURL("image/jpeg", 0.7);

        saveProfile();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  } else { saveProfile(); }

  function saveProfile() {
    const profileData = {
      name,
      course,
      contact,
      about,
      photo: photoURL,
      userId: currentUser.uid,
      email: currentUser.email
    };

    profilesRef.child(currentUser.uid).set(profileData);
    document.getElementById('successMsg').textContent = '✅ Profile saved successfully. Go to Profiles to view it.';
    document.getElementById('successMsg').style.display = 'block';
    setTimeout(() => {
      document.getElementById('successMsg').style.display = 'none';
      document.getElementById('successMsg').textContent = '✅ Profile added successfully. Go to Profiles to view it.';
    }, 3000);

    document.getElementById('name').value='';
    document.getElementById('course').value='';
    document.getElementById('contact').value='';
    document.getElementById('about').value='';
    document.getElementById('photo').value='';
    document.getElementById('currentPhotoURL').value='';
  }
}

function uploadPhoto(key) {
  const fileInput = document.getElementById(`photo-${key}`);
  const file = fileInput.files[0];
  if(!file){ alert("Please select a photo to upload."); return; }
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const MAX_WIDTH = 500;
      const scaleSize = MAX_WIDTH / img.width;

      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scaleSize;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressedPhoto = canvas.toDataURL("image/jpeg", 0.7);

      profilesRef.child(key).update({ photo: compressedPhoto });
      alert("Photo uploaded!");
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function getChatRoomId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function openChat(userId, displayName) {
  if (!currentUser) {
    alert('Please sign in to open chat.');
    showPage('authPage');
    return;
  }
  if (currentUser.uid === userId) {
    alert('You cannot chat with yourself.');
    return;
  }
  const roomId = getChatRoomId(currentUser.uid, userId);
  openChatRoom(roomId, displayName);
  showPage('chatPage', true, false);
}

function openChatRoom(roomId, displayName) {
  if (!currentUser) {
    alert('Please sign in to open chat.');
    showPage('authPage');
    return;
  }
  const peerId = getChatPeerId(roomId);
  if (!peerId) return;
  activeChatUserId = peerId;
  document.getElementById('chatTitle').textContent = `Chat with ${displayName || 'Student'}`;
  document.getElementById('chatMessages').innerHTML = '<p class="muted-text">Loading messages...</p>';
  if (currentChatRef) {
    currentChatRef.off();
  }
  currentChatRef = messagesRef.child(roomId);
  currentChatRef.on('value', renderMessages);
  updateChatConversationHeader();
}

function getChatPeerId(roomId) {
  return roomId.split('_').find(id => id !== currentUser.uid);
}

function sendMessage() {
  if (!currentUser) {
    alert('Please sign in to send messages.');
    showPage('authPage');
    return;
  }
  if (!activeChatUserId) {
    alert('Select a student in the inbox first.');
    return;
  }
  const textInput = document.getElementById('chatInput');
  const text = textInput.value.trim();
  if (!text) return;
  const roomId = getChatRoomId(currentUser.uid, activeChatUserId);
  const messageData = {
    sender: currentUser.uid,
    senderEmail: currentUser.email,
    text,
    timestamp: Date.now()
  };
  messagesRef.child(roomId).push(messageData);
  textInput.value = '';
}

function renderMessages(snapshot) {
  const messages = snapshot.val();
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  if (!messages) {
    container.innerHTML = '<p class="muted-text">No messages yet. Start the conversation!</p>';
    hideLoadingPopup();
    return;
  }
  const sorted = Object.values(messages).sort((a,b)=>a.timestamp-b.timestamp);
  sorted.forEach(msg => {
    const isMe = currentUser && msg.sender === currentUser.uid;
    const msgEl = document.createElement('div');
    msgEl.style.marginBottom = '10px';
    msgEl.style.textAlign = isMe ? 'right' : 'left';
    msgEl.innerHTML = `
      <div style="display:inline-block; text-align:left; max-width:82%; padding:10px 14px; border-radius:16px; background:${isMe ? '#1e88e5' : '#f3f4f6'}; color:${isMe ? '#fff' : '#111827'}; box-shadow:0 6px 16px rgba(15,23,42,0.06);">
        <div style="font-size:13px; margin-bottom:5px;"><strong>${isMe ? 'You' : msg.senderEmail || 'Student'}</strong></div>
        <div style="font-size:15px; line-height:1.4;">${msg.text}</div>
        <div style="font-size:11px; opacity:0.75; margin-top:6px;">${new Date(msg.timestamp).toLocaleString()}</div>
      </div>
    `;
    container.appendChild(msgEl);
  });
  container.scrollTop = container.scrollHeight;
  hideLoadingPopup();
}

function updatePresenceMap(snapshot) {
  const data = snapshot.val() || {};
  Object.keys(presenceMap).forEach(key => delete presenceMap[key]);
  Object.entries(data).forEach(([uid, value]) => {
    presenceMap[uid] = value && value.online;
  });
  if (lastProfilesSnapshot) {
    renderInbox(lastProfilesSnapshot);
  }
}

function renderInbox(snapshot) {
  const chatList = document.getElementById('chatList');
  chatList.innerHTML = '<p class="muted-text">Loading inbox...</p>';
  if (!currentUser) {
    chatList.innerHTML = '<p class="muted-text">Please sign in to view and message students.</p>';
    return;
  }
  const profiles = snapshot.val();
  if (!profiles) {
    chatList.innerHTML = '<p class="muted-text">No students available yet.</p>';
    chatLoaded = true;
    hideLoadingPopup();
    return;
  }
  Object.entries(profiles).forEach(([uid, profile]) => {
    if (uid === currentUser.uid) return;
    const online = presenceMap[uid] ? '🟢' : '⚪';
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'chat-item-btn';
    card.onclick = () => openChat(uid, profile.name || profile.email || 'Student');
    card.innerHTML = `
      <div class="chat-item-main">
        <img class="chat-item-photo" src="${profile.photo || ''}" alt="${profile.name || 'Student'}" onerror="this.style.display='none'">
        <div class="chat-item-profile">
          <div class="chat-item-name">${profile.name || profile.email || 'Student'}</div>
          <div class="chat-item-course">${profile.course || ''}</div>
        </div>
      </div>
      <div class="chat-item-status">${online}</div>`;
    chatList.appendChild(card);
  });
  chatLoaded = true;
  hideLoadingPopup();
}

function showChatListView() {
  const listPanel = document.getElementById('chatListPanel');
  const convoPanel = document.getElementById('chatConversationPanel');
  const messagesBox = document.getElementById('chatMessages');
  if (window.innerWidth <= 900) {
    if (listPanel) listPanel.classList.add('active');
    if (convoPanel) convoPanel.classList.remove('active');
    if (listPanel) listPanel.style.display = 'flex';
    if (convoPanel) convoPanel.style.display = 'none';
  } else {
    if (listPanel) listPanel.classList.add('active');
    if (convoPanel) convoPanel.classList.remove('active');
    if (listPanel) listPanel.style.display = 'flex';
    if (convoPanel) convoPanel.style.display = 'flex';
    if (messagesBox && !activeChatUserId) {
      messagesBox.innerHTML = '<div class="chat-empty-state">Select a student from the list to view the conversation.</div>';
    }
  }
}

function showChatConversationView() {
  const listPanel = document.getElementById('chatListPanel');
  const convoPanel = document.getElementById('chatConversationPanel');
  if (window.innerWidth <= 900) {
    if (listPanel) listPanel.classList.remove('active');
    if (convoPanel) convoPanel.classList.add('active');
    if (listPanel) listPanel.style.display = 'none';
    if (convoPanel) convoPanel.style.display = 'flex';
  } else {
    if (listPanel) listPanel.classList.remove('active');
    if (convoPanel) convoPanel.classList.add('active');
    if (listPanel) listPanel.style.display = 'flex';
    if (convoPanel) convoPanel.style.display = 'flex';
  }
}

function updateChatConversationHeader() {
  const photoEl = document.getElementById('chatProfilePhoto');
  const titleEl = document.getElementById('chatTitle');
  const statusEl = document.getElementById('chatStatus');
  if (!photoEl || !titleEl || !statusEl) return;
  if (!activeChatUserId) {
    titleEl.textContent = 'Select a student';
    statusEl.textContent = 'Choose a student to start chatting';
    photoEl.style.display = 'none';
    return;
  }
  const profile = lastProfilesSnapshot?.val()?.[activeChatUserId] || {};
  const name = profile.name || profile.email || 'Student';
  const course = profile.course || '';
  const online = presenceMap[activeChatUserId] ? 'Online now' : 'Offline';
  titleEl.textContent = name;
  statusEl.textContent = course ? `${course} • ${online}` : online;
  if (profile.photo) {
    photoEl.src = profile.photo;
    photoEl.style.display = 'block';
  } else {
    photoEl.style.display = 'none';
  }
}

function searchProfiles() {
  const searchText=document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('#profiles .card').forEach(card=>{
    const text=card.innerText.toLowerCase();
    card.style.display=text.includes(searchText)?'block':'none';
  });
}

function searchProfilesHeader(value) {
  const mainSearch=document.getElementById('search');
  if (mainSearch) {
    mainSearch.value = value;
    searchProfiles();
  }
}

function renderProfiles(snapshot) {
  lastProfilesSnapshot = snapshot;
  const profilesContainer=document.getElementById('profiles');
  profilesContainer.innerHTML = '<p class="muted-text">Loading profiles...</p>';
  const profiles=snapshot.val();
  if(profiles){
    profilesContainer.innerHTML = '';
    Object.entries(profiles).forEach(([key, profile])=>{
      const profileDiv=document.createElement('div');
      profileDiv.className='card';
      let photoSection='';
      if(profile.photo && profile.photo!==""){
        photoSection=`<img src="${profile.photo}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;cursor:pointer;" onclick="openLightbox('${profile.photo}')">`;
      } else if (currentUser && profile.userId === currentUser.uid) {
        photoSection=`<label for="photo-${key}" style="cursor:pointer; font-size:12px; color:#1e88e5; font-weight:bold; display:inline-block; border:1px solid #1e88e5; padding:4px 6px; border-radius:4px;">+ Add Photo</label>
          <input type="file" id="photo-${key}" accept="image/*" style="display:none;" onchange="uploadPhoto('${key}')">`;
      } else {
        photoSection=`<div style="width:60px;height:60px;border-radius:50%;background:#e3f2fd;display:flex;align-items:center;justify-content:center;color:#1565c0;font-size:12px;">No Photo</div>`;
      }

      const editButton = currentUser && profile.userId === currentUser.uid
        ? `<button onclick="editUserProfile('${key}')" style="margin-top:12px; background:#1565c0; color:white; border:none; border-radius:8px; padding:10px 14px; cursor:pointer;">Edit Your Profile</button>`
        : '';
      const deleteButton = isAdmin && currentUser && profile.userId !== currentUser.uid
        ? `<button onclick="deleteUserProfile('${key}', this)" style="margin-top:12px; margin-left:8px; background:#dc2626; color:white; border:none; border-radius:8px; padding:10px 14px; cursor:pointer;">Delete Profile</button>`
        : '';

      profileDiv.innerHTML=`
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            ${photoSection}
            <div style="flex:1; min-width:220px;">
              <h3 style="margin:0; font-size:16px;">${profile.name}</h3>
              <p style="margin:2px 0; font-size:14px;"><strong>Course:</strong> ${profile.course}</p>
              <p style="margin:2px 0; font-size:14px;">
${profile.contact ? `
  <a href="https://wa.me/260${String(profile.contact).replace(/^0+|[^0-9]/g,'')}" 
     target="_blank" class="whatsapp-btn">
     <i class="fa-brands fa-whatsapp"></i> WhatsApp
  </a> | <a href="tel:${profile.contact}" class="contact-btn">
     <i class="fa-solid fa-phone"></i> Call
  </a>
  ` : `<span class="muted-text" style="font-size:13px;">No contact provided</span>`}
</p>
              <p style="margin:2px 0; font-size:14px;">${profile.about}</p>
            </div>
          </div>
          <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px;">
            ${editButton}
            ${deleteButton}
          </div>`;
      profilesContainer.appendChild(profileDiv);
    });
  }
  profilesLoaded = true;
  hideLoadingPopup();
}

window.onload=function() {
  const savedDarkMode = localStorage.getItem('darkMode') === 'true';
  if (savedDarkMode) {
    document.documentElement.classList.add('dark-mode');
  }
  updateDarkModeIcon();

  const initialPage = window.location.hash ? window.location.hash.replace('#', '') : (auth.currentUser ? 'homePage' : 'authPage');
  if (initialPage && document.getElementById(initialPage)) {
    showPage(initialPage, false);
  }
  
  document.getElementById('welcomeModal').style.display='flex';
  auth.onAuthStateChanged(user=>{
    if (!user) {
      currentUser = null;
      isAdmin = false;
      updateAuthUI();
      clearProfileForm();
      showPage('authPage', false);
      return;
    }

    enforceAdminAccess(user);
    currentUser = user;
    updateAuthUI();
    setUserPresence(user.uid);
    loadOwnProfile();
    linkProfileIfExistsByEmail(user);
    showPage('homePage', false);

    if(lastProfilesSnapshot){
      renderProfiles(lastProfilesSnapshot);
      renderInbox(lastProfilesSnapshot);
    }
    if(lastMessagesSnapshot){
      updateChatNotificationFromSnapshot(lastMessagesSnapshot);
    }
  });
  profilesRef.on('value', snapshot=>{
    lastProfilesSnapshot=snapshot;
    renderProfiles(snapshot);
    renderInbox(snapshot);
    updateHomeDashboard();
  });
  presenceRef.on('value', snapshot=>{
    updatePresenceMap(snapshot);
    updateHomeDashboard();
  });
  messagesRef.on('value', snapshot => {
    lastMessagesSnapshot = snapshot;
    updateChatNotificationFromSnapshot(snapshot);
    updateHomeDashboard();
  });
}

function closeWelcome(){ document.getElementById('welcomeModal').style.display='none'; }

function updateChatNotificationFromSnapshot(snapshot) {
  if (!currentUser) return;
  const data = snapshot.val() || {};
  const unreadRooms = [];
  Object.entries(data).forEach(([roomId, messages]) => {
    if (!roomId.includes(currentUser.uid) || !messages) return;
    let lastMessage = null;
    Object.values(messages).forEach(msg => {
      if (!lastMessage || (msg.timestamp || 0) > (lastMessage.timestamp || 0)) {
        lastMessage = msg;
      }
    });
    if (lastMessage && lastMessage.sender !== currentUser.uid) {
      unreadRooms.push(roomId);
    }
  });
  unreadChatRooms = unreadRooms;
  updateChatNotification(unreadRooms.length);
}

function updateChatNotification(count) {
  const badge = document.getElementById('chatNotificationBadge');
  if (!badge) return;
  if (count > 0 && !document.getElementById('chatPage').classList.contains('active')) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function toggleDarkMode() {
  const html = document.documentElement;
  html.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', html.classList.contains('dark-mode'));
  updateDarkModeIcon();
}

function showLoadingPopup(message) {
  const popup = document.getElementById('loadingPopup');
  if (!popup) return;
  document.getElementById('loadingPopupText').textContent = message;
  popup.style.display = 'flex';
}

function hideLoadingPopup() {
  const popup = document.getElementById('loadingPopup');
  if (!popup) return;
  popup.style.display = 'none';
}

function updateDarkModeIcon() {
  const desktopToggle = document.getElementById('darkModeToggle');
  const mobileToggle = document.getElementById('darkModeToggleMobile');
  const isDark = document.documentElement.classList.contains('dark-mode');
  const label = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  if (desktopToggle) desktopToggle.textContent = label;
  if (mobileToggle) mobileToggle.textContent = label;
}

function showPage(pageId, pushState = true, openUnread = false){
  if (pageId === 'profilePage' && !currentUser) {
    alert('Please sign in to add or edit your profile.');
    pageId = 'authPage';
  }
  if (pageId === 'profilesPage') {
    if (!profilesLoaded) {
      showLoadingPopup('Loading profiles...');
    } else {
      hideLoadingPopup();
    }
  }
  if (pageId === 'chatPage') {
    if (!currentUser) {
      hideLoadingPopup();
    } else if (!chatLoaded) {
      showLoadingPopup('Loading chat...');
    } else {
      hideLoadingPopup();
    }
    if (openUnread && unreadChatRooms.length > 0) {
      showChatConversationView();
    } else if (activeChatUserId) {
      showChatConversationView();
    } else {
      showChatListView();
    }
  }
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
    page.style.display='none';
  });
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('active');
    page.style.display='block';
  }
  document.querySelectorAll('.nav-links button, .mobile-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });
  if (pageId === 'chatPage' && openUnread && unreadChatRooms.length > 0) {
    const roomId = unreadChatRooms[0];
    const peerId = getChatPeerId(roomId);
    const profile = lastProfilesSnapshot?.val()?.[peerId] || {};
    openChatRoom(roomId, profile.name || profile.email || 'Student');
    updateChatNotification(0);
  }
  if (pageId === 'chatPage' && !openUnread) {
    updateChatNotification(0);
  }
  if (pushState) {
    history.pushState({ page: pageId }, '', `#${pageId}`);
  }
}

window.addEventListener('popstate', event => {
  const pageId = event.state?.page || (window.location.hash ? window.location.hash.replace('#', '') : 'homePage');
  if (document.getElementById(pageId)) {
    showPage(pageId, false);
  }
});

function updateHomeWelcome() {
  const heading = document.getElementById('homeWelcomeHeading');
  const subtext = document.getElementById('homeWelcomeSubtitle');
  const eyebrow = document.querySelector('.home-eyebrow');
  if (!heading || !eyebrow) return;

  eyebrow.textContent = 'Welcome back,';

  if (currentUser?.displayName) {
    heading.textContent = currentUser.displayName;
  } else if (currentUser?.email) {
    const emailName = currentUser.email.split('@')[0];
    heading.textContent = emailName;
  } else {
    heading.textContent = 'Campus Connect';
  }

  if (subtext) {
    subtext.textContent = 'Connect with students across your campus.';
  }

  if (currentUser) {
    profilesRef.child(currentUser.uid).once('value').then(snapshot => {
      const profile = snapshot.val();
      if (profile?.name) {
        heading.textContent = profile.name;
      }
    });
  }

  updateHomeDashboard();
}

function updateHomeDashboard() {
  const registeredCountEl = document.getElementById('registeredStudentsCount');
  const conversationsCountEl = document.getElementById('conversationsCount');
  const onlineNowEl = document.getElementById('onlineNowValue');

  if (registeredCountEl) {
    const profiles = lastProfilesSnapshot?.val() || {};
    registeredCountEl.textContent = Object.keys(profiles).length.toString();
  }

  if (conversationsCountEl) {
    let count = 0;
    const messages = lastMessagesSnapshot?.val() || {};
    if (currentUser && messages) {
      count = Object.keys(messages).filter(roomId => roomId.includes(currentUser.uid)).length;
    }
    conversationsCountEl.textContent = count.toString();
  }

  if (onlineNowEl) {
    const presenceKeys = Object.keys(presenceMap);
    if (presenceKeys.length === 0) {
      onlineNowEl.textContent = 'Coming Soon';
    } else {
      const onlineCount = Object.values(presenceMap).filter(value => value === true).length;
      onlineNowEl.textContent = onlineCount.toString();
    }
  }
}

function updateAuthUI() {
  const status = document.getElementById('authStatus');
  const guestAuthActions = document.getElementById('guestAuthActions');
  const headerSearchBar = document.getElementById('headerSearchBar');
  const headerAuthInfo = document.getElementById('headerAuthInfo');
  const mainNav = document.querySelector('.nav-links');
  const mobileNav = document.querySelector('.mobile-nav');

  if (currentUser) {
    status.textContent = `Signed in as ${currentUser.email}`;
    guestAuthActions.style.display = 'none';
    headerSearchBar.style.display = 'none';
    headerAuthInfo.style.display = 'flex';
    mainNav.style.display = 'none';
    mobileNav.style.display = 'flex';
  } else {
    status.textContent = 'Not signed in';
    guestAuthActions.style.display = 'flex';
    headerSearchBar.style.display = 'none';
    headerAuthInfo.style.display = 'none';
    mainNav.style.display = 'none';
    mobileNav.style.display = 'none';
  }

  updateHomeWelcome();
}

function signUp() {
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;
  const regPhone = document.getElementById('registerPhone').value;

  if (!email || !password || !confirmPassword) {
    alert('Please fill in all registration fields.');
    return;
  }
  if (password !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then((cred) => {
      enforceAdminAccess(cred.user);
      currentUser = cred.user;
      updateAuthUI();
      const user = cred.user;
      if (regPhone && user) {
        const profileData = { userId: user.uid, email: user.email, contact: regPhone };
        profilesRef.child(user.uid).set(profileData);
      }
      loadOwnProfile();
      alert('Account created successfully. You can now add your profile.');
      showPage('profilePage');
    })
    .catch(error => alert(error.message));
}

function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    alert('Please enter email and password.');
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then((cred) => {
      enforceAdminAccess(cred.user);
      currentUser = cred.user;
      updateAuthUI();
      loadOwnProfile();
      alert('Logged in successfully.');
      showPage('profilePage');
    })
    .catch(error => alert(error.message));
}

function linkProfileIfExistsByEmail(user) {
  if (!user) return;
  profilesRef.once('value').then(snap => {
    const profiles = snap.val() || {};
    Object.entries(profiles).forEach(([key, profile]) => {
      if (!profile) return;
      if (profile.email && profile.email.toLowerCase() === user.email.toLowerCase()) {
        profile.userId = user.uid;
        profile.email = user.email;
        profilesRef.child(user.uid).set(profile).then(() => {
          if (key !== user.uid) profilesRef.child(key).remove();
        });
      }
    });
  });
}

function setUserPresence(uid) {
  const connectedRef = database.ref('.info/connected');
  const userPresenceRef = presenceRef.child(uid);
  connectedRef.on('value', snap => {
    if (snap.val() === true) {
      userPresenceRef.onDisconnect().set({ online: false, lastSeen: Date.now() });
      userPresenceRef.set({ online: true, lastSeen: Date.now() });
    }
  });
}

function logout() {
  auth.signOut()
    .then(() => {
      alert('You have been logged out.');
      showPage('homePage');
    })
    .catch(error => alert(error.message));
}

function loadOwnProfile() {
  if (!currentUser) { return; }
  profilesRef.child(currentUser.uid).once('value').then(snapshot => {
    const profile = snapshot.val();
    if (!profile) {
      clearProfileForm();
      return;
    }
    document.getElementById('name').value = profile.name || '';
    document.getElementById('course').value = profile.course || '';
    document.getElementById('contact').value = profile.contact || '';
    document.getElementById('about').value = profile.about || '';
    document.getElementById('currentPhotoURL').value = profile.photo || '';
  });
}

function clearProfileForm() {
  document.getElementById('name').value = '';
  document.getElementById('course').value = '';
  document.getElementById('contact').value = '';
  document.getElementById('about').value = '';
  document.getElementById('photo').value = '';
  document.getElementById('currentPhotoURL').value = '';
}

function deleteUserProfile(key, buttonEl) {
  if (!isAdmin || !currentUser) {
    return;
  }

  const confirmed = window.confirm('Are you sure you want to delete this profile?');
  if (!confirmed) {
    return;
  }

  if (buttonEl && buttonEl.closest('.card')) {
    buttonEl.closest('.card').remove();
  }

  profilesRef.child(key).remove().catch(() => {
    alert('Failed to delete profile.');
  });
}

function editUserProfile(key) {
  if (!currentUser) {
    alert('Please sign in to edit your profile.');
    showPage('authPage');
    return;
  }
  profilesRef.child(key).once('value').then(snapshot => {
    const profile = snapshot.val();
    if (!profile) { return; }
    document.getElementById('name').value = profile.name || '';
    document.getElementById('course').value = profile.course || '';
    document.getElementById('contact').value = profile.contact || '';
    document.getElementById('about').value = profile.about || '';
    document.getElementById('currentPhotoURL').value = profile.photo || '';
    showPage('profilePage');
  });
}

function openLightbox(src){
  document.getElementById('lightboxImg').src=src;
  document.getElementById('photoLightbox').style.display='flex';
}

function closeLightbox(){
  document.getElementById('photoLightbox').style.display='none';
  document.getElementById('lightboxImg').src='';
}

window.onscroll = function() {
  const btn = document.getElementById('backToTop');
  if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
    btn.style.display = 'block';
  } else {
    btn.style.display = 'none';
  }
};

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
