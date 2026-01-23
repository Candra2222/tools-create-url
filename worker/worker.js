export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    /* =========================
       CORS
       ========================= */
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const jsonHeader = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };

    /* =========================
       API: CREATE LINK
       ========================= */
    if (url.pathname === "/api/create" && req.method === "POST") {
      const body = await req.json();

      if (!body.repoFullName) {
        return new Response(
          JSON.stringify({ error: "repoFullName kosong" }),
          { headers: jsonHeader }
        );
      }

      const id = crypto.randomUUID().slice(0, 8);

      await env.LINKS.put(
        id,
        JSON.stringify({
          repo: body.repoFullName,
          images: Array.isArray(body.images) ? body.images : [],
        })
      );

      return new Response(
        JSON.stringify({ url: `${url.origin}/${id}` }),
        { headers: jsonHeader }
      );
    }

    /* =========================
       LOAD SLUG
       ========================= */
    const slug = url.pathname.slice(1);
    if (!slug) return new Response("OK");

    const data = await env.LINKS.get(slug);
    if (!data) {
      return new Response("404 NOT FOUND", { status: 404 });
    }

    const cfg = JSON.parse(data);

    /* =========================
       LOAD HTML DARI REPO
       ========================= */
    const raw = `https://raw.githubusercontent.com/${cfg.repo}/main/index.html`;
    const r = await fetch(raw);

    if (!r.ok) {
      return new Response("index.html tidak ditemukan di repo", {
        status: 404,
      });
    }

    let html = await r.text();

    /* =========================
       IMAGE INJECT (FIX TOTAL)
       ========================= */
    if (cfg.images && cfg.images.length) {
      html = html.replace(
        /<body([^>]*)>/i,
        `<body$1>
<div id="__inject_wrap" style="text-align:center;position:relative;z-index:999999">
  <img id="__inject_img"
       src="${cfg.images[0]}"
       style="max-width:100%;height:auto;display:block;margin:auto;">
</div>`
      );

      if (cfg.images.length > 1) {
        html = html.replace(
          /<\/body>/i,
          `<script>
(() => {
  const imgs = ${JSON.stringify(cfg.images)};
  let i = 0;
  const img = document.getElementById('__inject_img');
  if (!img) return;
  setInterval(() => {
    i = (i + 1) % imgs.length;
    img.src = imgs[i];
  }, 3000);
})();
</script>
</body>`
        );
      }
    }

    /* =========================
       RETURN HTML
       ========================= */
    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
