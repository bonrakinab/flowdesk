"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Plus,
  Trash2,
  Calculator,
  CalendarRange,
} from "lucide-react";
import { Badge, Button, Input, Label, PageHeader, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  calculateBdTax,
  formatLac,
  type TaxResult,
  type TaxpayerCategory,
} from "@/lib/bd-tax";

type Scope = "personal" | "family" | "all";
type Tab = "overview" | "cashflow" | "savings" | "tax" | "months" | "budgets";

type FinanceEntry = {
  id: string;
  kind: "income" | "expense";
  title: string;
  amount: number;
  category: string;
  scope: string;
  occurredAt: string;
  note: string | null;
  user: { id: string; name: string | null; color: string };
};

type SavingsGoal = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  scope: string;
  deadline: string | null;
  note: string | null;
  user: { id: string; name: string | null; color: string };
};

type FinanceMonth = {
  id: string;
  yearMonth: string;
  scope: string;
  grossPay: number;
  tax: number;
  netPay: number;
  income: number;
  expense: number;
  saved: number;
  taxCategory: string;
  note: string | null;
  user: { id: string; name: string | null; color: string };
};

type BudgetRow = {
  id: string;
  category: string;
  limitAmount: number;
  scope: string;
  spent: number;
  remaining: number;
  over: boolean;
  progress: number;
};

const CATEGORIES: TaxpayerCategory[] = [
  "general",
  "woman_or_senior",
  "third_gender_or_disabled",
  "freedom_fighter",
];

const CATEGORY_LABELS: Record<TaxpayerCategory, string> = {
  general: "General individual (৳3,75,000 free)",
  woman_or_senior: "Woman / senior 65+ (৳4,25,000 free)",
  third_gender_or_disabled: "Third gender / disabled (৳5,00,000 free)",
  freedom_fighter: "Gazetted war-wounded FF (৳5,25,000 free)",
};

