# Momentos (pontos de retorno do visual)

Cada "momento" é uma tag no git dos dois repositórios. Para voltar o painel a um momento, basta
publicar aquele ponto na main (os comandos estão no fim). Nada é apagado: os momentos seguintes
continuam no histórico e nas tags.

| Momento | Front (tag) | Back (tag) | O que é |
|---|---|---|---|
| **0** | `momento-0` = `5faf3d1` | `momento-0` = `e756d01` | Visual anterior: sidebar escura, barra branca em cima, fundo gelo. Já com as telas padronizadas (filtros, tabelas, Executar agora, Rodar de novo, tokens, MCP). |
| **1** | `momento-1` = `5277ce2` | `momento-1` = `e756d01` | "Claro e leve": sidebar branca translúcida com usuário no rodapé, sem barra em cima, fundo branco-azulado, cards com sombra suave, busca Ctrl+K, transição entre telas. |
| **2** | `momento-2` | `momento-2` | Cores puxadas para o padrão dos sistemas ALZ: fundo gelo, menu em gelo mais escuro com letra maior e negrito, cabeçalho de tabela mais marcado, linhas mais espaçadas, campos arredondados. Modal do Health corrigido. |

## Cores de fundo e menu (histórico)

Onde cada cor fica: `src/index.css` (fundo da página), `src/components/layout/app-shell.tsx`
(fundo do conteúdo), `src/app/providers/auth-provider.tsx` (tela de boot) e
`src/components/layout/app-sidebar.tsx` (fundo do menu e item ativo).

| Versão | Fundo do conteúdo | Menu | Item ativo do menu |
|---|---|---|---|
| Momento 2 (26/10/2026, antes do protótipo) | `#F5F5F5` (antes disso, `#f3f6fb` gelo azulado) | `#f8f9fb` | `bg-slate-200/70`, texto `text-slate-900` |
| **Atual** (protótipo do portal ALZ, commit `81df4cd`) | `#F8F7F4` | `#FFFFFF` | `#F7EDDF`, texto `#7a4a12`, hover `#F7EDDF/60` |

Para voltar às cores anteriores basta trocar esses valores nos quatro arquivos (ou
`git revert --no-edit 81df4cd`).

## Voltar para um momento (front)

```bash
cd /c/Projetos/orkaflow-frontend
git checkout melhorias-sobre-junho
git revert --no-edit <tag-do-momento-atual>..HEAD   # desfaz o que veio depois, mantendo o histórico
git push origin melhorias-sobre-junho:main
```

Forma mais simples quando é só o visual (um commit por momento):
```bash
git revert --no-edit momento-2   # volta para o momento 1
```

O backend não muda entre os momentos 0, 1 e 2 (mesmo commit), então só o front precisa voltar.
