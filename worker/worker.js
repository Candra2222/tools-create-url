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
       API: AMBIL SEMUA REPO
       (WAJIB ARRAY – FIX forEach ERROR)
       ========================= */
    if (url.pathname === "/api/github") {
      const gh = await fetch(
        `https://api.github.com/users/${env.GITHUB_USER}/repos?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            "User-Agent": "cf-worker",
          },
        }
      );

      const data = await gh.json();

      // JIKA ERROR DARI GITHUB
      if (!Array.isArray(data)) {
        return new Response(
          JSON.stringify({ error: "GitHub API error", raw: data }),
          { headers: jsonHeader }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: jsonHeader,
      });
    }

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
       IMAGE INJECT + ROTATOR
       (ANTI ERROR TOTAL)
       ========================= */
    if (cfg.images.length) {
      if (/<img[^>]*src=/i.test(html)) {
        html = html.replace(
          /<img[^>]*src="[^"]*"[^>]*>/i,
          `<img src="${cfg.images[0]}" style="max-width:100%;height:auto;">`
        );
      } else {
        html = html.replace(
          /<\/body>/i,
          `<img src="${cfg.images[0]}" style="max-width:100%;height:auto;"></body>`
        );
      }

      if (cfg.images.length > 1) {
        html = html.replace(
          /<\/body>/i,
          `<script>
(()=> {
  const imgs = ${JSON.stringify(cfg.images)};
  let i = 0;
  setInterval(()=>{
    const img = document.querySelector("img");
    if(img){
      i = (i + 1) % imgs.length;
      img.src = imgs[i];
    }
  },3000);
})();
</script>
</body>`
        );
      }
    }

    /* =========================
       RETURN HTML
       (REDIRECT TETAP DARI REPO)
       ========================= */
    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
