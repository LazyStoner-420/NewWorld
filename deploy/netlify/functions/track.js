// netlify/functions/track.js
// Logs page visits to /tmp/traffic.csv

const fs = require("fs");
const TRAFFIC_FILE = "/tmp/traffic.csv";
const HEADERS = ["timestamp", "page", "ref", "ip", "ua"];

function escapeCSV(val) {
  if (val == null) return "";
  const s = String(val).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { /* ignore */ }

  const row = {
    timestamp: body.time || new Date().toISOString(),
    page:      body.page || "/",
    ref:       body.ref  || "",
    ip:        event.headers?.["x-forwarded-for"] || event.headers?.["client-ip"] || "",
    ua:        body.ua   || event.headers?.["user-agent"] || ""
  };

  try {
    if (!fs.existsSync(TRAFFIC_FILE)) {
      fs.writeFileSync(TRAFFIC_FILE, HEADERS.join(",") + "\n", "utf8");
    }
    const csvRow = HEADERS.map(h => escapeCSV(row[h])).join(",") + "\n";
    fs.appendFileSync(TRAFFIC_FILE, csvRow, "utf8");
  } catch (err) {
    console.error("Traffic log error:", err.message);
  }

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
};
