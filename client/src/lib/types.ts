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
