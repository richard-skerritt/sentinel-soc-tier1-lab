// One-shot: add `category` and `mitreId` fields to the 30 existing alerts.
// Re-runnable safely — re-running just overwrites the values to the same thing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const alertsPath = path.resolve(__dirname, "..", "client", "src", "data", "alerts.json");

const tags = {
  "INC-2026-0501": { category: "authentication",       mitreId: "T1110.003" },
  "INC-2026-0502": { category: "authentication",       mitreId: "T1090.003" },
  "INC-2026-0503": { category: "authentication",       mitreId: "T1078"     },
  "INC-2026-0504": { category: "authentication",       mitreId: "T1621"     },
  "INC-2026-0505": { category: "authentication",       mitreId: "T1078"     },
  "INC-2026-0506": { category: "malware",              mitreId: "T1566.001" },
  "INC-2026-0507": { category: "malware",              mitreId: "T1105"     },
  "INC-2026-0508": { category: "malware",              mitreId: "T1003.001" },
  "INC-2026-0509": { category: "malware",              mitreId: "T1055.002" },
  "INC-2026-0510": { category: "malware",              mitreId: "T1055"     },
  "INC-2026-0511": { category: "malware",              mitreId: "T1547.001" },
  "INC-2026-0512": { category: "malware",              mitreId: "T1562.001" },
  "INC-2026-0513": { category: "malware",              mitreId: "T1490"     },
  "INC-2026-0514": { category: "lateral-movement",     mitreId: "T1087"     },
  "INC-2026-0515": { category: "malware",              mitreId: "T1204"     },
  "INC-2026-0516": { category: "phishing",             mitreId: "T1114.003" },
  "INC-2026-0517": { category: "malware",              mitreId: "T1485"     },
  "INC-2026-0518": { category: "phishing",             mitreId: "T1528"     },
  "INC-2026-0519": { category: "network",              mitreId: "T1567.002" },
  "INC-2026-0520": { category: "privilege-escalation", mitreId: "T1213"     },
  "INC-2026-0521": { category: "network",              mitreId: "T1530"     },
  "INC-2026-0522": { category: "authentication",       mitreId: "T1078.004" },
  "INC-2026-0523": { category: "privilege-escalation", mitreId: "T1552.001" },
  "INC-2026-0524": { category: "network",              mitreId: "T1133"     },
  "INC-2026-0525": { category: "malware",              mitreId: "T1496"     },
  "INC-2026-0526": { category: "phishing",             mitreId: "T1566.001" },
  "INC-2026-0527": { category: "network",              mitreId: "T1041"     },
  "INC-2026-0528": { category: "network",              mitreId: "T1071.004" },
  "INC-2026-0529": { category: "network",              mitreId: "T1071.001" },
  "INC-2026-0530": { category: "network",              mitreId: "T1187"     },
};

const raw = fs.readFileSync(alertsPath, "utf8");
const arr = JSON.parse(raw);

let tagged = 0;
let untagged = [];
for (const a of arr) {
  const t = tags[a.id];
  if (!t) {
    untagged.push(a.id);
    continue;
  }
  a.category = t.category;
  a.mitreId = t.mitreId;
  tagged++;
}

fs.writeFileSync(alertsPath, JSON.stringify(arr, null, 2) + "\n", "utf8");
console.log(`Tagged ${tagged} alerts. Untagged: ${untagged.length ? untagged.join(", ") : "none"}`);
