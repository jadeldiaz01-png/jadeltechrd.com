import fs from "node:fs";
import path from "node:path";

const project = String(process.env.GCP_PROJECT_ID || "").trim();
if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) {
  console.error("BIGQUERY_SQL_RENDER=BLOCKED invalid or missing GCP_PROJECT_ID");
  process.exit(2);
}

const root = "analytics/bigquery";
const out = process.env.BIGQUERY_SQL_OUT || "/tmp/jadeltechrd-bigquery-sql";
fs.mkdirSync(out, { recursive: true });

for (const name of fs.readdirSync(root).filter((n) => n.endsWith(".sql.tmpl"))) {
  const src = fs.readFileSync(path.join(root, name), "utf8");
  if (!src.includes("__GCP_PROJECT_ID__")) {
    console.error("BIGQUERY_SQL_RENDER=FAIL missing project placeholder " + name);
    process.exit(1);
  }
  const rendered = src.replaceAll("__GCP_PROJECT_ID__", project);
  const target = path.join(out, name.replace(/\.tmpl$/, ""));
  fs.writeFileSync(target, rendered);
  console.log("RENDERED", target);
}
console.log("BIGQUERY_SQL_RENDER=PASS");
