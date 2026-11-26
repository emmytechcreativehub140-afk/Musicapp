// ===== Sample songs (shown only if the database is empty or not connected) =====
const sampleSongs = [
  { id: 1, title: 'Midnight Vibes', artist: 'Dj Kayo', plays: 12400, color: '#1ed760', url: '', cover: '' },
  { id: 2, title: 'Lagos Nights', artist: 'Tobi Wave', plays: 9800, color: '#ff7a18', url: '', cover: '' },
  { id: 3, title: 'Golden Hour', artist: 'Ada Sings', plays: 15200, color: '#a855f7', url: '', cover: '' },
  { id: 4, title: 'Street Anthem', artist: 'Young Zed', plays: 7300, color: '#3b82f6', url: '', cover: '' },
  { id: 5, title: 'Calm Down Slow', artist: 'Mimi B', plays: 11100, color: '#ec4899', url: '', cover: '' },
  { id: 6, title: 'Afro Fire', artist: 'Dj Kayo', plays: 20500, color: '#eab308', url: '', cover: '' }
];
const artistColors = ['#1ed760', '#ff7a18', '#a855f7', '#3b82f6', '#ec4899', '#eab308'];
let songs = [];

// ===== Saved data on this phone (likes) =====
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
let liked = load('likedSongs', []);

// ===== State =====
let currentIndex = -1;
let isPlaying = false;
let shuffleOn = false;
let repeatOn = false;
let counted = false;        // has this play been counted yet
let loggedIn = false;
let fakeTimer = null;
let fakeTime = 0;
const FAKE_DURATION = 30;   // demo songs (no audio file) last 30 seconds
const audio = new Audio();
let toastTimer = null;

// ===== Helpers =====
function $(id) { return document.getElementById(id); }
function esc(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function formatPlays(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'K plays' : n + ' plays'; }
function formatTime(sec) {
  sec = Math.floor(sec || 0);
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
// Cover picture if the song has one, otherwise its color
function coverBg(s) { return s.cover ? "url('" + s.cover + "') center/cover" : s.color; }
function coverIcon(s) { return s.cover ? '' : '&#9835;'; }

// ===== Load songs from Supabase =====
async function loadSongs() {
  if (db) {
    try {
      const res = await db.from('songs').select('*').order('created_at', { ascending: false });
      if (res.error) throw res.error;
      songs = res.data.map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        plays: r.plays || 0,
        color: r.color || '#1ed760',
        url: r.audio_url,
        cover: r.cover_url || '',
        fromDb: true
      }));
    } catch (e) { console.log('Could not load songs', e); }
  }
  if (!songs.length) songs = sampleSongs.map((s) => Object.assign({}, s));
}

// ===== Login state =====
async function refreshAuth() {
  if (!db) return;
  const res = await db.auth.getSession();
  loggedIn = !!res.data.session;
  $('loginBtn').textContent = loggedIn ? 'Logout' : 'Login';
}

// ===== Build the page =====
function renderTrending() {
  const row = $('trendingRow');
  row.innerHTML = '';
  songs.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.style.animationDelay = Math.min(i, 8) * 0.1 + 's';
    card.innerHTML =
      '<div class="cover" style="background:' + coverBg(s) + '">' + coverIcon(s) + '</div>' +
      '<div class="song-title">' + esc(s.title) + '</div>' +
      '<div class="song-artist">' + esc(s.artist) + '</div>' +
      '<div class="song-meta"><span class="plays" data-id="' + s.id + '">' + formatPlays(s.plays) + '</span>' +
      '<button class="like-btn" data-id="' + s.id + '">&#9825;</button></div>';
    card.addEventListener('click', () => playSong(i));
    card.querySelector('.like-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLike(s.id);
    });
    row.appendChild(car);
  });
}

function renderArtists() {
  const row = $('artistRow');
  row.innerHTML = '';
  const names = [];
  songs.forEach((s) => { if (!names.includes(s.artist)) names.push(s.artist); });
  names.slice(0, 10).forEach((name, i) => {
    const el = document.createElement('div');
    el.className = 'artist';
    el.style.animationDelay = (i * 0.1) + 's';
    el.innerHTML =
      '<div class="artist-pic" style="background:' + artistColors[i % artistColors.length] + '">' +
      esc(name.charAt(0).toUpperCase()) + '</div><span>' + esc(name) + '</span>';
    el.addEventListener('click', () => { location.href = 'artist.html?name=' + encodeURIComponent(name); });
    row.appendChild(el);
  });
}
function renderReleases() {
  const list = $('releaseList');
  list.innerHTML = '';
  songs.slice(0, 10).forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'release';
    item.style.animationDelay = (i * 0.1) + 's';
    item.innerHTML =
      '<div class="cover" style="background:' + coverBg(s) + '">' + coverIcon(s) + '</div>' +
      '<div class="release-info"><div class="song-title">' + esc(s.title) + '</div>' +
      '<div class="song-artist">' + esc(s.artist) + '</div></div>' +
      '<div class="release-plays plays" data-id="' + s.id + '">' + formatPlays(s.plays) + '</div>';
    item.addEventListener('click', () => playSong(i));
    list.appendChild(item);
  });
}

