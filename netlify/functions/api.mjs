import { timingSafeEqual } from "node:crypto";

const endpoint = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hits = new Map();

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function isAdmin(key) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || typeof key !== "string") return false;
  const suppliedBytes = Buffer.from(key);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

async function database(table, query, { method = "GET", body } = {}) {
  const response = await fetch(
    `${endpoint}/rest/v1/${table}?${new URLSearchParams(query)}`,
    {
      method,
      headers: {
        apikey: serviceKey,
        authorization: "Bearer " + serviceKey,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Supabase request failed (${response.status}): ${await response.text()}`,
    );
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function readState(admin) {
  const [settings, notes] = await Promise.all([
    database("app_state", { id: "eq.1", select: "locked,review" }),
    database("submissions", {
      select: "id,type,text,hidden",
      order: "created_at.asc",
      ...(admin ? {} : { hidden: "eq.false" }),
    }),
  ]);
  return {
    locked: settings[0]?.locked ?? false,
    review: settings[0]?.review ?? false,
    notes,
  };
}

function rateLimited(request) {
  const ip = request.headers.get("x-nf-client-connection-ip");
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 600_000);
  if (recent.length >= 30) return true;
  hits.set(ip, [...recent, now]);
  return false;
}

export default async (request) => {
  if (!endpoint || !serviceKey) {
    return json(503, { error: "storage_not_configured" });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const key = url.searchParams.get("key") || "";

  try {
    if (path === "/api/info" && request.method === "GET") {
      return json(200, { admin: isAdmin(key) });
    }

    if (path === "/api/state" && request.method === "GET") {
      return json(200, await readState(isAdmin(key)));
    }

    if (path === "/api/note" && request.method === "POST") {
      if (rateLimited(request)) return json(429, { error: "slow" });

      let input;
      try {
        const text = await request.text();
        if (text.length > 4000) return json(413, { error: "too_large" });
        input = JSON.parse(text);
      } catch {
        return json(400, { error: "bad_json" });
      }
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return json(400, { error: "bad_request" });
      }

      const state = await database("app_state", {
        id: "eq.1",
        select: "locked,review",
      });
      if (state[0]?.locked) return json(423, { error: "locked" });

      const text = String(input.text || "")
        .replace(/[\u0000-\u001f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
      if (!text || !["others", "self"].includes(input.type)) {
        return json(400, { error: "bad" });
      }

      await database(
        "submissions",
        { select: "id" },
        {
          method: "POST",
          body: [{ type: input.type, text, hidden: state[0]?.review ?? false }],
        },
      );
      return json(200, { ok: true });
    }

    if (path === "/api/admin" && request.method === "POST") {
      let input;
      try {
        const text = await request.text();
        if (text.length > 4000) return json(413, { error: "too_large" });
        input = JSON.parse(text);
      } catch {
        return json(400, { error: "bad_json" });
      }
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return json(400, { error: "bad_request" });
      }
      if (!isAdmin(input.key)) return json(403, { error: "key" });

      if (input.action === "lock" || input.action === "review") {
        await database(
          "app_state",
          { id: "eq.1" },
          {
            method: "PATCH",
            body: { [input.action]: Boolean(input.value) },
          },
        );
      } else if (input.action === "hide" || input.action === "show") {
        if (typeof input.id !== "string") {
          return json(400, { error: "bad_id" });
        }
        await database(
          "submissions",
          { id: `eq.${input.id}` },
          {
            method: "PATCH",
            body: { hidden: input.action === "hide" },
          },
        );
      } else if (input.action === "delete") {
        if (typeof input.id !== "string") {
          return json(400, { error: "bad_id" });
        }
        await database(
          "submissions",
          { id: `eq.${input.id}` },
          { method: "DELETE" },
        );
      } else if (input.action === "clear") {
        await database(
          "submissions",
          { id: "not.is.null" },
          { method: "DELETE" },
        );
      } else {
        return json(400, { error: "bad_action" });
      }

      return json(200, { ok: true });
    }

    return json(404, { error: "not_found" });
  } catch (error) {
    console.error("API request failed", error);
    return json(500, { error: "internal_error" });
  }
};

export const config = { path: "/api/*" };
