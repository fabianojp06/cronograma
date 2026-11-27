# Manual do Usuário

Esta pasta reúne o manual do Sistema Cronograma CTCEA para leitura fora do sistema.

| Arquivo | O que é | Como é feito |
|---|---|---|
| `manual-do-usuario.md` | O manual completo em texto | **Gerado** de `src/lib/manual-conteudo.ts` por `npm run gerar:manual` |

| `pdf/perfil/` | Um PDF por perfil: `manual-colaborador.pdf` e `manual-administrador.pdf`, com capa e índice | **Gerados** por `npm run gerar:manual-pdf` |
| `pdf/funcionalidades/` | Um PDF por funcionalidade (`NN-nome.pdf`), mais o guia dos relatórios | **Gerados** pelo mesmo comando |
| `pdf/manifest.json` | Hash do conteúdo de cada PDF: prova que estão em dia | Gerado junto |

O manual de verdade mora dentro do sistema, na tela `/manual`. Esta pasta é uma cópia
gerada dele: **não edite os arquivos gerados**, altere a fonte e gere de novo.

Dois testes (`manual-markdown.test.ts` e `manual-pdf-plano.test.ts`) falham se o Markdown ou
os PDFs ficarem desatualizados em relação ao manual do sistema. O PDF em si muda de bytes a
cada geração; por isso o teste compara o `manifest.json`, não o arquivo.
