const $ = (selector) => document.querySelector(selector);

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
    item.textContent = 'Počítač není připojený k žádné síti.';
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
      fillList($('#connect-admin'), info.adminUrls);
      fillList($('#connect-display'), info.displayUrls);
    } catch {
      fillList($('#connect-admin'), []);
      fillList($('#connect-display'), []);
    }
    dialog.hidden = false;
  });
  $('#connect-close').addEventListener('click', () => (dialog.hidden = true));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.hidden = true;
  });
}
