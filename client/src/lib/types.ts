export interface Alert {
  id: string;
  ruleName: string;
  product: string;
  productCode: string;
  alertSeverity: "Critical" | "High" | "Medium" | "Low";
  displayedAt: string;
  ruleDescription: string;
  entities: Record<string, string>;
  relatedTables: string[];
  starterQuery: string;
  investigationGoals: string[];
  groundTruthVerdict: string;
  groundTruthSummary: string;
  correctActions: string[];
  redHerrings: string[];
  playbookReason: string;
  mitre: string[];
  hunterHints: string[];
  category: RunbookCategory;
  mitreId: string;
}

export type RunbookCategory =
  | "authentication"
  | "malware"
  | "phishing"
  | "network"
  | "lateral-movement"
  | "privilege-escalation";

export interface RunbookStep {
  id: number;
  action: string;
  tool: string;
  kql: string;
  expectedResult: string;
  decisionYes: string;
  decisionNo: string;
}

export interface Runbook {
  title: string;
  tool: string;
  steps: RunbookStep[];
}

export type RunbookMap = Record<RunbookCategory, Runbook>;

export interface MitreEntry {
  tactic: string;
  tacticId: string;
  technique: string;
  techniqueId: string;
  whatAttackerDoes: string;
  whyItMatters: string;
  commonIndicators: string[];
  sentinelKql: string;
  rapid7Query: string;
  elkQuery: string;
  nextMitreStep: string;
  differencesFromBruteForce: string;
}

export interface Rapid7AssetRecord {
  hostname: string;
  ip: string;
  os: string;
  lastSeen: string;
  riskScore: "low" | "medium" | "high";
  openVulnerabilities: number;
}

export interface Rapid7Response {
  logs: string[];
  asset: Rapid7AssetRecord;
}

export interface ElkEvent {
  "@timestamp": string;
  "event.category": string;
  "source.ip"?: string;
  "destination.ip"?: string;
  "user.name"?: string;
  "event.outcome"?: string;
  message?: string;
}

export interface ToolStack {
  id: string;
  name: string;
  siem: string;
  siemQueryLanguage: string;
  xdr: string;
  logPlatform: string;
  edr: string;
  ngav: string;
  idps: string;
  ticketing: string;
}

export interface ToolStackConfig {
  stacks: ToolStack[];
  activeStack: string;
}

export interface Lesson {
  id: string;
  title: string;
  estimatedMinutes: number;
  intro: string;
  sections: { heading: string; body: string }[];
  exercise: {
    prompt: string;
    expectedTable?: string;
    validator: {
      type: string;
      mustContain: string[];
      mustReturnRows: boolean;
    };
    hint: string;
  };
}

export interface Tutorial {
  lessons: Lesson[];
}
