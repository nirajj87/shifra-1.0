/**
 * Hindi STT often writes English as Devanagari. Fix known mishears
 * before intent parsers run, so distance/translate/wiki see real words.
 */
const FIXES: [string, string][] = [
  ["व्हाट इस ए लरावेली", "what is laravel"],
  ["व्हाट इस ए लरावेल", "what is laravel"],
  ["व्हाट इस द टुडे", "what is the today"],
  ["लरावेली माइग्रेशन", "laravel migration"],
  ["लरावेली", "laravel"],
  ["लरावेल", "laravel"],
  ["माइग्रेशन", "migration"],
  ["कॉउ गिव्स अस मिल्क", "cow gives us milk"],
  ["कॉउ गिव्स मिल्क", "cow gives milk"],
  ["गिव्स अस मिल्क", "gives us milk"],
  ["घड़ी हरसरू", "gadhi harsaru"],
  ["कड़ी हरसरू", "gadhi harsaru"],
  ["गढ़ी हरसरू", "gadhi harsaru"],
  ["हरसरू", "harsaru"],
  ["जीजेवीएसटी", "gjust"],
  ["जीजे यूनिवर्सिटी", "gjust university hisar"],
  ["मुख्यमंत्रियों", "chief minister"],
  ["मुख्यमंत्री", "chief minister"],
  ["मुखयमंत्री", "chief minister"],
  ["जन्माष्टमी", "janmashtami"],
  ["जन्म दिवस", "birthday"],
  ["वी एस कोड", "vs code"],
  ["बीएस कोड", "vs code"],
  ["यूनिवर्सिटी", "university"],
  ["के बारे में", "ke baare mein"],
  ["ट्रांसलेशन करें", "translation"],
  ["इन हिंदी", "in hindi"],
  ["इन इंग्लिश", "in english"],
  ["mukhymantri", "chief minister"],
  ["mukhya mantri", "chief minister"],
  ["bs code", "vs code"],
];

export function repairSpeech(text: string) {
  let out = ` ${String(text || "").trim()} `;
  const pairs = [...FIXES].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of pairs) {
    out = out.split(from).join(` ${to} `);
  }
  return out.replace(/\s+/g, " ").trim();
}
