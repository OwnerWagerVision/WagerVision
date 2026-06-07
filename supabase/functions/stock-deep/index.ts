const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ticker = (url.searchParams.get("ticker") || "").trim().toUpperCase();

    if (!ticker) {
      return new Response(JSON.stringify({ error: "Missing ticker" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("FMP_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing FMP_API_KEY secret" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    async function fmp(endpoint: string) {
      const sep = endpoint.includes("?") ? "&" : "?";
      const fmpUrl = `https://financialmodelingprep.com/stable${endpoint}${sep}apikey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(fmpUrl);
      if (!res.ok) return null;
      return await res.json();
    }

    const [profile, ratios, news] = await Promise.all([
      fmp(`/profile?symbol=${encodeURIComponent(ticker)}`),
      fmp(`/ratios?symbol=${encodeURIComponent(ticker)}&limit=1`),
      fmp(`/news/stock?symbols=${encodeURIComponent(ticker)}&limit=5`),	
    ]);

    return new Response(JSON.stringify({ profile, ratios, news }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Deep analysis failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
