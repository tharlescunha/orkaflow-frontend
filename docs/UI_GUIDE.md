# Guia de interface do OrkaFlow

Linguagem visual única para todas as telas. As classes ficam em `src/lib/ui.ts`; os componentes em `src/components/common/`. Nenhuma tela monta botão, input, card ou tabela "do zero".

## Princípios
1. **Rápido antes de bonito.** Nada de contador de 1 em 1 s, polling em aba oculta, lista inteira recarregada por clique.
2. **Ação onde a pessoa está.** Executar, pausar, parar, ver log: na própria linha ou card, sem trocar de tela.
3. **O mesmo em todo lugar.** Mesmo cabeçalho, mesma barra de filtros, mesma tabela, mesmo diálogo, mesmo toast, mesmas cores de estado.
4. **Sempre dizer o que está acontecendo.** Carregando = skeleton; vazio = EmptyState com ação; erro = QueryError com motivo e "Tentar de novo"; ação concluída = toast.

## Cores
- **Destaque (brand):** azul do logo, `blue-600` (`#2563eb`). Botão principal, links, foco, chip de filtro ativo, item ativo do menu.
- **Estados:** sucesso `emerald`, atenção `amber`, erro `red`, em execução `blue`, fila `cyan/sky`, neutro `slate`. Usar `tone.*` de `ui.ts` e `StatusBadge` para status de task.
- **Fundo:** página `slate-100`; cartões brancos; sidebar `slate-950`.
- Um único botão escuro/azul por tela (a ação principal). O resto é `secondary` (borda) ou `ghost`.

## Formas
- Cartões e diálogos: `rounded-xl` (`card`). Botões, inputs, selects: `rounded-lg`. Badges e chips: `rounded-full`.
- Altura padrão de botão e input: `h-10`; dentro de tabela: `h-8` (`btn.sm`) ou `btn.icon`.
- Foco visível em tudo que é clicável (`focusRing` já está nas classes de `ui.ts`).

## Estrutura de uma tela de lista
```
<section className={card}>
  <PageHeader title description actions={<botões>} />
  <FilterBar hasActiveFilters onClear>
    <SearchInput /> <SearchableSelect ... className="w-56" /> ...
  </FilterBar>
  <ActiveFilterChips chips={...} />          // opcional
  {isLoading ? <TableSkeleton/> : isError ? <QueryError onRetry/> : items.length === 0 ? <EmptyState action/> : <table className={table.table}>...}
  <Pagination />                             // quando paginada
</section>
```
- Cabeçalho: `PageHeader` (título `text-2xl`, descrição curta, ações à direita; `backTo` nas telas de detalhe).
- Atualização automática: `RefreshIndicator` (texto "Atualizado há X s" + botão), nunca contador.
- Tabela: classes `table.*`; linha clicável (`table.trClickable`) leva ao detalhe; nomes longos com `table.truncate` + `title`; coluna de ações à direita com `ActionsMenu`.
- Busca: `SearchInput`; filtros de lista usam `normalizeSearch` (ignora acento/maiúscula).
- Padrão de filtro: só ativos / últimos 7 dias, com chip visível e "Limpar filtros".
- Estado vazio: `EmptyState` com título, uma frase e o botão da ação ("Nova automação", "Limpar filtros").

## Estrutura de uma tela de detalhe
- `PageHeader` com `backTo`, `meta` (badges de estado) e as ações do registro à direita.
- Primeiro bloco = o que a pessoa veio ver (status, última execução, erro). ID e datas de criação/atualização vão para o fim ou para um bloco "Detalhes técnicos" recolhível.
- Grade de `InfoItem` (rótulo pequeno em caixa alta + valor) em 2 a 4 colunas.

## Formulários
- `label`, `input`, `select`, `textarea`, `hint`, `fieldError` de `ui.ts`.
- Erro de validação embaixo do campo, não em toast. Botão principal desabilitado enquanto inválido ou salvando.
- O formulário é montado só quando os dados chegam (`if (!data) return <DetailSkeleton/>`), nunca re-hidratado por efeito depois (isso sobrescrevia o que a pessoa digitava).
- Cancelar volta para o detalhe/lista; Ctrl+S salva quando fizer sentido.

## Feedback
- `toast.success / error / info` de `@/store/toast-store` (sem `ToastState` local, sem faixa colorida no topo da página).
- Confirmação: `ConfirmDialog` (`tone="danger"` para apagar/parar; `requireText` para o irreversível). Nunca `window.confirm`.
- Mensagem de erro de API: `getApiErrorMessage(error, "fallback")`, dizendo o que fazer quando der ("Já existe task aberta #123").

## Datas e números
- `formatDateTime` (26/10/2026, 14:05:33), `formatDateTimeShort`, `formatTimeSmart` (só hora se for hoje), `formatRelative` ("há 5 min"), `formatDuration` (2m 3s) de `@/lib/format`. Vazio = `---`.
