// LABEL WALL - anonymous phone responses -> live digital board (Kahoot-style)
// Zero dependencies. Run:  node server.js     (Node 16+)
// Students open  http://<your-address>:3000      Facilitator opens the /board?key=... link printed below.
const http = require("http"),
  fs = require("fs"),
  os = require("os"),
  path = require("path"),
  crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const KEY =
  process.env.ADMIN_KEY || String(Math.floor(1000 + Math.random() * 9000));
const FILE = path.join(__dirname, "notes.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const STATIC_FILES = {
  "/css/student.css": ["css/student.css", "text/css; charset=utf-8"],
  "/css/board.css": ["css/board.css", "text/css; charset=utf-8"],
  "/js/student.js": ["js/student.js", "text/javascript; charset=utf-8"],
  "/js/board.js": ["js/board.js", "text/javascript; charset=utf-8"],
};
let S = { notes: [], locked: false, review: false };
try {
  S = Object.assign(S, JSON.parse(fs.readFileSync(FILE, "utf8")));
} catch (e) {}
const save = () => fs.writeFile(FILE, JSON.stringify(S), () => {});
const clients = new Set(); // SSE connections {res, admin}
const hits = new Map(); // flood control only (in memory, never stored with notes)

const view = (admin) => ({
  locked: S.locked,
  review: S.review,
  notes: S.notes
    .filter((n) => admin || !n.hidden)
    .map((n) => ({ id: n.id, type: n.type, text: n.text, hidden: n.hidden })),
});
const push = () =>
  clients.forEach((c) =>
    c.res.write("data: " + JSON.stringify(view(c.admin)) + "\n\n"),
  );
const json = (res, code, o) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(o));
};
const body = (req) =>
  new Promise((r) => {
    let b = "";
    req.on("data", (d) => {
      b += d;
      if (b.length > 4000) req.destroy();
    });
    req.on("end", () => {
      try {
        r(JSON.parse(b));
      } catch (e) {
        r({});
      }
    });
  });

http
  .createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(path.join(PUBLIC_DIR, "index.html")));
    }
    if (u.pathname === "/board") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(path.join(PUBLIC_DIR, "board.html")));
    }
    if (STATIC_FILES[u.pathname]) {
      const [file, contentType] = STATIC_FILES[u.pathname];
      res.writeHead(200, { "Content-Type": contentType });
      return res.end(fs.readFileSync(path.join(PUBLIC_DIR, file)));
    }
    if (u.pathname === "/api/info")
      return json(res, 200, {
        port: PORT,
        lan: lanIPs(),
        admin: u.searchParams.get("key") === KEY,
      });
    if (u.pathname === "/api/stream") {
      const admin = u.searchParams.get("key") === KEY;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const c = { res, admin };
      clients.add(c);
      res.write("data: " + JSON.stringify(view(admin)) + "\n\n");
      const ka = setInterval(() => res.write(": ping\n\n"), 20000);
      return req.on("close", () => {
        clients.delete(c);
        clearInterval(ka);
      });
    }
    if (u.pathname === "/api/note" && req.method === "POST") {
      const b = await body(req);
      const ip = req.socket.remoteAddress,
        now = Date.now();
      const h = (hits.get(ip) || []).filter((t) => now - t < 600000);
      if (h.length >= 30) return json(res, 429, { error: "slow" });
      hits.set(ip, h.concat(now));
      if (S.locked) return json(res, 423, { error: "locked" });
      const text = String(b.text || "")
        .replace(/[\u0000-\u001f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
      if (!text || !["others", "self"].includes(b.type))
        return json(res, 400, { error: "bad" });
      S.notes.push({
        id: crypto.randomBytes(4).toString("hex"),
        type: b.type,
        text,
        hidden: S.review,
      });
      save();
      push();
      return json(res, 200, { ok: true });
    }
    if (u.pathname === "/api/admin" && req.method === "POST") {
      const b = await body(req);
      if (b.key !== KEY) return json(res, 403, { error: "key" });
      const n = S.notes.find((x) => x.id === b.id);
      if (b.action === "hide" && n) n.hidden = true;
      else if (b.action === "show" && n) n.hidden = false;
      else if (b.action === "delete")
        S.notes = S.notes.filter((x) => x.id !== b.id);
      else if (b.action === "lock") S.locked = !!b.value;
      else if (b.action === "review") S.review = !!b.value;
      else if (b.action === "clear") S.notes = [];
      save();
      push();
      return json(res, 200, { ok: true });
    }
    res.writeHead(404);
    res.end("Not found");
  })
  .listen(PORT, "0.0.0.0", () => {
    const ip = lanIPs()[0] || "localhost";
    console.log("\n  LABEL WALL is running\n");
    console.log("  Students open :  http://" + ip + ":" + PORT);
    console.log(
      "  Facilitator   :  http://" +
        ip +
        ":" +
        PORT +
        "/board?key=" +
        KEY +
        "   (project this one)\n",
    );
    console.log(
      "  Phones must be on the same Wi-Fi/hotspot as this computer (or host the app online).\n",
    );
  });
function lanIPs() {
  return []
    .concat(...Object.values(os.networkInterfaces()))
    .filter((i) => i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}
