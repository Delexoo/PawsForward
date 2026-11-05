const token = process.env.SUPABASE_ACCESS_TOKEN;
const anon = process.env.SUPABASE_ANON_KEY;
const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const ref = "fnkccwjoyfnackmdycti";

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = t;
  }
  return { status: r.status, j };
}

const defs = await sql(`
select pg_get_function_identity_arguments(p.oid) as args,
       pg_get_functiondef(p.oid) as def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'public_signup_promoter'
`);
console.log("DEF_STATUS", defs.status);
const rows = Array.isArray(defs.j) ? defs.j : defs.j?.value || [];
for (const row of rows) {
  const d = String(row.def || "");
  console.log("ARGS", row.args);
  console.log("HAS_OLD_DAILY", d.includes("already signed up today"));
  console.log("HAS_MAX5", d.includes("over 5 QR"));
  console.log("PHONE_OPTIONAL", /v_phone is not null/.test(d) || /v_phone is null/.test(d));
}

async function signup(body) {
  const r = await fetch(`${url}/rest/v1/rpc/public_signup_promoter`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  console.log("SIGNUP", r.status, t.slice(0, 250));
}

const phone = "(555) 777-8888";
await signup({
  p_first_name: "Dup1",
  p_last_name: "-",
  p_phone: phone,
  p_payment_type: "cashapp",
  p_payment_handle: "$dup1",
  p_email: "dup1@example.com",
});
await signup({
  p_first_name: "Dup2",
  p_last_name: "-",
  p_phone: phone,
  p_payment_type: "venmo",
  p_payment_handle: "@dup2",
  p_email: "dup2@example.com",
});
await signup({
  p_first_name: "NoPhone",
  p_last_name: "-",
  p_phone: null,
  p_payment_type: "cashapp",
  p_payment_handle: "$nophone",
  p_email: "nophone@example.com",
});
