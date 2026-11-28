const $ = (id) => document.getElementById(id);
let toastTimer = null;
let uid = '';

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
  uid = user.id;
  $('who').textContent = 'Signed in as ' + user.email;

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

  photoEditor(list);

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
      '<button class="mini-btn cov">Change cover</button>' +
      '<button class="mini-btn del">Delete</button></div>';

    row.querySelector('.copy').addEventListener('click', () => copyLink(s.id));
    row.querySelector('.cov').addEventListener('click', () => changeCover(s));
    row.querySelector('.del').addEventListener('click', () => deleteSong(s, row));
    box.appendChild(row);
  });
}

// ===== Pictures =====
function resizeImage(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the image'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Could not read the image'));
    img.src = url;
  });
}

// Change the cover picture of one song
function changeCover(s) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = async () => {
    const file = inp.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please choose an image'); return; }
    try {
      toast('Uploading cover...');
      const blob = await resizeImage(file, 800);
      const path = uid + '/cover-' + Date.now() + '.jpg';
      const up = await db.storage.from('covers').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const url = db.storage.from('covers').getPublicUrl(path).data.publicUrl;
      const res = await db.from('songs').update({ cover_url: url }).eq('id', s.id).select();
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) throw new Error('Not allowed. Run the Supabase update step first.');
      toast('Cover saved');
      init();
    } catch (err) {
      toast('Could not save: ' + (err.message || 'try again'));
    }
  };
  inp.click();
}

// ===== Artist profile photo =====
function photoEditor(list) {
  const names = [];
  list.forEach((s) => {
    const n = (s.artist || '').trim();
    if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
  });
  if (!names.length) return;

  let box = $('photoBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'photoBox';
    box.className = 'photo-box';
    $('myList').parentNode.insertBefore(box, $('myList'));
  }
  box.innerHTML =
    '<h3>Artist profile photo</h3>' +
    '<div class="photo-row"><div class="photo-pic" id="photoPic"></div>' +
    '<div class="photo-side"><select id="photoArtist">' +
    names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('') +
    '</select><button class="btn btn-ghost" id="photoBtn">Choose photo</button></div></div>' +
    '<input type="file" id="photoInput" accept="image/*" hidden>';

  $('photoArtist').addEventListener('change', showPhoto);
  $('photoBtn').addEventListener('click', () => $('photoInput').click());
  $('photoInput').addEventListener('change', () => {
    if ($('photoInput').files[0]) uploadPhoto($('photoInput').files[0]);
  });
  showPhoto();
}

function keyOf(name) { return name.trim().toLowerCase(); }

async function showPhoto() {
  const name = $('photoArtist').value;
  const pic = $('photoPic');
  pic.style.background = '';
  pic.textContent = name.charAt(0).toUpperCase();
  const res = await db.from('artist_photos').select('photo_url').eq('artist_key', keyOf(name)).maybeSingle();
  if (res.data && res.data.photo_url) {
    pic.style.background = "url('" + res.data.photo_url + "') center/cover";
    pic.textContent = '';
  }
}

async function uploadPhoto(file) {
  if (!file.type.startsWith('image/')) { toast('Please choose an image'); return; }
  const name = $('photoArtist').value;
  $('photoBtn').disabled = true;
  $('photoBtn').textContent = 'Uploading...';
  try {
    const blob = await resizeImage(file, 400);
    const path = uid + '/avatar-' + Date.now() + '.jpg';
    const up = await db.storage.from('covers').upload(path, blob, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
    const url = db.storage.from('covers').getPublicUrl(path).data.publicUrl;
    const sv = await db.from('artist_photos').upsert({ artist_key: keyOf(name), photo_url: url });
    if (sv.error) throw sv.error;
    toast('Photo saved');
    showPhoto();
  } catch (err) {
    toast('Could not save: ' + (err.message || 'try again'));
  }
  $('photoBtn').disabled = false;
  $('photoBtn').textContent = 'Choose photo';
  $('photoInput').value = '';
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
  init();
}

init();