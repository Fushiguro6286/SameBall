// Profanity list (English + Hinglish + Hindi in Devanagari). Used to refuse names, and in creator rooms
// to mask fans' messages on screen and stop fans sending them. Nexconn's own profanity filter (Console,
// up to 50 words) can sit in front of this for every room.

const BAD = [
  "fuck", "shit", "bitch", "cunt", "dick", "pussy", "asshole", "bastard", "slut", "whore", "nigger", "nigga", "faggot", "retard",
  "chutiya", "chutiye", "madarchod", "behenchod", "bhenchod", "bhosdike", "bhosdi", "gandu", "randi", "lund", "harami", "kutta", "kamina",
];
const BAD_SET = new Set(BAD);
/** Devanagari spellings: matched inside a word, since Hindi adds suffixes (चूतिये, हरामियों). */
const BAD_DEV = ["चूतिय", "चुतिय", "मादरचोद", "बहनचोद", "बहेनचोद", "भोसड", "गांडू", "गाण्डू", "रंडी", "हरामी", "हरामि", "कमीन", "लौड़"];
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "@": "a", $: "s", "5": "s" };

/** Whole-word match for Latin script, so names like "Ashit" or "Dickens" pass. */
function isBadWord(w: string): boolean {
  const n = w.toLowerCase().replace(/[0-9@$]/g, (c) => LEET[c] ?? c).replace(/[^a-z]/g, "");
  if (n && (BAD_SET.has(n) || BAD_SET.has(n.replace(/(.)\1+/g, "$1")))) return true;
  return BAD_DEV.some((d) => w.includes(d));
}

const WORD = /[\p{L}\p{M}0-9@$]+/gu;

export const isProfane = (s: string) => (s.match(WORD) ?? []).some(isBadWord);

/** "what a gandu" → "what a g★★★★". */
export const maskProfanity = (s: string) => s.replace(WORD, (w) => (isBadWord(w) ? [...w][0] + "★".repeat(Math.max(1, [...w].length - 1)) : w));
