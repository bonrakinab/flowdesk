/**
 * Bangladesh government public holidays (Ministry of Public Administration).
 * 2026 list from the Nov 2025 gazette / press coverage (Daily Star, etc.).
 * Moon-sighting dates (Eid, Shab-e-*, Ashura, Milad) may shift by ±1 day.
 */

export type BdHoliday = {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  kind: "general" | "executive";
};

const BD_HOLIDAYS_2026: BdHoliday[] = [
  { date: "2026-02-04", name: "Shab-e-Barat", kind: "executive" },
  {
    date: "2026-02-21",
    name: "Shaheed Day / International Mother Language Day",
    kind: "general",
  },
  { date: "2026-03-17", name: "Shab-e-Qadr", kind: "executive" },
  { date: "2026-03-19", name: "Eid-ul-Fitr holiday", kind: "executive" },
  { date: "2026-03-20", name: "Jumatul Bida / Eid holiday", kind: "general" },
  { date: "2026-03-21", name: "Eid-ul-Fitr", kind: "general" },
  { date: "2026-03-22", name: "Eid-ul-Fitr holiday", kind: "executive" },
  { date: "2026-03-23", name: "Eid-ul-Fitr holiday", kind: "executive" },
  {
    date: "2026-03-26",
    name: "Independence & National Day",
    kind: "general",
  },
  { date: "2026-04-14", name: "Pahela Baishakh (Bengali New Year)", kind: "executive" },
  {
    date: "2026-05-01",
    name: "May Day / Buddha Purnima",
    kind: "general",
  },
  { date: "2026-05-26", name: "Eid-ul-Azha holiday", kind: "executive" },
  { date: "2026-05-27", name: "Eid-ul-Azha holiday", kind: "executive" },
  { date: "2026-05-28", name: "Eid-ul-Azha", kind: "general" },
  { date: "2026-05-29", name: "Eid-ul-Azha holiday", kind: "executive" },
  { date: "2026-05-30", name: "Eid-ul-Azha holiday", kind: "executive" },
  { date: "2026-05-31", name: "Eid-ul-Azha holiday", kind: "executive" },
  { date: "2026-06-26", name: "Ashura", kind: "executive" },
  { date: "2026-08-05", name: "July Mass Uprising Day", kind: "general" },
  { date: "2026-08-26", name: "Eid-e-Miladunnabi", kind: "general" },
  { date: "2026-09-04", name: "Janmashtami", kind: "general" },
  {
    date: "2026-10-20",
    name: "Durga Puja (Mahanabami)",
    kind: "executive",
  },
  {
    date: "2026-10-21",
    name: "Durga Puja (Bijoya Dashami)",
    kind: "general",
  },
  { date: "2026-12-16", name: "Victory Day", kind: "general" },
  { date: "2026-12-25", name: "Christmas Day", kind: "general" },
];

const BY_YEAR: Record<number, BdHoliday[]> = {
  2026: BD_HOLIDAYS_2026,
};

export function holidaysForYear(year: number): BdHoliday[] {
  return BY_YEAR[year] ?? [];
}

/** Holidays overlapping [from, to] (inclusive calendar days). */
export function holidaysInRange(from: Date, to: Date): BdHoliday[] {
  const out: BdHoliday[] = [];
  const y0 = from.getFullYear();
  const y1 = to.getFullYear();
  for (let y = y0; y <= y1; y++) {
    for (const h of holidaysForYear(y)) {
      const [Y, M, D] = h.date.split("-").map(Number);
      const d = new Date(Y, M - 1, D);
      if (d >= startOfLocalDay(from) && d <= endOfLocalDay(to)) out.push(h);
    }
  }
  return out;
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function holidayDateLocal(h: BdHoliday): Date {
  const [Y, M, D] = h.date.split("-").map(Number);
  return new Date(Y, M - 1, D, 12, 0, 0, 0);
}
