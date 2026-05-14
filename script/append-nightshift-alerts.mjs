// Append the 5 Nightshift attack-chain alerts (INC-2026-0531..0535) to alerts.json.
// Conforms to the existing schema (ruleName/alertSeverity/displayedAt/entities-as-object/mitre-array)
// while preserving the intent from CLAUDE_CODE_BRIEF.md.
// Re-runnable: skips entries that already exist by id.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const alertsPath = path.resolve(__dirname, "..", "client", "src", "data", "alerts.json");

// New attack chain IOCs (distinct from existing 185.220.101.42 Cobalt Strike C2)
const TOR_IP = "185.220.101.47";          // Tor exit node — attacker pivot for ALT-032/035
const TARGET_HOST = "WIN10-WS-047";       // patient zero for ALT-031/033/034
const TARGET_USER = "jamie.chen@contoso.com";
const FILE_SRV = "FILE-SRV-001";
const SCAN_HOST_IP = "10.0.2.88";

const newAlerts = [
  {
    id: "INC-2026-0531",
    ruleName: "Suspicious process execution: Word spawned encoded PowerShell",
    product: "Microsoft Defender for Endpoint",
    productCode: "MDE",
    alertSeverity: "High",
    displayedAt: "2026-05-13T14:07:22Z",
    ruleDescription:
      "Defender for Endpoint detected a PowerShell process spawned by WINWORD.EXE running with an encoded (-EncodedCommand) payload and an outbound connection to a non-whitelisted IP. Classic macro-based execution from a phishing attachment.",
    entities: { host: TARGET_HOST, user: TARGET_USER, srcIp: TOR_IP },
    relatedTables: ["DeviceAlertEvents", "DeviceProcessEvents", "DeviceNetworkEvents"],
    starterQuery:
      `DeviceAlertEvents\n| where DeviceName == "${TARGET_HOST}"\n| where Timestamp > ago(2h)\n| project Timestamp, AlertTitle, FileName, InitiatingProcessFileName, ProcessCommandLine, RemoteIP`,
    investigationGoals: [
      "What parent process spawned PowerShell?",
      "What was the encoded command content?",
      "Was there successful C2 communication?",
      "Is this the only affected host?",
    ],
    groundTruthVerdict: "True Positive",
    groundTruthSummary:
      `WINWORD.EXE on ${TARGET_HOST} opened Invoice-Q2.docm and spawned powershell.exe -enc <base64>. Decoded command contacts ${TOR_IP}. 2.1MB exfiltrated. Single host so far but lateral movement underway.`,
    correctActions: [
      `Isolate ${TARGET_HOST} via MDE`,
      `Block ${TOR_IP} at firewall`,
      "Decode the -enc payload and IOC-share with email security",
      "Escalate to Tier 2",
    ],
    redHerrings: ["Educate user about macros", "Quarantine the document only"],
    playbookReason:
      "Word spawning encoded PowerShell with an outbound to a Tor exit is unambiguous. Isolate first, then preserve evidence. Encoded command and process tree are the deliverables for IR.",
    mitre: ["T1059.001 - PowerShell", "T1566.001 - Spearphishing Attachment"],
    hunterHints: [
      `Start at DeviceAlertEvents for ${TARGET_HOST}, then pivot to DeviceProcessEvents to walk the parent chain.`,
      "ProcessCommandLine contains '-enc' or '-EncodedCommand' — base64 the rest and decode.",
      "DeviceNetworkEvents will show the RemoteIP the powershell.exe process actually called.",
    ],
    category: "malware",
    mitreId: "T1059.001",
  },
  {
    id: "INC-2026-0532",
    ruleName: "Multiple mailboxes accessed from anonymizing service",
    product: "Microsoft Defender for Office 365",
    productCode: "M365",
    alertSeverity: "Medium",
    displayedAt: "2026-05-13T09:22:11Z",
    ruleDescription:
      "Multiple finance team mailboxes were accessed in sequence from a single Tor exit node IP. No interactive MFA challenge was recorded for any of the sessions — suggests OAuth token replay or refresh-token theft.",
    entities: { user: "finance-team@contoso.com", srcIp: TOR_IP },
    relatedTables: ["EmailEvents", "OfficeActivity", "SigninLogs", "ThreatIntelligenceIndicator"],
    starterQuery:
      `EmailEvents\n| where SrcIP == "${TOR_IP}"\n| where TimeGenerated > ago(6h)\n| project TimeGenerated, Operation, UserId, SrcIP, MailboxId`,
    investigationGoals: [
      "How many mailboxes were accessed and by which accounts?",
      "Was this a successful OAuth token theft or credential reuse?",
      "Were any emails forwarded or exfiltrated?",
      "Is MFA enforced on these accounts?",
    ],
    groundTruthVerdict: "True Positive",
    groundTruthSummary:
      `4 finance mailboxes (ap@, ar@, payroll@, controller@) accessed sequentially from Tor exit ${TOR_IP} 09:18–09:22 UTC. No SigninLogs MFA event — replayed refresh token. Two auto-forward rules created. Compromise confirmed.`,
    correctActions: [
      "Revoke all sessions for the 4 accounts",
      "Delete the auto-forward rules and audit sent items",
      `Block ${TOR_IP} on conditional access`,
      "Escalate — BEC / token theft",
    ],
    redHerrings: ["Reset passwords only", "Notify users to watch for phishing"],
    playbookReason:
      "Tor + sequential mailbox access + no MFA event = token replay. Password reset alone won't kill the refresh token — revoke sessions. Auto-forward rules are the exfil vector.",
    mitre: ["T1114.002 - Remote Email Collection", "T1528 - Steal Application Access Token"],
    hunterHints: [
      "EmailEvents filtered by SrcIP shows the full set of mailboxes touched.",
      "Look for Operation == 'New-InboxRule' from the same IP — the persistence move.",
      `Cross-reference ${TOR_IP} against ThreatIntelligenceIndicator — it'll be on Tor exit lists.`,
    ],
    category: "phishing",
    mitreId: "T1114.002",
  },
  {
    id: "INC-2026-0533",
    ruleName: "IDPS: Repeated port scan from internal host",
    product: "Azure Firewall IDPS",
    productCode: "AFW",
    alertSeverity: "Medium",
    displayedAt: "2026-05-13T14:31:05Z",
    ruleDescription:
      "Azure Firewall IDPS triggered on a high-rate horizontal port scan from an internal host. 847 connection attempts across 22 destination ports inside 4 minutes — pattern matches Nmap default SYN scan timing.",
    entities: { srcIp: SCAN_HOST_IP, host: TARGET_HOST },
    relatedTables: ["AzureFirewallNetworkRule", "DeviceNetworkEvents", "DeviceProcessEvents"],
    starterQuery:
      `AzureFirewallNetworkRule\n| where SrcIP == "${SCAN_HOST_IP}"\n| where TimeGenerated between (datetime(2026-05-13T14:25:00Z) .. datetime(2026-05-13T14:35:00Z))\n| summarize Attempts=count(), DistinctPorts=dcount(DstPort), Allowed=countif(Action == "Allow") by SrcIP`,
    investigationGoals: [
      `Is ${SCAN_HOST_IP} the same host as the Defender alert 30 minutes earlier?`,
      "What ports were targeted and what services do they correspond to?",
      "Were any connections successful (allowed by firewall)?",
      "Does the scan pattern match a known tool (Nmap, Masscan)?",
    ],
    groundTruthVerdict: "True Positive",
    groundTruthSummary:
      `${SCAN_HOST_IP} resolves to ${TARGET_HOST} — same host as INC-2026-0531. Scanned 22 ports (22, 80, 135, 139, 389, 443, 445, 1433, 3389, 5985, …) — classic Nmap top-ports list. 6 succeeded on the file server, including SMB (445) and WinRM (5985). Attacker pivoting from initial foothold.`,
    correctActions: [
      `Confirm ${TARGET_HOST} is already isolated from INC-2026-0531`,
      "Investigate the 6 successful connections — focus on the file server",
      "Audit WinRM/SMB sessions on receiving hosts",
      "Escalate — internal lateral movement underway",
    ],
    redHerrings: ["Block the scanning IP", "Wait for IDPS rule to expire"],
    playbookReason:
      "Internal port scan from a host already under suspicion is lateral movement reconnaissance. Following the 6 successful connections is more important than blocking the scanner — the host is already isolated.",
    mitre: ["T1046 - Network Service Discovery"],
    hunterHints: [
      `bin(TimeGenerated, 30s) and count() will show the scan rate — Nmap defaults to roughly 5/sec.`,
      "Group by DstPort then filter Action == 'Allow' to find the successful pivots.",
      "DeviceProcessEvents on the source host shows the scanning binary — likely nmap.exe or a PowerShell port-test loop.",
    ],
    category: "lateral-movement",
    mitreId: "T1046",
  },
  {
    id: "INC-2026-0534",
    ruleName: "Ransomware precursor: Volume shadow copies deleted",
    product: "Microsoft Defender for Endpoint",
    productCode: "MDE",
    alertSeverity: "Critical",
    displayedAt: "2026-05-13T15:44:18Z",
    ruleDescription:
      "vssadmin.exe executed with 'delete shadows /all /quiet' parameters on two hosts within 30 seconds. Preceded by encoded PowerShell and lateral movement activity. Highest-fidelity pre-ransomware indicator.",
    entities: { host: TARGET_HOST, fileServer: FILE_SRV, srcIp: TOR_IP },
    relatedTables: ["DeviceAlertEvents", "DeviceProcessEvents"],
    starterQuery:
      `DeviceProcessEvents\n| where DeviceName in ("${TARGET_HOST}", "${FILE_SRV}")\n| where ProcessCommandLine has "vssadmin" and ProcessCommandLine has "delete shadows"\n| project Timestamp, DeviceName, AccountName, ProcessCommandLine, InitiatingProcessFileName`,
    investigationGoals: [
      "Confirm the full attack chain from the earlier PowerShell alert",
      "Has the attacker reached the file server?",
      "Is encryption already underway (look for mass file rename events)?",
      "What is the immediate containment action?",
    ],
    groundTruthVerdict: "True Positive",
    groundTruthSummary:
      `vssadmin delete shadows /all /quiet ran on ${TARGET_HOST} at 15:44:18 and ${FILE_SRV} at 15:44:42 — both invoked by SYSTEM via remote PowerShell session from ${TARGET_HOST}. Mass file rename events follow on the file server within 90 seconds. Active ransomware encryption.`,
    correctActions: [
      `Confirm network isolation for ${TARGET_HOST} and ${FILE_SRV}`,
      "Verify offsite backup integrity immediately",
      "Activate ransomware playbook — invoke IR retainer + Legal",
      "Escalate Critical — executive notification per IR plan",
    ],
    redHerrings: ["Reboot the file server", "Run AV scan first"],
    playbookReason:
      "Shadow copy deletion is the pre-encryption ritual. By the time you see this alert, encryption has either started or is seconds away. Isolation and backup verification are now in parallel — there is no investigation phase here, only containment.",
    mitre: ["T1490 - Inhibit System Recovery", "T1486 - Data Encrypted for Impact"],
    hunterHints: [
      "/quiet flag suppresses the prompt — search for it specifically.",
      "InitiatingProcessFileName will likely be powershell.exe or wmiexec.py — that's your lateral movement vector.",
      "Look for the same command on multiple hosts within the same minute — that's the scope of the attacker's foothold.",
    ],
    category: "malware",
    mitreId: "T1490",
  },
  {
    id: "INC-2026-0535",
    ruleName: "Privileged role assigned outside change window",
    product: "Microsoft Entra ID",
    productCode: "AAD",
    alertSeverity: "High",
    displayedAt: "2026-05-13T14:53:00Z",
    ruleDescription:
      "Service account svc-backup@contoso.com was assigned the Global Administrator role at 14:53 UTC. No matching change ticket in ServiceNow. The assigning account was last seen signing in from a Tor exit node 6 hours earlier.",
    entities: { user: "svc-backup@contoso.com", assigningUser: "finance-controller@contoso.com", srcIp: TOR_IP },
    relatedTables: ["AzureActivity", "SigninLogs", "OfficeActivity"],
    starterQuery:
      `AzureActivity\n| where OperationNameValue contains "ROLEASSIGNMENTS/WRITE"\n| where TimeGenerated > ago(2h)\n| project TimeGenerated, Caller, CallerIpAddress, Properties`,
    investigationGoals: [
      "Who assigned the role and from what IP/session?",
      "Is the assigning account itself compromised (trace back to INC-2026-0532)?",
      "What actions has svc-backup taken since the role assignment?",
      "Has the role been removed? If not, what is the immediate action?",
    ],
    groundTruthVerdict: "True Positive",
    groundTruthSummary:
      `finance-controller@contoso.com (compromised in INC-2026-0532) granted Global Administrator to svc-backup@contoso.com at 14:53. svc-backup then created an app registration with Mail.ReadWrite and disabled conditional access on itself. Active privilege escalation pivoting from BEC.`,
    correctActions: [
      "Remove Global Administrator role from svc-backup immediately",
      "Disable svc-backup and finance-controller accounts",
      "Audit and revoke any app registrations / API permissions created in the window",
      "Escalate Critical — multi-stage identity compromise",
    ],
    redHerrings: ["Wait for next access review", "Notify the account owner"],
    playbookReason:
      "Role assignment from a compromised identity to a service account is a textbook persistence move. Service accounts are rarely watched, GA gives full tenant control. Containment is identity-first: kill the sessions, then unwind any objects created.",
    mitre: ["T1098.003 - Additional Cloud Roles", "T1078.004 - Cloud Accounts"],
    hunterHints: [
      "Pivot the Caller field against SigninLogs from the last 24h — was the assigning account on Tor recently?",
      "Properties contains the role definition ID — '62e90394-69f5-4237-9190-012177145e10' is Global Administrator.",
      "AzureActivity for Caller == 'svc-backup@contoso.com' shows what they did with the new privilege.",
    ],
    category: "privilege-escalation",
    mitreId: "T1098.003",
  },
];

const raw = fs.readFileSync(alertsPath, "utf8");
const arr = JSON.parse(raw);
const existingIds = new Set(arr.map((a) => a.id));

let added = 0;
for (const a of newAlerts) {
  if (existingIds.has(a.id)) continue;
  arr.push(a);
  added++;
}

fs.writeFileSync(alertsPath, JSON.stringify(arr, null, 2) + "\n", "utf8");
console.log(`Added ${added} alerts. Total now: ${arr.length}`);
