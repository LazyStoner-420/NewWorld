// netlify/functions/lead.js
// Receives a lead from the contact form.
// 1. Appends it to /tmp/leads.csv  (downloadable via leads-export.js)
// 2. Sends an email notification to the owner via SendGrid

const fs = require("fs");

// ─── CONFIGURATION ────────────────────────────────────────────────────────
// Set these two values directly here, then set the API key in Netlify env vars
const OWNER_EMAIL  = "miscarrangements@gmail.com";        // ← owner's real email address
const FROM_EMAIL   = "miscarrangements@gmail.com"; // ← your SendGrid verified sender
const FROM_NAME    = "New World Lawn Care Website";
const LEADS_FILE   = "/tmp/leads.csv";
// ──────────────────────────────────────────────────────────────────────────

const HEADERS = [
  "timestamp","name","email","phone","city","address",
  "services","lot_size","start","notes","source"
];

function escapeCSV(val) {
  if (val == null) return "";
  const s = String(val).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

function appendCSV(lead) {
  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, HEADERS.join(",") + "\n", "utf8");
  }
  const row = HEADERS.map(h => escapeCSV(lead[h])).join(",") + "\n";
  fs.appendFileSync(LEADS_FILE, row, "utf8");
}

async function sendEmail(lead) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.warn("SENDGRID_API_KEY not set — email skipped");
    return;
  }

  const rows = [
    ["Name",       lead.name],
    ["Email",      lead.email],
    ["Phone",      lead.phone      || "—"],
    ["City",       lead.city       || "—"],
    ["Address",    lead.address    || "—"],
    ["Services",   lead.services   || "—"],
    ["Lot Size",   lead.lot_size   || "—"],
    ["Start",      lead.start      || "—"],
    ["Notes",      lead.notes      || "—"],
    ["Source",     lead.source     || "—"],
    ["Submitted",  lead.timestamp],
  ];

  const htmlRows = rows.map(([label, val]) => `
    <tr>
      <td style="padding:7px 12px 7px 0;color:#666;font-weight:600;font-size:13px;width:100px;vertical-align:top;">${label}</td>
      <td style="padding:7px 0;color:#111;font-size:13px;border-bottom:1px solid #f0f0f0;">${val}</td>
    </tr>`).join("");

  const plainText = rows.map(([l, v]) => `${l}: ${v}`).join("\n");

  const payload = {
    personalizations: [{ to: [{ email: OWNER_EMAIL, name: "New World Lawn Care" }] }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    reply_to: { email: lead.email || FROM_EMAIL, name: lead.name || "Website Visitor" },
    subject: `New Quote Request — ${lead.name || "Unknown"} (${lead.city || "Ontario"})`,
    content: [
      { type: "text/plain", value: `New quote request:\n\n${plainText}` },
      {
        type: "text/html",
        value: `
        <div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;">
          <div style="background:#144d20;padding:20px 28px;border-radius:6px 6px 0 0;">
            <h2 style="color:#a8d5a2;margin:0;font-size:16px;font-weight:600;">New World Lawn Care</h2>
            <p style="color:#6bab72;margin:4px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">New Quote Request</p>
          </div>
          <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 6px 6px;padding:24px 28px;">
            <table style="width:100%;border-collapse:collapse;">${htmlRows}</table>
            <p style="margin-top:20px;font-size:11px;color:#aaa;">
              Reply directly to this email to contact ${lead.name || "the customer"}.
            </p>
          </div>
        </div>`
      }
    ]
  };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SendGrid ${res.status}: ${err}`);
  }
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "POST")   return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  let lead;
  try {
    lead = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (!lead.name && !lead.email) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Name or email required" }) };
  }

  lead.timestamp = lead.timestamp || new Date().toISOString();

  // 1. Save to CSV
  try {
    appendCSV(lead);
    console.log(`Lead saved: ${lead.name} <${lead.email}>`);
  } catch (err) {
    console.error("CSV write failed:", err.message);
    // Don't abort — still try to email
  }

  // 2. Email owner
  try {
    await sendEmail(lead);
    console.log(`Email sent for: ${lead.email}`);
  } catch (err) {
    console.error("Email failed:", err.message);
    // Lead is saved — return success regardless
  }

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ success: true })
  };
};
