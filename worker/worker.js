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
          images: body.images || []
        })
      );

      return json({
        url: `${url.origin}/${id}`
      });
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
       ========================= */
    const raw = `https://raw.githubusercontent.com/${cfg.repo}/main/index.html`;
    const r = await fetch(raw);

    if (!r.ok) {
      return new Response("index.html tidak ditemukan di repo", { status: 404 });
    }

    let html = await r.text();

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

    /* =========================
       REDIRECT (PAKAI SCRIPT DI REPO)
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
