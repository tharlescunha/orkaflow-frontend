import { useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/common/empty-state";
import { QueryError } from "@/components/common/query-error";
import { Skeleton } from "@/components/common/skeleton";
import { card, cardHeader, cardTitle, input } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { DashboardHourlyLoadHour, DashboardHourlyLoadResponse } from "@/services/api/dashboard";

/**
 * Carga por hora do dia (Brasília), geral e por máquina: onde já está cheio e onde ainda cabe mais execução.
 * O período vem do seletor do topo do Dashboard (como os outros gráficos): média por dia no período.
 */

type Metric = "minutes" | "tasks";

const METRICS: Array<{ label: string; value: Metric; hint: string }> = [
  { label: "Tempo rodando", value: "minutes", hint: "Minutos com task em execução em cada hora, em média por dia." },
  { label: "Tasks iniciadas", value: "tasks", hint: "Quantas tasks começam em cada hora, em média por dia." },
];

const BUSY_COLOR = "#d97706"; // amber-600: entre as horas mais cheias
const NORMAL_COLOR = "#2563eb"; // blue-600
const FREE_COLOR = "#10b981"; // emerald-500: sobra espaço

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}h`;
}

function valueOf(hour: DashboardHourlyLoadHour, metric: Metric) {
  return metric === "minutes" ? hour.avg_busy_minutes : hour.avg_tasks_per_day;
}

function formatValue(value: number, metric: Metric, days = 2) {
  if (metric === "minutes") return `${value.toFixed(1).replace(".", ",")} min`;
  // Na janela de 24 h é a contagem de tasks da hora (inteira); nos demais períodos, a média por dia.
  return days === 1 ? String(Math.round(value)) : value.toFixed(1).replace(".", ",");
}

/** "tasks" na janela de 24 h (contagem da hora); "tasks por dia" nos demais períodos (média). */
function tasksUnit(days: number) {
  return days === 1 ? "tasks" : "tasks por dia";
}

function segmentClass(active: boolean) {
  return cn(
    "h-9 px-3.5 text-sm font-medium transition first:rounded-l-lg last:rounded-r-lg",
    active ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
  );
}

export function HourlyLoadCard({
  periodLabel,
  data,
  loading,
  error,
  onRetry,
  retrying,
}: {
  periodLabel: string;
  data?: DashboardHourlyLoadResponse;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  const [metric, setMetric] = useState<Metric>("minutes");
  const [runnerId, setRunnerId] = useState<number | "">("");

  const runner = data?.runners.find((r) => r.runner_id === runnerId) ?? null;
  const series = runner ? runner.hours : (data?.hours ?? []);
  const scopeTasks = runner ? runner.total_tasks : (data?.hours ?? []).reduce((sum, h) => sum + h.tasks, 0);
  const scopeLabel = `${runner ? runner.label || runner.name : "Todas as máquinas"} · ${scopeTasks} tasks iniciadas no período`;

  return (
    <section className={card}>
      <div className={cn(cardHeader, "flex-wrap")}>
        <h2 className={cardTitle}>Carga por hora do dia ({periodLabel})</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex divide-x divide-slate-300 rounded-lg border border-slate-300" role="group" aria-label="O que medir">
            {METRICS.map((m) => (
              <button key={m.value} type="button" onClick={() => setMetric(m.value)} aria-pressed={metric === m.value} title={m.hint} className={segmentClass(metric === m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-3 pb-4 pt-3">
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : error ? (
          <QueryError error={error} what="a carga por hora" onRetry={onRetry} retrying={retrying} />
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

            <HourlyChart series={series} metric={metric} scopeLabel={scopeLabel} days={data.days} />
            <Heatmap data={data} metric={metric} selectedId={runnerId} onSelect={setRunnerId} />

            <p className="px-2 text-xs text-slate-500">
              Horário de Brasília. {data.days === 1 ? "Últimas 24 horas" : `Média por dia nos ${data.days} dias`}, contando as tasks pela hora em que começaram.
              {metric === "minutes" ? " No geral, passa de 60 min na hora quando há tasks ao mesmo tempo." : ""}
              {data.days === 1 ? " As pontas (ontem e hoje) são horas parciais." : ""}
              {" "}Aqui contam as tasks que começaram a rodar; o gráfico de execuções acima conta as criadas, então pode ter poucas a mais (as que ainda esperam na fila ou foram canceladas sem rodar).
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
        Mais cheias: <strong className="text-amber-700">{busiest.map((h) => h.title || hourLabel(h.hour)).join(", ") || "---"}</strong>
      </span>
      <span>
        Mais livres: <strong className="text-emerald-700">{freest.map((h) => h.title || hourLabel(h.hour)).join(", ")}</strong>
      </span>
    </div>
  );
}

function HourlyChart({
  series,
  metric,
  scopeLabel,
  days,
}: {
  series: DashboardHourlyLoadHour[];
  metric: Metric;
  scopeLabel: string;
  days: number;
}) {
  const max = Math.max(0, ...series.map((h) => valueOf(h, metric)));
  const rows = series.map((h) => ({
    key: h.key || String(h.hour),
    label: hourLabel(h.hour),
    title: h.title || hourLabel(h.hour),
    hour: h.hour,
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
            <XAxis
              dataKey="key"
              tickFormatter={(key) => rows.find((r) => r.key === key)?.label ?? ""}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              interval={1}
            />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={metric === "tasks"} />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.12)" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
              separator=""
              formatter={(_value, _name, item) => {
                const row = item.payload as (typeof rows)[number];
                return [`${formatValue(row.minutes, "minutes")} rodando · ${formatValue(row.tasks, "tasks", days)} ${tasksUnit(days)}`, ""];
              }}
              labelFormatter={(key) => {
                const row = rows.find((r) => r.key === key);
                if (!row) return "";
                const hh = String(row.hour).padStart(2, "0");
                return `${row.title} (${hh}:00 a ${hh}:59)`;
              }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {rows.map((row) => (
                <Cell key={row.key} fill={colorFor(row.value)} />
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
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Por máquina e hora
        <span className="ml-2 font-normal normal-case tracking-normal text-slate-500">
          {metric === "minutes" ? "cada número = minutos rodando na hora" : "cada número = tasks iniciadas na hora"}
          {data.days > 1 ? " (média por dia)" : ""}; ao lado do nome, o total do período
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-[2px] text-[10px]">
          <thead>
            <tr>
              <th className="w-40 text-left font-medium text-slate-500" />
              {data.hours.map((hour) => (
                <th key={hour.key || hour.hour} title={hour.title} className="font-medium text-slate-500">
                  {String(hour.hour).padStart(2, "0")}
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
                    <span className="ml-1 font-normal text-slate-400">
                      {metric === "minutes"
                        ? `${Math.round(runner.hours.reduce((sum, h) => sum + h.avg_busy_minutes, 0) * data.days)} min`
                        : `${runner.total_tasks} tasks`}
                    </span>
                  </button>
                </td>
                {runner.hours.map((hour) => {
                  const value = valueOf(hour, metric);
                  const intensity = max > 0 ? value / max : 0;
                  return (
                    <td
                      key={hour.key || hour.hour}
                      title={`${runner.label || runner.name} · ${hour.title || hourLabel(hour.hour)}: ${formatValue(hour.avg_busy_minutes, "minutes")} rodando, ${formatValue(hour.avg_tasks_per_day, "tasks", data.days)} ${tasksUnit(data.days)}`}
                      className="h-7 rounded text-center align-middle"
                      style={{
                        backgroundColor: value > 0 ? `rgba(37, 99, 235, ${0.1 + intensity * 0.8})` : "#f1f5f9",
                        color: intensity > 0.55 ? "#fff" : "#475569",
                      }}
                    >
                      {value > 0 ? (metric === "minutes" ? Math.round(value) : formatValue(value, "tasks", data.days)) : ""}
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
