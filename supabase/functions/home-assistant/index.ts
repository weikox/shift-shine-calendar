import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const HA_URL = Deno.env.get('HOMEASSISTANT_URL');
const HA_TOKEN = Deno.env.get('HOMEASSISTANT_TOKEN');

async function haFetch(path: string, init?: RequestInit) {
  const url = `${HA_URL!.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Authorization': `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(`HA ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!HA_URL || !HA_TOKEN) {
      throw new Error('HOMEASSISTANT_URL o HOMEASSISTANT_TOKEN no configurados');
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    let result: any;
    switch (action) {
      case 'getStates': {
        const states = await haFetch('/api/states');
        // Filter to interesting domains
        const domains = ['light', 'switch', 'sensor', 'binary_sensor', 'climate', 'cover', 'fan', 'media_player', 'script', 'scene', 'automation'];
        result = (states as any[]).filter((s) => domains.includes(s.entity_id.split('.')[0]));
        break;
      }
      case 'callService': {
        const { domain, service, entity_id, data } = body;
        if (!domain || !service) throw new Error('domain y service requeridos');
        result = await haFetch(`/api/services/${domain}/${service}`, {
          method: 'POST',
          body: JSON.stringify({ entity_id, ...(data || {}) }),
        });
        break;
      }
      case 'getState': {
        const { entity_id } = body;
        if (!entity_id) throw new Error('entity_id requerido');
        result = await haFetch(`/api/states/${entity_id}`);
        break;
      }
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('home-assistant error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
