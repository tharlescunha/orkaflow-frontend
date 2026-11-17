import { useSyncExternalStore } from "react";

// Última versão que a pessoa abriu na tela Atualizações (por navegador). Serve para o pontinho "novidade" no topo
// e para marcar como "Novo" o que saiu desde a última visita.
const KEY = "regente-last-seen-release";
const EVENT = "regente:release-seen";

export function getSeenVersion(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markVersionSeen(version: string) {
  try {
    window.localStorage.setItem(KEY, version);
  } catch {
    // sem localStorage (modo privado): só não lembra
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSeenVersion(): string | null {
  return useSyncExternalStore(subscribe, getSeenVersion, () => null);
}
