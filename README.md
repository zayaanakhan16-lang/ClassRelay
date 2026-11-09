# ClassRelay

**Learn it. Teach it. Pass it on.**

ClassRelay is a collaborative learning platform for the **CSC Winter Sparkathon 2026**. A
student presents their slides to four AI classmates, discovers what is still unclear, then
takes one weak concept to a room of real students who help them understand it. AI helps
you find the gap; people help you close it.

## The loop

1. **Teach** — upload a PDF or use the built-in photosynthesis lesson, then explain each
   slide to Mika, Rafa, Iya and Dev. Present with slides, or hide them and explain from
   memory.
2. **Discover** — the classmates raise their hands with questions that get harder as the
   discussion goes on (warm-up → core → challenge). They never give the answer.
3. **Learn from someone** — the classmates take a class quiz using *only the student's own
   words*, every answer quoting the transcript. Then the student takes a personal quiz and
   reads a private learning report.
4. **Re-teach** — the student can share one weak concept to a PeerRelay room, read peer
   explanations, mark the helpful ones, and re-teach the concept with confidence.

Privacy is the default: no account, no public scores, no automatic sharing. A student
chooses exactly what to share.

## Voice

The classroom talks. Each classmate reads their question aloud in their own voice (Web
Speech synthesis), and the student can answer by voice (Web Speech recognition) or by
typing. Both directions are honest about support: if the browser cannot speak or listen,
the UI says so and the text path always works.

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Express (Node) · pdf.js · Web Speech API.

## Run locally

```bash
npm install
npm run dev        # Vite on http://localhost:5173, API on http://localhost:8787
```

For a production build served by the Node server:

```bash
npm run build
npm start          # http://localhost:8787
```

### AI keys (optional)

Everything works with no keys at all — the app falls back to a clearly-labelled built-in
simulation, and every simulated response is marked as such in the UI.

To use a real model, copy `.env.example` to `.env` and set **one** provider:

- `GROQ_API_KEY` (recommended — fast, OpenAI-compatible)
- `OPENAI_API_KEY` (+ `OPENAI_BASE_URL`, `OPENAI_MODEL`)
- `GEMINI_API_KEY`

The key stays on the server. The browser only ever sends a task name and its data.

## Deploy to Vercel

The repository is ready to deploy as-is:

- `vercel.json` builds the client (`npm run build`) into `dist/` and serves it from the
  CDN.
- `api/index.js` is a serverless function that wraps the same Express app
  (`server/app.js`), so `/api/*` runs in the cloud.
- Add your provider key (e.g. `GROQ_API_KEY`) in **Project → Settings → Environment
  Variables** so the deployed app runs in live mode.

```bash
vercel          # preview deployment
vercel --prod   # production deployment
```

Note: the peer-learning rooms live in memory. On a serverless host they are per-instance
and ephemeral, which suits a demo — nothing about a student's learning is persisted.

## Layout

```
src/
  components/   shared UI (avatars, chips, buttons, honesty labels)
  pages/        Landing, Start, Privacy
  classroom/    the virtual classroom, slide stage, transcript, voice
  quiz/         class quiz and personal quiz
  report/       the private learning report
  peer-learning/  PeerRelay hub and rooms
  services/     ai.ts, peer.ts, speech.ts (voice in), voice.ts (voice out)
  hooks/        useSession, useVoices, useDictation
server/         Express app + AI task layer (server-side keys only)
api/            Vercel serverless entry
```

See `AGENTS.md` for deeper implementation notes.
