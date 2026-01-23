export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    /* ===== CORS / PREFLIGHT ===== */
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*"
    };

    /* =========================
       API: AMBIL SEMUA REPO
       ========================= */
    if (url.pathname === "/api/github") {
      const gh = await fetch(
        "https://api.github.com/user/repos?per_page=100",
        {
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            "User-Agent": "cf-worker",
            Accept: "application/vnd.github+json"
          }
        }
      );

      return new Response(await gh.text(), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    /* =========================
       API: CREATE LINK
       ========================= */
    if (url.pathname === "/api/create" && req.method === "POST") {
      const body = await req.json();

      const id = crypto.randomUUID().slice(0, 8);

      await env.LINKS.put(
        id,
        JSON.stringify({
          repo: body.repoFullName,
          images: body.images || []
        })
      );

      return json({
        url: `${url.origin}/${id}`
      }, 200, corsHeaders);
    }

    /* =========================
       LOAD SLUG
       ========================= */
    const slug = url.pathname.slice(1);
    if (!slug) {
      return new Response("OK");
    }

    const data = await env.LINKS.get(slug);
    if (!data) {
      return new Response("404 NOT FOUND", { status: 404 });
    }

    const cfg = JSON.parse(data);

    /* =========================
       LOAD HTML DARI REPO
       (MAIN → MASTER FALLBACK)
       ========================= */
    const branches = ["main", "master"];
    let html = null;

    for (const b of branches) {
      const raw = `https://raw.githubusercontent.com/${cfg.repo}/${b}/index.html`;
      const r = await fetch(raw);
      if (r.ok) {
        html = await r.text();
        break;
      }
    }

    if (!html) {
      return new Response("index.html tidak ditemukan di repo", { status: 404 });
    }

    /* =========================
       GANTI IMAGE + ROTATOR
       ========================= */
    if (cfg.images.length) {
      html = html.replace(
        /<img[^>]*src="[^"]*"[^>]*>/i,
        `<img src="${cfg.images[0]}" style="max-width:100%">`
      );

      if (cfg.images.length > 1) {
        html = html.replace(
          "</body>",
          `
<script>
(()=> {
  const imgs = ${JSON.stringify(cfg.images)};
  let i = 0;
  setInterval(()=>{
    const img = document.querySelector("img");
    if(img) img.src = imgs[i++ % imgs.length];
  },3000);
})();
</script>
</body>`
        );
      }
    }

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        ...corsHeaders
      }
    });
  }
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}
