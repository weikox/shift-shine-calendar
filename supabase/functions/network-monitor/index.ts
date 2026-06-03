import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-monitor-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const OFFLINE_THRESHOLD_SECONDS = 300; // 5 min sin checkin → cerrar sesión

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase().replace(/-/g, ":");
}

async function handleCheckin(body: any) {
  const mac = body?.mac ? normalizeMac(String(body.mac)) : "";
  if (!mac) return json({ error: "mac required" }, 400);

  const ip = body?.ip ?? null;
  const hostname = body?.hostname ?? null;
  const vendor = body?.vendor ?? null;
  const location = body?.location ?? null;
  const now = new Date().toISOString();

  // Buscar dispositivo
  const { data: existing } = await supabase
    .from("network_devices")
    .select("*")
    .eq("mac", mac)
    .maybeSingle();

  let device;
  let isNew = false;

  if (!existing) {
    isNew = true;
    const { data: inserted, error } = await supabase
      .from("network_devices")
      .insert({
        mac,
        ip,
        hostname,
        vendor,
        location,
        is_online: true,
        first_seen: now,
        last_seen: now,
      })
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    device = inserted;
  } else {
    const patch: Record<string, any> = { last_seen: now, is_online: true };
    if (ip && ip !== existing.ip) patch.ip = ip;
    if (hostname && hostname !== existing.hostname) patch.hostname = hostname;
    if (vendor && !existing.vendor) patch.vendor = vendor;
    if (location && location !== existing.location) patch.location = location;
    const { data: updated, error } = await supabase
      .from("network_devices")
      .update(patch)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    device = updated;
  }

  // ¿Hay sesión abierta?
  const { data: openSession } = await supabase
    .from("network_device_sessions")
    .select("id, started_at")
    .eq("device_id", device.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sessionStarted = false;
  if (!openSession) {
    sessionStarted = true;
    await supabase.from("network_device_sessions").insert({
      device_id: device.id,
      location,
      started_at: now,
    });
  } else if (location && openSession && device.location !== location) {
    // Misma sesión; nada más que hacer
  }

  return json({
    ok: true,
    isNew,
    sessionStarted,
    device: {
      id: device.id,
      mac: device.mac,
      ip: device.ip,
      hostname: device.hostname,
      vendor: device.vendor,
      label: device.label ?? device.hostname ?? device.ip,
      location: device.location,
    },
  });
}

async function handleDisconnect(body: any) {
  const mac = body?.mac ? normalizeMac(String(body.mac)) : "";
  if (!mac) return json({ error: "mac required" }, 400);

  const { data: device } = await supabase
    .from("network_devices")
    .select("id")
    .eq("mac", mac)
    .maybeSingle();

  if (!device) return json({ ok: true });

  const now = new Date().toISOString();
  await supabase
    .from("network_devices")
    .update({ is_online: false, last_seen: now })
    .eq("id", device.id);

  await supabase
    .from("network_device_sessions")
    .update({ ended_at: now })
    .eq("device_id", device.id)
    .is("ended_at", null);

  return json({ ok: true });
}

// Cierra sesiones huérfanas (dispositivo sin checkin reciente)
async function reapStale() {
  const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_SECONDS * 1000).toISOString();
  const { data: stale } = await supabase
    .from("network_devices")
    .select("id")
    .eq("is_online", true)
    .lt("last_seen", cutoff);
  if (!stale || stale.length === 0) return;
  const now = new Date().toISOString();
  const ids = stale.map((d) => d.id);
  await supabase.from("network_devices").update({ is_online: false }).in("id", ids);
  await supabase
    .from("network_device_sessions")
    .update({ ended_at: now })
    .in("device_id", ids)
    .is("ended_at", null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // Path puede llegar como /network-monitor/api/devices/checkin
  const path = url.pathname.replace(/^\/network-monitor/, "").replace(/\/+$/, "") || "/";

  try {
    if (path === "/api/healthz" || path === "/healthz" || path === "/") {
      return json({ ok: true, ts: new Date().toISOString() });
    }

    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    const body = await req.json().catch(() => ({}));

    // Token opcional
    const expectedToken = Deno.env.get("MONITOR_API_TOKEN");
    if (expectedToken) {
      const got = req.headers.get("x-monitor-token") ?? url.searchParams.get("token");
      if (got !== expectedToken) return json({ error: "unauthorized" }, 401);
    }

    // Limpieza oportunista en background
    reapStale().catch(() => {});

    if (path === "/api/devices/checkin") return await handleCheckin(body);
    if (path === "/api/devices/disconnect") return await handleDisconnect(body);

    return json({ error: "not found", path }, 404);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
