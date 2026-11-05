import fs from "fs";

const NEW_URL = process.env.SUPABASE_URL.replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=minimal",
};

function load(name) {
  const path = `${process.env.TEMP}/pf-mig-${name}.json`;
  if (!fs.existsSync(path)) return [];
  let raw = fs.readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  if (!raw.trim()) return [];
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : data ? [data] : [];
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) {
    console.log(`${table}: 0 rows`);
    return;
  }
  // chunk to avoid payload limits
  const size = 100;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const url = `${NEW_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(chunk),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`${table} FAIL`, res.status, text.slice(0, 500));
      process.exit(1);
    }
  }
  console.log(`${table}: upserted ${rows.length}`);
}

const employees = load("employees");
const donations = load("donations");
const visits = load("visits");
const payouts = load("payouts");

await upsert("employees", employees, "id");
await upsert("donations", donations, "id");
await upsert("visits", visits, "id");
await upsert("payouts", payouts, "id");

const check = await fetch(
  `https://api.supabase.com/v1/projects/fnkccwjoyfnackmdycti/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query:
        "select (select count(*) from employees) emp, (select count(*) from donations) don, (select count(*) from visits) vis, (select count(*) from payouts) pay",
    }),
  }
);
console.log("counts", await check.text());
