"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Apple,
  BarChart3,
  BookOpen,
  Dumbbell,
  HeartPulse,
  Salad,
  Save,
  Sparkles,
} from "lucide-react";

type Tab = "overview" | "workouts" | "progression" | "diet" | "nutrition" | "log" | "tracker" | "sources";

type Exercise = {
  name: string;
  muscles: string;
  reps: string;
  rest: string;
  cue: string;
  progression: string;
  replacement: string;
};

type WeekPlan = {
  week: number;
  pattern: "A-B-A" | "B-A-B";
  armSets: number;
  otherSets: number;
  rir: string;
  cardio: string;
  goal: string;
  adjustment: string;
};

type LogEntry = {
  weight?: string;
  reps?: string;
  rir?: string;
  status?: string;
  notes?: string;
};

type TrackerEntry = {
  date?: string;
  weight?: string;
  waist?: string;
  rightArm?: string;
  leftArm?: string;
  curl?: string;
  pressdown?: string;
  chestPress?: string;
  pulldown?: string;
  sessions?: string;
  sleep?: string;
  photo?: boolean;
  notes?: string;
};

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "workouts", label: "Workouts" },
  { id: "progression", label: "12 Weeks" },
  { id: "diet", label: "Bengali Diet" },
  { id: "nutrition", label: "Nutrition" },
  { id: "log", label: "Workout Log" },
  { id: "tracker", label: "Progress Tracker" },
  { id: "sources", label: "Sources" },
];

const workoutA: Exercise[] = [
  {
    name: "Machine Preacher Curl / Seated Cable Curl",
    muscles: "Biceps, brachialis",
    reps: "10–15",
    rest: "90–120 sec",
    cue: "Keep upper arm still; control lowering",
    progression: "Hit 15 on all sets at target RIR, then add the smallest load",
    replacement: "Seated dumbbell curl",
  },
  {
    name: "Leg Press",
    muscles: "Quads, glutes",
    reps: "8–12",
    rest: "2–3 min",
    cue: "Whole foot planted; controlled depth",
    progression: "Reach the top of the range before adding weight",
    replacement: "Hack squat",
  },
  {
    name: "Machine Chest Press",
    muscles: "Chest, triceps, front delts",
    reps: "8–12",
    rest: "~2 min",
    cue: "Shoulders stable; smooth press",
    progression: "Add reps, then the smallest load increase",
    replacement: "Smith/dumbbell press",
  },
  {
    name: "Neutral-Grip Lat Pulldown",
    muscles: "Lats, upper back, biceps",
    reps: "8–12",
    rest: "~2 min",
    cue: "Pull to upper chest; avoid excessive lean",
    progression: "Add reps, then load",
    replacement: "Assisted chin-up",
  },
];

const workoutB: Exercise[] = [
  {
    name: "Rope Triceps Pressdown",
    muscles: "Triceps",
    reps: "10–15",
    rest: "90–120 sec",
    cue: "Elbows near sides; no shoulder swing",
    progression: "Hit 15 on all sets at target RIR, then add the smallest load",
    replacement: "Seated overhead cable extension after several stable weeks",
  },
  {
    name: "Seated Leg Curl",
    muscles: "Hamstrings",
    reps: "10–15",
    rest: "90–120 sec",
    cue: "Align knee with machine pivot; control both directions",
    progression: "Add reps before weight",
    replacement: "Light Romanian deadlift later",
  },
  {
    name: "Chest-Supported Machine Row",
    muscles: "Upper/mid back, rear delts, biceps",
    reps: "8–12",
    rest: "~2 min",
    cue: "Keep chest on pad; avoid shrugging",
    progression: "Add reps, then load",
    replacement: "Seated cable row",
  },
  {
    name: "Incline Machine Chest Press",
    muscles: "Upper chest, triceps, front delts",
    reps: "8–12",
    rest: "~2 min",
    cue: "Head supported; controlled lowering",
    progression: "Add reps, then a small weight increase",
    replacement: "Incline dumbbell press",
  },
];

