# Momentos (pontos de retorno do visual)

Cada "momento" é uma tag no git dos dois repositórios. Para voltar o painel a um momento, basta
publicar aquele ponto na main (os comandos estão no fim). Nada é apagado: os momentos seguintes
continuam no histórico e nas tags.

| Momento | Front (tag) | Back (tag) | O que é |
|---|---|---|---|
| **0** | `momento-0` = `5faf3d1` | `momento-0` = `e756d01` | Visual anterior: sidebar escura, barra branca em cima, fundo gelo. Já com as telas padronizadas (filtros, tabelas, Executar agora, Rodar de novo, tokens, MCP). |
| **1** | `momento-1` = `5277ce2` | `momento-1` = `e756d01` | "Claro e leve": sidebar branca translúcida com usuário no rodapé, sem barra em cima, fundo branco-azulado, cards com sombra suave, busca Ctrl+K, transição entre telas. |
| **2** | `momento-2` | `momento-2` | Cores puxadas para o padrão dos sistemas ALZ: fundo gelo, menu em gelo mais escuro com letra maior e negrito, cabeçalho de tabela mais marcado, linhas mais espaçadas, campos arredondados. Modal do Health corrigido. |

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
