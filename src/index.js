const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Signup: POST /api/join  { email }
    if (url.pathname === "/api/join") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      let email = "";
      try {
        email = String((await request.json()).email || "").trim().toLowerCase();
      } catch {
        return json({ error: "Bad request" }, 400);
      }
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return json({ error: "That email doesn't look right." }, 400);
      }
      const key = "signup:" + email;
      if (!(await env.SIGNUPS.get(key))) {
        await env.SIGNUPS.put(
          key,
          JSON.stringify({ email, joined: new Date().toISOString(), country: request.cf?.country || "" })
        );
      }
      return json({ ok: true });
    }

    // Export: GET /api/signups?key=ADMIN_KEY  -> CSV download
    if (url.pathname === "/api/signups") {
      if (!env.ADMIN_KEY || url.searchParams.get("key") !== env.ADMIN_KEY) {
        return new Response("Not found", { status: 404 });
      }
      const rows = [["email", "joined", "country"]];
      let cursor;
      do {
        const page = await env.SIGNUPS.list({ prefix: "signup:", cursor });
        for (const k of page.keys) {
          const v = await env.SIGNUPS.get(k.name, "json");
          if (v) rows.push([v.email, v.joined, v.country]);
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="tripndarain-signups.csv"',
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
