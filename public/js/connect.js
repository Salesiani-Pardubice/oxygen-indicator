import { qrSvg } from './qr.js';

const $ = (selector) => document.querySelector(selector);

const NO_NETWORK = 'Počítač není připojený k žádné síti.';

/** One QR code per address (a PC can have several networks), each captioned with its URL. */
function fillQrList(container, urls) {
  container.replaceChildren(
    ...urls.map((url) => {
      const figure = document.createElement('figure');
      const code = document.createElement('div');
      code.className = 'qr';
      code.innerHTML = qrSvg(url); // markup comes from the QR library, the URL is only encoded in it
      const caption = document.createElement('figcaption');
      caption.textContent = url;
      figure.append(code, caption);
      return figure;
    }),
  );
  if (urls.length === 0) container.textContent = NO_NETWORK;
}

function fillList(list, urls) {
  list.replaceChildren(
    ...urls.map((url) => {
      const item = document.createElement('li');
      item.textContent = url;
      return item;
    }),
  );
  if (urls.length === 0) {
    const item = document.createElement('li');
    item.textContent = NO_NETWORK;
    list.append(item);
  }
}

/** The "connect from a phone" dialog; only offered on the server PC itself. */
export function setupConnectDialog({ enabled }) {
  const button = $('#connect-button');
  const dialog = $('#connect');
  button.hidden = !enabled;
  if (!enabled) return;

  button.addEventListener('click', async () => {
    try {
      const info = await (await fetch('/api/info')).json();
      fillQrList($('#connect-admin'), info.adminUrls);
      fillList($('#connect-display'), info.displayUrls);
    } catch {
      fillQrList($('#connect-admin'), []);
      fillList($('#connect-display'), []);
    }
    dialog.hidden = false;
  });
  $('#connect-close').addEventListener('click', () => (dialog.hidden = true));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.hidden = true;
  });
}
