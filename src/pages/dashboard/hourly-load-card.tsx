import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/common/empty-state";
import { QueryError } from "@/components/common/query-error";
import { Skeleton } from "@/components/common/skeleton";
import { card, cardHeader, cardTitle, input } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getDashboardHourlyLoad, type DashboardHourlyLoadHour, type DashboardHourlyLoadResponse } from "@/services/api/dashboard";

/**
 * Carga por hora do dia (Brasília), geral e por máquina: onde já está cheio e onde ainda cabe mais execução.
 * Média por dia no período, para um dia atípico não enganar.
 */

type LoadPeriod = "7d" | "15d" | "30d";
type Metric = "minutes" | "tasks";

const PERIODS: Array<{ label: string; value: LoadPeriod }> = [
  { label: "7 dias", value: "7d" },
  { label: "15 dias", value: "15d" },
  { label: "30 dias", value: "30d" },
];

const METRICS: Array<{ label: string; value: Metric; hint: string }> = [
  { label: "Tempo rodando", value: "minutes", hint: "Minutos com task em execução em cada hora, em média por dia." },
  { label: "Tasks iniciadas", value: "tasks", hint: "Quantas tasks começam em cada hora, em média por dia." },
];

const BUSY_COLOR = "#d97706"; // amber-600: entre as horas mais cheias
const NORMAL_COLOR = "#2563eb"; // blue-600
const FREE_COLOR = "#10b981"; // emerald-500: sobra espaço

