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

    // Contact / tickets / booking: POST /api/contact  { name, email, type, show, message, website(honeypot) }
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      let b;
      try { b = await request.json(); } catch { return json({ error: "Bad request" }, 400); }
      if (b && b.website) return json({ ok: true }); // bot trap
      const clip = (v, n) => String(v || "").trim().slice(0, n);
      const name = clip(b.name, 100), email = clip(b.email, 254).toLowerCase();
      const TYPES = ["Tickets", "Booking", "Merch", "Something else"];
      const type = TYPES.includes(b.type) ? b.type : "Something else";
      const show = clip(b.show, 200), message = clip(b.message, 2000);
      if (!name) return json({ error: "Add your name." }, 400);
      if (!EMAIL_RE.test(email)) return json({ error: "That email doesn't look right." }, 400);
      if (!message) return json({ error: "Add a message." }, 400);
      const id = Date.now() + ":" + crypto.randomUUID().slice(0, 8);
      await env.SIGNUPS.put("msg:" + id, JSON.stringify({
        received: new Date().toISOString(), type, name, email, show, message, country: request.cf?.country || "",
      }));
      return json({ ok: true });
    }

    // Export messages: GET /api/messages?key=ADMIN_KEY  -> CSV download (newest last)
    if (url.pathname === "/api/messages") {
      if (!env.ADMIN_KEY || url.searchParams.get("key") !== env.ADMIN_KEY) {
        return new Response("Not found", { status: 404 });
      }
      const cols = ["received", "type", "name", "email", "show", "message", "country"];
      const rows = [cols];
      let cursor;
      do {
        const page = await env.SIGNUPS.list({ prefix: "msg:", cursor });
        for (const k of page.keys) {
          const v = await env.SIGNUPS.get(k.name, "json");
          if (v) rows.push(cols.map((c) => v[c] || ""));
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="tripndarain-messages.csv"',
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
