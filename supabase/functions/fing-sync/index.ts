import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normalizeMac(mac: string) {
  return mac.trim().toUpperCase().replace(/-/g, ":");
}

function normalizeName(s: string | undefined | null) {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (/^\d+\.\d+\.\d+\.\d+/.test(t)) return null;
  return t;
}

async function resolveFingUrl(location: string | null): Promise<string | null> {
  if (location) {
    const { data } = await supabase
      .from("network_sede_config")
      .select("fing_url")
      .eq("location", location)
      .maybeSingle();
    if (data?.fing_url) return data.fing_url as string;
  }
  return Deno.env.get("FING_URL") ?? null;
}

async function syncOne(location: string | null) {
  const fingUrl = await resolveFingUrl(location);
  if (!fingUrl) {
    return { location, error: "FING_URL no configurado", updated: 0, grouped: 0, fingTotal: 0 };
  }

  const res = await fetch(fingUrl);
  if (!res.ok) {
    const text = await res.text();
    return { location, error: `Fing HTTP ${res.status}: ${text.slice(0, 200)}`, updated: 0, grouped: 0, fingTotal: 0 };
  }
  const data = await res.json();
  const fingDevices: any[] = data?.devices ?? [];

  let updated = 0;
  let grouped = 0;

  for (const fd of fingDevices) {
    if (!fd?.mac) continue;
    const mac = normalizeMac(String(fd.mac));
    const name = (typeof fd.name === "string" && fd.name.trim()) ? fd.name.trim() : null;
    const make = (typeof fd.make === "string" && fd.make.trim()) ? fd.make.trim() : null;

    const nameKey = normalizeName(name);
    const groupKey = nameKey ? `${nameKey}|${(make ?? "").toLowerCase()}` : null;
    if (groupKey) grouped++;

    const { data: existing } = await supabase
      .from("network_devices")
      .select("id, label, vendor, hostname, group_key, location")
      .eq("mac", mac)
      .maybeSingle();

    if (existing) {
      const patch: Record<string, any> = {};
      if (name && !existing.label) patch.label = name;
      if (make && !existing.vendor) patch.vendor = make;
      if (name && !existing.hostname) patch.hostname = name;
      if (groupKey && existing.group_key !== groupKey) patch.group_key = groupKey;
      if (location && !existing.location) patch.location = location;
      if (Object.keys(patch).length) {
        await supabase.from("network_devices").update(patch).eq("id", existing.id);
        updated++;
      }
    } else {
      await supabase.from("network_devices").insert({
        mac,
        ip: Array.isArray(fd.ip) ? fd.ip[0] : null,
        hostname: name,
        label: name,
        vendor: make,
        location,
        is_online: fd.state === "UP",
        group_key: groupKey,
        first_seen: fd.first_seen ?? new Date().toISOString(),
        last_seen: fd.last_changed ?? new Date().toISOString(),
      });
      updated++;
    }
  }

  return { location, fingTotal: fingDevices.length, updated, grouped };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const location: string | null = body?.location ?? null;
    const all: boolean = !!body?.all;

    let results: any[] = [];
    if (all) {
      // Sincroniza todas las sedes que tengan fing_url configurado
      const { data: sedes } = await supabase
        .from("network_sede_config")
        .select("location, fing_url");
      const targets = (sedes ?? []).filter((s: any) => s.fing_url).map((s: any) => s.location as string);
      // Si no hay ninguna sede configurada, intenta con la url por defecto (env)
      if (targets.length === 0) targets.push(null as any);
      for (const t of targets) results.push(await syncOne(t));
    } else {
      results.push(await syncOne(location));
    }

    const updated = results.reduce((a, r) => a + (r.updated || 0), 0);
    const grouped = results.reduce((a, r) => a + (r.grouped || 0), 0);
    const fingTotal = results.reduce((a, r) => a + (r.fingTotal || 0), 0);

    return new Response(JSON.stringify({ ok: true, updated, grouped, fingTotal, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
