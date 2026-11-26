const $ = (id) => document.getElementById(id);
let rows = [];   // one row per artist: name and total plays

function esc(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function money(cur, n) {
  return cur + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Add up the plays of every artist
async function load() {
  if (!db) { $('msg').textContent = 'Add your Supabase keys in config.js first.'; return; }
  const res = await db.from('songs').select('artist, plays');
  if (res.error) { $('msg').textContent = 'Could not load plays: ' + res.error.message; return; }
  const map = {};
  res.data.forEach((s) => {
    const key = s.artist.trim().toLowerCase();
    if (!map[key]) map[key] = { name: s.artist.trim(), plays: 0 };
    map[key].plays += s.plays || 0;
  });
  rows = Object.values(map).sort((a, b) => b.plays - a.plays);
}

$('calcBtn').addEventListener('click', () => {
  const amount = parseFloat($('amount').value);
  const pct = parseFloat($('pct').value);
  const cur = $('cur').value;

  if (!(amount > 0)) return ($('msg').textContent = 'Enter the ad earnings amount.');
  if (!(pct >= 0 && pct <= 100)) return ($('msg').textContent = 'Percentage must be between 0 and 100.');
  const total = rows.reduce((sum, r) => sum + r.plays, 0);
  if (!total) return ($('msg').textContent = 'There are no plays yet to share the money by.');
  $('msg').textContent = '';

  const pool = amount * pct / 100;
  let html =
    '<div class="pay-summary"><div><span>Artists share</span><b>' + money(cur, pool) + '</b></div>' +
    '<div><span>App keeps</span><b>' + money(cur, amount - pool) + '</b></div></div>';

  rows.forEach((r) => {
    const share = r.plays / total;
    html +=
      '<div class="pay-row"><div><strong>' + esc(r.name) + '</strong>' +
      '<small>' + r.plays.toLocaleString() + ' plays - ' + (share * 100).toFixed(1) + '%</small></div>' +
      '<b>' + money(cur, pool * share) + '</b></div>';
  });
  html += '<p class="note">This uses total plays so far. Real payments are sent by the client outside the app.</p>';
  $('result').innerHTML = html;
});

load();