const $ = (id) => document.getElementById(id);
let mode = 'login';

// Where to go after login (upload.html sends people here with ?next=upload.html)
const params = new URLSearchParams(location.search);
const wanted = params.get('next');
const next = ['upload.html', 'mysongs.html'].includes(wanted) ? wanted : 'index.html';

function setMode(m) {
  mode = m;
  $('tabLogin').classList.toggle('active', m === 'login');
  $('tabSignup').classList.toggle('active', m === 'signup');
  $('authBtn').textContent = m === 'login' ? 'Login' : 'Create account';
  $('heading').innerHTML = m === 'login' ? 'Welcome <span>back</span>' : 'Join <span>MusicApp</span>';
  $('subText').textContent = m === 'login'
    ? 'Log in to upload and promote your music.'
    : 'Create a free account to upload your songs.';
  $('password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  showMsg('');
}
function showMsg(text, ok) {
  $('msg').textContent = text;
  $('msg').classList.toggle('ok', !!ok);
}

$('tabLogin').addEventListener('click', () => setMode('login'));
$('tabSignup').addEventListener('click', () => setMode('signup'));

$('authBtn').addEventListener('click', async () => {
  if (!db) return showMsg('Add your Supabase keys in config.js first.');
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!email || password.length < 6) return showMsg('Enter your email and a password of at least 6 characters.');

  $('authBtn').disabled = true;
  showMsg('');

  const res = mode === 'signup'
    ? await db.auth.signUp({ email: email, password: password })
    : await db.auth.signInWithPassword({ email: email, password: password });

  $('authBtn').disabled = false;
  if (res.error) return showMsg(res.error.message);

  // Sign up with email confirmation turned on: no session yet
  if (mode === 'signup' && !res.data.session) {
    return showMsg('Account created. Check your email to confirm, then log in.', true);
  }
  showMsg('Success! Taking you in...', true);
  setTimeout(() => { location.href = next; }, 600);
});

// Already logged in? Skip this page
if (db) {
  db.auth.getSession().then(({ data }) => {
    if (data.session) location.href = next;
  });
}