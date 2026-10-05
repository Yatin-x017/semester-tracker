"use strict";
// Vercel serverless function: mirrors the Cloudflare Worker's /api/chat proxy
// (src/worker/index.ts) so the repo deploys to Vercel without code changes.
// Web-standard Request/Response signature; streams Groq's SSE straight through.
//
// Env vars to set in Vercel:
//   GROQ_API_KEY (required)
//   SUPABASE_URL + SUPABASE_ANON_KEY  (session auth), or APP_TOKEN (local mode)
//   ALLOWED_EMAIL (optional, restricts session auth to one email)
//   MODEL (optional, default qwen/qwen3.8-27b)
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
var json = function (o, status) {
    if (status === void 0) { status = 200; }
    return new Response(JSON.stringify(o), { status: status, headers: { "Content-Type": "application/json" } });
};
function authorized(request, env) {
    return __awaiter(this, void 0, void 0, function () {
        var h, r, u;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!env.SUPABASE_URL) return [3 /*break*/, 4];
                    h = request.headers.get("Authorization") || "";
                    if (!h.startsWith("Bearer "))
                        return [2 /*return*/, false];
                    return [4 /*yield*/, fetch("".concat(env.SUPABASE_URL, "/auth/v1/user"), {
                            headers: { Authorization: h, apikey: env.SUPABASE_ANON_KEY || "" },
                        })];
                case 1:
                    r = _a.sent();
                    if (!r.ok)
                        return [2 /*return*/, false];
                    if (!env.ALLOWED_EMAIL) return [3 /*break*/, 3];
                    return [4 /*yield*/, r.json().catch(function () { return ({}); })];
                case 2:
                    u = (_a.sent());
                    return [2 /*return*/, u.email === env.ALLOWED_EMAIL];
                case 3: return [2 /*return*/, true];
                case 4:
                    // Fail closed: without SUPABASE_URL the app runs in local-token mode.
                    // If no APP_TOKEN is configured there is no way to authenticate, so every
                    // request must be rejected instead of silently turning /api/chat into an
                    // open proxy for the Groq key.
                    if (!env.APP_TOKEN)
                        return [2 /*return*/, false];
                    return [2 /*return*/, request.headers.get("X-App-Token") === env.APP_TOKEN];
            }
        });
    });
}
function handler(request) {
    return __awaiter(this, void 0, void 0, function () {
        var env, body, _a, messages, stream, upstream, data_1, msg, data, text;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    env = process.env;
                    if (request.method !== "POST")
                        return [2 /*return*/, json({ error: "Use POST" }, 405)];
                    return [4 /*yield*/, authorized(request, env)];
                case 1:
                    if (!(_f.sent()))
                        return [2 /*return*/, json({ error: "Unauthorized" }, 401)];
                    if (!env.GROQ_API_KEY)
                        return [2 /*return*/, json({ error: "GROQ_API_KEY is not set" }, 500)];
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, request.json()];
                case 3:
                    body = _f.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _f.sent();
                    return [2 /*return*/, json({ error: "Invalid JSON" }, 400)];
                case 5:
                    messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
                    if (!messages.length || JSON.stringify(messages).length > 60000) {
                        return [2 /*return*/, json({ error: "Empty or too large request" }, 400)];
                    }
                    stream = body.stream === true;
                    return [4 /*yield*/, fetch("https://api.groq.com/openai/v1/chat/completions", {
                            method: "POST",
                            headers: { Authorization: "Bearer ".concat(env.GROQ_API_KEY), "Content-Type": "application/json" },
                            body: JSON.stringify(__assign({ model: env.MODEL || "qwen/qwen3.8-27b", messages: messages, temperature: 0.3, max_tokens: 1500 }, (stream ? { stream: true } : {}))),
                        })];
                case 6:
                    upstream = _f.sent();
                    if (!!upstream.ok) return [3 /*break*/, 8];
                    return [4 /*yield*/, upstream.json().catch(function () { return ({}); })];
                case 7:
                    data_1 = (_f.sent());
                    msg = ((_b = data_1 === null || data_1 === void 0 ? void 0 : data_1.error) === null || _b === void 0 ? void 0 : _b.message) || "Upstream error";
                    return [2 /*return*/, json({ error: msg }, upstream.status === 429 ? 429 : 502)];
                case 8:
                    // Pass Groq's SSE straight through so the client can render tokens live.
                    if (stream) {
                        return [2 /*return*/, new Response(upstream.body, {
                                headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
                            })];
                    }
                    return [4 /*yield*/, upstream.json().catch(function () { return ({}); })];
                case 9:
                    data = (_f.sent());
                    text = (((_e = (_d = (_c = data.choices) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) || "")
                        .replace(/<think>[\s\S]*?<\/think>/g, "")
                        .trim();
                    return [2 /*return*/, json({ text: text })];
            }
        });
    });
}
