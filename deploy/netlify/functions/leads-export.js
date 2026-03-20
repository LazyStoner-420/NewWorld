// netlify/functions/leads-export.js
// Download all saved leads as a CSV file.
//
// Usage:  GET  /.netlify/functions/leads-export?key=YOUR_EXPORT_KEY
//
// Set EXPORT_KEY in Netlify → Site Settings → Environment Variables

const fs = require("fs");
const LEADS_FILE = "/tmp/leads.csv";

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const provided = event.queryStringParameters?.key;
  const expected = process.env.EXPORT_KEY;

  if (!expected || provided !== expected) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const csv = fs.existsSync(LEADS_FILE)
    ? fs.readFileSync(LEADS_FILE, "utf8")
    : "timestamp,name,email,phone,city,address,services,lot_size,start,notes,source\n";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0,10)}.csv"`
    },
    body: csv
  };
};
