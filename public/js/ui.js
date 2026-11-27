/**
 * A row of toggle buttons where exactly one value is selected.
 * options: [{ value, label }]; returns { select(value) } to update the highlighted button.
 */
export function createSegmented(container, options, onSelect) {
  const buttons = new Map();
  for (const { value, label } of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => onSelect(value));
    container.append(button);
    buttons.set(value, button);
  }
  return {
    select(selected) {
      for (const [value, button] of buttons) button.setAttribute('aria-pressed', String(value === selected));
    },
  };
}

export function createToast(element) {
  let timer;
  return (message) => {
    element.textContent = message;
    element.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (element.hidden = true), 3000);
  };
}

/**
 * Wires a button that unlocks audio (browsers need a user gesture) and then toggles mute.
 * The first click anywhere on the page also unlocks audio, in case nobody pressed the button.
 * labels: { off, on, muted } texts for "not enabled yet", "sound on" and "muted".
 */
export function bindSoundToggle({ button, tones, labels, onEnable = () => {} }) {
  function render() {
    button.classList.toggle('attention', !tones.enabled);
    if (!tones.enabled) button.textContent = labels.off;
    else button.textContent = tones.muted ? labels.muted : labels.on;
  }

  function enable() {
    tones.enable();
    onEnable();
  }

  button.addEventListener('click', () => {
    if (!tones.enabled) {
      enable();
      tones.playTone(880, 200); // confirms that the speakers work
    } else {
      tones.setMuted(!tones.muted);
    }
    render();
  });

  document.addEventListener('pointerdown', (event) => {
    if (tones.enabled || button.contains(event.target)) return;
    enable();
    render();
  });

  render();
}
