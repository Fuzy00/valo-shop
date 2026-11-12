// Cloudflare Worker: a small proxy that lets your GitHub Pages site call Riot's
// store endpoints (which block direct browser requests). It only forwards to
// Riot hosts, and only for requests coming from your own site.
// Set a variable ALLOWED_ORIGIN, e.g. https://yourname.github.io

const HOSTS = [
  /^auth\.riotgames\.com$/,
  /^entitlements\.auth\.riotgames\.com$/,
  /^pd\.(eu|na|ap|kr)\.a\.pvp\.net$/,
];
const FORWARD = ["authorization", "content-type", "x-riot-entitlements-jwt", "x-riot-clientversion", "x-riot-clientplatform"];

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = !!env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN;
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : "null",
      "Access-Control-Allow-Headers": FORWARD.join(","),
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Vary": "Origin",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (!allowed) return new Response("Forbidden", { status: 403, headers: cors });

    let target;
    try { target = new URL(new URL(req.url).searchParams.get("u")); } catch { return new Response("Bad URL", { status: 400, headers: cors }); }
    if (target.protocol !== "https:" || !HOSTS.some((re) => re.test(target.hostname))) {
      return new Response("Host not allowed", { status: 400, headers: cors });
    }

    const headers = new Headers();
    for (const k of FORWARD) if (req.headers.has(k)) headers.set(k, req.headers.get(k));
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "POST" ? await req.text() : undefined,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  },
};
