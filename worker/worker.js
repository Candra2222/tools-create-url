export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    /* =========================
       API: AMBIL SEMUA REPO
       ========================= */
    if (url.pathname === "/api/github") {
      const gh = await fetch(
        "https://api.github.com/user/repos?per_page=100",
        {
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            "User-Agent": "cf-worker"
          }
        }
      );

      return new Response(await gh.text(), {
        headers: { "Content-Type": "application/json" }
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
          images: Array.isArray(body.images) ? body.images : []
        })
      );

      return json({ url: `${url.origin}/${id}` });
    }

    /* =========================
       LOAD SLUG
       ========================= */
    const slug = url.pathname.slice(1);
    if (!slug) return new Response("OK");

    const data = await env.LINKS.get(slug);
    if (!data) return new Response("404 NOT FOUND", { status: 404 });

    const cfg = JSON.parse(data);

    /* =========================
       LOAD HTML DARI REPO
       ========================= */
    const raw = `https://raw.githubusercontent.com/${cfg.repo}/main/index.html`;
    const r = await fetch(raw);

    if (!r.ok) {
      return new Response("index.html tidak ditemukan di repo", { status: 404 });
    }

    let html = await r.text();

    /* =========================
       INJECT IMAGE (FIX AMAN)
       ========================= */
    if (cfg.images.length) {
      html = html.replace(
        /<body([^>]*)>/i,
        `<body$1>
<div id="__cf_img_wrap" style="
  text-align:center;
  position:relative;
  z-index:999999;
">
  <img id="__cf_img"
       src="${cfg.images[0]}"
       style="max-width:100%;height:auto;display:block;margin:auto;">
</div>
`
      );

      if (cfg.images.length > 1) {
        html = html.replace(
          /<\/body>/i,
          `
<script>
(() => {
  const imgs = ${JSON.stringify(cfg.images)};
  let i = 0;
  const img = document.getElementById("__cf_img");
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
      headers: { "Content-Type": "text/html" }
    });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
