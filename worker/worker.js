export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    /* ================= CORS ================= */
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const json = (d, s = 200) =>
      new Response(JSON.stringify(d, null, 2), {
        status: s,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });

    /* ============ API: LIST REPO ============ */
    if (url.pathname === "/api/github") {
      const r = await fetch(
        `https://api.github.com/users/${env.GITHUB_USER}/repos?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            "User-Agent": "cf-worker",
          },
        }
      );

      const data = await r.json();
      if (!Array.isArray(data)) {
        return json({ error: true, github: data }, 500);
      }

      return json(
        data.map((r) => ({
          name: r.full_name,
          default_branch: r.default_branch,
        }))
      );
    }

    /* ============ API: CREATE LINK ============ */
    if (url.pathname === "/api/create" && req.method === "POST") {
      const body = await req.json();

      if (!body.repo) return json({ error: "repo kosong" }, 400);

      const id = crypto.randomUUID().slice(0, 8);

      await env.LINKS.put(
        id,
        JSON.stringify({
          repo: body.repo,
          images: Array.isArray(body.images) ? body.images : [],
        })
      );

      return json({ url: `${url.origin}/${id}` });
    }

    /* ============ LOAD SLUG ============ */
    const slug = url.pathname.slice(1);
    if (!slug) return new Response("OK");

    const data = await env.LINKS.get(slug);
    if (!data) return new Response("404", { status: 404 });

    const cfg = JSON.parse(data);

    /* ============ LOAD HTML DARI REPO ============ */
    const raw = `https://raw.githubusercontent.com/${cfg.repo}/main/index.html`;
    const r = await fetch(raw);
    if (!r.ok) return new Response("index.html not found", { status: 404 });

    let html = await r.text();

    /* ============ IMAGE INJECT (FIX) ============ */
    if (cfg.images.length) {
      html = html.replace(
        /<body([^>]*)>/i,
        `<body$1>
<div id="__inject_wrap" style="text-align:center;z-index:999999">
<img id="__inject_img"
     src="${cfg.images[0]}"
     style="max-width:100%;height:auto;display:block;margin:auto">
</div>`
      );

      if (cfg.images.length > 1) {
        html = html.replace(
          /<\/body>/i,
          `<script>
(()=> {
 const imgs=${JSON.stringify(cfg.images)};
 let i=0;
 const img=document.getElementById('__inject_img');
 setInterval(()=>{
   i=(i+1)%imgs.length;
   if(img) img.src=imgs[i];
 },3000);
})();
</script></body>`
        );
      }
    }

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
