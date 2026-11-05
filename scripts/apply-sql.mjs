import fs from "fs";

const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || "fnkccwjoyfnackmdycti";
const file = process.argv[2];
if (!token || !file) {
  console.error("Usage: TOKEN=... node apply-sql.mjs <file.sql>");
  process.exit(1);
}
const sql = fs.readFileSync(file, "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
console.log("STATUS", res.status);
console.log(text.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
