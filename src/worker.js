const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

async function authorized(request, env) {
  if (env.SUPABASE_URL) {
    const h = request.headers.get("Authorization") || "";
    if (!h.startsWith("Bearer ")) return false;
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: h, apikey: env.SUPABASE_ANON_KEY || "" },
    });
    if (!r.ok) return false;
    if (env.ALLOWED_EMAIL) {
      const u = await r.json().catch(() => ({}));
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return json({ error: "Use POST" }, 405);
      if (!(await authorized(request, env))) return json({ error: "Unauthorized" }, 401);
      if (!env.GROQ_API_KEY) return json({ error: "GROQ_API_KEY is not set" }, 500);

      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
      if (!messages.length || JSON.stringify(messages).length > 60000) {
        return json({ error: "Empty or too large request" }, 400);
      }

      const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.MODEL || "qwen/qwen3.8-27b",
          messages,
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const msg = data?.error?.message || "Upstream error";
        return json({ error: msg }, upstream.status === 429 ? 429 : 502);
      }
      const text = (data.choices?.[0]?.message?.content || "")
        .replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      return json({ text });
    }

    return env.ASSETS.fetch(request);
  },
};
