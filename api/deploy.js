export default {
  async fetch(req, env) {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const { html } = await req.json()

    const files = {
      "index.html": {
        content: html || "<h1>Hello Cloudflare</h1>"
      }
    }

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects/${env.CF_PROJECT}/deployments`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ files })
      }
    )

    const data = await res.json()

    return new Response(JSON.stringify({
      url: data.result?.url || null,
      raw: data
    }), {
      headers: { "Content-Type": "application/json" }
    })
  }
}