const REFRESH_MS = 60_000;

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}h`;
}

function valueOf(hour: DashboardHourlyLoadHour, metric: Metric) {
  return metric === "minutes" ? hour.avg_busy_minutes : hour.avg_tasks_per_day;
}

function formatValue(value: number, metric: Metric) {
  if (metric === "minutes") return `${value.toFixed(1).replace(".", ",")} min`;
  return value.toFixed(1).replace(".", ",");
}

function segmentClass(active: boolean) {
  return cn(
    "h-9 px-3.5 text-sm font-medium transition first:rounded-l-lg last:rounded-r-lg",
    active ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
  );
}

export function HourlyLoadCard() {
  const [period, setPeriod] = useState<LoadPeriod>("15d");
  const [metric, setMetric] = useState<Metric>("minutes");
  const [runnerId, setRunnerId] = useState<number | "">("");

  const query = useQuery({
    queryKey: ["dashboard-hourly-load", period],
    queryFn: () => getDashboardHourlyLoad({ period }),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const data = query.data;
  const runner = data?.runners.find((r) => r.runner_id === runnerId) ?? null;
  const series = runner ? runner.hours : (data?.hours ?? []);
  const scopeLabel = runner ? runner.label || runner.name : "Todas as máquinas";

  return (
    <section className={card}>
      <div className={cn(cardHeader, "flex-wrap")}>
        <h2 className={cardTitle}>Carga por hora do dia</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex divide-x divide-slate-300 rounded-lg border border-slate-300" role="group" aria-label="O que medir">
            {METRICS.map((m) => (
              <button key={m.value} type="button" onClick={() => setMetric(m.value)} aria-pressed={metric === m.value} title={m.hint} className={segmentClass(metric === m.value)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="inline-flex divide-x divide-slate-300 rounded-lg border border-slate-300" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <button key={p.value} type="button" onClick={() => setPeriod(p.value)} aria-pressed={period === p.value} className={segmentClass(period === p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-3 pb-4 pt-3">
        {query.isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : query.isError ? (
          <QueryError error={query.error} what="a carga por hora" onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : !data || data.hours.every((h) => h.tasks === 0 && h.avg_busy_minutes === 0) ? (
          <EmptyState compact icon={Clock3} title="Nenhuma execução no período" description="O gráfico aparece conforme as tasks forem executadas." />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Máquina
                <select value={runnerId} onChange={(e) => setRunnerId(e.target.value === "" ? "" : Number(e.target.value))} className={cn(input, "h-9 w-auto min-w-[200px]")}>
                  <option value="">Todas as máquinas</option>
                  {data.runners.map((r) => (
                    <option key={r.runner_id} value={r.runner_id}>
                      {r.label || r.name}
                    </option>
                  ))}
                </select>
              </label>
              <BusiestAndFree series={series} metric={metric} />
            </div>

            <HourlyChart series={series} metric={metric} scopeLabel={scopeLabel} />
            <Heatmap data={data} metric={metric} selectedId={runnerId} onSelect={setRunnerId} />

            <p className="px-2 text-xs text-slate-500">
              Horário de Brasília. Média por dia nos {data.days} dias, contando as tasks pela hora em que começaram.
              {metric === "minutes" ? " No geral, passa de 60 min na hora quando há tasks ao mesmo tempo." : ""}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function BusiestAndFree({ series, metric }: { series: DashboardHourlyLoadHour[]; metric: Metric }) {
  const { busiest, freest } = useMemo(() => {
    const sorted = [...series].sort((a, b) => valueOf(b, metric) - valueOf(a, metric) || a.hour - b.hour);
    return {
      busiest: sorted.slice(0, 3).filter((h) => valueOf(h, metric) > 0),
      freest: [...sorted].reverse().slice(0, 3),
    };
  }, [series, metric]);

  if (series.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
      <span>
        Mais cheias: <strong className="text-amber-700">{busiest.map((h) => hourLabel(h.hour)).join(", ") || "---"}</strong>
      </span>
      <span>
        Mais livres: <strong className="text-emerald-700">{freest.map((h) => hourLabel(h.hour)).join(", ")}</strong>
      </span>
    </div>
  );
}

function HourlyChart({ series, metric, scopeLabel }: { series: DashboardHourlyLoadHour[]; metric: Metric; scopeLabel: string }) {
  const max = Math.max(0, ...series.map((h) => valueOf(h, metric)));
  const rows = series.map((h) => ({
    label: hourLabel(h.hour),
    value: valueOf(h, metric),
    tasks: h.avg_tasks_per_day,
    minutes: h.avg_busy_minutes,
  }));

  function colorFor(value: number) {
    if (max <= 0) return NORMAL_COLOR;
    if (value >= max * 0.75) return BUSY_COLOR;
    if (value <= max * 0.25) return FREE_COLOR;
    return NORMAL_COLOR;
  }

  return (
    <div>
      <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">{scopeLabel}</p>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={metric === "tasks"} />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.12)" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
              separator=""
              formatter={(_value, _name, item) => {
                const row = item.payload as (typeof rows)[number];
                return [`${formatValue(row.minutes, "minutes")} rodando · ${formatValue(row.tasks, "tasks")} tasks por dia`, ""];
              }}
              labelFormatter={(label) => {
                const hh = String(label).replace("h", "");
                return `Entre ${hh}:00 e ${hh}:59`;
              }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {rows.map((row) => (
                <Cell key={row.label} fill={colorFor(row.value)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-4 px-2 text-xs text-slate-500">
        <Legend color={BUSY_COLOR} label="Mais cheia (a partir de 75% do pico)" />
        <Legend color={NORMAL_COLOR} label="Carga média" />
        <Legend color={FREE_COLOR} label="Livre (até 25% do pico)" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/** Uma linha por máquina, uma coluna por hora: onde o azul é fraco ainda cabe execução. */
function Heatmap({
  data,
  metric,
  selectedId,
  onSelect,
}: {
  data: DashboardHourlyLoadResponse;
  metric: Metric;
  selectedId: number | "";
  onSelect: (id: number | "") => void;
}) {
  const max = Math.max(0, ...data.runners.flatMap((r) => r.hours.map((h) => valueOf(h, metric))));

  if (data.runners.length === 0) return null;

  return (
    <div className="px-2">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Por máquina e hora</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-[2px] text-[10px]">
          <thead>
            <tr>
              <th className="w-40 text-left font-medium text-slate-500" />
              {Array.from({ length: 24 }, (_, hour) => (
                <th key={hour} className="font-medium text-slate-500">
                  {String(hour).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.runners.map((runner) => (
              <tr key={runner.runner_id}>
                <td className="pr-2">
                  <button
                    type="button"
                    onClick={() => onSelect(selectedId === runner.runner_id ? "" : runner.runner_id)}
                    title="Ver só esta máquina no gráfico"
                    className={cn(
                      "block w-full truncate rounded px-1.5 py-1 text-left text-xs font-medium hover:bg-slate-100",
                      selectedId === runner.runner_id ? "bg-blue-50 text-blue-700" : "text-slate-700"
                    )}
                  >
                    {runner.label || runner.name}
                    <span className="ml-1 font-normal text-slate-400">{runner.total_tasks}</span>
                  </button>
                </td>
                {runner.hours.map((hour) => {
                  const value = valueOf(hour, metric);
                  const intensity = max > 0 ? value / max : 0;
                  return (
                    <td
                      key={hour.hour}
                      title={`${runner.label || runner.name} · ${hourLabel(hour.hour)}: ${formatValue(hour.avg_busy_minutes, "minutes")} rodando, ${formatValue(hour.avg_tasks_per_day, "tasks")} tasks por dia`}
                      className="h-7 rounded text-center align-middle"
                      style={{
                        backgroundColor: value > 0 ? `rgba(37, 99, 235, ${0.1 + intensity * 0.8})` : "#f1f5f9",
                        color: intensity > 0.55 ? "#fff" : "#475569",
                      }}
                    >
                      {value > 0 ? (metric === "minutes" ? Math.round(value) : value.toFixed(1).replace(".", ",")) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
