SEMESTER TRACKER (Cloudflare Workers + Vite + React + TypeScript + Supabase + Groq)

ARCHITECTURE
Frontend: React 19 + Vite + TypeScript (src/), code-split so the waifu (three.js + @pixiv/three-vrm) loads only when opened.
Worker:   src/worker/index.ts proxies /api/chat to Groq and serves static assets via the Cloudflare Vite plugin.
Vercel:   api/chat.ts is the same /api/chat proxy as a Vercel function, so the
          repo deploys to Vercel instead of Cloudflare without code changes.
Dev:      One command runs both client and worker with HMR (see RUN).

SRC/ STRUCTURE
src/main.tsx         Entry point: mounts <App /> into #root.
src/App.tsx          App shell: sidebar, view routing (lazy Waifu), Settings
                     and Sign-in dialogs, timetable-import handoff, theming.
src/styles.css       All styling (gothic dark/light theme).
src/types.ts         Re-exports model types for convenience.
src/views/           One component per page.
  Today.tsx            Day view: classes with P/A logging, extra classes,
                       routine checklist, events, open tasks, due-soon banner.
  Attendance.tsx       Per-course lecture/lab percentages, policy selector
                       (75% standard / 60% leeway), safe/below/critical pills.
  TasksEvents.tsx      Task and event CRUD (progress counters, due dates).
  Coding.tsx           Manual LeetCode / Codeforces / GitHub logs with
                       14-day heat strips, streaks and per-difficulty stats.
  Import.tsx           Editable confirmation table for AI-extracted
                       timetable rows; nothing is saved until Apply.
src/components/
  Assistant.tsx        Chat UI for /api/chat: applies <action> payloads via
                       Apply buttons, and PDF timetable upload (pdfjs-dist).
  TaskRow.tsx          Shared task row (counter bump / delete).
  Waifu.tsx            Waifu panel: speech bubble, poke reactions, voice and
                       mute toggles, Load VRM / URL / Reset controls.
  waifu/engine.ts      three.js + @pixiv/three-vrm runtime: render loop, idle
                       sway, blinking, lip-sync, poke animations, and the
                       texture-level recolor of the sample model to Albedo.
  waifu/VrmCanvas.tsx  Canvas mount: loads stored VRM (IndexedDB), dev
                       /albedo.vrm fallback, else the tinted pixiv sample.
  waifu/Guide.tsx      In-panel VRoid Studio recipe for making an Albedo VRM.
src/lib/
  model.ts           Domain model: AppState types, seed timetable/courses,
                     normState() validation for all persisted data, date
                     helpers and attendance math (counts/avg/TH).
  store.tsx          StoreProvider: localStorage persistence, Supabase auth
                     (OTP sign-in), cloud sync (debounced upsert, last write
                     wins, sem3_backup), app token state.
  ai.ts              Albedo system prompt, chat context builder, ask() to
                     /api/chat, <action> parsing/validation, timetable
                     parsing from model output.
  config.ts          Public runtime config from /config.js (Supabase URL +
                     anon key); HAS_SB gates sync/sign-in.
  token.ts           App token for local-only mode; session storage only.
  speech.ts          Web Speech API voice with Aria / Gothic personas.
  bus.ts             Tiny pub-sub so the assistant can drive the waifu.
  vrmStore.ts        IndexedDB persistence for a user-supplied .vrm file.
src/worker/
  index.ts           Cloudflare Worker: auth-gated /api/chat proxy to Groq
                     (Supabase session or APP_TOKEN; fails closed), then
                     static assets. env.d.ts has worker env types.

SECRETS: what goes where
Secret, never committed: GROQ_API_KEY, ALLOWED_EMAIL, APP_TOKEN. Locally they live in .dev.vars (git-ignored). On Cloudflare set them with: npx wrangler secret put NAME
Public, safe to commit: SUPABASE_URL and SUPABASE_ANON_KEY (in wrangler.jsonc) and the same two values in public/config.js. Row level security is what protects the data.
Never use the Supabase service_role key anywhere in this project.

