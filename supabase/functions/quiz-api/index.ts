import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigin = "https://ohan-fcsm.github.io";
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const rateLimits = new Map<string, number[]>();
const rateWindowMs = 60_000;
const maxRequestsPerWindow = 20;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function allowRequest(ip: string) {
  const now = Date.now();
  const recent = (rateLimits.get(ip) ?? []).filter((time) => now - time < rateWindowMs);
  if (recent.length >= maxRequestsPerWindow) return false;
  recent.push(now);
  rateLimits.set(ip, recent);
  if (rateLimits.size > 5000) {
    for (const [key, times] of rateLimits) {
      if (!times.some((time) => now - time < rateWindowMs)) rateLimits.delete(key);
    }
  }
  return true;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin !== allowedOrigin) return json({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRequest(ip)) return json({ error: "Too many requests" }, 429);

  let payload: { action?: unknown; score?: unknown; duration_seconds?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (payload.action === "stats") {
    const { data, error } = await supabase.rpc("get_quiz_stats");
    if (error) return json({ error: "Could not load statistics" }, 500);
    return json(data);
  }

  if (payload.action === "submit") {
    const score = payload.score;
    const duration = payload.duration_seconds;
    if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > 10) {
      return json({ error: "Invalid score" }, 400);
    }
    if (!Number.isInteger(duration) || (duration as number) < 1 || (duration as number) > 150) {
      return json({ error: "Invalid duration" }, 400);
    }

    const { error } = await supabase.from("quiz_results").insert({
      score: score as number,
      duration_seconds: duration as number,
    });
    if (error) return json({ error: "Could not save result" }, 500);
    return json({ ok: true }, 201);
  }

  return json({ error: "Unknown action" }, 400);
});
