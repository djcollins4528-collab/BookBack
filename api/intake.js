const MAX_BODY_BYTES = 48 * 1024;

export default async function intake(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST to submit a pilot request." });
  }
  if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    return res.status(415).json({ error: "Send this form as JSON." });
  }
  let body;
  try {
    body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES) {
      return res.status(413).json({ error: "Request is too large." });
    }
  } catch {
    return res.status(400).json({ error: "The request could not be read. Please try again." });
  }

  try {
    const upstreamOrigin = process.env.BOOKEDBACK_API_ORIGIN;
    if (!upstreamOrigin || !upstreamOrigin.startsWith("https://")) {
      return res.status(503).json({ error: "The request form is temporarily unavailable. Please try again later." });
    }
    const upstream = await fetch(`${upstreamOrigin}/api/intake`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: upstreamOrigin,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await upstream.json().catch(() => ({ error: "The request could not be saved." }));
    return res.status(upstream.status).json(payload);
  } catch {
    return res.status(503).json({ error: "The request form is temporarily unavailable. Please try again later." });
  }
};
