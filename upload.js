// ===== Elements =====
const $ = (id) => document.getElementById(id);
const coverDrop = $('coverDrop'), coverInput = $('coverInput');
const audioDrop = $('audioDrop'), audioInput = $('audioInput');
let coverFile = null;    // chosen cover image
let audioFile = null;    // chosen audio file

// ===== Must be logged in to upload =====
if (db) {
  db.auth.getSession().then(({ data }) => {
    if (!data.session) location.href = 'login.html?next=upload.html';
  });
}

// ===== Open file pickers when a zone is tapped =====
coverDrop.addEventListener('click', () => coverInput.click());
audioDrop.addEventListener('click', () => audioInput.click());

// ===== Drag and drop (works on desktop) =====
[coverDrop, audioDrop].forEach((zone) => {
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (zone === coverDrop) handleCover(file); else handleAudio(file);
  });
});

coverInput.addEventListener('change', () => coverInput.files[0] && handleCover(coverInput.files[0]));
audioInput.addEventListener('change', () => audioInput.files[0] && handleAudio(audioInput.files[0]));

// ===== Cover preview =====
function handleCover(file) {
  if (!file.type.startsWith('image/')) { showError('Please choose an image for the cover.'); return; }
  coverFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    $('coverPreview').src = e.target.result;
    $('coverPreview').classList.add('show');
    $('coverText').innerHTML = '<strong>Cover added</strong><small>Tap to change</small>';
    coverDrop.classList.add('filled');
    showError('');
  };
  reader.readAsDataURL(file);
}

// ===== Audio preview =====
function handleAudio(file) {
  if (!file.type.startsWith('audio/')) { showError('Please choose an audio file.'); return; }
  audioFile = file;
  const mb = (file.size / 1024 / 1024).toFixed(1);
  $('audioText').innerHTML = '<strong>' + file.name + '</strong><small>' + mb + ' MB - tap to change</small>';
  audioDrop.classList.add('filled');
  $('audioPreview').src = URL.createObjectURL(file);
  $('audioPreview').hidden = false;
  showError('');
}

function showError(msg) { $('error').textContent = msg; }
function safeName(name) { return name.replace(/[^a-zA-Z0-9._-]/g, '_'); }

function resetButton() {
  $('submitBtn').disabled = false;
  $('submitBtn').textContent = 'Upload Song';
  $('uploadProgress').classList.remove('show');
  $('uploadFill').style.width = '0';
}

// ===== Upload to Supabase =====
$('submitBtn').addEventListener('click', async () => {
  const title = $('title').value.trim();
  const artist = $('artist').value.trim();
  const genre = $('genre').value;

  if (!title) return showError('Please enter the song title.');
  if (!artist) return showError('Please enter your artist name.');
  if (!audioFile) return showError('Please choose your song file.');
  if (!db) return showError('Add your Supabase keys in config.js first.');
  if (audioFile.size > 50 * 1024 * 1024) return showError('Song is too big. Keep it under 50 MB.');
  showError('');

  const { data: sess } = await db.auth.getSession();
  if (!sess.session) { location.href = 'login.html?next=upload.html'; return; }
  const uid = sess.session.user.id;

  $('submitBtn').disabled = true;
  $('submitBtn').textContent = 'Uploading...';
  $('uploadProgress').classList.add('show');

  // Smooth progress bar that moves while the real upload happens
  let pct = 0;
  const timer = setInterval(() => {
    pct = Math.min(pct + Math.random() * 6 + 2, 90);
    $('uploadFill').style.width = pct + '%';
  }, 300);

  try {
    const stamp = Date.now();

    // 1. Upload the audio file
    const audioPath = uid + '/' + stamp + '-' + safeName(audioFile.name);
    const a = await db.storage.from('songs').upload(audioPath, audioFile, { contentType: audioFile.type });
    if (a.error) throw a.error;
    const audioUrl = db.storage.from('songs').getPublicUrl(audioPath).data.publicUrl;

    // 2. Upload the cover image (optional)
    let coverUrl = '';
    if (coverFile) {
      const coverPath = uid + '/' + stamp + '-' + safeName(coverFile.name);
      const c = await db.storage.from('covers').upload(coverPath, coverFile, { contentType: coverFile.type });
      if (c.error) throw c.error;
      coverUrl = db.storage.from('covers').getPublicUrl(coverPath).data.publicUrl;
    }

    // 3. Save the song in the songs table
    const colors = ['#1ed760', '#ff7a18', '#a855f7', '#3b82f6', '#ec4899', '#eab308'];
    const ins = await db.from('songs').insert({
      title: title,
      artist: artist,
      genre: genre,
      audio_url: audioUrl,
      cover_url: coverUrl,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
    if (ins.error) throw ins.error;

    clearInterval(timer);
    $('uploadFill').style.width = '100%';
    setTimeout(() => {
      $('successText').textContent = '"' + title + '" by ' + artist + ' is now on MusicApp.';
      $('success').classList.add('show');
    }, 400);
  } catch (err) {
    clearInterval(timer);
    showError('Upload failed: ' + (err.message || 'try again'));
    resetButton();
  }
});

// ===== Upload another =====
$('againBtn').addEventListener('click', () => {
  $('success').classList.remove('show');
  $('title').value = '';
  $('artist').value = '';
  coverFile = null; audioFile = null;
  $('coverPreview').classList.remove('show');
  $('coverText').innerHTML = '<span class="drop-icon">&#128444;</span><strong>Add cover art</strong><small>Tap to choose an image</small>';
  $('audioText').innerHTML = '<span class="drop-icon">&#127925;</span><strong>Choose your song</strong><small>MP3, WAV or M4A</small>';
  coverDrop.classList.remove('filled'); audioDrop.classList.remove('filled');
  $('audioPreview').hidden = true;
  resetButton();
});