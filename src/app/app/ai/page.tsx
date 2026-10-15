"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AVAILABILITY_OPTIONS,
  DEFAULT_PREFS,
  KIND_OPTIONS,
  PAY_OPTIONS,
  RADIUS_OPTIONS,
  SEARCH_STAGES,
  runSearch,
} from "@/lib/ai";
import { AI_SOURCES, TASK_TYPES } from "@/lib/data";
import { PAY_COMPARISON_HELP } from "@/lib/pay";
import { SkillsPicker } from "@/components/SkillsPicker";
import { useApp } from "@/lib/store";
import type { AiPrefs, AiResult } from "@/lib/types";
import { OpportunityCard } from "@/components/cards";
import { Button, Icon, Progress, SectionHeading, Tag } from "@/components/ui";

type Phase = "wizard" | "searching" | "results";

export default function AiFinderPage() {
  const { aiPrefs, saveAiPrefs, setAiResults, aiResults } = useApp();
  const [prefs, setPrefs] = useState<AiPrefs>(aiPrefs ?? DEFAULT_PREFS);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>(aiResults ? "results" : "wizard");
  const [stage, setStage] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = useMemo(
    () => [
      { title: "What can you do?", hint: "Pick everything that applies. This is the strongest signal." },
      { title: "What kind of opportunities do you want?", hint: "You can change this any time." },
      { title: "What small tasks are you willing to do?", hint: "Physical and local work counts too." },
      { title: "Where can you work?", hint: "Distance and remote answers filter the results." },
      { title: "How much do you want to earn?", hint: PAY_COMPARISON_HELP },
      { title: "When are you available?", hint: "Used to rank work that fits your week." },
    ],
    []
  );

  useEffect(() => {
    if (phase !== "searching") return;
    timer.current = setInterval(() => {
      setStage((s) => {
        if (s >= SEARCH_STAGES.length - 1) {
          if (timer.current) clearInterval(timer.current);
          return s;
        }
        return s + 1;
      });
    }, 620);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "searching" || stage < SEARCH_STAGES.length - 1) return;
    const done = setTimeout(() => {
      const found = runSearch(prefs);
      setAiResults(found);
      saveAiPrefs(prefs);
      setPhase("results");
    }, 700);
    return () => clearTimeout(done);
  }, [phase, stage, prefs, setAiResults, saveAiPrefs]);

  const toggle = <K extends keyof AiPrefs>(key: K, value: string) => {
    setPrefs((p) => {
      const arr = p[key] as string[];
      return {
        ...p,
        [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      } as AiPrefs;
    });
  };

  const canAdvance =
    step === 0 ? prefs.skills.length > 0 : true;

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">AI opportunity finder</span>
          <Tag tone="quiet">Demo — no live web search</Tag>
        </div>
        <h1 className="display mt-3 max-w-[22ch] text-[34px] sm:text-[46px]">
          Let AI search for small jobs for you.
        </h1>
        <p className="mt-3 max-w-[68ch] text-[14.5px] leading-relaxed text-ink2">
          Tell us what you can do, where you want to work and what you are looking for. We will find
          relevant opportunities across the web, then explain why each one matches before you apply.
        </p>
      </header>

      {phase === "wizard" ? (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="tagshape border border-rule bg-raised p-6 sm:p-7">
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-[12px] text-ink3">
                <span>
                  Step {step + 1} of {steps.length}
                </span>
                <span className="figure">{Math.round(((step + 1) / steps.length) * 100)}%</span>
              </div>
              <Progress value={Math.round(((step + 1) / steps.length) * 100)} />
            </div>

            <h2 className="display-tight text-[24px]">{steps[step].title}</h2>
            <p className="mt-2 text-[13.5px] text-ink2">{steps[step].hint}</p>

            <div className="mt-5">
              {step === 0 ? (
                <SkillsPicker
                  value={prefs.skills}
                  onChange={(skills) => setPrefs((p) => ({ ...p, skills }))}
                />
              ) : null}

              {step === 1 ? (
                <Chips
                  options={KIND_OPTIONS}
                  selected={prefs.kinds}
                  onToggle={(v) => toggle("kinds", v)}
                />
              ) : null}

              {step === 2 ? (
                <>
                  <Chips
                    options={TASK_TYPES}
                    selected={prefs.tasks}
                    onToggle={(v) => toggle("tasks", v)}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <input
                      placeholder="Something else you would do"
                      className="min-w-[180px] flex-1 rounded-full border border-rule bg-transparent px-4 py-2.5 text-[13.5px] outline-none placeholder:text-ink3"
                      onKeyDown={(e) => {
                        const el = e.currentTarget;
                        if (e.key === "Enter" && el.value.trim()) {
                          e.preventDefault();
                          setPrefs((p) => ({ ...p, tasks: [...p.tasks, el.value.trim()] }));
                          el.value = "";
                        }
                      }}
                    />
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setPrefs((p) => ({ ...p, radius: r }))}
                      className={`tagshape flex items-center justify-between border px-4 py-3 text-left text-[13.5px] font-semibold transition-colors ${
                        prefs.radius === r
                          ? "border-accent bg-accent/10 text-ink"
                          : "border-rule text-ink2 hover:border-ink/30"
                      }`}
                    >
                      {r}
                      {prefs.radius === r ? (
                        <span className="text-accentx">
                          <Icon name="check" size={16} />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {step === 4 ? (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {PAY_OPTIONS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPrefs((prev) => ({ ...prev, minPay: p }))}
                        className={`rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                          prefs.minPay === p
                            ? "border-accent bg-accent text-onaccent"
                            : "border-rule text-ink2"
                        }`}
                      >
                        {p === 0 ? "Any amount" : `$${p}+/day equivalent`}
                      </button>
                    ))}
                  </div>
                  <div className="mt-5">
                    <div className="eyebrow mb-2">Prefer</div>
                    <div className="flex gap-2">
                      {(["any", "hourly", "fixed"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setPrefs((p) => ({ ...p, payType: t }))}
                          className={`rounded-full border px-3.5 py-2 text-[12.5px] font-semibold capitalize transition-colors ${
                            prefs.payType === t
                              ? "border-accent bg-accent/15 text-accentx"
                              : "border-rule text-ink2"
                          }`}
                        >
                          {t === "any" ? "No preference" : `${t} pay`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 5 ? (
                <Chips
                  options={AVAILABILITY_OPTIONS}
                  selected={prefs.availability}
                  onToggle={(v) => toggle("availability", v)}
                />
              ) : null}
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-rule pt-5">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                Back
              </Button>
              {step < steps.length - 1 ? (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canAdvance}
                  iconRight="arrowRight"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setStage(0);
                    setPhase("searching");
                  }}
                  iconRight="ai"
                >
                  Find opportunities
                </Button>
              )}
            </div>
          </div>

          {/* live summary */}
          <aside className="tagshape border border-rule bg-raised p-5 lg:sticky lg:top-24">
            <SectionHeading eyebrow="Your brief" title="What AI will look for" />
            <Summary label="Skills" values={prefs.skills} />
            <Summary label="Opportunity types" values={prefs.kinds} />
            <Summary label="Tasks" values={prefs.tasks} />
            <Summary label="Where" values={[prefs.radius]} />
            <Summary
              label="Pay"
              values={[prefs.minPay === 0 ? "Any amount" : `$${prefs.minPay}+/day equivalent`]}
            />
            <Summary label="Available" values={prefs.availability} />
          </aside>
        </section>
      ) : null}

      {phase === "searching" ? (
        <section className="tagshape border border-rule bg-raised p-8 sm:p-12">
          <div className="mx-auto max-w-[520px] text-center">
            <span className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full bg-accent text-onaccent">
              <Icon name="ai" size={26} filled />
            </span>
            <h2 className="display-tight text-[24px]">Looking for work you can do</h2>
            <p className="mt-2 text-[13.5px] text-ink2">
              This run uses the Earnly demo listing set, not a live web search.
            </p>
            <ul className="mt-8 space-y-3 text-left">
              {SEARCH_STAGES.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] ${
                      i < stage
                        ? "bg-positive/20 text-positive"
                        : i === stage
                          ? "bg-accent text-onaccent"
                          : "bg-ink/10 text-ink3"
                    }`}
                  >
                    {i < stage ? <Icon name="check" size={13} /> : i + 1}
                  </span>
                  <span
                    className={`text-[14px] ${i <= stage ? "font-semibold text-ink" : "text-ink3"}`}
                  >
                    {s}
                  </span>
                  {i === stage ? (
                    <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-accent" />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {phase === "results" ? (
        <Results
          results={aiResults ?? runSearch(prefs)}
          onRestart={() => {
            setPhase("wizard");
            setStep(0);
            setAiResults(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Summary({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="border-b border-rule py-3 last:border-0">
      <div className="eyebrow mb-2">{label}</div>
      {values.length === 0 ? (
        <span className="text-[13px] text-ink3">Not set</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Tag key={v}>{v}</Tag>
          ))}
        </div>
      )}
    </div>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            onClick={() => onToggle(o)}
            aria-pressed={on}
            className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              on
                ? "border-accent bg-accent text-onaccent"
                : "border-rule text-ink2 hover:border-ink/30 hover:text-ink"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Results({
  results,
  onRestart,
}: {
  results: AiResult[];
  onRestart: () => void;
}) {
  const [showSources, setShowSources] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);

  return (
    <section>
      <div className="tagshape mb-6 flex flex-wrap items-center justify-between gap-4 border border-rule bg-raised p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-onaccent">
              <Icon name="ai" size={15} filled />
            </span>
            <span className="text-[15px] font-bold">
              {results.length} opportunities, ranked and explained
            </span>
          </div>
          <p className="mt-2 max-w-[70ch] text-[13px] text-ink2">
            Each result was discovered, filtered, ranked and explained against your brief. The demo
            run used the local listing set; the source column shows where a live version would read
            from.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRestart}>
            Change the brief
          </Button>
          <Button variant="ghost" onClick={() => setShowSources((v) => !v)}>
            {showSources ? "Hide sources" : "How discovery works"}
          </Button>
        </div>
      </div>

      {showSources ? (
        <div className="tagshape mb-6 border border-rule bg-raised p-5">
          <SectionHeading eyebrow="Architecture" title="Where listings come from" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {AI_SOURCES.map((s) => (
              <div key={s.id} className="tagshape border border-rule p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-bold">{s.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      s.status === "live"
                        ? "bg-positive/15 text-positive"
                        : "bg-ink/10 text-ink3"
                    }`}
                  >
                    {s.status === "live" ? "READS NOW" : "PLANNED"}
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">{s.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-rule pt-4 text-[12.5px] leading-relaxed text-ink3">
            Earnly does not scrape platforms that forbid it. Each source is an adapter behind one
            interface, so a new permitted source is added without touching the interface you are
            looking at.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {results.map((r) => (
          <div key={r.id} className="flex flex-col">
            <div className="flex-1">
              <OpportunityCard o={r} why={r.why} sourceLabel={r.source?.name ?? "Earnly listings"} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={applied.includes(r.id) ? "outline" : "primary"}
                onClick={() => setApplied((a) => (a.includes(r.id) ? a : [...a, r.id]))}
              >
                {applied.includes(r.id) ? "Application sent" : "Apply"}
              </Button>
              <Link
                href={
                  r.kind === "task"
                    ? `/app/tasks/${r.id}`
                    : r.kind === "job"
                      ? `/app/jobs/${r.id}`
                      : `/app/internships/${r.id}`
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-rule px-3.5 py-2 text-[13px] font-semibold text-ink2 hover:text-ink"
              >
                View opportunity
                <Icon name="arrowRight" size={14} />
              </Link>
              <button
                onClick={() => setShowSources(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-ink3 hover:text-ink"
              >
                Original source
                <Icon name="arrowUpRight" size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="tagshape mt-8 border border-dashed border-rule p-5 text-[13px] leading-relaxed text-ink2">
        <strong className="font-bold">Honesty note.</strong> No live web search ran. The ranking,
        the match percentages and the explanations were computed from the Earnly demo listing set,
        which is why every result links back into this prototype rather than to an external site.
        The interfaces for real sources, ranking and explanations already exist in{" "}
        <span className="figure">src/lib/ai.ts</span>.
      </div>
    </section>
  );
}
