// Vercel serverless function: mirrors the Cloudflare Worker's /api/chat proxy
// (src/worker/index.ts) so the repo deploys to Vercel without code changes.
// Web-standard Request/Response signature; streams Groq's SSE straight through.
//
// Env vars to set in Vercel:
//   GROQ_API_KEY (required)
//   SUPABASE_URL + SUPABASE_ANON_KEY  (session auth), or APP_TOKEN (local mode)
//   ALLOWED_EMAIL (optional, restricts session auth to one email)
//   MODEL (optional, default qwen/qwen3.8-27b)

interface Env {
  MODEL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ALLOWED_EMAIL?: string;
  APP_TOKEN?: string;
  GROQ_API_KEY?: string;
}

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

async function authorized(request: Request, env: Env): Promise<boolean> {
  if (env.SUPABASE_URL) {
    const h = request.headers.get("Authorization") || "";
    if (!h.startsWith("Bearer ")) return false;
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: h, apikey: env.SUPABASE_ANON_KEY || "" },
    });
    if (!r.ok) return false;
    if (env.ALLOWED_EMAIL) {
      const u = (await r.json().catch(() => ({}))) as { email?: string };
      return u.email === env.ALLOWED_EMAIL;
    }
    return true;
  }
  // Fail closed: without SUPABASE_URL the app runs in local-token mode.
  // If no APP_TOKEN is configured there is no way to authenticate, so every
  // request must be rejected instead of silently turning /api/chat into an
  // open proxy for the Groq key.
  if (!env.APP_TOKEN) return false;
  return request.headers.get("X-App-Token") === env.APP_TOKEN;
}

export default async function handler(request: Request): Promise<Response> {
  const env = process.env as unknown as Env;

  if (request.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!(await authorized(request, env))) return json({ error: "Unauthorized" }, 401);
  if (!env.GROQ_API_KEY) return json({ error: "GROQ_API_KEY is not set" }, 500);

  let body: { messages?: unknown; stream?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (!messages.length || JSON.stringify(messages).length > 60000) {
    return json({ error: "Empty or too large request" }, 400);
  }

  const stream = body.stream === true;
  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.MODEL || "qwen/qwen3.8-27b",
      messages,
      temperature: 0.3,
      max_tokens: 1500,
      ...(stream ? { stream: true } : {}),
    }),
  });
  if (!upstream.ok) {
    const data = (await upstream.json().catch(() => ({}))) as { error?: { message?: string } };
    const msg = data?.error?.message || "Upstream error";
    return json({ error: msg }, upstream.status === 429 ? 429 : 502);
  }
  // Pass Groq's SSE straight through so the client can render tokens live.
  if (stream) {
    return new Response(upstream.body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }
  const data = (await upstream.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = (data.choices?.[0]?.message?.content || "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim();
  return json({ text });
}
