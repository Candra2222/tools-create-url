export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/api/github") {
      const gh = await fetch("https://api.github.com/user/repos?per_page=100", {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "User-Agent": "cf-worker"
        }
      });
      return new Response(await gh.text(), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url.pathname === "/api/create" && req.method === "POST") {
      const { repo, images, redirect } = await req.json();
      const id = crypto.randomUUID().slice(0, 8);

      await env.LINKS.put(id, JSON.stringify({
        repo,
        images,
        redirect
      }));

      return json({ url: `https://${url.hostname}/${id}` });
    }

    const slug = url.pathname.slice(1);
    if (!slug) return new Response("OK");

    const data = await env.LINKS.get(slug);
    if (!data) return new Response("404 NOT FOUND", { status: 404 });

    const cfg = JSON.parse(data);
    const raw = `https://raw.githubusercontent.com/${cfg.repo}/main/index.html`;
    const r = await fetch(raw);
    let html = await r.text();

    if (cfg.images?.length) {
      html = html.replace(
        /<img[^>]*src="[^"]*"[^>]*>/i,
        `<img src="${cfg.images[0]}" style="max-width:100%">`
      );

      if (cfg.images.length > 1) {
        html = html.replace("</body>", `
<script>
(()=>{const i=${JSON.stringify(cfg.images)};let x=0;
setInterval(()=>{const m=document.querySelector("img");
if(m)m.src=i[x++%i.length]},3000);})();
</script></body>`);
      }
    }

    html = html.replace("</body>", `
<script>setTimeout(()=>location.href="${cfg.redirect}",1500)</script></body>`);

    return new Response(html, { headers: { "Content-Type": "text/html" }});
  }
};

function json(d,s=200){
  return new Response(JSON.stringify(d,null,2),{
    status:s,
    headers:{'Content-Type':'application/json'}
  });
}
