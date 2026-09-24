# Live server pe Shifra

Build **`/shifra/`** path ke liye hai. Live URL is tarah honi chahiye:

`https://your-domain.com/shifra/`

## 1. Build banao (is PC pe)

Repo root:

```bash
cd D:\Projects\shifra
npm install --prefix shipra
copy shipra\.env.example shipra\.env.local
```

`shipra/.env.local` mein Gemini key (optional) daalo, phir:

```bash
npm run build:live
```

Yeh karta hai:

1. `shipra/dist` — Vite production files  
2. Copy → repo root **`live/`** (upload yahi folder)

`live/` git mein nahi jaati, kyunki bundle mein API key ho sakti hai.

## 2. Host pe chadhao

`live/` ke **saare** files (index.html, assets/, UPLOAD.txt chhod sakte ho) host ki is jagah pe daalo:

```
public_html/shifra/index.html
public_html/shifra/assets/...
```

cPanel File Manager, FTP, ya nginx root:

```nginx
location /shifra/ {
  alias /var/www/shifra/;
  try_files $uri $uri/ /shifra/index.html;
}
```

Apache `.htaccess` usi folder mein:

```
RewriteEngine On
RewriteBase /shifra/
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /shifra/index.html [L]
```

Check: `https://your-domain.com/shifra/` — blank page ho to path galat hai (files `/` pe hain, `/shifra/` pe nahi).

## 3. Do tarike ke live

### A) Sirf static (shared hosting)

Chalega: time, Q&A, distance (OSRM), mausam, Gemini, Wikipedia.  
Kamzor: news RSS, translate proxy, fill-missing file write, PC commands.

### B) Poori app (VPS / apna Node)

Build ke baad isi machine pe:

```bash
npm run preview
```

Vite preview **wahi APIs** chalata hai jo `dev` pe hain (`/api/news`, `/api/translate`, …), port usually 4173. Nginx se `https://domain.com/shifra/` ko us port pe reverse-proxy karo.

PC commands (notepad) preview pe bhi **localhost** tak seemit hain — public server se kisi ka Notepad nahi khulega.

## 4. GitHub Pages

Repo naam `shifra-1.0` hai, isliye Pages URL `/shifra-1.0/` hoti hai, `/shifra/` nahi.

Agar Pages use karna ho to `shipra/vite.config.ts` mein `base` badal ke dubara `npm run build:live`. Apne domain + `/shifra/` ke liye abhi wala base theek hai.

## 5. Build ke baad test

1. `https://your-domain.com/shifra/`
2. Type: `Delhi to Patna ki Duri` — source `OSRM · OpenStreetMap`
3. Type: `aajkal India mein kya chal raha hai` — static host pe fail ho to preview/Node chahiye
4. Mic Chrome/Edge + HTTPS (localhost chhod ke HTTP pe mic block ho sakta hai)

User steps: [01-user-guide.md](./01-user-guide.md)