// ===== Likes =====
function toggleLike(id) {
  id = Number(id);
  liked = liked.includes(id) ? liked.filter((x) => x !== id) : liked.concat(id);
  save('likedSongs', liked);
  refreshLikes();
}
function refreshLikes() {
  document.querySelectorAll('.like-btn').forEach((btn) => {
    const on = liked.includes(Number(btn.dataset.id));
    btn.classList.toggle('liked', on);
    btn.innerHTML = on ? '&#9829;' : '&#9825;';
  });
}

// ===== Play counts (saved in Supabase for real songs) =====
function countPlay(s) {
  s.plays += 1;
  if (db && s.fromDb) {
    db.rpc('increment_plays', { song_id: s.id }).then(() => {}, () => {});
  }
  refreshPlays();
}
function refreshPlays() {
  document.querySelectorAll('.plays').forEach((el) => {
    const s = songs.find((x) => String(x.id) === el.dataset.id);
    if (s) el.textContent = formatPlays(s.plays);
  });
  if (currentIndex !== -1) $('fpPlays').textContent = formatPlays(songs[currentIndex].plays);
}

// ===== Player: choose a song =====
function selectSong(index) {
  stopFake();
  audio.pause();
  currentIndex = index;
  counted = false;
  fakeTime = 0;
  const s = songs[index];

  if (s.url) { audio.src = s.url; } else { audio.removeAttribute('src'); audio.load(); }

  $('player').classList.add('active');
  $('playerTitle').textContent = s.title;
  $('playerArtist').textContent = s.artist;
  $('playerCover').style.background = coverBg(s);
  $('fpTitle').textContent = s.title;
  $('fpArtist').textContent = s.artist;
  $('fpCover').style.background = coverBg(s);
  $('fpCover').innerHTML = coverIcon(s);
  $('fullPlayer').style.background = 'linear-gradient(180deg, ' + s.color + '66, #0a0a0a 65%)';
  $('fpLike').dataset.id = s.id;
  $('fpPlays').textContent = formatPlays(s.plays);
  updateProgress(0, s.url ? 0 : FAKE_DURATION);
  refreshLikes();
  setPlaying(false);
}

// ===== Player: play, pause, next, previous =====
function startPlayback() {
  const s = songs[currentIndex];
  if (!counted) { counted = true; countPlay(s); }
  if (s.url) { audio.play().catch(() => {}); } else { startFake(); }
  setPlaying(true);
}
function pausePlayback() {
  audio.pause();
  stopFake();
  setPlaying(false);
}
function playSong(index) {
  selectSong(index);
  startPlayback();
}
function togglePlay() {
  if (currentIndex === -1) { playSong(0); return; }
  if (isPlaying) pausePlayback(); else startPlayback();
}
function nextSong() {
  let i;
  if (shuffleOn && songs.length > 1) {
    do { i = Math.floor(Math.random() * songs.length); } while (i === currentIndex);
  } else {
    i = (currentIndex + 1) % songs.length;
  }
  playSong(i);
}
function prevSong() { playSong((currentIndex - 1 + songs.length) % songs.length); }

function handleEnded() {
  stopFake();
  if (repeatOn) { playSong(currentIndex); return; }
  nextSong();
}

function setPlaying(state) {
  isPlaying = state;
  const icon = state ? '&#10074;&#10074;' : '&#9658;';
  $('playBtn').innerHTML = icon;
  $('fpPlay').innerHTML = icon;
  $('player').classList.toggle('playing', state);
  $('fullPlayer').classList.toggle('playing', state);
}

// ===== Progress =====
function updateProgress(cur, dur) {
  const pct = dur ? Math.min(cur / dur * 100, 100) : 0;
  $('progressFill').style.width = pct + '%';
  $('fpFill').style.width = pct + '%';
  $('fpCur').textContent = formatTime(cur);
  $('fpDur').textContent = formatTime(dur);
}
// Demo clock for songs that have no audio file
function startFake() {
  stopFake();
  fakeTimer = setInterval(() => {
    fakeTime += 0.25;
    updateProgress(fakeTime, FAKE_DURATION);
    if (fakeTime >= FAKE_DURATION) handleEnded();
  }, 250);
}
function stopFake() { clearInterval(fakeTimer); }

