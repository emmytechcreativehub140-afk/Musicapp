const $ = (id) => document.getElementById(id);
const name = new URLSearchParams(location.search).get('name');
let toastTimer = null;

function esc(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function formatPlays(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n); }
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

async function init() {
  if (!name) { $('msg').textContent = 'No artist chosen.'; return; }
  $('artistName').textContent = name;
  $('avatar').textContent = name.charAt(0).toUpperCase();
  document.title = name + ' - MusicApp';
  if (!db) { $('msg').textContent = 'Add your Supabase keys in config.js first.'; return; }

  // ilike = not case sensitive, so "dj kayo" and "Dj Kayo" match
  const res = await db.from('songs').select('*').ilike('artist', name).order('plays', { ascending: false });
  if (res.error) { $('msg').textContent = 'Could not load songs: ' + res.error.message; return; }
  render(res.data);
}

function render(list) {
  const total = list.reduce((sum, s) => sum + (s.plays || 0), 0);
  $('statSongs').textContent = list.length;
  $('statPlays').textContent = formatPlays(total);
  $('statTop').textContent = list[0] ? list[0].title : '-';

  const box = $('songList');
  box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="empty">No songs from this artist yet.</div>'; return; }

  list.forEach((s, i) => {
    const bg = s.cover_url ? "url('" + s.cover_url + "') center/cover" : (s.color || '#1ed760');
    const row = document.createElement('div');
    row.className = 'my-song';
    row.style.cursor = 'pointer';
    row.style.animationDelay = Math.min(i, 8) * 0.08 + 's';
    row.innerHTML =
      '<div class="cover" style="background:' + bg + '">' + (s.cover_url ? '' : '&#9835;') + '</div>' +
      '<div class="my-info"><div class="song-title">' + esc(s.title) + '</div>' +
      '<div class="song-artist">' + (s.genre ? esc(s.genre) : 'Song') + '</div>' +
      '<div class="my-plays">' + (s.plays || 0).toLocaleString() + ' plays</div></div>' +
      '<div class="my-actions"><button class="mini-btn">&#9658; Play</button></div>';
    // Opens the home page with this song loaded in the full player
    row.addEventListener('click', () => { location.href = 'index.html?song=' + s.id; });
    box.appendChild(row);
  });
}

$('shareProfile').addEventListener('click', async () => {
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: name + ' on MusicApp', url: url }); } catch (e) {}
    return;
  }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => toast('Link copied')).catch(() => window.prompt('Copy this link', url));
  } else {
    window.prompt('Copy this link', url);
  }
});

init();