// Warn-only config check that runs before `wrangler dev` (see "predev" in package.json).
// Compares .dev.vars against the .dev.vars.example template and warns when the app
// would run local-only without APP_TOKEN, where /api/chat rejects every request.
// Never blocks: always exits 0.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let warnings = 0;
const warn = (m) => {
  warnings++;
  console.warn(`[semester-tracker] WARNING: ${m}`);
};

function parseVars(text) {
  const vars = {};
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (key) vars[key] = val;
  }
  return vars;
}

const cwd = process.cwd();

let template = {};
try {
  template = parseVars(readFileSync(join(cwd, ".dev.vars.example"), "utf8"));
} catch {
  warn(".dev.vars.example is missing, so there is no template to check against.");
}

let vars = {};
if (existsSync(join(cwd, ".dev.vars"))) {
  vars = parseVars(readFileSync(join(cwd, ".dev.vars"), "utf8"));
} else {
  warn("No .dev.vars found. Copy .dev.vars.example to .dev.vars and fill in your values.");
}

for (const key of Object.keys(template)) {
  if (!(key in vars)) warn(`.dev.vars is missing ${key} (listed in .dev.vars.example).`);
}

// SUPABASE_URL normally comes from wrangler.jsonc vars; a .dev.vars entry overrides it.
let supabaseUrl = vars.SUPABASE_URL || "";
if (!supabaseUrl) {
  try {
    const wrangler = readFileSync(join(cwd, "wrangler.jsonc"), "utf8");
    supabaseUrl = (wrangler.match(/"SUPABASE_URL"\s*:\s*"([^"]*)"/) || [])[1] || "";
  } catch {
    // no config file: treat as empty
  }
}

if (!vars.GROQ_API_KEY) {
  warn("GROQ_API_KEY is empty: /api/chat will answer 500 'GROQ_API_KEY is not set'.");
}

if (!supabaseUrl && !vars.APP_TOKEN) {
  warn("Running local-only (SUPABASE_URL empty) without APP_TOKEN: /api/chat rejects every request (fail closed).");
  warn("Set APP_TOKEN in .dev.vars — see .dev.vars.example.");
} else if (supabaseUrl && !vars.ALLOWED_EMAIL) {
  warn("SUPABASE_URL is set but ALLOWED_EMAIL is empty: any signed-in user may use /api/chat.");
}

if (!warnings) {
  console.log("[semester-tracker] .dev.vars check passed.");
}
