// Seeds demo data through the running app's admin API. Usage: npm run seed [-- --url=https://… --wipe --no-deck --date=2026-11-20]
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const url = args.url || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const login = await fetch(`${url}/api/admin/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: process.env.ADMIN_USERNAME || "admin", password: process.env.ADMIN_PASSWORD }) });
if (!login.ok) { console.error("admin login failed", await login.text()); process.exit(1); }
const cookie = login.headers.get("set-cookie")?.split(";")[0];
const r = await fetch(`${url}/api/admin/seed`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ wipe: Boolean(args.wipe), withDeck: !args["no-deck"], eventDate: typeof args.date === "string" ? args.date : undefined }) });
console.log(r.status, await r.text());
