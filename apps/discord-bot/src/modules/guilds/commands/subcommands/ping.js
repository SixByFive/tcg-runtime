// /sbf ping
export const name = "ping";
export const description = "Check if the bot is alive (latency).";

// Optional options builder (not needed here)
// export function build(opt) { /* opt.addStringOption(...) */ }

export async function execute(interaction) {
  const sent = await interaction.reply({
    content: "Pinging…",
    ephemeral: true,
    fetchReply: true,
  });
  const diff = sent.createdTimestamp - interaction.createdTimestamp;
  await interaction.editReply(`Pong! Latency ~${diff}ms`);
}
