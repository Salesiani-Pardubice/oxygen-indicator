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
