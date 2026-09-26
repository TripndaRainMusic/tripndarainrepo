# tripndarain.com

The official TripN DaRain site — World Domination Department.

- `public/index.html` — the whole page (text, sections, styles)
- `public/img/` — character poses, logo mark, video thumbnails
- `src/index.js` — handles the email signup form (`/api/join`) and the private signup export (`/api/signups?key=...`)
- `wrangler.jsonc` — Cloudflare Worker settings (serves tripndarain.com and www)

Every change pushed to `main` deploys automatically through Cloudflare.
