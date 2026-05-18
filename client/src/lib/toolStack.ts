// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import toolStackData from "@/data/toolStacks.json";
import type { ToolStack, ToolStackConfig } from "@/lib/types";

const STORAGE_KEY = "active_tool_stack";

const data = toolStackData as unknown as ToolStackConfig;

export function listStacks(): ToolStack[] {
  return data.stacks;
}

export function getActiveStackId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && data.stacks.some((s) => s.id === stored)) return stored;
  } catch {}
  return data.activeStack;
}

export function setActiveStackId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
  window.dispatchEvent(new CustomEvent("tool-stack-changed", { detail: id }));
}

export function getActiveStack(): ToolStack {
  const id = getActiveStackId();
  return data.stacks.find((s) => s.id === id) ?? data.stacks[0];
}

// Stacks that have full tool-panel data wired up. Others show the "Coming soon" overlay.
const FULLY_SUPPORTED = new Set(["nightshift-default"]);

export function isStackFullySupported(stackId: string = getActiveStackId()): boolean {
  return FULLY_SUPPORTED.has(stackId);
}
