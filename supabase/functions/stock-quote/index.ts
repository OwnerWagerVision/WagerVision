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
      return new Response(
        JSON.stringify({ error: "Missing ticker" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("FMP_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing FMP_API_KEY secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fmpUrl = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(apiKey)}`;
    const fmpRes = await fetch(fmpUrl);
    const body = await fmpRes.text();

    return new Response(body, {
      status: fmpRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Stock quote failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
