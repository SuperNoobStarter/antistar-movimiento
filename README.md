# ANTISTAR-moviMIENTO

> Kill the star. Start the movimiento.

A pirate livestreaming platform — the airwaves belong to whoever climbs the
rooftop. Dark CRT-punk interface, real HLS playback, simulated movement chat,
and a go-live flow that puts a new channel on the grid instantly.

## Run it

Static site — no build step, no dependencies to install.

```bash
# any static server, e.g.
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL. (Opening `index.html` directly also works, but a
server is recommended so hls.js fetches segments cleanly.)

## What's inside

| File | Purpose |
|------|---------|
| `index.html` | Shell: boot screen, ticker, nav, view + modal/toast roots |
| `styles.css` | Design system — "midnight" violet/rose theme + phosphor-green tube mode |
| `data.js` | Mock data: channels, public HLS test streams, chat pools, slogans |
| `app.js` | Hash router, channel grid, HLS attach/destroy, chat sim, go-live modal |

## Features

- **Boot sequence** — terminal-style startup log with progress bar
- **Signal grid** — live channels with viewer counts + uptime, replay vault for archives
- **Real video** — hls.js playing public test streams (`test-streams.mux.dev`, Akamai), with native HLS fallback for Safari
- **Watch page** — big-play overlay, unmute, PiP, quality cycler, copy-link, "amplify" counter, mesh-relay broadcast note
- **Live chat simulation** — bilingual (ES/EN) chatter pool, mod messages, hype bursts, viewer counts that drift while you watch
- **GO LIVE modal** — creates a real channel entry with slug, routes to it, viewer counter starts at 1 (you)
- **Manifesto** — four articles + slogan wall
- **Theme toggle** — midnight violet/rose ⇄ phosphor green CRT, persisted in `localStorage`
- **Search** — filters by title, host, or tag
- **Ticker** — broadcast-style news marquee

## Swapping in a real backend

`data.js` is the seam. Replace `CHANNELS` with a fetch from your API, point
`stream.url` at your own `.m3u8` endpoints (e.g. from a MediaMTX / Owncast /
SRT ingest), and wire the go-live modal to a create-channel endpoint. Chat is
one `setInterval` away from a websocket.

---

*No stars were authorized in the construction of this network.*
