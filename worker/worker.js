export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    /* ===============================
       CORS
    =============================== */
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: cors()
      });
    }

    /* ===============================
       LOAD GITHUB REPO
       /api/github
    =============================== */
    if (url.pathname === '/api/github') {
      try {
        const r = await fetch('https://api.github.com/user/repos?per_page=100', {
          headers: {
            Authorization: `token ${env.GITHUB_TOKEN}`,
            'User-Agent': 'cf-worker'
          }
        });

        const d = await r.json();

        // 🔒 PENTING: PAKSA ARRAY
        if (!Array.isArray(d)) {
          return json([]);
        }

        return json(d.map(x => ({
          full_name: x.full_name
        })));
      } catch (e) {
        return json([]);
      }
    }

    /* ===============================
       CREATE / DEPLOY
       /api/create
    =============================== */
    if (url.pathname === '/api/create' && req.method === 'POST') {
      try {
        const body = await req.json();
        const repo = body.repoFullName;
        const images = body.images || [];

        if (!repo) {
          return json({ error: 'Repo kosong' }, 400);
        }

        // 🔗 link hasil (contoh)
        const rand = Math.random().toString(36).slice(2, 8);
        const link = `https://${repo.replace('/', '-')}-${rand}.pages.dev`;

        return json({
          url: link,
          repo,
          images
        });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};

/* ===============================
   HELPER
=============================== */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors()
    }
  });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
