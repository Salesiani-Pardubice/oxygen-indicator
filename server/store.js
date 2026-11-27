import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** A JSON file on disk. Writes go through a temporary file so a crash never leaves half a file. */
export function createStore(path) {
  return {
    path,

    /** The saved object, or null when there is no file yet. Throws when the file is damaged. */
    load() {
      let text;
      try {
        text = readFileSync(path, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
      return JSON.parse(text);
    },

    save(data) {
      mkdirSync(dirname(path), { recursive: true });
      const temporary = `${path}.tmp`;
      writeFileSync(temporary, JSON.stringify(data));
      renameSync(temporary, path);
    },

    /** Moves a damaged file aside so it can be inspected and is not overwritten silently. */
    quarantine() {
      try {
        renameSync(path, `${path}.broken`);
      } catch {
        // nothing to move
      }
    },
  };
}
