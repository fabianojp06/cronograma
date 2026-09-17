# SCHEMA.md — Modelo de dados do Sistema Cronograma

Rascunho de schema Prisma. O Claude Code deve usar isto como ponto de partida na
Etapa 1 do backlog (`PROGRESS.md`) e ajustar conforme necessário, documentando
qualquer desvio no "Log de decisões".

```prisma
enum StatusAcao {
  NAO_INICIADO
  EM_CURSO_25
  EM_CURSO_50
  EM_CURSO_75
  CONCLUIDO
}

model Projeto {
  id             String   @id @default(cuid())
  referencia     String?  // ex: "CRO-DEP-2026-001"
  nome           String
  equipe         String?  // ex: STI, GIA, GRH
  natureza       String?  // ex: Desenvolvimento, Infraestrutura, Iniciativa
  categoria      String?
  responsavel    String?
  apoio          String?
  setorEnvolvido String?
  comentario     String?
  prioridade     Int?
  ativo          Boolean  @default(true) // soft delete
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  acoes          Acao[]
}

model Acao {
  id                  String     @id @default(cuid())
  projetoId           String
  projeto             Projeto    @relation(fields: [projetoId], references: [id])
  numero              Int        // sequencial dentro do projeto
  descricao           String
  status              StatusAcao @default(NAO_INICIADO)

  previstoInicio      DateTime?
  previstoTermino     DateTime?
  realizadoInicio     DateTime?
  realizadoTermino    DateTime?
  duracaoDiasUteis    Int?       // calculado, não editável diretamente

  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  historico           HistoricoAlteracao[]

  @@unique([projetoId, numero])
}

model HistoricoAlteracao {
  id            String   @id @default(cuid())
  acaoId        String
  acao          Acao     @relation(fields: [acaoId], references: [id])
  campo         String   // ex: "status", "previstoTermino"
  valorAntigo   String?
  valorNovo     String?
  alteradoEm    DateTime @default(now())
  alteradoPor   String?  // login/nome de quem alterou, se aplicável
}
```

## Notas de mapeamento (planilha → sistema)

| Campo na planilha (PLA-DEP) | Campo no sistema |
|---|---|
| N° | `Projeto.referencia` ou `Acao.numero` (conforme granularidade) |
| Prioridade | `Projeto.prioridade` |
| Equipe | `Projeto.equipe` |
| Natureza | `Projeto.natureza` |
| Assunto (Projeto / Iniciativa) | `Projeto.nome` |
| Status | derivado de `Acao.status` agregado |
| Ação | `Acao.descricao` |
| Responsável / Apoio / Setor Envolvido | `Projeto.responsavel` / `apoio` / `setorEnvolvido` |
| Comentário | `Projeto.comentario` |
| Categoria | `Projeto.categoria` |
| Progresso | derivado de `Acao.status` (percentual embutido no enum) |
| Início / Término (linha Previsto) | `Acao.previstoInicio` / `previstoTermino` |
| Início / Término (linha Realizado) | `Acao.realizadoInicio` / `realizadoTermino` |
| Duração (dias úteis) | `Acao.duracaoDiasUteis` (calculado) |
| Grade semanal de colunas | não precisa virar coluna alguma — é derivada das datas na renderização do Gantt |
