/**
 * Bangladesh Income Tax Act 2023 — Tax Year 2026–27 individual slabs.
 * Amounts in BDT (Taka). "Lac" = 100,000.
 *
 * Ordinary resident free threshold: Tk 375,000 (TY 2026–27).
 * Other categories keep the same extras over the general base.
 */

export type TaxpayerCategory =
  | "general"
  | "woman_or_senior"
  | "third_gender_or_disabled"
  | "freedom_fighter";

export const TAX_FREE_LIMIT: Record<TaxpayerCategory, number> = {
  general: 375_000,
  woman_or_senior: 425_000,
  third_gender_or_disabled: 500_000,
  freedom_fighter: 525_000,
};

/** Progressive bands after the tax-free allowance. */
export const TAX_SLABS_AFTER_FREE = [
  { upTo: 300_000, rate: 0.1 },
  { upTo: 400_000, rate: 0.15 },
  { upTo: 500_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
] as const;

export const MINIMUM_TAX = 5_000;
export const MINIMUM_TAX_NEW_TAXPAYER = 1_000;
export const DISABLED_DEPENDENT_EXTRA = 50_000;

export type TaxBracketLine = {
  label: string;
  amount: number;
  rate: number;
  tax: number;
};

export type TaxResult = {
  annualIncome: number;
  exemptIncome: number;
  deductions: number;
  /** Income after exempt + deductions (before free slab). */
  assessableIncome: number;
  grossPay: number;
  netPay: number;
  monthlyGross: number;
  monthlyTax: number;
  monthlyNet: number;
  taxFreeLimit: number;
  taxableIncome: number;
  brackets: TaxBracketLine[];
  /** Tax from progressive slabs only. */
  grossTax: number;
  /** After minimum-tax floor. */
  taxAfterMin: number;
  investmentRebate: number;
  taxAfterRebate: number;
  surcharge: number;
  surchargeRate: number;
  tds: number;
  /** Final amount still payable (negative = refund/credit). */
  taxPayable: number;
  minimumTax: number;
  effectiveRate: number;
  category: TaxpayerCategory;
  disabledDependents: number;
};

export function formatBdt(n: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/** Format like 10,00,000 (Indian/Bangladesh grouping). */
export function formatLac(n: number) {
  const rounded = Math.round(n);
  const s = Math.abs(rounded).toString();
  if (s.length <= 3) return (rounded < 0 ? "-" : "") + s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${rounded < 0 ? "-" : ""}${parts.join(",")},${last3}`;
}

export function calculateBdTax(input: {
  annualIncome: number;
  category?: TaxpayerCategory;
  disabledDependents?: number;
  isNewTaxpayer?: boolean;
  /** Tax-exempt income (excluded from assessable). */
  exemptIncome?: number;
  /** Permitted deductions (excluded from assessable). */
  deductions?: number;
  /** Eligible investment tax rebate amount. */
  investmentRebate?: number;
  /** Tax already deducted at source. */
  tds?: number;
  /** Surcharge as % of tax after rebate (e.g. 10 = 10%). */
  surchargeRate?: number;
  /** Or flat surcharge amount (takes precedence if both set > 0). */
  surchargeAmount?: number;
}): TaxResult {
  const category = input.category ?? "general";
  const dependents = Math.max(0, input.disabledDependents ?? 0);
  const annualIncome = Math.max(0, input.annualIncome);
  const exemptIncome = Math.max(0, input.exemptIncome ?? 0);
  const deductions = Math.max(0, input.deductions ?? 0);
  const investmentRebate = Math.max(0, input.investmentRebate ?? 0);
  const tds = Math.max(0, input.tds ?? 0);
  const surchargeRate = Math.max(0, input.surchargeRate ?? 0);

  const assessableIncome = Math.max(
    0,
    annualIncome - exemptIncome - deductions
  );

  const freeLimitBase =
    TAX_FREE_LIMIT[category] + dependents * DISABLED_DEPENDENT_EXTRA;

  const taxFree = Math.min(freeLimitBase, assessableIncome);
  const taxableIncome = Math.max(0, assessableIncome - taxFree);

  const brackets: TaxBracketLine[] = [];
  if (taxFree > 0) {
    brackets.push({
      label: `First ${formatLac(taxFree)} (tax-free)`,
      amount: taxFree,
      rate: 0,
      tax: 0,
    });
  }

  let remaining = taxableIncome;
  let grossTax = 0;

  for (const slab of TAX_SLABS_AFTER_FREE) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, slab.upTo);
    const tax = slice * slab.rate;
    const pct = Math.round(slab.rate * 100);
    brackets.push({
      label:
        slab.upTo === Infinity
          ? `Remaining @ ${pct}%`
          : `Next ${formatLac(slab.upTo)} @ ${pct}%`,
      amount: slice,
      rate: slab.rate,
      tax,
    });
    grossTax += tax;
    remaining -= slice;
  }

  const minimumTax = input.isNewTaxpayer
    ? MINIMUM_TAX_NEW_TAXPAYER
    : MINIMUM_TAX;

  const exceedsFree = assessableIncome > freeLimitBase;
  const taxAfterMin =
    exceedsFree && taxableIncome > 0
      ? Math.max(grossTax, minimumTax)
      : 0;

  const taxAfterRebate = Math.max(0, taxAfterMin - investmentRebate);

  const surchargeFromRate =
    surchargeRate > 0 ? (taxAfterRebate * surchargeRate) / 100 : 0;
  const surcharge =
    (input.surchargeAmount ?? 0) > 0
      ? Math.max(0, input.surchargeAmount ?? 0)
      : surchargeFromRate;

  const taxWithSurcharge = taxAfterRebate + surcharge;
  const taxPayable = taxWithSurcharge - tds;

  const taxRounded = Math.round(taxPayable);
  const grossPay = Math.round(annualIncome);
  // Net = income after final tax liability (TDS already paid is part of tax, not extra)
  const netPay = Math.round(grossPay - Math.round(taxWithSurcharge));

  return {
    annualIncome,
    exemptIncome: Math.round(exemptIncome),
    deductions: Math.round(deductions),
    assessableIncome: Math.round(assessableIncome),
    grossPay,
    netPay,
    monthlyGross: Math.round(grossPay / 12),
    monthlyTax: Math.round(Math.round(taxWithSurcharge) / 12),
    monthlyNet: Math.round(netPay / 12),
    taxFreeLimit: freeLimitBase,
    taxableIncome: Math.round(taxableIncome),
    brackets,
    grossTax: Math.round(grossTax),
    taxAfterMin: Math.round(taxAfterMin),
    investmentRebate: Math.round(investmentRebate),
    taxAfterRebate: Math.round(taxAfterRebate),
    surcharge: Math.round(surcharge),
    surchargeRate,
    tds: Math.round(tds),
    taxPayable: taxRounded,
    minimumTax,
    effectiveRate:
      annualIncome > 0 ? Math.round(taxWithSurcharge) / annualIncome : 0,
    category,
    disabledDependents: dependents,
  };
}
