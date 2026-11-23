<!-- Promoção: homologacao → main (produção). Abra com ?template=promocao.md -->

## O que sobe para produção
<!-- Resuma as etapas que entram neste PR, uma linha por etapa. -->

## Migrations
- [ ] Este PR **não** tem migration nova.
- [ ] Este PR **tem** migration nova, e ela é **aditiva** (nada de DROP, renomear ou mudar tipo de coluna que já tem dado). O build de produção aplica a migration **antes** do código no ar, no banco real.
- Se tem migration, confirme também:
  - [ ] Ela já rodou no banco da homologação (o build de lá a aplicou).
  - [ ] Índices e CHECK que só existem em SQL (limite de 3 WINs) seguem presentes.

## Validação na homologação
- [ ] Entrei em `cronograma-homologacao.vercel.app` e conferi a funcionalidade nova.
- [ ] Os testes de navegador e a suíte estão verdes neste PR.
- [ ] Conferi o manual (`/manual`) e o `CLAUDE.md` das funcionalidades novas.

## Depois do merge
- [ ] `/api/saude` de produção responde `ok`.
- [ ] Houve migration? Conferi no log do deploy que ela foi aplicada.

Aprovação de quem administra o sistema. O autoloop nunca mescla este PR.