// Real audio progress
audio.addEventListener('timeupdate', () => updateProgress(audio.currentTime, audio.duration || 0));
audio.addEventListener('loadedmetadata', () => updateProgress(0, audio.duration || 0));
audio.addEventListener('ended', handleEnded);
audio.addEventListener('error', () => { if (audio.src) toast('Could not play this song'); });

function seek(pct) {
  if (currentIndex === -1) return;
  const s = songs[currentIndex];
  if (s.url && audio.duration) {
    audio.currentTime = pct * audio.duration;
  } else {
    fakeTime = pct * FAKE_DURATION;
    updateProgress(fakeTime, FAKE_DURATION);
  }
}
['progress', 'fpProgress'].forEach((id) => {
  $(id).addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - r.left) / r.width);
  });
});

// ===== Full player open and close =====
function openFull() {
  if (currentIndex === -1) return;
  $('fullPlayer').classList.add('open');
  document.body.classList.add('noscroll');
}
function closeFull() {
  $('fullPlayer').classList.remove('open');
  document.body.classList.remove('noscroll');
}
$('openFull').addEventListener('click', openFull);
$('fpClose').addEventListener('click', closeFull);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFull(); });

// ===== Share =====
function songLink(s) {
  // The link opens the home page and loads this song
  return location.href.split('?')[0].split('#')[0] + '?song=' + s.id;
}
function shareText(s) { return 'Listen to "' + s.title + '" by ' + s.artist + ' on MusicApp'; }

async function shareSong() {
  if (currentIndex === -1) return;
  const s = songs[currentIndex];
  const url = songLink(s);
  if (navigator.share) {
    try { await navigator.share({ title: s.title, text: shareText(s), url: url }); } catch (e) {}
    return;
  }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => toast('Link copied')).catch(() => window.prompt('Copy this link', url));
  } else {
    window.prompt('Copy this link', url);
  }
}
function shareWhatsApp() {
  if (currentIndex === -1) return;
  const s = songs[currentIndex];
  window.open('https://wa.me/?text=' + encodeURIComponent(shareText(s) + ' ' + songLink(s)), '_blank');
}

// ===== Button wiring =====
$('playBtn').addEventListener('click', togglePlay);
$('fpPlay').addEventListener('click', togglePlay);
$('nextBtn').addEventListener('click', nextSong);
$('fpNext').addEventListener('click', nextSong);
$('prevBtn').addEventListener('click', prevSong);
$('fpPrev').addEventListener('click', prevSong);
$('fpLike').addEventListener('click', () => { if (currentIndex !== -1) toggleLike(songs[currentIndex].id); });
$('shareBtn').addEventListener('click', shareSong);
$('waBtn').addEventListener('click', shareWhatsApp);
$('shuffleBtn').addEventListener('click', () => {
  shuffleOn = !shuffleOn;
  $('shuffleBtn').classList.toggle('active', shuffleOn);
  toast(shuffleOn ? 'Shuffle on' : 'Shuffle off');
});
$('repeatBtn').addEventListener('click', () => {
  repeatOn = !repeatOn;
  $('repeatBtn').classList.toggle('active', repeatOn);
  toast(repeatOn ? 'Repeat on' : 'Repeat off');
});

// ===== Search =====
$('search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.song-card').forEach((card) => {
    card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

// ===== Top buttons =====
$('loginBtn').addEventListener('click', async () => {
  if (loggedIn) {
    await db.auth.signOut();
    await refreshAuth();
    toast('Logged out');
  } else {
    window.location.href = 'login.html';
  }
});
$('uploadBtn').addEventListener('click', () => { window.location.href = 'upload.html'; });
$('mySongsBtn').addEventListener('click', () => { window.location.href = 'mysongs.html'; });
$('startBtn').addEventListener('click', () => playSong(0));

// ===== Top bar shadow on scroll =====
window.addEventListener('scroll', () => {
  $('topbar').classList.toggle('scrolled', window.scrollY > 10);
});

// ===== Scroll reveal animation =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('show');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

// ===== Loader =====
window.addEventListener('load', () => {
  setTimeout(() => $('loader').classList.add('hide'), 900);
});

// ===== Start =====
async function init() {
  await loadSongs();
  renderTrending();
  renderArtists();
  renderReleases();
  refreshLikes();
  await refreshAuth();

  // If someone opens a shared link (?song=ID), load that song in the full player
  const sharedId = new URLSearchParams(location.search).get('song');
  if (sharedId) {
    const i = songs.findIndex((s) => String(s.id) === sharedId);
    if (i !== -1) { selectSong(i); openFull(); }
  }
}
init();