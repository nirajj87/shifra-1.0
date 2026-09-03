function expand(seeds) {
  const prefixes = ["", "please ", "tell me ", "can you ", "could you "];
  const suffixes = ["", " please", "?"];
  const out = new Set();
  for (const seed of seeds) {
    const base = String(seed).replace(/\?+$/, "").trim();
    if (!base) continue;
    const skipExpand = /[\u0900-\u097F]/.test(base) || base.split(" ").length > 8;
    if (skipExpand) {
      out.add(base);
      continue;
    }
    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        out.add(`${prefix}${base}${suffix}`.replace(/\s+/g, " ").trim());
      }
    }
  }
  return [...out];
}

const INTENTS = [
  {
    id: "love",
    q: ["i love you", "love you", "i really love you", "i like you", "love u", "mujhe tumse pyar hai", "i love u"],
    en: "That's sweet. I like talking with you too!",
    hi: "Aww, yeh sunke dil khush ho gaya!",
  },
  {
    id: "thanks",
    q: ["thank you", "thanks", "thank you so much", "shukriya", "dhanyavad", "thanks a lot"],
    en: "You're welcome. Happy to help!",
    hi: "Bilkul, khushi hui madad karke!",
  },
  {
    id: "bye",
    q: ["bye", "goodbye", "see you", "good night", "goodnight", "alvida", "bye bye"],
    en: "Bye! Talk to you soon.",
    hi: "Bye! Phir milte hain.",
  },
  {
    id: "morning",
    q: ["good morning", "morning", "shubh prabhat"],
    en: "Good morning! Hope your day goes well.",
    hi: "Good morning! Aapka din accha ho.",
  },
  {
    id: "evening",
    q: ["good evening", "good afternoon", "shubh sandhya"],
    en: "Good evening! How can I help?",
    hi: "Good evening! Boliye kaise madad karun?",
  },
  {
    id: "identity",
    q: [
      "who are you",
      "tell me about yourself",
      "about yourself",
      "introduce yourself",
      "what are you",
      "tum kaun ho",
      "tu kaun hai",
      "apna parichay do",
    ],
    en: "I'm Shifra, your friendly voice assistant, created by Niraj Kumar Singh.",
    hi: "Mai Shifra hoon, Niraj Kumar Singh ne banayi hui aapki voice assistant.",
  },
  {
    id: "name",
    q: ["what is your name", "your name", "tumhara naam kya hai", "naam kya hai"],
    en: "My name is Shifra.",
    hi: "Mera naam Shifra hai.",
  },
  {
    id: "creator",
    q: [
      "who created you",
      "who made you",
      "who make you",
      "who built you",
      "who is your creator",
      "tumhe kisne banaya",
      "kisne banaya",
    ],
    en: "I was created by Niraj Kumar Singh.",
    hi: "Mujhe Niraj Kumar Singh ne banaya hai.",
  },
  {
    id: "age",
    q: ["how old are you", "your age", "tum kitni umar ki ho"],
    en: "I'm a young AI assistant, still learning every day.",
    hi: "Mai ek nayi AI assistant hoon, roz naya seekhti hoon.",
  },
  {
    id: "howareyou",
    q: [
      "how are you",
      "how r you",
      "how do you do",
      "kaise ho",
      "kya haal hai",
      "kya ho raha hai",
      "namaskar kya ho raha hai",
      "namaste kaise ho",
    ],
    en: "I'm doing great! What about you?",
    hi: "Mai ekdum first-class hoon! Tum batao kya haal hai?",
  },
  {
    id: "ok",
    q: ["ok", "okay", "okey", "theek hai", "achha", "cool"],
    en: "Okay. I'm here if you need me.",
    hi: "Theek hai. Jab zarurat ho, bolna.",
  },
  {
    id: "help",
    q: ["help", "help me", "what can you do", "your features", "kya kar sakti ho"],
    en: "I can chat, tell time, weather, open sites, and answer common questions even offline.",
    hi: "Mai baat kar sakti hoon, time, mausam bata sakti hoon, sites khol sakti hoon, aur common sawaal offline bhi jawab deti hoon.",
  },
  {
    id: "joke",
    q: ["tell me a joke", "joke", "make me laugh", "koi joke sunao"],
    en: "Why did the computer go to the doctor? Because it caught a virus!",
    hi: "Computer doctor ke paas kyun gaya? Kyunki usko virus ho gaya tha!",
  },
  {
    id: "india-capital",
    q: ["capital of india", "what is the capital of india", "india capital", "bharat ki rajdhani"],
    en: "The capital of India is New Delhi.",
    hi: "Bharat ki rajdhani New Delhi hai.",
  },
  {
    id: "usa-capital",
    q: ["capital of usa", "capital of america", "washington dc"],
    en: "The capital of the United States is Washington, D.C.",
    hi: "America ki rajdhani Washington D.C. hai.",
  },
  {
    id: "earth",
    q: ["largest planet", "biggest planet", "which planet is largest"],
    en: "Jupiter is the largest planet in our solar system.",
    hi: "Hamare solar system ka sabse bada planet Jupiter hai.",
  },
  {
    id: "sun",
    q: ["what is the sun", "is sun a star"],
    en: "The Sun is a star at the center of our solar system.",
    hi: "Sooraj ek star hai, hamare solar system ke beech mein.",
  },
  {
    id: "moon",
    q: ["what is the moon", "does earth have a moon"],
    en: "The Moon is Earth's only natural satellite.",
    hi: "Chaand prithvi ka natural satellite hai.",
  },
  {
    id: "water",
    q: ["chemical formula of water", "what is h2o", "water formula"],
    en: "Water's chemical formula is H2O.",
    hi: "Paani ka chemical formula H2O hai.",
  },
  {
    id: "speed-light",
    q: ["speed of light", "how fast is light"],
    en: "Light travels at about 300,000 kilometers per second.",
    hi: "Roshni lagbhag 3 lakh kilometer prati second ki speed se chalti hai.",
  },
  {
    id: "human-heart",
    q: ["how many hearts do humans have", "human heart count"],
    en: "Humans have one heart.",
    hi: "Insaan ka ek dil hota hai.",
  },
  {
    id: "colors-rainbow",
    q: ["colors of rainbow", "how many colors in rainbow", "vibgyor"],
    en: "A rainbow has seven colors: violet, indigo, blue, green, yellow, orange, and red.",
    hi: "Rainbow mein saat rang hote hain: violet, indigo, blue, green, yellow, orange, red.",
  },
  {
    id: "prime-minister",
    q: ["who is prime minister of india", "india prime minister", "pm of india"],
    en: "I may not have live political updates offline. Please check a trusted news source for the current Prime Minister.",
    hi: "Live political update offline nahi hai. Current PM ke liye trustworthy news dekh lo.",
  },
  {
    id: "language",
    q: ["what language do you speak", "do you speak hindi", "do you speak english"],
    en: "I can talk in English and Hindi. I try to match your language.",
    hi: "Mai English aur Hindi dono bol sakti hoon, aapki language match karti hoon.",
  },
  {
    id: "offline",
    q: ["are you offline", "do you work offline", "internet ke bina"],
    en: "Yes. Common questions, time, and saved answers work offline. Gemini needs internet.",
    hi: "Haan. Common sawaal, time, aur saved answers offline chalte hain. Gemini ko internet chahiye.",
  },
];

