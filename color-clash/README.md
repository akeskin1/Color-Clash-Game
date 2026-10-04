# Color Clash

A real-time 2–4 player browser game. Players join a room, race to select the target color, and compete over 10 rounds.

## Local development

```bash
npm install
npm run dev
```

The Vite client runs on its normal local port and the Socket.IO server on port 3000. For production, build the client and run the server:

```bash
npm run build
npm start
```

If frontend and backend are hosted separately, set `VITE_SERVER_URL` during the client build to the public server URL.

## Rules
- 2–4 players per room.
- 10 rounds.
- Each round lasts 5 seconds.
- First correct answer: +100 points.
- Wrong answer: −25 points (score never goes below zero).
- Each player can answer only once per round.
- Highest score after round 10 wins.
