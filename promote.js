const $ = (id) => document.getElementById(id);
let parsed = null;     // the link, once it checks out
let coverBlob = null;  // the cover picture, if one was chosen

// Must be logged in
if (db) {
  db.auth.getSession().then(({ data }) => {
    if (!data.session) location.href = 'login.html?next=promote.html';
  });
}

function showError(msg) { $('error').textContent = msg; }

function pretty(text) {
  let t = text;
  try { t = decodeURIComponent(text); } catch (e) {}
  return t.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseLink(raw) {
  let u;
  try { u = new URL(raw.trim()); } catch (e) { return null; }
  if (!/(^|\.)audiomack\.com$/.test(u.hostname)) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 3 || parts[1] !== 'song') return null;
  const ok = /^[\w.~%-]+$/;
  if (!ok.test(parts[0]) || !ok.test(parts[2])) return null;
  return {
    artist: parts[0],
    slug: parts[2],
    clean: 'https://audiomack.com/' + parts[0] + '/song/' + parts[2],
    embed: 'https://audiomack.com/embed/song/' + parts[0] + '/' + parts[2]
  };
}

$('link').addEventListener('input', (e) => {
  const raw = e.target.value;
  parsed = parseLink(raw);
  if (parsed) {
    showError('');
    $('preview').innerHTML = '<iframe src="' + parsed.embed + '" height="252" scrolling="no" frameborder="0"></iframe>';
    if (!$('title').value) $('title').value = pretty(parsed.slug);
    if (!$('artist').value) $('artist').value = pretty(parsed.artist);
  } else {
    $('preview').innerHTML = '';
    if (raw.trim().length > 12) showError('This does not look like an Audiomack song link.');
  }
});

// ===== Cover picture =====
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

$('coverDrop').addEventListener('click', () => $('coverInput').click());
$('coverInput').addEventListener('change', async () => {
  const file = $('coverInput').files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showError('Please choose an image for the cover.'); return; }
  try {
    coverBlob = await resizeImage(file, 800);
    $('coverPreview').src = URL.createObjectURL(coverBlob);
    $('coverPreview').classList.add('show');
    $('coverText').innerHTML = '<strong>Cover added</strong><small>Tap to change</small>';
    $('coverDrop').classList.add('filled');
    showError('');
  } catch (e) {
    showError('Could not read that image.');
  }
});

// ===== Promote =====
$('submitBtn').addEventListener('click', async () => {
  const title = $('title').value.trim();
  const artist = $('artist').value.trim();
  const genre = $('genre').value;

  if (!parsed) return showError('Paste a full Audiomack song link first.');
  if (!title) return showError('Please enter the song title.');
  if (!artist) return showError('Please enter the artist name.');
  if (!db) return showError('Add your Supabase keys in config.js first.');
  showError('');

  $('submitBtn').disabled = true;
  $('submitBtn').textContent = 'Promoting...';

  try {
    const sess = await db.auth.getSession();
    if (!sess.data.session) { location.href = 'login.html?next=promote.html'; return; }
    const uid = sess.data.session.user.id;

    const dup = await db.from('songs').select('id').eq('source_url', parsed.clean).limit(1);
    if (dup.error) throw dup.error;
    if (dup.data.length) throw new Error('This song is already being promoted.');

    // Upload the cover first, if there is one
    let coverUrl = null;
    if (coverBlob) {
      const path = uid + '/cover-' + Date.now() + '.jpg';
      const up = await db.storage.from('covers').upload(path, coverBlob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      coverUrl = db.storage.from('covers').getPublicUrl(path).data.publicUrl;
    }

    const colors = ['#1ed760', '#ff7a18', '#a855f7', '#3b82f6', '#ec4899', '#eab308'];
    const ins = await db.from('songs').insert({
      title: title,
      artist: artist,
      genre: genre,
      source_url: parsed.clean,
      cover_url: coverUrl,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
    if (ins.error) throw ins.error;

    $('successText').textContent = '"' + title + '" by ' + artist + ' is now being promoted.';
    $('success').classList.add('show');
  } catch (err) {
    showError(err.message || 'Something went wrong. Try again.');
  }
  $('submitBtn').disabled = false;
  $('submitBtn').textContent = 'Promote Song';
});

$('againBtn').addEventListener('click', () => {
  $('success').classList.remove('show');
  $('link').value = '';
  $('title').value = '';
  $('artist').value = '';
  $('preview').innerHTML = '';
  $('coverPreview').classList.remove('show');
  $('coverText').innerHTML = '<span class="drop-icon">&#128444;</span><strong>Add cover art (optional)</strong><small>Save the cover from Audiomack, then choose it here</small>';
  $('coverDrop').classList.remove('filled');
  $('coverInput').value = '';
  coverBlob = null;
  parsed = null;
});