import type { Env } from "../../types/env";
import type { ResearchProvider } from "./provider";
import { BraveResearchProvider } from "./braveProvider";
import { MockResearchProvider } from "./mockResearchProvider";

const mockSingleton = new MockResearchProvider();

export function getResearchProvider(env: Env): ResearchProvider {
  if (env.BRAVE_SEARCH_API_KEY) return new BraveResearchProvider(env.BRAVE_SEARCH_API_KEY);
  return mockSingleton;
}

export * from "./provider";

/**
 * Cheap keyword heuristic for "would current information improve this
 * plan?" — avoids spending an AI call just to decide whether to research.
 * Intentionally conservative: most everyday tasks (call Marco, clean the
 * garage) should never trigger a search.
 */
const RESEARCH_TRIGGER_WORDS = [
  "exhibit",
  "trade show",
  "conference",
  "expo",
  "visa",
  "passport",
  "entry requirement",
  "customs",
  "regulation",
  "compliance",
  "deadline",
  "permit",
  "license",
  "licence",
  "requirements",
  "policy",
  "rules",
  "amazon",
  "app store",
  "play store",
  "import",
  "export",
  "insurance",
  "booking window",
  "eicma",
  "ces ",
];

export function shouldResearch(text: string): boolean {
  const t = text.toLowerCase();
  return RESEARCH_TRIGGER_WORDS.some((w) => t.includes(w));
}
