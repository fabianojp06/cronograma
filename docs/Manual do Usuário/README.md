# Manual do Usuário

Esta pasta reúne o manual do Sistema Cronograma CTCEA para leitura fora do sistema.

| Arquivo | O que é | Como é feito |
|---|---|---|
| `manual-do-usuario.md` | O manual completo em texto | **Gerado** de `src/lib/manual-conteudo.ts` por `npm run gerar:manual` |

O manual de verdade mora dentro do sistema, na tela `/manual`. Esta pasta é uma cópia
gerada dele: **não edite os arquivos gerados**, altere a fonte e gere de novo.

Um teste (`src/lib/manual-markdown.test.ts`) falha se o arquivo ficar desatualizado em
relação ao manual do sistema.
