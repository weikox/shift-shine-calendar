const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { embedUrl } = await req.json();

    if (!embedUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'embedUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the embed page to extract HLS m3u8 URL
    const embedResponse = await fetch(embedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await embedResponse.text();

    // Extract m3u8 URL from the page
    const m3u8Match = html.match(/https:\/\/[^"']+\.m3u8[^"']*/);
    if (!m3u8Match) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not find HLS stream URL' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const m3u8Url = m3u8Match[0];

    return new Response(
      JSON.stringify({ success: true, m3u8Url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