const weeks: WeekPlan[] = [
  { week: 1, pattern: "A-B-A", armSets: 2, otherSets: 2, rir: "4", cardio: "Walk + optional easy run/walk", goal: "Learn equipment and technique", adjustment: "No load chasing" },
  { week: 2, pattern: "B-A-B", armSets: 2, otherSets: 2, rir: "3–4", cardio: "1 walk + 1 easy run/walk", goal: "Repeat clean form", adjustment: "Add reps first" },
  { week: 3, pattern: "A-B-A", armSets: 3, otherSets: 2, rir: "3", cardio: "1 walk + 1 easy run/walk", goal: "Increase direct arm volume", adjustment: "Keep compounds conservative" },
  { week: 4, pattern: "B-A-B", armSets: 2, otherSets: 2, rir: "4", cardio: "Easy only", goal: "Deload / technique week", adjustment: "Reduce fatigue" },
  { week: 5, pattern: "A-B-A", armSets: 3, otherSets: 3, rir: "3", cardio: "2 easy cardio sessions", goal: "Normal training volume", adjustment: "Optional lateral raises may begin" },
  { week: 6, pattern: "B-A-B", armSets: 4, otherSets: 3, rir: "2–3", cardio: "2 easy cardio sessions", goal: "Full arm-priority volume", adjustment: "Progress reps/load" },
  { week: 7, pattern: "A-B-A", armSets: 4, otherSets: 3, rir: "2", cardio: "2 easy cardio sessions", goal: "Productive hypertrophy work", adjustment: "Avoid failure" },
  { week: 8, pattern: "B-A-B", armSets: 2, otherSets: 2, rir: "4", cardio: "Easy only", goal: "Deload", adjustment: "Reduce sets and effort" },
  { week: 9, pattern: "A-B-A", armSets: 4, otherSets: 3, rir: "2", cardio: "2 easy cardio sessions", goal: "Rebuild full volume", adjustment: "Resume prior loads" },
  { week: 10, pattern: "B-A-B", armSets: 4, otherSets: 3, rir: "1–2", cardio: "2 easy cardio sessions", goal: "Hard hypertrophy block", adjustment: "No routine failure" },
  { week: 11, pattern: "A-B-A", armSets: 4, otherSets: 3, rir: "1–2", cardio: "2 easy cardio sessions", goal: "Best productive week", adjustment: "Only clean reps count" },
  { week: 12, pattern: "B-A-B", armSets: 2, otherSets: 2, rir: "3–4", cardio: "Easy only", goal: "Deload and assess", adjustment: "No 1RM testing" },
];

const meals = [
  { day: "Monday", total: "1,970 kcal · 140 g protein", meals: ["Breakfast — Chira 50 g + plain doi 200 g + 2 boiled eggs + papaya 150 g", "Snack — Roasted chola 30 g + guava 150 g", "Lunch — Rice 150 g + rui/tilapia jhol 170 g + masoor dal 100 g + mixed shobji 250 g", "Snack — Low-fat milk 250 mL + small banana", "Dinner — Chicken jhol 180 g + 2 small atta roti + lau/cabbage 250 g"] },
  { day: "Tuesday", total: "1,995 kcal · 146 g protein", meals: ["Breakfast — 2 small atta roti + 3-egg vegetable omelette + cucumber/tomato", "Snack — Plain doi 200 g + orange/malta", "Lunch — Rice 150 g + chicken curry 170 g + moong dal 100 g + palong/lal shak 200 g", "Snack — Roasted chola 25 g + 1 boiled egg + unsweetened milk tea", "Dinner — Fish jhol 180 g + 2 small roti + cauliflower/beans/carrot 300 g"] },
  { day: "Wednesday", total: "1,940 kcal · 135 g protein", meals: ["Breakfast — Chira 45 g + milk 250 mL + 2 eggs + banana 80 g", "Snack — Guava 150 g + 1 boiled egg", "Lunch — Lean beef curry 140 g + rice 140 g + thin dal 100 g + salad + shobji 250 g", "Snack — Plain doi 200 g + papaya 150 g", "Dinner — Chicken-moong khichuri: dry rice 45 g + dry dal 45 g + chicken 150 g + vegetables 200 g"] },
  { day: "Thursday", total: "1,940 kcal · 138 g protein", meals: ["Breakfast — 2 small roti + 2 eggs + dal 120 g + cucumber/tomato", "Snack — Milk 250 mL + papaya 150 g", "Lunch — Rice 150 g + fish curry 180 g + cholar dal 100 g + potol/jhinge 250 g", "Snack — Roasted chola 30 g + tea without sugar", "Dinner — Low-oil chicken bhuna 180 g + 2 small roti + mixed shobji 300 g"] },
  { day: "Friday", total: "1,980 kcal · 144 g protein", meals: ["Breakfast — Chira 50 g + plain doi 220 g + small banana + 2 boiled eggs", "Snack — 2 boiled eggs + cucumber", "Lunch — Rice 160 g + chicken jhol 180 g + masoor dal 100 g + mixed shobji 250 g", "Snack — Guava 150 g + plain doi 150 g", "Dinner — Soy-chunk curry 60 g dry soy + 2 small roti + shak 250 g + dal 80 g"] },
  { day: "Saturday", total: "2,030 kcal · 137 g protein", meals: ["Breakfast — 3-egg vegetable omelette + 2 small roti + seasonal fruit 100 g", "Snack — Roasted chola 30 g + orange", "Lunch — Rice 150 g + rui/katla 180 g + masoor dal 120 g + shak/shobji 250 g", "Snack — Milk 250 mL + banana 80 g", "Dinner — Lean beef 140 g or chicken 170 g + 2 small roti + begun/bhindi 300 g + salad"] },
  { day: "Sunday", total: "1,950 kcal · 145 g protein", meals: ["Breakfast — 2 eggs + 2 small roti + thin dal 100 g + tomato/cucumber", "Snack — Plain doi 200 g + guava 100 g", "Lunch — Light chicken pulao: dry rice 60 g + chicken 180 g + vegetables 150 g + cucumber raita 100 g", "Snack — Papaya 150 g + 2 boiled eggs", "Dinner — Fish jhol 180 g + rice 120 g + dal 100 g + shobji 300 g"] },
];

