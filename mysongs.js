const $ = (id) => document.getElementById(id);
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
function songLink(id) {
  return location.href.split('?')[0].replace('mysongs.html', 'index.html') + '?song=' + id;
}

async function init() {
  if (!db) { $('msg').textContent = 'Add your Supabase keys in config.js first.'; return; }

  const sess = await db.auth.getSession();
  if (!sess.data.session) { location.href = 'login.html?next=mysongs.html'; return; }
  const user = sess.data.session.user;
  $('who').textContent = 'Signed in as ' + user.email;

  // Only this user's songs
  const res = await db.from('songs').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (res.error) { $('msg').textContent = 'Could not load songs: ' + res.error.message; return; }
  render(res.data);
}

function render(list) {
  const total = list.reduce((sum, s) => sum + (s.plays || 0), 0);
  const top = list.slice().sort((a, b) => (b.plays || 0) - (a.plays || 0))[0];
  $('statSongs').textContent = list.length;
  $('statPlays').textContent = formatPlays(total);
  $('statTop').textContent = top ? top.title : '-';

  const box = $('myList');
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<div class="empty">You have not uploaded any song yet.</div>';
    return;
  }
  list.forEach((s, i) => {
    const bg = s.cover_url ? "url('" + s.cover_url + "') center/cover" : (s.color || '#1ed760');
    const row = document.createElement('div');
    row.className = 'my-song';
    row.style.animationDelay = Math.min(i, 8) * 0.08 + 's';
    row.innerHTML =
      '<div class="cover" style="background:' + bg + '">' + (s.cover_url ? '' : '&#9835;') + '</div>' +
      '<div class="my-info"><div class="song-title">' + esc(s.title) + '</div>' +
      '<div class="song-artist">' + esc(s.artist) + (s.genre ? ' - ' + esc(s.genre) : '') + '</div>' +
      '<div class="my-plays">' + (s.plays || 0).toLocaleString() + ' plays</div></div>' +
      '<div class="my-actions"><button class="mini-btn copy">Copy link</button>' +
      '<button class="mini-btn del">Delete</button></div>';

    row.querySelector('.copy').addEventListener('click', () => copyLink(s.id));
    row.querySelector('.del').addEventListener('click', () => deleteSong(s, row));
    box.appendChild(row);
  });
}

function copyLink(id) {
  const url = songLink(id);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => toast('Link copied')).catch(() => window.prompt('Copy this link', url));
  } else {
    window.prompt('Copy this link', url);
  }
}

async function deleteSong(s, row) {
  if (!confirm('Delete "' + s.title + '"? This cannot be undone.')) return;
  const res = await db.from('songs').delete().eq('id', s.id);
  if (res.error) { toast('Could not delete'); return; }
  row.remove();
  toast('Song deleted');
  init(); // refresh the numbers
}

init();