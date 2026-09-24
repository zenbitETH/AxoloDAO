// The colorimetric reader's author in Control operativo. Its rows ("XOVI bot sin Lupita")
// are unverified machine readings, marked by this string as Autor principal, and must never
// be published as a measurement.
//
// The bytes are the same as `author` in axolodao-brain tools/overlays/reader-author.json,
// the one file the Sheet writer reads. Both repos pin them in their tests
// (brain: tools/overlays/test-reader-rows.mjs; here: scripts/test-data-water-bot.mjs), so a
// rename on either side turns a test red instead of publishing the other side's rows.
// Nothing here reads the environment: an env var must never be able to rename the bot.
export const READER_BOT_AUTHOR = 'XOVI bot';

const FOLDED = READER_BOT_AUTHOR.toLowerCase();

// Trim and case-fold: a hand-edited cell ("  xovi BOT ") is still the bot.
export const isReaderBotAuthor = value => (value ?? '').toString().trim().toLowerCase() === FOLDED;
