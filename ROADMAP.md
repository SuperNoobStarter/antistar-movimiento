# ANTISTAR-moviMIENTO — ROADMAP (saved for later)

Parked ideas from the initial build session (Sept 2026). The site is fully
working as a static frontend with mock data; these are the next moves,
roughly in priority order.

## 1. Real ingest backend
Make GO LIVE actually broadcast: browser webcam/screen capture via
`MediaRecorder`, an ingest endpoint on the Node server, and HLS restreaming
(e.g. MediaMTX or Owncast) so user-created channels stream real video
instead of public test streams.

## 2. Websocket chat
Replace the simulated chat with a real websocket chat server shared across
all viewers. Keep the existing UI (`Chat` object in `app.js` is the seam —
swap `setInterval` ticks for socket events).

## 3. Stream thumbnails & mini-player
Animate stream previews on channel-card hover, and add a mini-player that
keeps playing when navigating away from the watch page.

## 4. Persistence
Persist go-live channels, amplify counts, and viewer stats to
`localStorage` (or the future backend) so user-created transmissions
survive page reloads.

## Architecture notes
- The data seam is `data.js` (`CHANNELS` array) — swap for an API fetch.
- Player logic lives in `app.js` (`attachStream` / `destroyPlayer`), already
  handles hls.js + Safari native HLS.
- Static server is `server.js` (zero-dep Node ESM) — extend it for ingest +
  websockets rather than adding a framework.
- Run with: `node server.js 8137`
