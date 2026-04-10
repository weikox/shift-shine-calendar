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

    const ua = { 'User-Agent': 'Mozilla/5.0' };

    // Step 1: Fetch embed page to get m3u8 URL
    const embedResponse = await fetch(embedUrl, { headers: ua });
    const html = await embedResponse.text();

    const m3u8Match = html.match(/https:\/\/[^"']+\.m3u8[^"']*/);
    if (!m3u8Match) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not find HLS stream URL' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const m3u8Url = m3u8Match[0];
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

    // Step 2: Fetch the m3u8 playlist (same IP)
    const playlistResponse = await fetch(m3u8Url, { headers: ua });
    if (!playlistResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Playlist fetch failed: ${playlistResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const playlist = await playlistResponse.text();

    // Step 3: Find the latest .ts segment
    const lines = playlist.split('\n');
    let lastSegment = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        lastSegment = trimmed;
      }
    }

    if (!lastSegment) {
      return new Response(
        JSON.stringify({ success: false, error: 'No segments found in playlist' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const segmentUrl = lastSegment.startsWith('http') ? lastSegment : baseUrl + lastSegment;

    // Step 4: Fetch the TS segment (same IP)
    const segmentResponse = await fetch(segmentUrl, { headers: ua });
    if (!segmentResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Segment fetch failed: ${segmentResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const segmentData = await segmentResponse.arrayBuffer();

    return new Response(segmentData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'video/mp2t',
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