function money(n: number) {
  return `৳${formatLac(n)}`;
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelYearMonth(ym: string) {
  try {
    const [y, m] = ym.split("-").map(Number);
    return format(new Date(y, m - 1, 1), "MMMM yyyy");
  } catch {
    return ym;
  }
}

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [scope, setScope] = useState<Scope>("all");
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [summary, setSummary] = useState({
    income: 0,
    expense: 0,
    net: 0,
    savingsRate: 0,
  });
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [savingsSummary, setSavingsSummary] = useState({
    totalTarget: 0,
    totalCurrent: 0,
    remaining: 0,
    progress: 0,
  });
  const [months, setMonths] = useState<FinanceMonth[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [budgetForm, setBudgetForm] = useState({
    category: "food",
    limitAmount: "",
    scope: "personal" as "personal" | "family",
  });
  const [saveMonthKey, setSaveMonthKey] = useState(currentYearMonth());
  const [saveMonthScope, setSaveMonthScope] = useState<"personal" | "family">(
    "personal"
  );
  const [saveGrossOverride, setSaveGrossOverride] = useState("");
  const [savingMonth, setSavingMonth] = useState(false);

  const [entryForm, setEntryForm] = useState({
    kind: "income" as "income" | "expense",
    title: "",
    amount: "",
    category: "salary",
    scope: "personal" as "personal" | "family",
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  const [goalForm, setGoalForm] = useState({
    title: "",
    targetAmount: "",
    currentAmount: "",
    scope: "personal" as "personal" | "family",
  });

  const [taxIncome, setTaxIncome] = useState("1000000");
  const [taxCategory, setTaxCategory] =
    useState<TaxpayerCategory>("general");
  const [disabledDependents, setDisabledDependents] = useState("0");
  const [isNewTaxpayer, setIsNewTaxpayer] = useState(false);
  const [exemptIncome, setExemptIncome] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [investmentRebate, setInvestmentRebate] = useState("0");
  const [tds, setTds] = useState("0");
  const [surchargeRate, setSurchargeRate] = useState("0");
  const [taxResult, setTaxResult] = useState<TaxResult | null>(null);

  const loadFinance = useCallback(async () => {
    const res = await fetch(`/api/finance?scope=${scope}`);
    if (!res.ok) return;
    const data = await res.json();
    setEntries(data.entries);
    setSummary(data.summary);
  }, [scope]);

  const loadSavings = useCallback(async () => {
    const res = await fetch(`/api/finance/savings?scope=${scope}`);
    if (!res.ok) return;
    const data = await res.json();
    setGoals(data.goals);
    setSavingsSummary(data.summary);
  }, [scope]);

  const loadMonths = useCallback(async () => {
    const res = await fetch(`/api/finance/months?scope=${scope}`);
    if (!res.ok) return;
    const data = await res.json();
    setMonths(data.months);
  }, [scope]);

  const loadBudgets = useCallback(async () => {
    const res = await fetch(`/api/finance/budgets?scope=${scope}`);
    if (!res.ok) return;
    const data = await res.json();
    setBudgets(data.budgets);
  }, [scope]);

  useEffect(() => {
    void loadFinance();
    void loadSavings();
    void loadMonths();
    void loadBudgets();
  }, [loadFinance, loadSavings, loadMonths, loadBudgets]);

  useEffect(() => {
    const income = Number(taxIncome) || 0;
    setTaxResult(
      calculateBdTax({
        annualIncome: income,
        category: taxCategory,
        disabledDependents: Number(disabledDependents) || 0,
        isNewTaxpayer,
        exemptIncome: Number(exemptIncome) || 0,
        deductions: Number(deductions) || 0,
        investmentRebate: Number(investmentRebate) || 0,
        tds: Number(tds) || 0,
        surchargeRate: Number(surchargeRate) || 0,
      })
    );
  }, [
    taxIncome,
    taxCategory,
    disabledDependents,
    isNewTaxpayer,
    exemptIncome,
    deductions,
    investmentRebate,
    tds,
    surchargeRate,
  ]);

  const annualFromEntries = useMemo(() => {
    return entries
      .filter((e) => e.kind === "income")
      .reduce((s, e) => s + e.amount, 0);
  }, [entries]);

  const payPreview = useMemo(
    () =>
      calculateBdTax({
        annualIncome: annualFromEntries,
        category: taxCategory,
      }),
    [annualFromEntries, taxCategory]
  );

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(entryForm.amount);
    if (!entryForm.title || !(amount > 0)) return;
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...entryForm,
        amount,
        occurredAt: new Date(entryForm.occurredAt).toISOString(),
      }),
    });
    if (res.ok) {
      setEntryForm((f) => ({ ...f, title: "", amount: "" }));
      await loadFinance();
    }
  }

  async function deleteEntry(id: string) {
    await fetch("/api/finance", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadFinance();
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const targetAmount = Number(goalForm.targetAmount);
    if (!goalForm.title || !(targetAmount > 0)) return;
    const res = await fetch("/api/finance/savings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: goalForm.title,
        targetAmount,
        currentAmount: Number(goalForm.currentAmount) || 0,
        scope: goalForm.scope,
      }),
    });
    if (res.ok) {
      setGoalForm({
        title: "",
        targetAmount: "",
        currentAmount: "",
        scope: "personal",
      });
      await loadSavings();
    }
  }

  async function contribute(id: string) {
    const raw = window.prompt("Add to savings (BDT)?", "5000");
    if (!raw) return;
    const addAmount = Number(raw);
    if (!(addAmount > 0)) return;
    await fetch("/api/finance/savings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, addAmount }),
    });
    await loadSavings();
  }

  async function deleteGoal(id: string) {
    await fetch("/api/finance/savings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadSavings();
  }

  async function saveMonth() {
    setSavingMonth(true);
    try {
      const body: Record<string, unknown> = {
        yearMonth: saveMonthKey,
        scope: saveMonthScope,
        taxCategory,
        fromEntries: true,
      };
      if (saveGrossOverride.trim()) {
        body.grossPay = Number(saveGrossOverride);
      }
      const res = await fetch("/api/finance/months", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaveGrossOverride("");
        await loadMonths();
      }
    } finally {
      setSavingMonth(false);
    }
  }

  async function deleteMonth(id: string) {
    await fetch("/api/finance/months", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadMonths();
  }

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    const limitAmount = Number(budgetForm.limitAmount);
    if (!(limitAmount > 0)) return;
    const res = await fetch("/api/finance/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: budgetForm.category,
        limitAmount,
        scope: budgetForm.scope,
      }),
    });
    if (res.ok) {
      setBudgetForm((f) => ({ ...f, limitAmount: "" }));
      await loadBudgets();
    }
  }

  async function deleteBudget(id: string) {
    await fetch("/api/finance/budgets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadBudgets();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "cashflow", label: "Income & spend" },
    { id: "budgets", label: "Budgets" },
    { id: "savings", label: "Savings" },
    { id: "tax", label: "Tax & pay" },
    { id: "months", label: "Months" },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="page-canvas mx-auto max-w-5xl">
      <PageHeader
        title="Finance"
        description="Cashflow, savings, pay, and BD income tax (TY 2026–27)"
        actions={
          <div className="flex rounded-xl border border-border bg-card p-1">
            {(
              [
                ["all", "All"],
                ["personal", "Personal"],
                ["family", "Family"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setScope(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  scope === id
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div className="page-tabs mt-2 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition",
              tab === t.id
                ? "border-accent text-accent font-medium"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Income"
              value={money(summary.income)}
              tone="good"
              icon={<ArrowDownLeft size={16} />}
            />
            <Stat
              label="Expenditure"
              value={money(summary.expense)}
              tone="warn"
              icon={<ArrowUpRight size={16} />}
            />
            <Stat
              label="Cash left"
              value={money(summary.net)}
              tone={summary.net >= 0 ? "good" : "warn"}
              icon={<PiggyBank size={16} />}
              hint={
                summary.income > 0
                  ? `${Math.round(summary.savingsRate * 100)}% of income`
                  : undefined
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Gross pay"
              value={money(payPreview.grossPay)}
              tone="good"
              icon={<ArrowDownLeft size={16} />}
              hint="Before tax (from logged income)"
            />
            <Stat
              label="Tax"
              value={money(payPreview.taxPayable)}
              tone="warn"
              icon={<Calculator size={16} />}
            />
            <Stat
              label="Net pay"
              value={money(payPreview.netPay)}
              tone="good"
              icon={<PiggyBank size={16} />}
              hint="After tax"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wider text-muted">
                Savings goals
              </div>
              <div className="mt-2 text-2xl font-[family-name:var(--font-display)]">
                {money(savingsSummary.totalCurrent)}
                <span className="text-base text-muted font-sans">
                  {" "}
                  / {money(savingsSummary.totalTarget)}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${Math.min(100, savingsSummary.progress * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted">
                  Saved months
                </div>
                <CalendarRange size={14} className="text-muted" />
              </div>
              <div className="mt-2 text-2xl font-[family-name:var(--font-display)]">
                {months.length}
              </div>
              <p className="text-sm text-muted mt-1">
                {months[0]
                  ? `Latest: ${labelYearMonth(months[0].yearMonth)} · net ${money(months[0].netPay)}`
                  : "No monthly snapshots yet"}
              </p>
              <Button
                variant="soft"
                size="sm"
                className="mt-3"
                onClick={() => setTab("months")}
              >
                Manage months
              </Button>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium mb-3">Recent activity</h2>
            <EntryList entries={entries.slice(0, 8)} onDelete={deleteEntry} />
          </div>
        </div>
      )}

      {tab === "cashflow" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <form
            onSubmit={addEntry}
            className="rounded-2xl border border-border bg-card p-5 space-y-3 h-fit"
          >
            <h2 className="font-medium flex items-center gap-2">
              <Plus size={16} /> Add entry
            </h2>
            <div className="flex gap-2">
              {(["income", "expense"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setEntryForm((f) => ({ ...f, kind: k }))}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-xs font-medium border transition",
                    entryForm.kind === k
                      ? k === "income"
                        ? "border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                        : "border-rose-600 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                      : "border-border text-muted"
                  )}
                >
                  {k === "income" ? "Income" : "Expense"}
                </button>
              ))}
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={entryForm.title}
                onChange={(e) =>
                  setEntryForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Salary, rent, groceries…"
              />
            </div>
            <div>
              <Label>Amount (BDT)</Label>
              <Input
                type="number"
                min={0}
                value={entryForm.amount}
                onChange={(e) =>
                  setEntryForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="50000"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Category</Label>
                <Select
                  value={entryForm.category}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  <option value="salary">Salary</option>
                  <option value="business">Business</option>
                  <option value="rent">Rent</option>
                  <option value="food">Food</option>
                  <option value="transport">Transport</option>
                  <option value="utilities">Utilities</option>
                  <option value="education">Education</option>
                  <option value="health">Health</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <Label>Scope</Label>
                <Select
                  value={entryForm.scope}
                  onChange={(e) =>
                    setEntryForm((f) => ({
                      ...f,
                      scope: e.target.value as "personal" | "family",
                    }))
                  }
                >
                  <option value="personal">Personal</option>
                  <option value="family">Family</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={entryForm.occurredAt}
                onChange={(e) =>
                  setEntryForm((f) => ({ ...f, occurredAt: e.target.value }))
                }
              />
            </div>
            <Button type="submit" className="w-full">
              Save
            </Button>
          </form>

          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <Badge>In {money(summary.income)}</Badge>
              <Badge>Out {money(summary.expense)}</Badge>
              <Badge>Left {money(summary.net)}</Badge>
            </div>
            <EntryList entries={entries} onDelete={deleteEntry} />
          </div>
        </div>
      )}

      {tab === "budgets" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <form
            onSubmit={saveBudget}
            className="rounded-2xl border border-border bg-card p-5 space-y-3 h-fit"
          >
            <h2 className="font-medium">Set category budget</h2>
            <p className="text-xs text-muted">
              Monthly cap vs this month&apos;s expenses in that category.
            </p>
            <div>
              <Label>Category</Label>
              <Select
                value={budgetForm.category}
                onChange={(e) =>
                  setBudgetForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                <option value="food">Food</option>
                <option value="rent">Rent</option>
                <option value="transport">Transport</option>
                <option value="utilities">Utilities</option>
                <option value="education">Education</option>
                <option value="health">Health</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <Label>Limit (BDT / month)</Label>
              <Input
                type="number"
                min={0}
                value={budgetForm.limitAmount}
                onChange={(e) =>
                  setBudgetForm((f) => ({ ...f, limitAmount: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Scope</Label>
              <Select
                value={budgetForm.scope}
                onChange={(e) =>
                  setBudgetForm((f) => ({
                    ...f,
                    scope: e.target.value as "personal" | "family",
                  }))
                }
              >
                <option value="personal">Personal</option>
                <option value="family">Family</option>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              Save budget
            </Button>
          </form>

          <div className="space-y-3">
            {budgets.length === 0 && (
              <p className="text-sm text-muted">No budgets yet.</p>
            )}
            {budgets.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium capitalize">{b.category}</div>
                    <div className="text-xs text-muted">{b.scope}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteBudget(b.id)}
                    className="text-muted hover:text-danger p-1"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2 text-sm tabular-nums">
                  {money(b.spent)}{" "}
                  <span className="text-muted">/ {money(b.limitAmount)}</span>
                  {b.over && (
                    <span className="ml-2 text-rose-600 text-xs font-medium">
                      Over by {money(Math.abs(b.remaining))}
                    </span>
                  )}
                </div>
                <div className="mt-2 h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      b.over ? "bg-rose-500" : "bg-accent"
                    )}
                    style={{ width: `${Math.min(100, b.progress * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "savings" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <form
            onSubmit={addGoal}
            className="rounded-2xl border border-border bg-card p-5 space-y-3 h-fit"
          >
            <h2 className="font-medium flex items-center gap-2">
              <PiggyBank size={16} /> New goal
            </h2>
            <div>
              <Label>Name</Label>
              <Input
                value={goalForm.title}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Emergency fund"
              />
            </div>
            <div>
              <Label>Target (BDT)</Label>
              <Input
                type="number"
                min={0}
                value={goalForm.targetAmount}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, targetAmount: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Already saved</Label>
              <Input
                type="number"
                min={0}
                value={goalForm.currentAmount}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, currentAmount: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Scope</Label>
              <Select
                value={goalForm.scope}
                onChange={(e) =>
                  setGoalForm((f) => ({
                    ...f,
                    scope: e.target.value as "personal" | "family",
                  }))
                }
              >
                <option value="personal">Personal</option>
                <option value="family">Family</option>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              Create goal
            </Button>
          </form>

          <div className="space-y-3">
            {goals.length === 0 && (
              <p className="text-sm text-muted">No savings goals yet.</p>
            )}
            {goals.map((g) => {
              const pct =
                g.targetAmount > 0
                  ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
                  : 0;
              return (
                <div
                  key={g.id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{g.title}</div>
                      <div className="text-xs text-muted mt-0.5">
                        {g.scope} · {g.user.name || "You"}
                        {g.deadline
                          ? ` · by ${format(parseISO(g.deadline), "MMM d, yyyy")}`
                          : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteGoal(g.id)}
                      className="text-muted hover:text-danger p-1"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-3 text-sm">
                    {money(g.currentAmount)}{" "}
                    <span className="text-muted">/ {money(g.targetAmount)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <Button
                    variant="soft"
                    size="sm"
                    className="mt-3"
                    onClick={() => contribute(g.id)}
                  >
                    Add contribution
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "tax" && taxResult && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 h-fit">
            <h2 className="font-medium flex items-center gap-2">
              <Calculator size={16} /> Income tax & pay
            </h2>
            <p className="text-xs text-muted">
              Progressive slabs · TY 2026–27 · free threshold ৳3,75,000
              (general).
            </p>
            <div>
              <Label>Total annual income (BDT)</Label>
              <Input
                type="number"
                min={0}
                value={taxIncome}
                onChange={(e) => setTaxIncome(e.target.value)}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[500_000, 960_000, 1_000_000, 1_500_000, 2_500_000].map(
                  (n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTaxIncome(String(n))}
                      className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted hover:border-accent hover:text-accent"
                    >
                      {n / 100_000} lac
                    </button>
                  )
                )}
              </div>
            </div>
            <div>
              <Label>Exempt income</Label>
              <Input
                type="number"
                min={0}
                value={exemptIncome}
                onChange={(e) => setExemptIncome(e.target.value)}
              />
            </div>
            <div>
              <Label>Permitted deductions</Label>
              <Input
                type="number"
                min={0}
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
              />
            </div>
            <div>
              <Label>Taxpayer category</Label>
              <Select
                value={taxCategory}
                onChange={(e) =>
                  setTaxCategory(e.target.value as TaxpayerCategory)
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Disabled dependents (+৳50,000 each)</Label>
              <Input
                type="number"
                min={0}
                value={disabledDependents}
                onChange={(e) => setDisabledDependents(e.target.value)}
              />
            </div>
            <div>
              <Label>Investment tax rebate</Label>
              <Input
                type="number"
                min={0}
                value={investmentRebate}
                onChange={(e) => setInvestmentRebate(e.target.value)}
              />
            </div>
            <div>
              <Label>Tax deducted at source (TDS)</Label>
              <Input
                type="number"
                min={0}
                value={tds}
                onChange={(e) => setTds(e.target.value)}
              />
            </div>
            <div>
              <Label>Surcharge (% of tax after rebate)</Label>
              <Input
                type="number"
                min={0}
                value={surchargeRate}
                onChange={(e) => setSurchargeRate(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isNewTaxpayer}
                onChange={(e) => setIsNewTaxpayer(e.target.checked)}
                className="rounded border-border"
              />
              New taxpayer (min tax ৳1,000 instead of ৳5,000)
            </label>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  Gross pay
                </div>
                <div className="mt-1 text-xl font-[family-name:var(--font-display)]">
                  {money(taxResult.grossPay)}
                </div>
                <div className="text-xs text-muted mt-1">
                  {money(taxResult.monthlyGross)} / mo
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  {taxResult.taxPayable < 0 ? "Refund / credit" : "Still payable"}
                </div>
                <div className="mt-1 text-xl font-[family-name:var(--font-display)] text-rose-700 dark:text-rose-300">
                  {money(Math.abs(taxResult.taxPayable))}
                </div>
                <div className="text-xs text-muted mt-1">
                  Tax after rebate/surcharge {money(taxResult.taxAfterRebate + taxResult.surcharge)} · TDS{" "}
                  {money(taxResult.tds)}
                </div>
              </div>
              <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  Net pay
                </div>
                <div className="mt-1 text-xl font-[family-name:var(--font-display)] text-accent">
                  {money(taxResult.netPay)}
                </div>
                <div className="text-xs text-muted mt-1">
                  {money(taxResult.monthlyNet)} / mo
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted space-y-1">
              <div className="flex justify-between gap-2">
                <span>Assessable (income − exempt − deductions)</span>
                <span className="tabular-nums text-foreground">
                  {money(taxResult.assessableIncome)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Slab tax</span>
                <span className="tabular-nums text-foreground">
                  {money(taxResult.grossTax)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>After minimum tax</span>
                <span className="tabular-nums text-foreground">
                  {money(taxResult.taxAfterMin)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>− Investment rebate</span>
                <span className="tabular-nums text-foreground">
                  {money(taxResult.investmentRebate)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>+ Surcharge</span>
                <span className="tabular-nums text-foreground">
                  {money(taxResult.surcharge)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>− TDS</span>
                <span className="tabular-nums text-foreground">
                  {money(taxResult.tds)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">Slab</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium text-right">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {taxResult.brackets.map((b, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-2.5">{b.label}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {money(b.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {money(b.tax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-50 dark:bg-white/5 font-medium">
                    <td className="px-4 py-3">Gross → net</td>
                    <td className="px-4 py-3 text-right">
                      {money(taxResult.grossPay)}
                    </td>
                    <td className="px-4 py-3 text-right text-accent">
                      {money(taxResult.netPay)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Example: 10 lac taxable → tax ৳78,750 → net ৳9,21,250
              {Number(taxIncome) === 1_000_000 &&
              taxCategory === "general" &&
              Number(disabledDependents) === 0 &&
              Number(exemptIncome) === 0 &&
              Number(deductions) === 0 &&
              Number(investmentRebate) === 0 &&
              Number(tds) === 0 &&
              Number(surchargeRate) === 0
                ? taxResult.taxAfterMin === 78_750 &&
                  taxResult.netPay === 921_250
                  ? " ✓"
                  : " (mismatch — check slabs)"
                : "."}
            </p>
          </div>
        </div>
      )}

      {tab === "months" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 h-fit">
            <h2 className="font-medium flex items-center gap-2">
              <CalendarRange size={16} /> Save month
            </h2>
            <p className="text-xs text-muted">
              Uses that month&apos;s entries; tax from annualized gross.
            </p>
            <div>
              <Label>Month</Label>
              <Input
                type="month"
                value={saveMonthKey}
                onChange={(e) => setSaveMonthKey(e.target.value)}
              />
            </div>
            <div>
              <Label>Scope</Label>
              <Select
                value={saveMonthScope}
                onChange={(e) =>
                  setSaveMonthScope(e.target.value as "personal" | "family")
                }
              >
                <option value="personal">Personal</option>
                <option value="family">Family</option>
              </Select>
            </div>
            <div>
              <Label>Gross pay override (optional)</Label>
              <Input
                type="number"
                min={0}
                value={saveGrossOverride}
                onChange={(e) => setSaveGrossOverride(e.target.value)}
                placeholder="Defaults to month income"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => void saveMonth()}
              disabled={savingMonth}
            >
              {savingMonth ? "Saving…" : "Save / update month"}
            </Button>
          </div>

          <div className="space-y-3">
            {months.length === 0 && (
              <p className="text-sm text-muted">
                No months saved yet. Log income for a month, then save it here.
              </p>
            )}
            {months.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{labelYearMonth(m.yearMonth)}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {m.scope} · {m.user.name || "You"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMonth(m.id)}
                    className="text-muted hover:text-danger p-1"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[10px] uppercase text-muted">Gross</div>
                    <div className="tabular-nums font-medium">
                      {money(m.grossPay)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted">Tax</div>
                    <div className="tabular-nums font-medium text-rose-700 dark:text-rose-300">
                      {money(m.tax)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted">Net</div>
                    <div className="tabular-nums font-medium text-accent">
                      {money(m.netPay)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted">
                  Income {money(m.income)} · Spend {money(m.expense)} · Left{" "}
                  {money(m.saved)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string;
  value: string;
  tone: "good" | "warn";
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted">
        {label}
        <span
          className={cn(
            "rounded-md p-1",
            tone === "good"
              ? "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-[family-name:var(--font-display)] tabular-nums">
        {value}
      </div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

function EntryList({
  entries,
  onDelete,
}: {
  entries: FinanceEntry[];
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted">No entries yet for this view.</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
        >
          <div
            className={cn(
              "h-9 w-9 rounded-lg grid place-items-center shrink-0",
              e.kind === "income"
                ? "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            )}
          >
            {e.kind === "income" ? (
              <ArrowDownLeft size={16} />
            ) : (
              <ArrowUpRight size={16} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{e.title}</div>
            <div className="text-xs text-muted">
              {e.category} · {e.scope} ·{" "}
              {format(parseISO(e.occurredAt), "MMM d, yyyy")}
              {e.user.name ? ` · ${e.user.name}` : ""}
            </div>
          </div>
          <div
            className={cn(
              "tabular-nums text-sm font-medium shrink-0",
              e.kind === "income" ? "text-teal-700 dark:text-teal-300" : ""
            )}
          >
            {e.kind === "income" ? "+" : "−"}
            {money(e.amount)}
          </div>
          <button
            type="button"
            onClick={() => onDelete(e.id)}
            className="text-muted hover:text-danger p-1 shrink-0"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
