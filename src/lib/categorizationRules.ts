import type { Transaction } from "@/contexts/FinancesContext";

export type RuleMatchType = "starts_with" | "contains" | "equals" | "ends_with";
export type RuleCategory = Exclude<Transaction["category"], "income">;
export type RuleOperator = "AND" | "OR";

export interface RuleCondition {
  pattern: string;
  matchType: RuleMatchType;
}

export interface CategorizationRule {
  id: string;
  pattern: string;
  matchType: RuleMatchType;
  category: RuleCategory;
  // Optional second condition for concatenation
  operator?: RuleOperator;
  pattern2?: string;
  matchType2?: RuleMatchType;
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

const matchesCondition = (
  text: string,
  pattern: string,
  matchType: RuleMatchType
): boolean => {
  const p = normalize(pattern);
  if (!p) return false;
  switch (matchType) {
    case "starts_with":
      return text.startsWith(p);
    case "ends_with":
      return text.endsWith(p);
    case "equals":
      return text === p;
    case "contains":
    default:
      return text.includes(p);
  }
};

export const matchesRule = (description: string, rule: CategorizationRule): boolean => {
  const text = normalize(description);
  const first = matchesCondition(text, rule.pattern, rule.matchType);
  if (!rule.operator || !rule.pattern2 || !rule.matchType2) {
    return first;
  }
  const second = matchesCondition(text, rule.pattern2, rule.matchType2);
  return rule.operator === "AND" ? first && second : first || second;
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
