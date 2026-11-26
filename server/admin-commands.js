// Admin commands by type. Each returns the game's { ok } / { ok: false, error } result.
export const adminCommands = {
  setPaused: (game, body) => game.setPaused(body.paused),
  setSpeed: (game, body) => game.setSpeed(body.speed),
  setMinerCount: (game, body) => game.setMinerCount(body.count),
  renameMiner: (game, body) => game.renameMiner(body.id, body.name),
  setPreset: (game, body) => game.setPreset(body.id, body.preset),
  setPresetSeconds: (game, body) => game.setPresetSeconds(body.preset, body.seconds),
  setRefillPerClick: (game, body) => game.setRefillPerClick(body.value),
  startEvent: (game, body) =>
    game.startEvent(body.eventId, {
      // A missing durationSec means "use the event's default"; an explicit null means "until ended".
      durationSec: 'durationSec' in body ? body.durationSec : undefined,
      targets: body.targets,
    }),
  endEvent: (game, body) => game.endEvent(body.id),
  clearLog: (game) => game.clearLog(),
  resetGame: (game) => game.resetGame(),
};
