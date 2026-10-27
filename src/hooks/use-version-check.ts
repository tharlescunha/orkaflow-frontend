import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Com que frequência, no máximo, perguntar ao servidor qual é o build publicado.
const CHECK_EVERY_MS = 60_000;

/**
 * Recarrega o painel sozinho quando sai versão nova.
 *
 * O build grava um id no bundle (__BUILD_ID__) e em /version.json. Este hook compara os dois
 * ao trocar de tela, ao voltar para a aba e a cada minuto. Quando o servidor tem um build
 * diferente, espera a próxima troca de tela para recarregar (assim ninguém perde um formulário
 * pela metade) — a troca de tela já é um clique do usuário, então a página nova entra na hora.
 */
export function useVersionCheck() {
  const { pathname } = useLocation();
  const outdated = useRef(false);
  const lastCheck = useRef(0);

  // Ao trocar de tela com versão nova pendente: recarrega nesse mesmo caminho.
  useEffect(() => {
    if (outdated.current) window.location.reload();
  }, [pathname]);

  useEffect(() => {
    // Em desenvolvimento o id é sempre o mesmo; o check fica só para produção.
    if (import.meta.env.DEV) return;

    async function check() {
      const now = Date.now();
      if (outdated.current || now - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = now;
      try {
        const res = await fetch(`/version.json?t=${now}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { build?: string };
        if (data.build && data.build !== __BUILD_ID__) outdated.current = true;
      } catch {
        // sem rede ou servidor fora: tenta de novo no próximo ciclo
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void check();
    }

    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Também confere ao trocar de tela (respeitando o intervalo mínimo).
  useEffect(() => {
    if (import.meta.env.DEV || outdated.current) return;
    const now = Date.now();
    if (now - lastCheck.current < CHECK_EVERY_MS) return;
    lastCheck.current = now;
    fetch(`/version.json?t=${now}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { build?: string } | null) => {
        if (data?.build && data.build !== __BUILD_ID__) outdated.current = true;
      })
      .catch(() => undefined);
  }, [pathname]);
}
