export async function onRequestPost({ request, env }) {
  try {
    const { repoFullName, images } = await request.json();

    if (!repoFullName || !images?.length) {
      return Response.json({ error: "PARAM_REQUIRED" }, { status: 400 });
    }

    /* 1️⃣ ambil HTML mentah dari GitHub */
    const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/main/index.html`;
    const r = await fetch(rawUrl);
    if (!r.ok) {
      return Response.json({ error: "HTML_NOT_FOUND", rawUrl }, { status: 404 });
    }

    let html = await r.text();

    /* 2️⃣ inject img pertama */
    html = html.replace(
      /<img([^>]+)src="[^"]*"([^>]*)>/i,
      `<img$1src="${images[0]}"$2>`
    );

    /* 3️⃣ rotator */
    if (images.length > 1) {
      html = html.replace(
        "</body>",
        `
<script>
(() => {
  const IMGS = ${JSON.stringify(images)};
  const img = document.querySelector("img");
  if(!img) return;
  let i = 0;
  setInterval(() => {
    i = (i+1) % IMGS.length;
    img.src = IMGS[i];
  }, 3000);
})();
</script>
</body>`
      );
    }

    /* 4️⃣ create Pages deployment */
    const name = "gen-" + crypto.randomUUID().slice(0, 8);

    const deploy = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          production_branch: "main"
        })
      }
    );

    const d = await deploy.json();
    if (!d.success) return Response.json(d, { status: 500 });

    /* 5️⃣ upload HTML */
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects/${name}/deployments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          files: {
            "index.html": html
          }
        })
      }
    );

    return Response.json({
      url: `https://${name}.pages.dev`
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
