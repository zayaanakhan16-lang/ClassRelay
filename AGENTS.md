# AGENTS.md — ClassRelay

Repository-specific knowledge for future agents working in this codebase.

## What this is

ClassRelay is a "learn it by teaching it" app. A student presents slides to four AI
classmates, takes a class quiz (the classmates answer using only the student's words),
takes a personal quiz, reads a private learning report, and can take one weak concept to
a peer-learning room (PeerRelay). Built for CSC Winter Sparkathon 2026.

Reference implementation studied: `Jandexl/Teachback` (cloned to `/tmp/teachback` when
present). ClassRelay deliberately keeps its own name, identity and design.

## Stack & scripts

- React 18 + TypeScript + Vite + Tailwind. Backend: Express in `server/`.
- `npm run dev` — runs Vite (web) + `node --watch server/index.js` (api) together.
- `npm run build` — `tsc -b && vite build` (this is the real typecheck).
- `npm run typecheck` — `tsc -b --pretty`.
- API key comes from `.env` (server side only). With no key the server runs in **demo
  mode** and simulates AI with a built-in engine. All simulated output must be labelled
  (`SourceTag`, `DemoBanner`).

## Architecture map

- `src/pages` — Landing, Start, Privacy.
- `src/classroom` — `ClassroomPage`, `SlideStage` (present / from-memory recall gating),
  `useClassroom` (state machine), `ClassmateRow` + `SpeakingBubble`, `TranscriptPanel`.
- `src/quiz` — `ClassQuizPage`, `SelfQuizPage`.
- `src/report` — `ReportPage` (private; the only place a concept can be shared).
- `src/peer-learning` — `PeerHubPage`, `PeerRoomPage`, `ShareConceptDialog`.
- `src/reteach` — re-teach a weak slide from memory.
- `src/components` — `ClassmateAvatar`, `Logo`, `Layout`, `ui.tsx` (SourceTag, Spinner,
  ErrorNote, ProgressRail, **ScoreRing**, **SessionSteps**, **DifficultyChip**,
  **VoiceToggle**, **MicButton**, StepBadge, ...).
- `src/services` — `ai.ts` (study card, classmate turn, class quiz, self quiz, report),
  `peer.ts` (rooms, contributions, AI peer-support summary), `speech.ts` (voice **input**,
  Web Speech recognition), `voice.ts` (voice **output**, speech synthesis — the classmates
  talking).
- `src/hooks` — `useSession` (in-memory session store; **not persisted**, so a full
  journey must run in one page session — reloading `/report` etc. redirects to `/start`),
  `useVoices` (spoken classmates: per-classmate voice, on/off toggle, who is speaking),
  `useDictation` (reusable mic for any text field).
- `server/` — `index.js` (local listener), `app.js` (the Express app, shared with the
  serverless entry point), `lib/tasks.js` (personalities + prompt/task logic).
- `api/index.js` — Vercel serverless entry that re-exports the Express app, wrapped in a
  rewrite that carries the real path in `__p` (see the deployment gotcha below).

## Deployment (Vercel)

- `vercel.json` sets `framework: null`, `buildCommand: npm run build`,
  `outputDirectory: dist`, and two rewrites: `/api/(.*)` → `/api?__p=$1` (carrying the
  real path), then everything else that is not `/api` → `/index.html` (SPA fallback).
- **Gotcha — `/api/*` routing**: Vercel's plain-function router does **not** treat a
  bracket catch-all `api/[...path].js` as multi-segment. Only one-segment paths such as
  `/api/health` reached Express; every nested path (`/api/peer/rooms`) was answered by the
  platform with its own 404 (`x-vercel-error: NOT_FOUND`) and never invoked the function.
  The symptom is PeerRelay failing on the deployed site only, while working locally. The
  fix is a single `api/index.js` plus the explicit `__p` rewrite. If you add new nested
  `/api/...` routes, test them against the deployed URL, not just `localhost`.
- **Gotcha — stale deploys are invisible**: the client bundle and the API can come from
  different builds. `/api/health` reports `commit` (the `VERCEL_GIT_COMMIT_SHA`) so you can
  confirm which revision is actually serving traffic.
- **Peer rooms are in-memory**: fine for a demo, but on serverless they are per-instance,
  so a room can 404 if the read lands on a different instance. Verified 0/25 misses in
  practice; note the limitation rather than claiming durability.
- `.env.local` is loaded by `server/app.js` (after `.env`, and it wins). On Vercel there is
  no env file: set `GROQ_API_KEY` (etc.) in Project → Settings → Environment Variables.
  With no key the site runs in demo mode, which is fully functional and labelled.

## Groq

- Default model is `openai/gpt-oss-120b`. `llama-3.3-70b-versatile` is retired (404).
- Groq's reasoning models (gpt-oss, qwen3) spend part of the token budget thinking, which
  showed up as empty replies and rate limits. `resolveProvider` sends `reasoning_effort`
  ("low") for those models only; non-reasoning models reject the parameter. Override with
  `GROQ_REASONING_EFFORT=low|medium|high|off`.
- `complete()` retries a 429 once after a short wait before falling back to the demo engine.

## Voice

- **Output** (`voice.ts` + `useVoices`): each classmate reads their question aloud in a
  distinct voice (name hints in `VOICE_STYLE`, then deduped so no two share one). Sound is
  off by default and turned on with the `VoiceToggle` — a real user gesture, so autoplay
  rules never bite. Only one voice plays at a time (`speak` cancels first), matching the
  one-speaker classroom rule. If `speechSynthesis` is missing the toggle is disabled and
  says "Voice unavailable" — never faked.
- **Input** (`speech.ts` + `useDictation`): the mic uses Web Speech recognition; the
  transcript is always editable and a text box always works. `speechSupported` gates the
  button.

## Difficulty

- Classmate questions carry a `difficulty` of `warmup` | `core` | `challenge`. The server
  prompt tells the model to start easy and escalate as the discussion goes on; the demo
  engine mirrors this (`difficultyAt`). `DifficultyChip` renders the tier on the question
  bubble and in the conversation log.

## Gotchas

- **Avatars**: `ClassmateAvatar.tsx` must render *real* SVG React elements. A previous
  bug injected hand-authored SVG strings as escaped text nodes inside `<g>`, so every
  classmate rendered as a blank coloured disc. Faces carry `aria-label="{id} portrait"`.
- **Router**: `BrowserRouter` in `src/main.tsx` sets v7 future flags to silence warnings.
- **Session is in-memory**: guarded pages redirect to `/start` when there is no lesson.
  CDP/automation scripts must run the whole flow in one session, never navigate directly
  to `/report`.
- **Self-quiz**: intro button is "Begin my quiz"; missed questions show a "Reveal the
  answer" button (reasoning is required first).
- **Peer room AI summary** needs >= 1 contribution before "Summarise the room" enables.

## Verification approach that worked

Chrome DevTools Protocol scripts in `/tmp/*.mjs` driven against a headless Chrome on
`http://127.0.0.1:9222`, web app on `http://127.0.0.1:12001`. Capture
`Runtime.consoleAPICalled` (error) and `Log.entryAdded` (error) to prove no console
errors. Use native value setters + `input` events for React-controlled fields.
