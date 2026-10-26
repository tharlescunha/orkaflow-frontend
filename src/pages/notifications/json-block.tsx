import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Tenta indentar JSON; se não for JSON válido devolve o texto cru. */
function formatMaybeJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return text;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // cai no fallback
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handle() {
    const ok = await copyText(value);
    setState(ok ? "ok" : "fail");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={handle}
      aria-label={label}
      className={cn(btn.secondary, "h-7 gap-1 px-2 text-xs")}
    >
      {state === "ok" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {state === "ok" ? "Copiado!" : state === "fail" ? "Não foi possível copiar" : "Copiar"}
    </button>
  );
}

type JsonBlockProps = {
  title: string;
  text: string | null | undefined;
  copyLabel: string;
  emptyText?: string;
  formatJson?: boolean;
  note?: string | null;
};

export function JsonBlock({ title, text, copyLabel, emptyText = "Vazio", formatJson = false, note }: JsonBlockProps) {
  const has = Boolean(text && text.length > 0);
  const shown = has ? (formatJson ? formatMaybeJson(text as string) : (text as string)) : "";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-600">{title}</div>
        {has && <CopyButton value={shown} label={copyLabel} />}
      </div>
      {note && <p className="mb-1 text-xs font-semibold text-amber-700">{note}</p>}
      {has ? (
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
          {shown}
        </pre>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}
