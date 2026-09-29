SEMESTER TRACKER (Cloudflare Workers + Supabase + Groq)

SECRETS: what goes where
Secret, never committed: GROQ_API_KEY, ALLOWED_EMAIL, APP_TOKEN. Locally they live in .dev.vars (git-ignored). On Cloudflare set them with: npx wrangler secret put NAME
Public, safe to commit: SUPABASE_URL and SUPABASE_ANON_KEY (in wrangler.jsonc) and the same two values in public/config.js. Row level security is what protects the data.
Never use the Supabase service_role key anywhere in this project.

SUPABASE SETUP
1. Create a project at supabase.com.
2. SQL Editor: paste and run supabase/schema.sql.
3. Authentication, Providers: keep Email on. Authentication, Sign In / Providers settings: turn off "Allow new users to sign up".
4. Authentication, Users: Add user, enter your email (this is the only account).
5. Authentication, URL Configuration: add http://localhost:8787 and your deployed URL to Redirect URLs.
6. Project Settings, API: copy the Project URL and the anon public key into public/config.js (url, key) and into wrangler.jsonc (SUPABASE_URL, SUPABASE_ANON_KEY).
7. Put your email in .dev.vars as ALLOWED_EMAIL.
With SUPABASE_URL empty the app runs local-only and uses APP_TOKEN. If APP_TOKEN is also empty the AI endpoint refuses every request (fail closed), so set it when running without Supabase.

SECURITY NOTES
Never put real credentials in .dev.vars.example or any committed file; use placeholders there only. If a secret ever lands in git history, rotate it (Groq key at console.groq.com, APP_TOKEN in .dev.vars and `npx wrangler secret put APP_TOKEN`) — rotating is the only real fix.

RUN AND DEPLOY
npm install
npm run dev            (http://localhost:8787)
npx wrangler login
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put ALLOWED_EMAIL
npm run deploy

WHAT V2 ADDS SO FAR
Sign-in by email link, cloud sync of all data through Supabase, and AI actions: ask the assistant to log attendance, add a task or add an event, then press the Apply button it shows.
Sync is last write wins, one row per user. Signing in on a device replaces its local data with the cloud copy; the old local copy is kept under sem3_backup in browser storage.
