/**
 * Saves the game to disk whenever it changed. Call saveIfChanged() on a timer and once more on
 * shutdown. A failing disk is reported once, not on every attempt.
 */
export function createPersister({ game, store, log = console }) {
  let lastSaved = null;
  let failing = false;

  function saveIfChanged() {
    const data = game.serialize();
    const text = JSON.stringify(data);
    if (text === lastSaved) return false;
    try {
      store.save(data);
      lastSaved = text;
      if (failing) log.log('Ukládání stavu hry opět funguje.');
      failing = false;
      return true;
    } catch (error) {
      if (!failing) log.warn(`Stav hry se nepodařilo uložit: ${error.message}`);
      failing = true;
      return false;
    }
  }

  /** Remembers the state that was just loaded, so it is not written back unchanged. */
  function markLoaded() {
    lastSaved = JSON.stringify(game.serialize());
  }

  return { saveIfChanged, markLoaded };
}
