// Minimal ambient for the Vercel Node runtime (no @types/node in this project).
declare var process: { env: Record<string, string | undefined> };
