import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// eWeLink API v2 endpoints
const EWELINK_API_URL = 'https://eu-apia.coolkit.cc';

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2, 10);

  const bodyObj = {
    lang: 'en',
    countryCode: '+34',
    ts: timestamp,
    version: 8,
    appid: appId,
    nonce,
  };
  const bodyStr = JSON.stringify(bodyObj);

  // eWeLink v2 sign: HMAC-SHA256(appSecret, raw JSON body), base64
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyStr));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const response = await fetch(`${EWELINK_API_URL}/v2/user/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CK-Appid': appId,
      'X-CK-Nonce': nonce,
      'Authorization': `Sign ${signatureB64}`,
    },
    body: bodyStr,
  });

  const data = await response.json();
  console.log('Login response:', JSON.stringify(data));

  if (data.error !== 0) {
    throw new Error(`Login failed: ${data.msg || 'Unknown error'}`);
  }

  return data.data.at;
}

async function makeApiRequest(
  endpoint: string,
  method: string,
  appId: string,
  accessToken: string,
  body?: object
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CK-Appid': appId,
    'Authorization': `Bearer ${accessToken}`,
  };
  
  const options: RequestInit = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${EWELINK_API_URL}${endpoint}`, options);
  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const appId = Deno.env.get('APPID');
    const appSecret = Deno.env.get('APPSECRET');
    
    if (!appId || !appSecret) {
      throw new Error('APPID and APPSECRET must be configured');
    }
    
    const { action, deviceId, state } = await req.json();
    console.log(`eWeLink action: ${action}, deviceId: ${deviceId}`);

    // Get access token
    const accessToken = await getAccessToken(appId, appSecret);
    console.log('Access token obtained successfully');

    let result;

    switch (action) {
      case 'getDevices':
        result = await makeApiRequest('/v2/device/thing', 'GET', appId, accessToken);
        console.log('Devices response:', JSON.stringify(result));
        
        if (result.error === 0) {
          // Transform the response to match expected format
          const devices = result.data.thingList?.map((thing: any) => ({
            deviceid: thing.itemData.deviceid,
            name: thing.itemData.name,
            online: thing.itemData.online,
            params: thing.itemData.params || {},
          })) || [];
          result = devices;
        } else {
          throw new Error(result.msg || 'Failed to get devices');
        }
        break;
      
      case 'getDevice':
        if (!deviceId) throw new Error('Device ID required');
        result = await makeApiRequest(`/v2/device/thing?thingList=[{"itemType":1,"id":"${deviceId}"}]`, 'GET', appId, accessToken);
        break;
      
      case 'toggleDevice':
        if (!deviceId) throw new Error('Device ID required');
        // First get current state
        const deviceInfo = await makeApiRequest(`/v2/device/thing?thingList=[{"itemType":1,"id":"${deviceId}"}]`, 'GET', appId, accessToken);
        console.log('Device info:', JSON.stringify(deviceInfo));
        
        if (deviceInfo.error !== 0) {
          throw new Error('Failed to get device state');
        }
        
        const device = deviceInfo.data.thingList?.[0]?.itemData;
        if (!device) {
          throw new Error('Device not found');
        }
        
        const currentState = device.params?.switch === 'on';
        const newState = currentState ? 'off' : 'on';
        
        result = await makeApiRequest('/v2/device/thing/status', 'POST', appId, accessToken, {
          type: 1,
          id: deviceId,
          params: { switch: newState }
        });
        console.log('Toggle result:', JSON.stringify(result));
        break;
      
      case 'setDevicePowerState':
        if (!deviceId) throw new Error('Device ID required');
        result = await makeApiRequest('/v2/device/thing/status', 'POST', appId, accessToken, {
          type: 1,
          id: deviceId,
          params: { switch: state }
        });
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
