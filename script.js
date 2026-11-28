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
let counted = false;
let loggedIn = false;
let fakeTimer = null;
let fakeTime = 0;
const FAKE_DURATION = 30;
const audio = new Audio();
let toastTimer = null;

// ===== Helpers =====
function $(id) { return document.getElementById(id); }
function on(id, event, fn) { const el = $(id); if (el) el.addEventListener(event, fn); }
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
function coverBg(s) { return s.cover ? "url('" + s.cover + "') center/cover" : s.color; }
function coverIcon(s) { return s.cover ? '' : '&#9835;'; }
function copyText(text, msg) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => toast(msg)).catch(() => window.prompt('Copy this', text));
  } else {
    window.prompt('Copy this', text);
  }
}

// ===== Promoted songs (Audiomack links) =====
function embedSrc(s) {
  const m = (s.source || '').match(/audiomack\.com\/([\w.~%-]+)\/song\/([\w.~%-]+)/);
  return m ? 'https://audiomack.com/embed/song/' + m[1] + '/' + m[2] : '';
}
function isPromo(s) { return !!embedSrc(s); }

// Extra pieces made by code, so index.html does not need changes
const fpEmbed = document.createElement('div');
fpEmbed.className = 'fp-embed';
$('fpCover').parentNode.insertBefore(fpEmbed, $('fpCover'));

const amBtn = document.createElement('a');
amBtn.className = 'act';
amBtn.textContent = 'Audiomack';
amBtn.target = '_blank';
amBtn.rel = 'noopener';
amBtn.style.display = 'none';
amBtn.style.textDecoration = 'none';
$('shareBtn').parentNode.appendChild(amBtn);

const promoBtn = document.createElement('button');
promoBtn.className = 'btn btn-ghost';
promoBtn.id = 'promoteBtn';
promoBtn.textContent = 'Promote';
$('uploadBtn').parentNode.insertBefore(promoBtn, $('uploadBtn'));

// ===== Share sheet (made by code) =====
const sheet = document.createElement('div');
sheet.className = 'sheet';
sheet.innerHTML =
  '<div class="sheet-panel">' +
  '<button class="sheet-close" id="shClose">&#10005;</button>' +
  '<h3>Promote this song</h3>' +
  '<div class="sh-card"><div class="sh-cover" id="shCover"></div>' +
  '<div><strong id="shTitle"></strong><small id="shArtist"></small><em>Listen now on MusicApp</em></div></div>' +
  '<label class="sh-label">Caption (you can edit it)</label>' +
  '<textarea id="shCaption" rows="3"></textarea>' +
  '<div class="sh-link"><input id="shLink" readonly><button class="sh-small" id="shCopyLink">Copy link</button></div>' +
  '<div class="sh-grid">' +
  '<button class="sh-btn wa" id="shWa">WhatsApp</button>' +
  '<button class="sh-btn fb" id="shFb">Facebook</button>' +
  '<button class="sh-btn x" id="shX">X</button>' +
  '<button class="sh-btn tg" id="shTg">Telegram</button>' +
  '<button class="sh-btn" id="shCap">Copy caption</button>' +
  '<button class="sh-btn" id="shMore">More...</button>' +
  '</div>' +
  '<p class="sh-tip">Instagram and TikTok: copy the caption, then paste it in your story, post or bio.</p>' +
  '</div>';
document.body.appendChild(sheet);

// ===== Load songs from Supabase =====
async function loadSongs() {
  if (typeof db !== 'undefined' && db) {
    try {
      const res = await db.from('songs').select('*').order('created_at', { ascending: false });
      if (res.error) throw res.error;
      songs = res.data.map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        plays: r.plays || 0,
        color: r.color || '#1ed760',
        url: r.audio_url || '',
        source: r.source_url || '',
        cover: r.cover_url || '',
        featured: !!r.featured,
        fromDb: true
      }));
    } catch (e) { console.log('Could not load songs', e); }
  }
  if (!songs.length) songs = sampleSongs.map((s) => Object.assign({}, s));
}

// ===== Login state =====
async function refreshAuth() {
  if (typeof db === 'undefined' || !db) return;
  const res = await db.auth.getSession();
  loggedIn = !!res.data.session;
  $('loginBtn').textContent = loggedIn ? 'Logout' : 'Login';
}

