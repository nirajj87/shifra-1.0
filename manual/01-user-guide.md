# Shifra user guide

Shifra Hindi aur English dono samajhti hai. Mic dabaye rakho, ya type karke Send dabaao.

Live URL (server pe upload ke baad): `https://your-domain.com/shifra/`

Local: `http://localhost:5173/shifra/` — repo root se `npm run dev`

Windows pe: `Shifra.exe` ya `Start-Shifra.bat`

---

## Pehli baar

1. Chrome ya Edge use karo (mic inhi mein theek chalta hai).
2. Mic allow karo jab browser poochhe.
3. Welcome line sunne ke baad sawal bolo ya type karo.

---

## Kya poochh sakte ho

### Roz ke sawal
- Time / date: `abhi time kya hai`, `aaj ki tarikh`
- Naam: `mera naam Ravi hai`, `mera naam kya hai`
- Mausam: `Delhi ka mausam`, `Hisar ka temperature`
- Shifra: `tumhara naam`, `kisne banaya`, `kaise ho`

### Distance (live map, guess nahi)
- `Delhi to Patna ki Duri`
- `गुरुग्राम से मोतिहारी की दूरी बताओ`
- `Delhi se Mumbai kitna door`

Do shehar clearly bolo. Mic agar naam tod de (jaise गढ़ी → घड़ी) to type karna zyada sahi hai.

### Translate
- `translate hello to hindi`
- `राम स्कूल जाता है इंग्लिश में ट्रांसलेशन करें`
- `cow gives milk in hindi`

### News
- `aajkal India mein kya chal raha hai`
- `America news`
- `Bihar headlines`
- `twitter pe kya chal raha` — live tweets tabhi jab server pe `X_BEARER_TOKEN` ho; warna news channels

Jawab ke **neeche chhote font** mein source dikhta hai (NDTV, BBC, OSRM, Gemini, Wikipedia…). Ye line sirf screen pe hai, awaaz mein nahi.

### Aur tools
- `100 dollar in rupees`
- `define courage`
- `10 km in miles`
- `time in Tokyo`
- `joke sunao`

### Sites (browser)
- `youtube kholo`, `open gmail`, `play music`, `open whatsapp`

### Is PC pe (sirf local `npm run dev` / EXE)
- `notepad kholo`, `docker chalu`, `open project shifra`, `D drive kholo`

Hosted live site pe ye PC commands **kaam nahi** karte.

---

## Buttons

| Button | Kaam |
|---|---|
| Hold to talk | Dabaye rakho, bolo, chhod do |
| Send | Typed command |
| Copy chat | Poori baat copy |
| Save answers | Browser mein seekhe hue jawab download |
| New questions | Jo sawal training pe gire, unki list |
| Fill with Gemini | Un sawalon ke jawab Gemini se `common-qa.json` mein (tokens lagte hain) |

---

## Galat jawab aaye to

1. Typed clearly try karo, sirf mic nahi.
2. Distance ke liye `se` / `to` / `की दूरी` ke saath do shehar.
3. Page hard refresh (`Ctrl+Shift+R`).
4. Live site pe news na aaye to host ko Node/`npm run preview` chahiye (dekho [03-live-server.md](./03-live-server.md)).

Andar ka flow: [02-internal-process.md](./02-internal-process.md)
