export interface ParsedBankTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

export interface BankParseResult {
  transactions: ParsedBankTransaction[];
  detectedFormat: string;
  skippedRows: number;
}

type Row = Record<string, unknown>;

const DATE_KEYS = ["fecha", "date", "f operacion", "f valor", "fecha operacion", "fecha valor", "data"];
const DESCRIPTION_KEYS = ["concepto", "descripcion", "descripción", "movimiento", "detalle", "comercio", "beneficiario", "ordenante", "observaciones", "description"];
const AMOUNT_KEYS = ["importe", "cantidad", "amount", "valor", "euros", "total", "importe eur"];
const DEBIT_KEYS = ["cargo", "debe", "debito", "débito", "retirada", "withdrawal"];
const CREDIT_KEYS = ["abono", "haber", "credito", "crédito", "ingreso", "deposit"];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const findKey = (keys: string[], candidates: string[]) => {
  const normalizedCandidates = candidates.map(normalize);
  return keys.find((key) => {
    const normalizedKey = normalize(key);
    return normalizedCandidates.some((candidate) => normalizedKey === candidate || normalizedKey.includes(candidate));
  });
};

export const createBankTransactionKey = (transaction: Pick<ParsedBankTransaction, "date" | "description" | "amount"> & { account?: string }) =>
  [
    transaction.account ?? "",
    transaction.date,
    Math.round(transaction.amount * 100),
    normalize(transaction.description),
  ].join("|");

export const parseCurrencyAmount = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const negative = raw.includes("-") || /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/^-/, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const normalized = cleaned
    .replace(new RegExp(`\\${decimalSeparator === "," ? "." : ","}`, "g"), "")
    .replace(decimalSeparator, ".");
  const amount = Number.parseFloat(normalized);

  if (!Number.isFinite(amount)) return null;
  return negative ? -Math.abs(amount) : amount;
};

const parseExcelSerialDate = (value: number) => {
  const date = new Date(Math.round((value - 25569) * 86400 * 1000));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

export const formatBankDate = (value: unknown, fallbackMonth: string): string => {
  if (typeof value === "number") return parseExcelSerialDate(value) ?? `${fallbackMonth}-01`;
  const raw = String(value ?? "").trim();
  if (!raw) return `${fallbackMonth}-01`;

  const isoMatch = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;

  const europeanMatch = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (europeanMatch) {
    const year = europeanMatch[3].length === 2 ? `20${europeanMatch[3]}` : europeanMatch[3];
    return `${year}-${europeanMatch[2].padStart(2, "0")}-${europeanMatch[1].padStart(2, "0")}`;
  }

  return `${fallbackMonth}-01`;
};

export const parseCsvRows = (text: string): Row[] => {
  const delimiter = (text.match(/;/g)?.length ?? 0) > (text.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = text.split(/\r?\n/).filter((line) => line.trim());
  if (rows.length < 2) return [];

  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) {
        cells.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else current += char;
    }
    cells.push(current.trim().replace(/^"|"$/g, ""));
    return cells;
  };

  const headers = parseLine(rows[0]);
  return rows.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce<Row>((acc, header, index) => {
      acc[header || `Columna ${index + 1}`] = values[index] ?? "";
      return acc;
    }, {});
  });
};

export const parseBankRows = (rows: Row[], fallbackMonth: string): BankParseResult => {
  const transactions: ParsedBankTransaction[] = [];
  let skippedRows = 0;
  const keys = Object.keys(rows[0] ?? {});
  const dateKey = findKey(keys, DATE_KEYS);
  const descriptionKey = findKey(keys, DESCRIPTION_KEYS);
  const amountKey = findKey(keys, AMOUNT_KEYS);
  const debitKey = findKey(keys, DEBIT_KEYS);
  const creditKey = findKey(keys, CREDIT_KEYS);

  rows.forEach((row) => {
    const rowKeys = Object.keys(row);
    const date = formatBankDate(dateKey ? row[dateKey] : row[rowKeys[0]], fallbackMonth);
    const description = String(descriptionKey ? row[descriptionKey] : row[rowKeys[1]] ?? "").trim();
    const directAmount = amountKey ? parseCurrencyAmount(row[amountKey]) : null;
    const debit = debitKey ? parseCurrencyAmount(row[debitKey]) : null;
    const credit = creditKey ? parseCurrencyAmount(row[creditKey]) : null;
    const fallbackAmount = !amountKey && !debitKey && !creditKey ? parseCurrencyAmount(row[rowKeys[2]]) : null;
    const amount = directAmount ?? (credit !== null ? Math.abs(credit) : debit !== null ? -Math.abs(debit) : fallbackAmount);

    if (!description || amount === null || amount === 0) {
      skippedRows++;
      return;
    }

    transactions.push({
      date,
      description,
      amount: Math.abs(amount),
      type: amount >= 0 ? "income" : "expense",
    });
  });

  return {
    transactions,
    skippedRows,
    detectedFormat: [dateKey, descriptionKey, amountKey ?? `${debitKey ?? ""}/${creditKey ?? ""}`]
      .filter(Boolean)
      .join(" · ") || "Formato genérico",
  };
};