RUN AND DEPLOY
npm install
npm run dev            (http://localhost:5173 — Vite dev server + worker together)
npm run typecheck      (tsc -b)
npm run build          (vite build -> dist/)
npm run preview        (build + run in the real workerd runtime locally)
npm run deploy         (build + wrangler deploy using the generated output config)

DEPLOY TO VERCEL (alternative to Cloudflare)
1. Import the repo on vercel.com (framework preset: Vite; build command and
   output are auto-detected, api/chat.ts ships as a serverless function).
2. Set env vars for the function: GROQ_API_KEY, ALLOWED_EMAIL, and either
   SUPABASE_URL + SUPABASE_ANON_KEY (sign-in mode) or APP_TOKEN (local mode).
   MODEL is optional (default qwen/qwen3.8-27b).
3. Put the Supabase Project URL and anon key in public/config.js before
   deploying, and add the vercel.app URL to Supabase Redirect URLs.
4. Deploy. The 60s function limit is set in vercel.json so streamed replies
   are not cut off.

With SUPABASE_URL empty the app runs local-only and uses APP_TOKEN. If APP_TOKEN is also empty the AI endpoint refuses every request (fail closed), so set it when running without Supabase.

SUPABASE SETUP (optional, for sync + sign-in)
1. Create a project at supabase.com.
2. SQL Editor: paste and run supabase/schema.sql (idempotent — safe to
   re-run; it also creates app_state_history, a trigger-kept archive of the
   last 20 versions of your data for recovery from bad syncs).
3. Authentication, Providers: keep Email on. Authentication, Sign In / Providers settings: turn off "Allow new users to sign up".
4. Authentication, Users: Add user, enter your email (this is the only account).
5. Authentication, URL Configuration: add http://localhost:5173 and your deployed URL to Redirect URLs.
6. Project Settings, API: copy the Project URL and the anon public key into public/config.js (url, key) and into wrangler.jsonc (SUPABASE_URL, SUPABASE_ANON_KEY).
7. Put your email in .dev.vars as ALLOWED_EMAIL.

THE WAIFU (ALBEDO)
The Waifu panel renders a VRM avatar with three.js (@pixiv/three-vrm): idle sway, blinking, lip movement while she speaks, poke reactions, and speech synthesis with two personas (Aria / Gothic).
Default model: the pixiv three-vrm sample, auto-tinted to a gothic palette (black hair, crimson eyes, pale skin).
To use a real Albedo:
1. Press "Guide" in the waifu panel for the VRoid Studio recipe (free app, export as VRM).
2. Press "Load VRM" and pick your exported .vrm. It is stored in IndexedDB in your browser and survives reloads; "Reset" returns to the tinted sample.
3. VRM 0.x and 1.0 both work. The app rotates VRM1 models upright automatically (VRMUtils.rotateVRM0).

WHAT V2 ADDS
Sign-in by email link, cloud sync of all data through Supabase, and AI actions: ask the assistant to log attendance, add a task or add an event, then press the Apply button it shows.
Timetable import: upload a PDF in the AI panel; the model extracts class blocks and you confirm them in an editable table before anything is saved.
Sync is last write wins, one row per user. Signing in on a device replaces its local data with the cloud copy; the old local copy is kept under sem3_backup in browser storage.

WHAT V3 ADDS
Assistant replies stream in token by token with a thinking indicator and a Stop button; the chat is kept for the session (sessionStorage) with a Clear control.
AI actions now cover logging attendance, adding/removing tasks and events, and logging an extra class; every action is validated and applied as an immutable state update.
Attendance leeway is a real three-way policy (75% standard / 60% approved / 50% medical).
Tasks and events can be edited inline (title, due date, counter, time).
Settings can export all data as JSON and restore a backup.
Theme choice persists across reloads, and the assistant collapses to a closeable full-screen panel on phones.

SECURITY NOTES
Never put real credentials in .dev.vars.example or any committed file; use placeholders there only. dist/ is git-ignored (the worker build output can contain .dev.vars copies). If a secret ever lands in git history, rotate it (Groq key at console.groq.com, APP_TOKEN in .dev.vars and `npx wrangler secret put APP_TOKEN`) — rotating is the only real fix.
