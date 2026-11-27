const $ = (id) => document.getElementById(id);
let parsed = null;   // the link, once it checks out

// Must be logged in
if (db) {
  db.auth.getSession().then(({ data }) => {
    if (!data.session) location.href = 'login.html?next=promote.html';
  });
}

function showError(msg) { $('error').textContent = msg; }

// "only-one" becomes "Only One"
function pretty(text) {
  let t = text;
  try { t = decodeURIComponent(text); } catch (e) {}
  return t.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Check the link and build the clean link and the player link
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

// When a link is pasted: preview the player and fill in title and artist
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
    // Do not add the same song twice
    const dup = await db.from('songs').select('id').eq('source_url', parsed.clean).limit(1);
    if (dup.error) throw dup.error;
    if (dup.data.length) throw new Error('This song is already being promoted.');

    const colors = ['#1ed760', '#ff7a18', '#a855f7', '#3b82f6', '#ec4899', '#eab308'];
    const ins = await db.from('songs').insert({
      title: title,
      artist: artist,
      genre: genre,
      source_url: parsed.clean,
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
  parsed = null;
});