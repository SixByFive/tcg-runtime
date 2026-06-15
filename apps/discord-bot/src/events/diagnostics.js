// src/events/diagnostics.js
// NEW: optional diagnostics middleware to log lifecycle timings.

export function logStart(interaction, note) {
  interaction.__t0 = Date.now();
  console.log(`[ix] start ${interaction.id} ${interaction.commandName} ${note ?? ""}`);
}

export function logDefer(interaction) {
  console.log(`[ix] defer ${interaction.id} +${Date.now() - (interaction.__t0 || Date.now())}ms`);
}

export function logEdit(interaction, note) {
  console.log(`[ix] edit ${interaction.id} +${Date.now() - (interaction.__t0 || Date.now())}ms ${note ?? ""}`);
}
