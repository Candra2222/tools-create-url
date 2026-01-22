export async function onRequest() {
  const token = GITHUB_TOKEN; // optional
  const res = await fetch("https://api.github.com/user/repos", {
    headers: token ? { Authorization: `token ${token}` } : {}
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}
