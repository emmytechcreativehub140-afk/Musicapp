// Starts the install feature and shows an "Install" button
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

let installEvent = null;
const installBtn = document.createElement('button');
installBtn.className = 'btn btn-green';
installBtn.textContent = 'Install SoundBoost';
installBtn.style.cssText =
  'display:none;position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:80;box-shadow:0 8px 24px rgba(0,0,0,0.5);';
document.body.appendChild(installBtn);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  installBtn.style.display = 'block';
});

installBtn.addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  installBtn.style.display = 'none';
});

window.addEventListener('appinstalled', () => { installBtn.style.display = 'none'; });