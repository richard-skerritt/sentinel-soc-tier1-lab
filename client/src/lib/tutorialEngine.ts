// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  createElement,
} from "react";
import guideStepsData from "@/data/guideSteps.json";
import type { RunbookCategory } from "@/lib/types";

export interface GuideStep {
  plain_english: string;
  why: string;
  what_to_look_for: string;
  practice_prompt: string;
  practice_keywords: string[];
  practice_placeholder: string;
  practice_success: string;
  practice_hint: string;
  tool: "sentinel" | "rapid7" | "elk" | "edr";
  runbook_connection: string;
  report_connection: string;
  terminal_mode?: boolean;
  terminal_context?: string;
}

export interface GuideIntro {
  title: string;
  body: string;
  analogy: string;
}

export interface GuideCategory {
  intro: GuideIntro;
  steps: Record<string, GuideStep>;
}

const guideSteps = guideStepsData as unknown as Record<string, GuideCategory>;

export function getGuideStep(category: string, stepId: number): GuideStep | null {
  return guideSteps[category]?.steps?.[String(stepId)] ?? null;
}

export function getGuideIntro(category: string): GuideIntro | null {
  return guideSteps[category]?.intro ?? null;
}

export function getAvailableStepIds(category: string): number[] {
  const cat = guideSteps[category];
  if (!cat) return [];
  return Object.keys(cat.steps)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
}

/** Loose keyword match — accepts the answer if ≥ 70% of keywords are present. */
export function validatePractice(userInput: string, keywords: string[]): {
  ok: boolean;
  missing: string[];
} {
  const input = userInput.toLowerCase();
  const missing = keywords.filter((k) => !input.includes(k.toLowerCase()));
  const ok = keywords.length === 0 || missing.length <= Math.floor(keywords.length * 0.3);
  return { ok, missing };
}

// ============================================================
// Context
// ============================================================

export interface TutorialContextValue {
  guidedMode: boolean;
  toggleGuidedMode: () => void;
  setGuidedMode: (v: boolean) => void;
  activeGuideStep: { category: RunbookCategory; stepId: number } | null;
  openGuideStep: (category: RunbookCategory, stepId: number) => void;
  closeGuideStep: () => void;
  hasSeenIntro: (category: string) => boolean;
  markIntroSeen: (category: string) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

const GUIDED_KEY = "nightshift_guided_mode";
const introKey = (category: string) => `nightshift_intro_seen_${category}`;

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [guidedMode, setGuidedModeState] = useState<boolean>(false);
  const [activeGuideStep, setActiveGuideStep] =
    useState<{ category: RunbookCategory; stepId: number } | null>(null);
  const [introsSeen, setIntrosSeen] = useState<Record<string, boolean>>({});

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      setGuidedModeState(localStorage.getItem(GUIDED_KEY) === "true");
    } catch {}
  }, []);

  const setGuidedMode = useCallback((v: boolean) => {
    setGuidedModeState(v);
    try {
      localStorage.setItem(GUIDED_KEY, v ? "true" : "false");
    } catch {}
  }, []);

  const toggleGuidedMode = useCallback(() => {
    setGuidedModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GUIDED_KEY, next ? "true" : "false");
      } catch {}
      return next;
    });
  }, []);

  const openGuideStep = useCallback(
    (category: RunbookCategory, stepId: number) => {
      setActiveGuideStep({ category, stepId });
    },
    [],
  );
  const closeGuideStep = useCallback(() => setActiveGuideStep(null), []);

  const hasSeenIntro = useCallback(
    (category: string): boolean => {
      if (introsSeen[category]) return true;
      try {
        return localStorage.getItem(introKey(category)) === "true";
      } catch {
        return false;
      }
    },
    [introsSeen],
  );

  const markIntroSeen = useCallback((category: string) => {
    setIntrosSeen((prev) => ({ ...prev, [category]: true }));
    try {
      localStorage.setItem(introKey(category), "true");
    } catch {}
  }, []);

  const value = useMemo<TutorialContextValue>(
    () => ({
      guidedMode,
      toggleGuidedMode,
      setGuidedMode,
      activeGuideStep,
      openGuideStep,
      closeGuideStep,
      hasSeenIntro,
      markIntroSeen,
    }),
    [
      guidedMode,
      toggleGuidedMode,
      setGuidedMode,
      activeGuideStep,
      openGuideStep,
      closeGuideStep,
      hasSeenIntro,
      markIntroSeen,
    ],
  );

  return createElement(TutorialContext.Provider, { value }, children);
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial must be used inside <TutorialProvider>");
  }
  return ctx;
}
