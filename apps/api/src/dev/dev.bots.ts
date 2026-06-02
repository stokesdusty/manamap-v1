export const BOT_IDS = [
  'bot_wren',
  'bot_sol',
  'bot_kira',
  'bot_dune',
  'bot_ash',
  'bot_nyx',
  'bot_tarn',
  'bot_vex',
] as const;

export type BotId = (typeof BOT_IDS)[number];