const nutritionTargets = [
  ["Calories", "1,950–2,050 kcal", "Moderate deficit; only reduce after 2 adherent stagnant weeks"],
  ["Protein", "130–145 g", "Keep constant when calories change"],
  ["Carbohydrate", "210–245 g", "Training fuel; do not eliminate rice"],
  ["Fat", "55–70 g", "Control cooking oil first if calories need cutting"],
  ["Fibre", "25–35 g", "Increase gradually"],
  ["Fruit + vegetables", "≥400 g", "2 large vegetable servings + 2 fruits"],
  ["Water / fluids", "2.5–3.0 L+", "Increase with heat/sweat"],
  ["Salt", "<5 g salt/day", "Count cooking + table salt; not a zero-sodium target"],
  ["Free sugar", "Prefer ≤25 g/day", "Avoid sugary drinks, sweets and sweet tea"],
];

const supplements = [
  ["Creatine monohydrate", "Recommended optional", "3–5 g/day", "Strength/performance and lean-mass support"],
  ["Whey protein", "Optional convenience", "20–30 g protein as needed", "Use only when daily food protein is short"],
  ["Vitamin D", "Conditional", "Based on diet/labs/clinician advice", "Bone/muscle/general health"],
  ["Omega-3 EPA/DHA", "Food-first / conditional", "Prefer fatty fish ~2×/week", "Cardiovascular nutrition"],
  ["Vitamin B12", "Only if needed", "Meet requirement or clinician-directed dose", "Nerve/blood-cell function"],
  ["Iron", "Do not take routinely", "Clinician-directed if deficient", "Correct iron deficiency"],
  ["Magnesium", "Food-first", "Aim ~400–420 mg/day total from food", "Muscle/nerve function"],
  ["Multivitamin", "Usually unnecessary", "Around 100% DV if used", "Small dietary-gap insurance"],
  ["Fat burners / stimulant pre-workouts", "Not recommended", "—", "Not required for fat loss"],
];

