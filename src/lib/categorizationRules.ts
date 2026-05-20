import type { Transaction } from "@/contexts/FinancesContext";

export type RuleMatchType = "starts_with" | "contains" | "equals" | "ends_with";
export type RuleCategory = Exclude<Transaction["category"], "income">;

export interface CategorizationRule {
  id: string;
  pattern: string;
  matchType: RuleMatchType;
  category: RuleCategory;
}

const STORAGE_KEY = "bank-categorization-rules";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const loadCategorizationRules = (): CategorizationRule[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveCategorizationRules = (rules: CategorizationRule[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
};

export const matchesRule = (description: string, rule: CategorizationRule): boolean => {
  const text = normalize(description);
  const pattern = normalize(rule.pattern);
  if (!pattern) return false;
  switch (rule.matchType) {
    case "starts_with":
      return text.startsWith(pattern);
    case "ends_with":
      return text.endsWith(pattern);
    case "equals":
      return text === pattern;
    case "contains":
    default:
      return text.includes(pattern);
  }
};

export const categorizeDescription = (
  description: string,
  rules: CategorizationRule[],
  fallback: RuleCategory = "daily"
): RuleCategory => {
  for (const rule of rules) {
    if (matchesRule(description, rule)) return rule.category;
  }
  return fallback;
};

export const MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  starts_with: "Comienza por",
  contains: "Contiene",
  ends_with: "Termina por",
  equals: "Es igual a",
};

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  fixed: "Fijo",
  periodic: "Periódico",
  extra: "Extra",
  daily: "Diario",
};
