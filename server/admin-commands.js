// Admin commands by type. Each returns the game's { ok } / { ok: false, error } result.
export const adminCommands = {
  setPaused: (game, body) => game.setPaused(body.paused),
  setSpeed: (game, body) => game.setSpeed(body.speed),
  setMinerCount: (game, body) => game.setMinerCount(body.count),
  renameMiner: (game, body) => game.renameMiner(body.id, body.name),
  setPreset: (game, body) => game.setPreset(body.id, body.preset),
  setPresetSeconds: (game, body) => game.setPresetSeconds(body.preset, body.seconds),
  setRefillPerClick: (game, body) => game.setRefillPerClick(body.value),
  resetGame: (game) => game.resetGame(),
};
