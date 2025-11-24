import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, email, password, region, deviceId, state } = await req.json();

    // Dynamic import of ewelink-api
    const ewelink = await import('npm:ewelink-api@3.1.7');
    
    const connection = new ewelink.default({
      email,
      password,
    });

    let result;

    switch (action) {
      case 'getDevices':
        result = await connection.getDevices();
        break;
      
      case 'getDevice':
        if (!deviceId) throw new Error('Device ID required');
        result = await connection.getDevice(deviceId);
        break;
      
      case 'toggleDevice':
        if (!deviceId) throw new Error('Device ID required');
        result = await connection.toggleDevice(deviceId);
        break;
      
      case 'setDevicePowerState':
        if (!deviceId) throw new Error('Device ID required');
        result = await connection.setDevicePowerState(deviceId, state);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});