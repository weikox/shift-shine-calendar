const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { embedUrl, proxyUrl } = body;

    // Mode 1: Proxy a URL (for HLS segments/playlists)
    if (proxyUrl) {
      const response = await fetch(proxyUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Proxy fetch failed: ${response.status}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const data = await response.arrayBuffer();

      return new Response(data, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

    // Mode 2: Resolve embed URL to m3u8 URL
    if (embedUrl) {
      const embedResponse = await fetch(embedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const html = await embedResponse.text();

      const m3u8Match = html.match(/https:\/\/[^"']+\.m3u8[^"']*/);
      if (!m3u8Match) {
        return new Response(
          JSON.stringify({ success: false, error: 'Could not find HLS stream URL' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, m3u8Url: m3u8Match[0] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'embedUrl or proxyUrl is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
