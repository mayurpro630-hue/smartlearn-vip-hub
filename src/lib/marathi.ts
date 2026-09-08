/**
 * Marathi support for the English course: meanings + Devanagari pronunciation.
 * Used as a helpful fallback when a lesson row has no Marathi text saved yet.
 */

type Gloss = { mr: string; pron: string; emoji?: string };

export const MARATHI_GLOSSARY: Record<string, Gloss> = {
  apple: { mr: "सफरचंद", pron: "अ‍ॅपल", emoji: "🍎" },
  banana: { mr: "केळे", pron: "बनाना", emoji: "🍌" },
  mango: { mr: "आंबा", pron: "मँगो", emoji: "🥭" },
  orange: { mr: "संत्रं", pron: "ऑरेंज", emoji: "🍊" },
  grapes: { mr: "द्राक्षे", pron: "ग्रेप्स", emoji: "🍇" },
  guava: { mr: "पेरू", pron: "ग्वावा", emoji: "🍐" },
  cat: { mr: "मांजर", pron: "कॅट", emoji: "🐱" },
  dog: { mr: "कुत्रा", pron: "डॉग", emoji: "🐶" },
  cow: { mr: "गाय", pron: "काऊ", emoji: "🐄" },
  goat: { mr: "बकरी", pron: "गोट", emoji: "🐐" },
  horse: { mr: "घोडा", pron: "हॉर्स", emoji: "🐴" },
  elephant: { mr: "हत्ती", pron: "एलिफंट", emoji: "🐘" },
  lion: { mr: "सिंह", pron: "लायन", emoji: "🦁" },
  tiger: { mr: "वाघ", pron: "टायगर", emoji: "🐯" },
  monkey: { mr: "माकड", pron: "मंकी", emoji: "🐵" },
  bird: { mr: "पक्षी", pron: "बर्ड", emoji: "🐦" },
  fish: { mr: "मासा", pron: "फिश", emoji: "🐟" },
  water: { mr: "पाणी", pron: "वॉटर", emoji: "💧" },
  milk: { mr: "दूध", pron: "मिल्क", emoji: "🥛" },
  rice: { mr: "भात", pron: "राईस", emoji: "🍚" },
  bread: { mr: "पाव", pron: "ब्रेड", emoji: "🍞" },
  book: { mr: "पुस्तक", pron: "बुक", emoji: "📖" },
  pen: { mr: "पेन", pron: "पेन", emoji: "🖊️" },
  pencil: { mr: "पेन्सिल", pron: "पेन्सिल", emoji: "✏️" },
  school: { mr: "शाळा", pron: "स्कूल", emoji: "🏫" },
  teacher: { mr: "शिक्षक", pron: "टीचर", emoji: "👩‍🏫" },
  student: { mr: "विद्यार्थी", pron: "स्टुडंट", emoji: "🧑‍🎓" },
  friend: { mr: "मित्र", pron: "फ्रेंड", emoji: "🧑‍🤝‍🧑" },
  mother: { mr: "आई", pron: "मदर", emoji: "👩" },
  father: { mr: "वडील", pron: "फादर", emoji: "👨" },
  brother: { mr: "भाऊ", pron: "ब्रदर", emoji: "👦" },
  sister: { mr: "बहीण", pron: "सिस्टर", emoji: "👧" },
  house: { mr: "घर", pron: "हाऊस", emoji: "🏠" },
  home: { mr: "घर", pron: "होम", emoji: "🏡" },
  market: { mr: "बाजार", pron: "मार्केट", emoji: "🛒" },
  shop: { mr: "दुकान", pron: "शॉप", emoji: "🏪" },
  money: { mr: "पैसे", pron: "मनी", emoji: "💰" },
  road: { mr: "रस्ता", pron: "रोड", emoji: "🛣️" },
  bus: { mr: "बस", pron: "बस", emoji: "🚌" },
  train: { mr: "रेल्वे", pron: "ट्रेन", emoji: "🚆" },
  sun: { mr: "सूर्य", pron: "सन", emoji: "☀️" },
  moon: { mr: "चंद्र", pron: "मून", emoji: "🌙" },
  star: { mr: "तारा", pron: "स्टार", emoji: "⭐" },
  tree: { mr: "झाड", pron: "ट्री", emoji: "🌳" },
  flower: { mr: "फूल", pron: "फ्लॉवर", emoji: "🌸" },
  rain: { mr: "पाऊस", pron: "रेन", emoji: "🌧️" },
  hello: { mr: "नमस्कार", pron: "हॅलो", emoji: "👋" },
  "good morning": { mr: "शुभ प्रभात", pron: "गुड मॉर्निंग", emoji: "🌅" },
  "good night": { mr: "शुभ रात्री", pron: "गुड नाईट", emoji: "🌜" },
  "thank you": { mr: "धन्यवाद", pron: "थँक यू", emoji: "🙏" },
  sorry: { mr: "माफ करा", pron: "सॉरी", emoji: "😔" },
  please: { mr: "कृपया", pron: "प्लीज", emoji: "🙂" },
  yes: { mr: "होय", pron: "येस", emoji: "✅" },
  no: { mr: "नाही", pron: "नो", emoji: "❌" },
  today: { mr: "आज", pron: "टुडे", emoji: "📅" },
  tomorrow: { mr: "उद्या", pron: "टुमॉरो", emoji: "📆" },
  yesterday: { mr: "काल", pron: "येस्टरडे", emoji: "🕐" },
  eat: { mr: "खाणे", pron: "ईट", emoji: "🍽️" },
  drink: { mr: "पिणे", pron: "ड्रिंक", emoji: "🥤" },
  run: { mr: "पळणे", pron: "रन", emoji: "🏃" },
  walk: { mr: "चालणे", pron: "वॉक", emoji: "🚶" },
  read: { mr: "वाचणे", pron: "रीड", emoji: "📚" },
  write: { mr: "लिहिणे", pron: "राईट", emoji: "✍️" },
  speak: { mr: "बोलणे", pron: "स्पीक", emoji: "🗣️" },
  listen: { mr: "ऐकणे", pron: "लिसन", emoji: "👂" },
  interview: { mr: "मुलाखत", pron: "इंटरव्ह्यू", emoji: "💼" },
  meeting: { mr: "बैठक", pron: "मीटिंग", emoji: "🗓️" },
  email: { mr: "ईमेल", pron: "ईमेल", emoji: "📧" },
  office: { mr: "कार्यालय", pron: "ऑफिस", emoji: "🏢" },
  comfortable: { mr: "आरामदायक", pron: "कम-फर्-ट-बल", emoji: "🛋️" },
};

const LETTER_WORDS: Record<string, string> = {
  A: "apple",
  B: "banana",
  C: "cat",
  D: "dog",
  E: "elephant",
  F: "fish",
  G: "goat",
  H: "horse",
  L: "lion",
  M: "mango",
  O: "orange",
  P: "pen",
  R: "rice",
  S: "sun",
  T: "tree",
  W: "water",
};

export function lookupMarathi(text: string | null | undefined): Gloss | null {
  if (!text) return null;
  const key = text.toLowerCase().replace(/[^a-z ]/g, "").trim();
  if (MARATHI_GLOSSARY[key]) return MARATHI_GLOSSARY[key]!;
  const single = text.trim().toUpperCase();
  if (single.length === 1 && LETTER_WORDS[single]) {
    return MARATHI_GLOSSARY[LETTER_WORDS[single]!] ?? null;
  }
  return null;
}

/** Emoji illustration for a word, used by the visual matching game. */
export function iconFor(text: string | null | undefined) {
  return lookupMarathi(text)?.emoji ?? null;
}
