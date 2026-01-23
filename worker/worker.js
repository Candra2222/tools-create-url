export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    /* =========================
       CORS
    ========================= */
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: cors(),
      });
    }

    /* =========================
       API: LIST REPO GITHUB
       ========================= */
    if (url.pathname === "/api/github") {
      const gh = await fetch(
        `https://api.github.com/users/${env.GITHUB_USER}/repos?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            "User-Agent": "cf-worker",
            Accept: "application/vnd.github+json",
          },
        }
      );

      return json(await gh.json());
    }

    /* =========================
       API: CREATE LINK
       ========================= */
    if (url.pathname === "/api/create" && req.method === "POST") {
      const body = await req.json();

      if (!body.repoFullName) {
        return json({ error: "repoFullName kosong" }, 400);
      }

      const id = crypto.randomUUID().slice(0, 8);

      await env.LINKS.put(
        id,
        JSON.stringify({
          repo: body.repoFullName,
          images: Array.isArray(body.images) ? body.images : [],
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
      return new Response("index.html tidak ditemukan", { status: 404 });
    }

    let html = await r.text();

    /* =========================
       IMAGE INJECT + ROTATOR
       ========================= */
    if (cfg.images?.length) {
      html = html.replace(
        /<body([^>]*)>/i,
        `<body$1>
<div style="text-align:center;position:relative;z-index:999999">
  <img id="__inject_img" src="${cfg.images[0]}"
       style="max-width:100%;height:auto;margin:auto;display:block;">
</div>`
      );

      if (cfg.images.length > 1) {
        html = html.replace(
          /<\/body>/i,
          `<script>
(()=> {
  const imgs = ${JSON.stringify(cfg.images)};
  let i = 0;
  const img = document.getElementById('__inject_img');
  if(!img) return;
  setInterval(()=>{
    i = (i+1) % imgs.length;
    img.src = imgs[i];
  },3000);
})();
</script></body>`
        );
      }
    }

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        ...cors(),
      },
    });
  },
};

/* =========================
   HELPERS
========================= */
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...cors(),
    },
  });
}
