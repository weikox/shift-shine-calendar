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
  // descartar nombres genéricos tipo "192.168.x.x" o "wlan0"
  if (/^\d+\.\d+\.\d+\.\d+/.test(t)) return null;
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const fingUrl = Deno.env.get("FING_URL");
    if (!fingUrl) {
      return new Response(JSON.stringify({ error: "FING_URL not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const location: string | null = body?.location ?? null;

    const res = await fetch(fingUrl);
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Fing HTTP ${res.status}`, body: text }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      const model = (typeof fd.model === "string" && fd.model.trim()) ? fd.model.trim() : null;

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
        if (Object.keys(patch).length) {
          await supabase.from("network_devices").update(patch).eq("id", existing.id);
          updated++;
        }
      } else {
        // Crear dispositivo "conocido por Fing" aunque aún no haya hecho checkin
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

    return new Response(JSON.stringify({
      ok: true,
      fingTotal: fingDevices.length,
      updated,
      grouped,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