const sources = [
  ["Resistance training volume/frequency", "ACSM 2026 position stand", "https://pubmed.ncbi.nlm.nih.gov/41843416/"],
  ["Weekly set dose response", "Pelland et al. 2026", "https://pubmed.ncbi.nlm.nih.gov/41343037/"],
  ["Direct biceps training", "Mannarino et al.", "https://pubmed.ncbi.nlm.nih.gov/31268995/"],
  ["Direct triceps training", "Maeo et al.", "https://pubmed.ncbi.nlm.nih.gov/35819335/"],
  ["Proximity to failure", "Refalo et al. 2024", "https://pubmed.ncbi.nlm.nih.gov/38393985/"],
  ["Progressive overload", "Chaves et al. 2024", "https://pubmed.ncbi.nlm.nih.gov/38286426/"],
  ["Machines vs free weights", "Haugen et al. 2023", "https://pubmed.ncbi.nlm.nih.gov/37582807/"],
  ["Protein intake", "ISSN position stand", "https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8"],
  ["Warm-up/cool-down", "American Heart Association", "https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/warm-up-cool-down"],
  ["Pre-exercise screening", "CSEP", "https://csep.ca/2021/01/20/pre-screening-for-physical-activity/"],
];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-4 md:p-5 ${className}`}>{children}</div>;
}

function Input({ value, onChange, placeholder, type = "text" }: { value?: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-w-[86px] rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent"
    />
  );
}

export default function FitnessPlanPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [week, setWeek] = useState(1);
  const [log, setLog] = useState<Record<string, LogEntry>>({});
  const [tracker, setTracker] = useState<Record<string, TrackerEntry>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const savedWeek = Number(localStorage.getItem("flowdesk-fitness-week") || "1");
      if (savedWeek >= 1 && savedWeek <= 12) setWeek(savedWeek);
      setLog(JSON.parse(localStorage.getItem("flowdesk-fitness-log") || "{}"));
      setTracker(JSON.parse(localStorage.getItem("flowdesk-fitness-tracker") || "{}"));
    } catch {
      // Start clean if local data is malformed.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("flowdesk-fitness-week", String(week));
  }, [week]);

  function persist(nextLog = log, nextTracker = tracker) {
    localStorage.setItem("flowdesk-fitness-log", JSON.stringify(nextLog));
    localStorage.setItem("flowdesk-fitness-tracker", JSON.stringify(nextTracker));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  const sessions = useMemo(() => {
    let sessionNo = 0;
    return weeks.flatMap((plan) =>
      plan.pattern.split("-").map((kind) => {
        sessionNo += 1;
        return { sessionNo, week: plan.week, kind: kind as "A" | "B", plan };
      })
    );
  }, []);

  const current = weeks[week - 1];
  const currentWorkout = current.pattern.startsWith("A") ? workoutA : workoutB;

  function updateLog(key: string, patch: Partial<LogEntry>) {
    const next = { ...log, [key]: { ...(log[key] || {}), ...patch } };
    setLog(next);
    localStorage.setItem("flowdesk-fitness-log", JSON.stringify(next));
  }

  function updateTracker(key: string, patch: Partial<TrackerEntry>) {
    const next = { ...tracker, [key]: { ...(tracker[key] || {}), ...patch } };
    setTracker(next);
    localStorage.setItem("flowdesk-fitness-tracker", JSON.stringify(next));
  }

  return (
    <div className="p-4 md:p-8">
      <div className="page-canvas mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-accent">
              <Dumbbell size={20} />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">12-week plan</span>
            </div>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl md:text-4xl">Fitness Plan</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">Bengali fat-loss + arm-priority muscle-building plan, converted into a trackable Flowdesk workspace.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Current week</label>
            <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
              {weeks.map((w) => <option key={w.week} value={w.week}>Week {w.week}</option>)}
            </select>
            <button onClick={() => persist()} className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white">
              <Save size={15} /> {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {tabs.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition ${tab === item.id ? "bg-accent text-white" : "border border-border bg-card text-muted hover:text-foreground"}`}>
              {item.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[ ["Calories", "1,950–2,050 kcal/day"], ["Protein", "130–145 g/day"], ["Gym", "3 sessions/week"], ["Cardio", "1 brisk walk + 1 easy run/walk"] ].map(([label, value]) => (
                <Card key={label}><div className="text-xs uppercase tracking-wider text-muted">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></Card>
              ))}
            </div>

            <Card className="border-accent/30 bg-accent-soft/30">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Week {week} · {current.pattern}</div>
                  <div className="mt-1 text-sm text-muted">{current.goal} · Target {current.rir} RIR · {current.cardio}</div>
                </div>
                <button onClick={() => setTab("workouts")} className="rounded-xl border border-accent/30 bg-card px-3 py-2 text-sm text-accent">Open workouts</button>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="font-semibold">Weekly schedule</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  {[
                    ["Mon", "Workout A"], ["Tue", "Brisk walk · 25–40 min"], ["Wed", "Workout B"], ["Thu", "Rest/easy walk"],
                    ["Fri", "Workout A/B"], ["Sat", "Easy run/walk · 25–40 min"], ["Sun", "Rest"], ["Pattern", current.pattern],
                  ].map(([day, item]) => <div key={day} className="rounded-xl bg-background p-3"><div className="text-xs text-muted">{day}</div><div className="mt-1 font-medium">{item}</div></div>)}
                </div>
              </Card>
              <Card>
                <h2 className="font-semibold">Progress rules</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  <li>• Use 3–7 morning weigh-ins per week and average them.</li>
                  <li>• Progress repetitions first, then load.</li>
                  <li>• Do not increase weight just because a new week begins.</li>
                  <li>• Keep protein at 130–145 g/day even if calories are adjusted.</li>
                  <li>• If weight and waist stall for 2 adherent weeks, reduce roughly 100–150 kcal.</li>
                </ul>
              </Card>
            </div>

            <Card className="border-amber-300/40 bg-amber-50/70 dark:bg-amber-950/10">
              <div className="flex gap-3"><HeartPulse className="mt-0.5 shrink-0 text-amber-700" size={18} /><p className="text-sm text-amber-950 dark:text-amber-100">Safety note from the plan: use controlled breathing and moderate effort. Stop training and seek medical assessment for chest pressure, near-fainting, unusual or rapidly worsening breathlessness, or sustained palpitations with dizziness. Use RIR for lifting and the talk test for easy cardio.</p></div>
            </Card>
          </div>
        )}

        {tab === "workouts" && (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {[["Workout A — Biceps Priority", workoutA, "A"], ["Workout B — Triceps Priority", workoutB, "B"]].map(([title, exercises, kind]) => (
              <Card key={String(kind)}>
                <h2 className="text-lg font-semibold">{String(title)}</h2>
                <div className="mt-4 space-y-3">
                  {(exercises as Exercise[]).map((ex, i) => {
                    const sets = i === 0 ? current.armSets : current.otherSets;
                    return (
                      <div key={ex.name} className="rounded-xl border border-border/70 bg-background p-3">
                        <div className="flex items-start justify-between gap-3"><div><div className="text-xs text-muted">{i + 1}. {ex.muscles}</div><div className="font-medium">{ex.name}</div></div><div className="rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">{sets} × {ex.reps}</div></div>
                        <div className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-2"><span>Rest: {ex.rest}</span><span>Target: {current.rir} RIR</span><span>Form: {ex.cue}</span><span>Progress: {ex.progression}</span></div>
                        <div className="mt-2 text-xs text-muted">Alternative: {ex.replacement}</div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
            <Card className="lg:col-span-2">
              <h2 className="font-semibold">Optional shoulder-width add-on</h2>
              <p className="mt-2 text-sm text-muted">Cable / machine lateral raise · 2 × 12–20 · 1–2×/week · 60–90 sec rest. Add only after the main four exercises from Week 5 onward if recovery and session length remain good.</p>
            </Card>
          </div>
        )}

        {tab === "progression" && (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-accent-soft text-left"><tr>{["Week", "Pattern", "Arm sets", "Other sets", "RIR", "Cardio", "Main goal", "Adjustment"].map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{weeks.map((w) => <tr key={w.week} className={`border-t border-border ${w.week === week ? "bg-accent-soft/40" : ""}`}><td className="px-3 py-3 font-semibold">{w.week}</td><td className="px-3 py-3">{w.pattern}</td><td className="px-3 py-3">{w.armSets}</td><td className="px-3 py-3">{w.otherSets}</td><td className="px-3 py-3">{w.rir}</td><td className="px-3 py-3">{w.cardio}</td><td className="px-3 py-3">{w.goal}</td><td className="px-3 py-3 text-muted">{w.adjustment}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        {tab === "diet" && (
          <div className="mt-5 space-y-4">
            <Card className="border-accent/30 bg-accent-soft/30"><div className="flex gap-3"><Salad className="text-accent" size={20} /><div><div className="font-semibold">Bengali 7-day menu</div><div className="mt-1 text-sm text-muted">Approx. 1,950–2,050 kcal/day. Rice, meat and fish amounts are cooked edible portions unless noted. Measure oil instead of free-pouring.</div></div></div></Card>
            <div className="grid gap-4 lg:grid-cols-2">
              {meals.map((day) => <Card key={day.day}><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{day.day}</h2><span className="text-xs text-accent">{day.total}</span></div><ul className="mt-3 space-y-2 text-sm text-muted">{day.meals.map((meal) => <li key={meal}>• {meal}</li>)}</ul></Card>)}
            </div>
            <Card><div className="font-semibold">Arm-growth nutrition rule</div><p className="mt-2 text-sm text-muted">Do not add “bulking calories” just because arms are prioritized. Keep the current deficit while performance improves. Put a normal carb-containing meal/snack 1–3 hours before lifting and keep daily protein at 130–145 g.</p></Card>
          </div>
        )}

        {tab === "nutrition" && (
          <div className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><h2 className="flex items-center gap-2 font-semibold"><Apple size={18} /> Daily nutrition targets</h2><div className="mt-3 divide-y divide-border">{nutritionTargets.map(([name, range, note]) => <div key={name} className="grid grid-cols-[120px_150px_1fr] gap-3 py-2.5 text-sm"><span className="font-medium">{name}</span><span>{range}</span><span className="text-muted">{note}</span></div>)}</div></Card>
              <Card><h2 className="flex items-center gap-2 font-semibold"><Sparkles size={18} /> Supplements</h2><div className="mt-3 divide-y divide-border">{supplements.map(([name, status, amount, purpose]) => <div key={name} className="py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{name}</span><span className="text-xs text-accent">{status}</span></div><div className="mt-1 text-xs text-muted">{amount} · {purpose}</div></div>)}</div></Card>
            </div>
            <Card><h2 className="font-semibold">Meal timing around gym</h2><div className="mt-3 grid gap-3 md:grid-cols-4">{[["2–3 h pre", "Normal meal", "25–40 g protein · 40–70 g carbs"], ["30–90 min pre", "Small snack if hungry", "8–20 g protein · 20–40 g carbs"], ["0–2 h post", "Normal meal", "25–40 g protein · 40–70 g carbs"], ["Before bed", "Optional protein snack", "10–25 g protein"]].map(([time, meal, macro]) => <div key={time} className="rounded-xl bg-background p-3"><div className="text-xs text-accent">{time}</div><div className="mt-1 text-sm font-medium">{meal}</div><div className="mt-1 text-xs text-muted">{macro}</div></div>)}</div></Card>
          </div>
        )}

        {tab === "log" && (
          <div className="mt-5 space-y-4">
            <Card><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">36-session workout log</h2><p className="mt-1 text-sm text-muted">Enter weight, reps, RIR, status and notes. Entries save automatically in this browser.</p></div><BarChart3 className="text-accent" /></div></Card>
            {sessions.map((session) => {
              const exercises = session.kind === "A" ? workoutA : workoutB;
              return (
                <details key={session.sessionNo} open={session.week === week} className="rounded-2xl border border-border bg-card">
                  <summary className="cursor-pointer px-4 py-3 font-medium">Session {session.sessionNo} · Week {session.week} · Workout {session.kind}</summary>
                  <div className="overflow-x-auto border-t border-border">
                    <table className="min-w-[880px] w-full text-sm">
                      <thead className="bg-background/60 text-left"><tr>{["Exercise", "Sets", "Range", "Weight", "Reps by set", "RIR", "Status", "Notes"].map((h) => <th key={h} className="px-3 py-2 text-xs font-medium text-muted">{h}</th>)}</tr></thead>
                      <tbody>{exercises.map((ex, index) => {
                        const key = `${session.sessionNo}:${index}`;
                        const entry = log[key] || {};
                        const sets = index === 0 ? session.plan.armSets : session.plan.otherSets;
                        return <tr key={key} className="border-t border-border align-top"><td className="px-3 py-3 font-medium">{ex.name}</td><td className="px-3 py-3">{sets}</td><td className="px-3 py-3">{ex.reps}</td><td className="px-2 py-2"><Input value={entry.weight} onChange={(v) => updateLog(key, { weight: v })} placeholder="lb/kg" /></td><td className="px-2 py-2"><Input value={entry.reps} onChange={(v) => updateLog(key, { reps: v })} placeholder="12/11/10" /></td><td className="px-2 py-2"><Input value={entry.rir} onChange={(v) => updateLog(key, { rir: v })} placeholder={session.plan.rir} /></td><td className="px-2 py-2"><select value={entry.status || "Planned"} onChange={(e) => updateLog(key, { status: e.target.value })} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"><option>Planned</option><option>Completed</option><option>Skipped</option></select></td><td className="px-2 py-2"><Input value={entry.notes} onChange={(v) => updateLog(key, { notes: v })} placeholder="Notes" /></td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {tab === "tracker" && (
          <div className="mt-5 space-y-4">
            <Card><h2 className="font-semibold">12-week progress tracker</h2><p className="mt-1 text-sm text-muted">Track weekly average weight, waist, both arms, strength markers, gym sessions, sleep and photos. Arm circumference should be measured at the same relaxed mid-upper-arm point and at the same time of day.</p></Card>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="min-w-[1420px] w-full text-sm">
                <thead className="bg-accent-soft text-left"><tr>{["Week", "Date", "Avg weight", "Waist", "Right arm", "Left arm", "Curl best", "Pressdown best", "Chest press best", "Pulldown best", "Gym sessions", "Avg sleep", "Photo", "Notes"].map((h) => <th key={h} className="px-2.5 py-3 text-xs font-semibold">{h}</th>)}</tr></thead>
                <tbody>{Array.from({ length: 13 }, (_, i) => i).map((w) => {
                  const key = String(w);
                  const entry = tracker[key] || {};
                  return <tr key={w} className={`border-t border-border ${w === week ? "bg-accent-soft/30" : ""}`}><td className="px-3 py-3 font-semibold">{w}</td><td className="px-2 py-2"><Input type="date" value={entry.date} onChange={(v) => updateTracker(key, { date: v })} /></td><td className="px-2 py-2"><Input value={entry.weight} onChange={(v) => updateTracker(key, { weight: v })} placeholder="kg" /></td><td className="px-2 py-2"><Input value={entry.waist} onChange={(v) => updateTracker(key, { waist: v })} placeholder="cm" /></td><td className="px-2 py-2"><Input value={entry.rightArm} onChange={(v) => updateTracker(key, { rightArm: v })} placeholder="cm" /></td><td className="px-2 py-2"><Input value={entry.leftArm} onChange={(v) => updateTracker(key, { leftArm: v })} placeholder="cm" /></td><td className="px-2 py-2"><Input value={entry.curl} onChange={(v) => updateTracker(key, { curl: v })} /></td><td className="px-2 py-2"><Input value={entry.pressdown} onChange={(v) => updateTracker(key, { pressdown: v })} /></td><td className="px-2 py-2"><Input value={entry.chestPress} onChange={(v) => updateTracker(key, { chestPress: v })} /></td><td className="px-2 py-2"><Input value={entry.pulldown} onChange={(v) => updateTracker(key, { pulldown: v })} /></td><td className="px-2 py-2"><Input value={entry.sessions} onChange={(v) => updateTracker(key, { sessions: v })} /></td><td className="px-2 py-2"><Input value={entry.sleep} onChange={(v) => updateTracker(key, { sleep: v })} placeholder="h" /></td><td className="px-3 py-3 text-center"><input type="checkbox" checked={Boolean(entry.photo)} onChange={(e) => updateTracker(key, { photo: e.target.checked })} /></td><td className="px-2 py-2"><Input value={entry.notes} onChange={(v) => updateTracker(key, { notes: v })} placeholder="Notes" /></td></tr>;
                })}</tbody>
              </table>
            </div>
            <Card><h2 className="font-semibold">How to judge progress</h2><div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm"><div><div className="font-medium">Body weight</div><div className="text-muted">Use the weekly average; a working pace in the plan is roughly 0.2–0.6 kg/week.</div></div><div><div className="font-medium">Waist</div><div className="text-muted">Measure weekly in the morning at the same point and tape tension.</div></div><div><div className="font-medium">Arms</div><div className="text-muted">Measure every 2 weeks, relaxed, same point, same time—not after a workout.</div></div><div><div className="font-medium">Strength</div><div className="text-muted">Look for more clean reps at the same load or more load at the same RIR.</div></div></div></Card>
          </div>
        )}

        {tab === "sources" && (
          <div className="mt-5 space-y-4">
            <Card><div className="flex items-center gap-3"><BookOpen className="text-accent" /><div><h2 className="font-semibold">Research sources used in the plan</h2><p className="text-sm text-muted">These are the sources listed in the uploaded plan.</p></div></div></Card>
            <div className="grid gap-3 md:grid-cols-2">{sources.map(([topic, source, url]) => <a key={topic} href={url} target="_blank" rel="noreferrer" className="rounded-2xl border border-border bg-card p-4 transition hover:border-accent/40"><div className="text-xs uppercase tracking-wider text-muted">{topic}</div><div className="mt-1 font-medium">{source}</div><div className="mt-2 truncate text-xs text-accent">{url}</div></a>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