// ===== Build the page =====
function buildCard(s, i, delay, featured) {
  const card = document.createElement('div');
  card.className = 'song-card';
  card.style.animationDelay = Math.min(delay, 8) * 0.1 + 's';
  card.innerHTML =
    (featured ? '<span class="badge">Featured</span>' : '') +
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
  return card;
}

function renderTrending() {
  const row = $('trendingRow');
  row.innerHTML = '';
  songs.forEach((s, i) => row.appendChild(buildCard(s, i, i, false)));
}

// Featured section: shows songs that have "featured" ticked in Supabase
function renderFeatured() {
  let sec = $('featuredSection');
  const list = [];
  songs.forEach((s, i) => { if (s.featured) list.push({ s: s, i: i }); });
  if (!list.length) { if (sec) sec.remove(); return; }
  if (!sec) {
    sec = document.createElement('section');
    sec.className = 'section';
    sec.id = 'featuredSection';
    sec.innerHTML = '<h2>Featured</h2><div class="card-row" id="featuredRow"></div>';
    const trending = $('trendingRow').closest('section');
    trending.parentNode.insertBefore(sec, trending);
  }
  const row = $('featuredRow');
  row.innerHTML = '';
  list.forEach((x, n) => row.appendChild(buildCard(x.s, x.i, n, true)));
}

async function renderArtists() {
  const row = $('artistRow');
  row.innerHTML = '';
  const names = [];
  songs.forEach((s) => { if (!names.includes(s.artist)) names.push(s.artist); });

  // Profile photos that artists added
  const photos = {};
  if (typeof db !== 'undefined' && db) {
    try {
      const res = await db.from('artist_photos').select('artist_key, photo_url');
      if (!res.error) res.data.forEach((r) => { photos[r.artist_key] = r.photo_url; });
    } catch (e) {}
  }

  names.slice(0, 10).forEach((name, i) => {
    const photo = photos[name.trim().toLowerCase()];
    const bg = photo ? "url('" + esc(photo) + "') center/cover" : artistColors[i % artistColors.length];
    const el = document.createElement('div');
    el.className = 'artist';
    el.style.animationDelay = (i * 0.1) + 's';
    el.innerHTML =
      '<div class="artist-pic" style="background:' + bg + '">' +
      (photo ? '' : esc(name.charAt(0).toUpperCase())) + '</div><span>' + esc(name) + '</span>';
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
    const isOn = liked.includes(Number(btn.dataset.id));
    btn.classList.toggle('liked', isOn);
    btn.innerHTML = isOn ? '&#9829;' : '&#9825;';
  });
}

