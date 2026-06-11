const mysql = require("mysql2/promise");
async function probe(name, cfg) {
  try {
    const c = await mysql.createConnection({ ...cfg, connectTimeout: 5000 });
    const [tables] = await c.query("SELECT table_name t, table_rows r FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name");
    const [[cnt]] = await c.query("SELECT COUNT(*) n FROM clients").catch(() => [[{ n: "no clients table" }]]);
    console.log(name, "=> tables:", tables.length, "| clients rows:", cnt.n);
    await c.end();
  } catch (e) { console.log(name, "=> FAILED:", e.message); }
}
(async () => {
  await probe("3306/services_app", { host: "127.0.0.1", port: 3306, user: "root", password: "root", database: "services_app" });
  await probe("3307/servicesofficeapp", { host: "127.0.0.1", port: 3307, user: "root", password: "rootpassword", database: "servicesofficeapp" });
})();
