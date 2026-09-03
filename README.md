# Shifra 1.0

Browser voice assistant (Hindi + English). Common questions work **offline**. If the local bank does not know, **Gemini is tried first**. If Gemini tokens/quota fail, Shifra fetches **Wikipedia** (then Google if you add a CSE key, otherwise DuckDuckGo). When Gemini works again, it automatically gets priority.

Live app folder: [`shipra/`](./shipra)

## Desktop app (Windows EXE)

Double-click **`Shifra.exe`** in the repo root (or `shipra\desktop\Shifra.exe`). It starts the local server and opens Shifra in an Edge/Chrome app window.

Need Node.js installed. Create the exe anytime:

```bash
npm run exe
```

Or use `Start-Shifra.bat`.

## Setup

1. Install [Node.js 20+](https://nodejs.org/)
2. Clone and install:

```bash
git clone https://github.com/nirajj87/shifra-1.0.git
cd shifra-1.0
npm install --prefix shipra
```

3. Gemini key (optional, for unknown questions and Fill with Gemini):

```bash
copy shipra\.env.example shipra\.env.local
```

Open `shipra/.env.local` and paste your key from [Google AI Studio](https://aistudio.google.com/apikey):

```
VITE_GEMINI_API_KEY=AIza...your-key...
```

Never commit `.env.local`.

## Commands

From the **repo root**:

| Command | What it does |
|---|---|
| `npm run dev` | Local app at http://localhost:5173/shifra/ |
| `npm run build` | Production build in `shipra/dist` |
| `npm run preview` | Preview the production build |
| `npm run exe` | Builds `Shifra.exe` (Windows launcher) |

Or from `shipra/`: `npm run dev`, `npm run build`.

After changing Vite plugins, restart `npm run dev`.

## Env settings (`shipra/.env.local`)

| Key | Default | Meaning |
|---|---|---|
| `VITE_GEMINI_API_KEY` | empty | Gemini API key |
| `VITE_GEMINI_MODEL` | `gemini-2.5-flash-lite` | Cheap/fast model first |
| `VITE_GEMINI_ENABLED` | `true` | Set `false` to stay fully offline |
| `VITE_MAX_OUTPUT_TOKENS` | `80` | Short spoken answers |
| `VITE_ANSWER_SENTENCES` | `2` | Max spoken sentences |
| `VITE_WELCOME` | `true` | Speak welcome on load |
| `VITE_WEB_FALLBACK` | `true` | Wikipedia/Google after Gemini fails |
| `VITE_GOOGLE_CSE_KEY` | empty | Optional Google Custom Search key |
| `VITE_GOOGLE_CSE_CX` | empty | Optional Google search engine ID |
| `SHIFRA_PROJECTS_DIR` | `D:\Projects` | Folder for “open project …” |
| `SHIFRA_DOCKER_EXE` | Docker Desktop path | Used by “start docker” |

## How to talk / type

- **Hold to talk** on the mic button, then release.
- **Type** in the box and press Send. Same commands work by voice or keyboard.

Unknown questions: Gemini first, then Wikipedia/Google, then *I'm still in training…*  
They are saved to `shipra/src/data/missing-questions.json` during `npm run dev`. Click **Fill with Gemini** to write answers into `shipra/src/data/common-qa.json` (this spends tokens).

## Voice / type commands

Web (works in the browser):

- `open youtube` / `youtube kholo`
- `open gmail` / `open email` / `email kholo`
- `play music` / `gaana chalao`
- `play kesariya` (YouTube Music search)
- `open facebook`, `open instagram`, `open whatsapp`, `open google`
- `translate hello to hindi` / `good morning ka hindi`
- `Delhi se Mumbai kitna door` / `distance between Delhi and London`
- `100 dollar in rupees`
- `define courage`
- `time in Tokyo`

This PC (Windows, **only with `npm run dev`** on this machine):

- `open notepad` / `notepad kholo`
- `start docker` / `docker chalu`
- `run project` (starts `shifra`)
- `run project <name>` / `project <name> chalao`
- `open my project <name>` / `open project shifra` / `mera project shifra kholo`
- `open drive` (opens `D:\`)
- `open C drive` / `D drive kholo`

Projects are opened from `SHIFRA_PROJECTS_DIR` (default `D:\Projects`).

## Question bank

Edit `shipra/src/data/common-qa.json` to add offline answers:

```json
{ "id": "creator", "keys": ["who made you", "kisne banaya"], "en": "...", "hi": "..." }
```

## Notes

- Mic needs Chrome (or Edge) and permission.
- Hosted/GitHub Pages builds **cannot** open Notepad, Docker, or local drives. Those need local `npm run dev`.
- Weather uses Open-Meteo (no extra key). Name a city: *Hisar ka mausam*.
- Free tools (no extra key):

| Say | What happens |
|---|---|
| `translate good morning to hindi` | Google Translate (MyMemory backup) |
| `hello ka hindi` | Same |
| `Delhi se Mumbai kitna door` / `distance between Delhi and Hisar` | Road + straight-line km (OSM / OSRM) |
| `100 dollar in rupees` | Live currency |
| `define ephemeral` / `hello ka matlab` | English dictionary |
| `10 km in miles` / `100 fahrenheit in celsius` | Unit convert |
| `time in Tokyo` / `London ka time` | World clock |
| `joke sunao` | Fresh joke |
| `tell me a fact` | Random fact |