// ===== Play counts =====
function countPlay(s) {
  s.plays += 1;
  if (typeof db !== 'undefined' && db && s.fromDb) {
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
  const embed = embedSrc(s);

  if (s.url) { audio.src = s.url; } else { audio.removeAttribute('src'); audio.load(); }

  if (embed) {
    fpEmbed.innerHTML = '<iframe src="' + esc(embed) + '" height="252" scrolling="no" frameborder="0" allow="autoplay"></iframe>';
    amBtn.href = s.source;
    amBtn.style.display = '';
  } else {
    fpEmbed.innerHTML = '';
    amBtn.style.display = 'none';
  }
  $('fullPlayer').classList.toggle('embed-mode', !!embed);

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
  if (isPromo(songs[index])) {
    counted = true;
    countPlay(songs[index]);
    openFull();
    return;
  }
  startPlayback();
}
function togglePlay() {
  if (currentIndex === -1) { playSong(0); return; }
  if (isPromo(songs[currentIndex])) { openFull(); return; }
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
function startFake() {
  stopFake();
  fakeTimer = setInterval(() => {
    fakeTime += 0.25;
    updateProgress(fakeTime, FAKE_DURATION);
    if (fakeTime >= FAKE_DURATION) handleEnded();
  }, 250);
}
function stopFake() { clearInterval(fakeTimer); }

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
  on(id, 'click', (e) => {
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
on('openFull', 'click', openFull);
on('fpClose', 'click', closeFull);

// ===== Share =====
function songLink(s) {
  return location.href.split('?')[0].split('#')[0] + '?song=' + s.id;
}
function shareText(s) { return 'Listen to "' + s.title + '" by ' + s.artist + ' on MusicApp'; }

function openSheet() {
  if (currentIndex === -1) return;
  const s = songs[currentIndex];
  $('shCover').style.background = coverBg(s);
  $('shCover').innerHTML = coverIcon(s);
  $('shTitle').textContent = s.title;
  $('shArtist').textContent = s.artist;
  $('shCaption').value = '\uD83D\uDD25 Now playing: "' + s.title + '" by ' + s.artist + '. Listen free on MusicApp \uD83C\uDFA7';
  $('shLink').value = songLink(s);
  sheet.classList.add('open');
}
function closeSheet() { sheet.classList.remove('open'); }
function captionOnly() { return $('shCaption').value.trim(); }
function fullText() { return captionOnly() + ' ' + $('shLink').value; }

on('shClose', 'click', closeSheet);
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
on('shCopyLink', 'click', () => copyText($('shLink').value, 'Link copied'));
on('shCap', 'click', () => copyText(fullText(), 'Caption copied'));
on('shWa', 'click', () => window.open('https://wa.me/?text=' + encodeURIComponent(fullText()), '_blank'));
on('shFb', 'click', () => window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent($('shLink').value), '_blank'));
on('shX', 'click', () => window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(captionOnly()) + '&url=' + encodeURIComponent($('shLink').value), '_blank'));
on('shTg', 'click', () => window.open('https://t.me/share/url?url=' + encodeURIComponent($('shLink').value) + '&text=' + encodeURIComponent(captionOnly()), '_blank'));
on('shMore', 'click', async () => {
  if (navigator.share) {
    try { await navigator.share({ title: 'MusicApp', text: captionOnly(), url: $('shLink').value }); } catch (e) {}
  } else {
    copyText(fullText(), 'Caption copied');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSheet(); closeFull(); }
});

function shareWhatsApp() {
  if (currentIndex === -1) return;
  const s = songs[currentIndex];
  window.open('https://wa.me/?text=' + encodeURIComponent(shareText(s) + ' ' + songLink(s)), '_blank');
}

// ===== Button wiring =====
on('playBtn', 'click', togglePlay);
on('fpPlay', 'click', togglePlay);
on('nextBtn', 'click', nextSong);
on('fpNext', 'click', nextSong);
on('prevBtn', 'click', prevSong);
on('fpPrev', 'click', prevSong);
on('fpLike', 'click', () => { if (currentIndex !== -1) toggleLike(songs[currentIndex].id); });
on('shareBtn', 'click', openSheet);
on('waBtn', 'click', shareWhatsApp);
on('shuffleBtn', 'click', () => {
  shuffleOn = !shuffleOn;
  $('shuffleBtn').classList.toggle('active', shuffleOn);
  toast(shuffleOn ? 'Shuffle on' : 'Shuffle off');
});
on('repeatBtn', 'click', () => {
  repeatOn = !repeatOn;
  $('repeatBtn').classList.toggle('active', repeatOn);
  toast(repeatOn ? 'Repeat on' : 'Repeat off');
});

// ===== Search =====
on('search', 'input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.song-card').forEach((card) => {
    card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

// ===== Top buttons =====
on('loginBtn', 'click', async () => {
  if (loggedIn) {
    await db.auth.signOut();
    await refreshAuth();
    toast('Logged out');
  } else {
    window.location.href = 'login.html';
  }
});
on('uploadBtn', 'click', () => { window.location.href = 'upload.html'; });
on('promoteBtn', 'click', () => { window.location.href = 'promote.html'; });
on('mySongsBtn', 'click', () => { window.location.href = 'mysongs.html'; });
on('startBtn', 'click', () => playSong(0));

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
  renderFeatured();
  renderTrending();
  renderArtists();
  renderReleases();
  refreshLikes();
  await refreshAuth();

  // Shared link (?song=ID): open that song
  const sharedId = new URLSearchParams(location.search).get('song');
  if (sharedId) {
    const i = songs.findIndex((s) => String(s.id) === sharedId);
    if (i !== -1) {
      if (isPromo(songs[i])) { playSong(i); } else { selectSong(i); openFull(); }
    }
  }
}
init();