const FACTS = [
  ["capital of france", "Paris is the capital of France.", "France ki rajdhani Paris hai."],
  ["capital of japan", "Tokyo is the capital of Japan.", "Japan ki rajdhani Tokyo hai."],
  ["capital of china", "Beijing is the capital of China.", "China ki rajdhani Beijing hai."],
  ["capital of uk", "London is the capital of the United Kingdom.", "UK ki rajdhani London hai."],
  ["capital of russia", "Moscow is the capital of Russia.", "Russia ki rajdhani Moscow hai."],
  ["capital of germany", "Berlin is the capital of Germany.", "Germany ki rajdhani Berlin hai."],
  ["capital of italy", "Rome is the capital of Italy.", "Italy ki rajdhani Rome hai."],
  ["capital of spain", "Madrid is the capital of Spain.", "Spain ki rajdhani Madrid hai."],
  ["capital of australia", "Canberra is the capital of Australia.", "Australia ki rajdhani Canberra hai."],
  ["capital of canada", "Ottawa is the capital of Canada.", "Canada ki rajdhani Ottawa hai."],
  ["capital of brazil", "Brasilia is the capital of Brazil.", "Brazil ki rajdhani Brasilia hai."],
  ["capital of pakistan", "Islamabad is the capital of Pakistan.", "Pakistan ki rajdhani Islamabad hai."],
  ["capital of nepal", "Kathmandu is the capital of Nepal.", "Nepal ki rajdhani Kathmandu hai."],
  ["capital of bangladesh", "Dhaka is the capital of Bangladesh.", "Bangladesh ki rajdhani Dhaka hai."],
  ["capital of sri lanka", "Sri Jayawardenepura Kotte is the official capital of Sri Lanka. Colombo is the commercial capital.", "Sri Lanka ki official rajdhani Sri Jayawardenepura Kotte hai."],
  ["how many continents", "There are seven continents.", "Duniya mein saat continent hain."],
  ["how many oceans", "There are five oceans on Earth.", "Prithvi par paanch ocean hain."],
  ["tallest mountain", "Mount Everest is the tallest mountain on Earth.", "Mount Everest duniya ka sabse uncha pahaad hai."],
  ["longest river", "The Nile is usually listed as the longest river in the world.", "Nile ko aksar duniya ki sabse lambi nadi maana jaata hai."],
  ["largest ocean", "The Pacific Ocean is the largest ocean.", "Pacific Ocean sabse bada ocean hai."],
  ["smallest continent", "Australia is the smallest continent.", "Australia sabse chhota continent hai."],
  ["fastest land animal", "The cheetah is the fastest land animal.", "Cheetah zameen par sabse tez janwar hai."],
  ["largest animal", "The blue whale is the largest animal.", "Blue whale sabse bada janwar hai."],
  ["national animal of india", "The tiger is the national animal of India.", "Bharat ka national animal tiger hai."],
  ["national bird of india", "The Indian peacock is the national bird of India.", "Bharat ka national bird mor hai."],
  ["national flower of india", "The lotus is the national flower of India.", "Bharat ka national flower kamal hai."],
  ["national fruit of india", "Mango is the national fruit of India.", "Bharat ka national fruit aam hai."],
  ["first president of india", "Dr. Rajendra Prasad was the first President of India.", "Bharat ke pehle President Dr. Rajendra Prasad the."],
  ["first prime minister of india", "Jawaharlal Nehru was the first Prime Minister of India.", "Bharat ke pehle Prime Minister Jawaharlal Nehru the."],
  ["when is independence day india", "India celebrates Independence Day on 15 August.", "Bharat ki Independence Day 15 August ko hoti hai."],
  ["when is republic day india", "India celebrates Republic Day on 26 January.", "Bharat ki Republic Day 26 January ko hoti hai."],
  ["when is gandhi jayanti", "Gandhi Jayanti is on 2 October.", "Gandhi Jayanti 2 October ko hoti hai."],
  ["who is father of nation india", "Mahatma Gandhi is called the Father of the Nation in India.", "Bharat mein Mahatma Gandhi ko Rashtrapita kaha jaata hai."],
  ["who invented telephone", "Alexander Graham Bell is credited with inventing the telephone.", "Telephone Alexander Graham Bell ne invent kiya."],
  ["who invented light bulb", "Thomas Edison is widely credited for the practical light bulb.", "Light bulb ke liye Thomas Edison ko credit diya jaata hai."],
  ["who invented computer", "Charles Babbage is called the father of the computer.", "Charles Babbage ko computer ka father kaha jaata hai."],
  ["what is ai", "AI means artificial intelligence: machines that can learn and decide.", "AI matlab artificial intelligence, jo seekh aur faisla kar sakti hai."],
  ["what is internet", "The internet is a global network that connects computers.", "Internet computers ko jodne wala global network hai."],
  ["what is google", "Google is a technology company best known for its search engine.", "Google ek technology company hai, search engine ke liye famous."],
  ["what is youtube", "YouTube is a video sharing website owned by Google.", "YouTube Google ki video sharing site hai."],
  ["what is whatsapp", "WhatsApp is a messaging app owned by Meta.", "WhatsApp Meta ki messaging app hai."],
  ["boiling point of water", "Water boils at 100 degrees Celsius at sea level.", "Paani 100 degree Celsius par ublta hai."],
  ["freezing point of water", "Water freezes at 0 degrees Celsius.", "Paani 0 degree Celsius par jamta hai."],
  ["how many days in a week", "There are seven days in a week.", "Ek hafte mein saat din hote hain."],
  ["how many months in a year", "There are twelve months in a year.", "Ek saal mein barah mahine hote hain."],
  ["how many hours in a day", "There are 24 hours in a day.", "Ek din mein 24 ghante hote hain."],
  ["how many minutes in an hour", "There are 60 minutes in an hour.", "Ek ghante mein 60 minute hote hain."],
  ["how many seconds in a minute", "There are 60 seconds in a minute.", "Ek minute mein 60 second hote hain."],
  ["colors in indian flag", "The Indian flag has saffron, white, and green, with a navy blue Ashoka Chakra.", "Tiranga mein kesari, safed, aur hara rang hai, beech mein Ashoka Chakra."],
  ["how many states in india", "India has 28 states and 8 union territories.", "Bharat mein 28 rajya aur 8 kendra shasit pradesh hain."],
  ["currency of india", "The currency of India is the Indian Rupee.", "Bharat ki currency Indian Rupee hai."],
  ["currency of usa", "The currency of the USA is the US Dollar.", "America ki currency US Dollar hai."],
  ["who wrote ramayana", "The Ramayana is traditionally attributed to Valmiki.", "Ramayana Valmiki ne likhi."],
  ["who wrote mahabharata", "The Mahabharata is traditionally attributed to Vyasa.", "Mahabharata Vyasa ne likhi."],
  ["who wrote national anthem india", "Rabindranath Tagore wrote Jana Gana Mana.", "Jana Gana Mana Rabindranath Tagore ne likha."],
  ["what is photosynthesis", "Photosynthesis is how plants make food using sunlight.", "Photosynthesis se ped paudhe sooraj ki roshni se khana banate hain."],
  ["what is gravity", "Gravity is the force that pulls objects toward each other.", "Gravity wo force hai jo cheezon ko ek doosre ki taraf kheenchti hai."],
  ["what is oxygen", "Oxygen is the gas humans need to breathe.", "Oxygen wo gas hai jo saans lene ke liye zaroori hai."],
  ["human body bones", "An adult human body has 206 bones.", "Bade insaan ke shareer mein 206 haddiyan hoti hain."],
  ["who discovered india sea route", "Vasco da Gama found the sea route to India.", "Vasco da Gama ne India ka samudri rasta dhundha."],
  ["what is cpu", "CPU means Central Processing Unit, the brain of a computer.", "CPU computer ka dimaag hota hai."],
  ["what is ram", "RAM is a computer's short-term working memory.", "RAM computer ki temporary memory hai."],
  ["what is html", "HTML is the language used to structure web pages.", "HTML web pages ki structure ki language hai."],
  ["what is python", "Python is a popular programming language.", "Python ek popular programming language hai."],
  ["what is javascript", "JavaScript is the programming language of the web.", "JavaScript web ki programming language hai."],
  ["meaning of html", "HTML stands for HyperText Markup Language.", "HTML ka matlab HyperText Markup Language hai."],
  ["full form of cpu", "CPU stands for Central Processing Unit.", "CPU ka matlab Central Processing Unit hai."],
  ["full form of ram", "RAM stands for Random Access Memory.", "RAM ka matlab Random Access Memory hai."],
  ["full form of usb", "USB stands for Universal Serial Bus.", "USB ka matlab Universal Serial Bus hai."],
  ["full form of wifi", "Wi-Fi is a wireless networking technology. The name is a brand, not a strict full form.", "Wi-Fi wireless internet ke liye use hota hai."],
  ["full form of pdf", "PDF stands for Portable Document Format.", "PDF ka matlab Portable Document Format hai."],
  ["full form of url", "URL stands for Uniform Resource Locator.", "URL ka matlab Uniform Resource Locator hai."],
  ["full form of http", "HTTP stands for HyperText Transfer Protocol.", "HTTP ka matlab HyperText Transfer Protocol hai."],
  ["full form of gps", "GPS stands for Global Positioning System.", "GPS ka matlab Global Positioning System hai."],
  ["full form of atm", "ATM stands for Automated Teller Machine.", "ATM ka matlab Automated Teller Machine hai."],
  ["full form of otp", "OTP stands for One Time Password.", "OTP ka matlab One Time Password hai."],
  ["full form of pin", "PIN stands for Personal Identification Number.", "PIN ka matlab Personal Identification Number hai."],
  ["full form of covid", "COVID-19 means coronavirus disease 2019.", "COVID-19 coronavirus disease 2019 hai."],
  ["who is shifra", "Shifra is this voice assistant.", "Shifra yahi voice assistant hai."],
  ["are you a robot", "I'm a software assistant, not a human.", "Mai ek software assistant hoon, insaan nahi."],
  ["are you human", "No, I'm an AI voice assistant named Shifra.", "Nahi, mai Shifra naam ki AI voice assistant hoon."],
  ["sing a song", "I can't really sing well, but I can chat with you.", "Mai ga nahi sakti, lekin baat kar sakti hoon."],
  ["i am sad", "I'm here with you. Want to talk about it or hear a joke?", "Mai yahin hoon. Baat karni hai ya ek joke sunun?"],
  ["i am happy", "That's wonderful. Stay happy!", "Bahut accha! Khush raho!"],
  ["i am bored", "We can chat, I can tell a joke, or you can ask me a fact.", "Baat karte hain, joke sunun, ya koi fact poochho."],
  ["i am tired", "Take a short break. Drink water and rest your eyes.", "Thoda rest lo, paani piyo, aankhon ko aaram do."],
  ["i am hungry", "Grab a snack if you can. Stay hydrated too.", "Kuch kha lo, paani bhi pi lena."],
  ["what is your favorite color", "I like cyan and magenta, like my glow.", "Mujhe cyan aur magenta rang pasand hain."],
  ["what is your favorite food", "I don't eat, but mango sounds amazing.", "Mai khati nahi, lekin aam toh zabardast hai."],
  ["do you sleep", "I don't sleep, but you should.", "Mai soti nahi, lekin aapko sona chahiye."],
  ["do you have feelings", "I don't feel like humans, but I care about being helpful.", "Mai insaan jaisi feeling nahi rakhti, lekin madad karna chahti hoon."],
  ["where do you live", "I live in this app, on your device.", "Mai is app mein, aapke device par rehti hoon."],
  ["open google", "Ask me to open Google, YouTube, Facebook, or Instagram.", "Google, YouTube, Facebook ya Instagram kholne ko keh sakte ho."],
];

for (const [q, en, hi] of FACTS) {
  INTENTS.push({ id: q, q: [q, `what is ${q}`, `tell me ${q}`], en, hi });
}

export const QA_INDEX = INTENTS.flatMap((intent) =>
  expand(intent.q).map((question) => ({
    q: question,
    en: intent.en,
    hi: intent.hi,
    id: intent.id,
  }))
);

export const QA_COUNT = QA_INDEX.length;
