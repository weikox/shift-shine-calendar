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

    // Fetch the embed page to extract poster URL
    const embedResponse = await fetch(embedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await embedResponse.text();

    // Extract poster URL from the video tag
    const posterMatch = html.match(/poster="([^"]+)"/);
    if (!posterMatch) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not find poster image' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const posterUrl = posterMatch[1];

    // Fetch the poster image
    const imageResponse = await fetch(posterUrl);
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch poster image' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    return new Response(imageBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
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
