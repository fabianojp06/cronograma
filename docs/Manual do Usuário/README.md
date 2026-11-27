# Manual do Usuário

Esta pasta reúne o manual do Sistema Cronograma CTCEA para leitura fora do sistema.

| Arquivo | O que é | Como é feito |
|---|---|---|
| `manual-do-usuario.md` | O manual completo em texto | **Gerado** de `src/lib/manual-conteudo.ts` por `npm run gerar:manual` |

| `pdf/perfil/` | Um PDF por perfil: `manual-colaborador.pdf` e `manual-administrador.pdf`, com capa e índice | **Gerados** por `npm run gerar:manual-pdf` |
| `pdf/funcionalidades/` | Um PDF por funcionalidade (`NN-nome.pdf`), mais o guia dos relatórios | **Gerados** pelo mesmo comando |
| `pdf/manifest.json` | Hash do conteúdo de cada PDF: prova que estão em dia | Gerado junto |

| `video/<nome>/` | Manual **narrado** em HTML: uma página que se lê sozinha, com MP3 embutido, destaque do trecho, legenda e capturas de tela | Roteiro em `roteiro.json`; telas por `npm run capturar:telas-manual`; página por `npm run gerar:manual-video -- <nome>` |

### Como fazer um manual narrado

1. **Roteiro**: `roteiro.json` (trechos, texto da página e texto falado).
2. **Telas**: `npm run capturar:telas-manual -- <nome>` (só contra banco e servidor locais; ver o cabeçalho do script).
3. **Voz**: cole `pedido-narracao.md` no Claude web e peça um MP3 por trecho, nomeado pelo `id`. Ponha os arquivos em `audio/`.
4. **Página**: `npm run gerar:manual-video -- <nome>` mede os MP3, calcula os tempos e grava `<nome>.html`.

O manual de verdade mora dentro do sistema, na tela `/manual`. Esta pasta é uma cópia
gerada dele: **não edite os arquivos gerados**, altere a fonte e gere de novo.

Dois testes (`manual-markdown.test.ts` e `manual-pdf-plano.test.ts`) falham se o Markdown ou
os PDFs ficarem desatualizados em relação ao manual do sistema. O PDF em si muda de bytes a
cada geração; por isso o teste compara o `manifest.json`, não o arquivo.
