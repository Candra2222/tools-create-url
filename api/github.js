export async function onRequest(context) {
  const { request, env } = context;

  // ================= CORS =================
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: cors()
    });
  }

  // ================= TOKEN CHECK =================
  if (!env.GITHUB_TOKEN) {
    return json({ error: 'GITHUB_TOKEN belum diset' }, 500);
  }

  try {
    const r = await fetch(
      'https://api.github.com/user/repos?per_page=100',
      {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          'User-Agent': 'cf-pages',
          Accept: 'application/vnd.github+json'
        }
      }
    );

    const d = await r.json();

    // 🔒 FIX UTAMA: PAKSA ARRAY
    if (!Array.isArray(d)) {
      return json([]);
    }

    return json(
      d.map(repo => ({
        full_name: repo.full_name
      }))
    );
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

/* ================= HELPER ================= */

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
