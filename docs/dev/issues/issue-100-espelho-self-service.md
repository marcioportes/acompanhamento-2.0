# Issue #100 — Espelho: Modo Self-Service

**Tipo:** Épico
**Prioridade:** CRÍTICA
**Branch:** `feature/espelho-self-service`
**Origem:** Sessão estratégica 29/03/2026 (DEC-P07)
**Dependência:** Issue #097 (AI Assessment Report) deve estar mergeado
**Objetivo:** Permitir que alunos sem mentor usem a plataforma Espelho com acesso a KPIs e diário de trading, viabilizando o tier self-service do modelo de dois tiers.

---

## Contexto

O Acompanhamento 2.0 (nome público: Espelho) foi construído com o mentor como parte integral do fluxo. Com a decisão de oferecer a plataforma em modo self-service (aluno opera sozinho, sem feedback individual), é necessário adaptar a UI para esconder funcionalidades exclusivas da Mentoria Alpha e garantir que o aluno self-service extraia valor dos KPIs e do diário sem confusão.

### Situação atual (61 alunos)

- 13 VIP: usam a plataforma com feedback individual do mentor → **Mentoria Alpha**
- 48 ativos: grupo WhatsApp + sessões de pregão, SEM plataforma → migram para **Espelho self-service**

### Diferenciação entre tiers

| Funcionalidade | Espelho Self-Service | Mentoria Alpha |
|---|---|---|
| Registro de trades (diário) | ✅ | ✅ |
| KPIs automáticos (payoff, RO, compliance, scores) | ✅ | ✅ |
| Nota de evolução por dimensão (gates) | ✅ | ✅ |
| Detecção de padrões (TILT, revenge) | ✅ | ✅ |
| Gráficos de evolução | ✅ | ✅ |
| Grupo WhatsApp + sessões de pregão | ✅ | ✅ |
| Acesso ao mentor via WhatsApp/canais | ✅ | ✅ |
| SWOT dinâmico (análise KPIs + diagnóstico por gate + prescrição) | ✅ | ✅ |
| **Fechamento de ciclo** | ❌ Exclusivo | ✅ |
| **Assessment Comportamental (relatório AI)** | ❌ Exclusivo | ✅ |
| **Feedback individual do mentor** | ❌ Exclusivo | ✅ |
| **Validação de ciclo** | ❌ Exclusivo | ✅ |
| **Probing questions / aprofundamento** | ❌ Exclusivo | ✅ |
| **Sessões 1:1** | ❌ Exclusivo | ✅ |

### Resultado esperado

Aluno self-service consegue:
1. Registrar trades e ver seu diário completo
2. Visualizar todos os KPIs automáticos (payoff, RO, compliance, scores emocionais)
3. Ver sua nota de evolução por dimensão do 4D (gates — sabe onde está)
4. Ver detecção de padrões (TILT, revenge trading)
5. Acompanhar gráficos de evolução ao longo do tempo
6. **NÃO vê:** fechamento de ciclo, assessment AI, SWOT dinâmico (diagnóstico + prescrição por gate), feedback, probing questions

**Tensão de upsell natural:** O aluno self-service vê os números (KPIs) e sabe em que estágio está (nota/gate), mas não tem acesso à análise que interpreta esses números e prescreve o que fazer para avançar (SWOT). A curiosidade + frustração de "vejo onde estou mas não sei como avançar" é o motor orgânico de conversão para Mentoria Alpha.

---

## Análise de Impacto (Gate Obrigatório — Passo 1)

### Collections afetadas

| Collection | Impacto | Detalhe |
|---|---|---|
| `students` | MODIFICAÇÃO | Novo campo: `mentorshipTier` (enum: `self-service` \| `alpha`) |
| `trades` | NENHUM | Fluxo de registro não muda |
| `plans` | NENHUM | Ciclos são exclusivos da Mentoria Alpha |
| `cycles` | NENHUM | Exclusivo Mentoria Alpha |
| `assessments` | NENHUM | Exclusivo Mentoria Alpha |
| `questionnaires` | NENHUM | Exclusivo Mentoria Alpha |

### Cloud Functions afetadas

| Function | Impacto | Detalhe |
|---|---|---|
| `classifyOpenResponse` | NENHUM | Exclusivo Mentoria Alpha |
| `onTradeCreated` | NENHUM | Trigger automático, funciona para ambos tiers |
| `recalculateCompliance` | NENHUM | Automático, funciona para ambos tiers |
| Demais CFs | NENHUM | Nenhuma CF nova necessária |

### Hooks/Listeners afetados

| Hook/Component | Impacto | Detalhe |
|---|---|---|
| Dashboard principal | MODIFICAÇÃO | Esconder seções exclusivas Alpha para self-service |
| `AIAssessmentReport` | CONDICIONAL | Esconder para self-service (`mentorshipTier !== 'alpha'`) |
| `ProbingQuestionsPanel` | CONDICIONAL | Esconder para self-service |
| `CycleNavigation` | CONDICIONAL | Esconder para self-service |
| Feedback components | CONDICIONAL | Esconder para self-service |

### Side-effects

| Área | Risco | Mitigação |
|---|---|---|
| PL calculation | Nenhum (automático) | — |
| Compliance scoring | Nenhum (automático) | — |
| Emotional scoring | Nenhum (automático) | — |
| KPIs | Nenhum (automáticos, não dependem do mentor) | — |

**Nota:** Este épico é de baixo risco técnico. Nenhuma Cloud Function é criada ou modificada. O impacto é primariamente de UI: esconder/mostrar componentes com base no tier do aluno.

---

## Sub-tarefas

### C1: Campo `mentorshipTier` no Student

**Objetivo:** Distinguir alunos self-service de alunos Mentoria Alpha.

- Adicionar campo `mentorshipTier` ao documento do student em Firestore
- Valores: `self-service` | `alpha`
- Default para novos alunos: `self-service`
- Migração dos 13 VIP atuais: setar como `alpha`
- UI do mentor: permitir visualizar e alterar tier de cada aluno

**Impacto:** `students` collection. Nenhum CF afetado.

**Testes:**
- Verificar que campo persiste corretamente
- Verificar que mentor consegue alterar tier
- Verificar default para novo aluno

### C2: UI Condicional — Esconder Funcionalidades Alpha

**Objetivo:** Aluno self-service vê apenas o que pertence ao seu tier.

Componentes a esconder quando `mentorshipTier === 'self-service'`:

| Componente / Seção | Ação |
|---|---|
| Fechamento de ciclo (botão/fluxo) | Esconder |
| AI Assessment Report | Esconder |
| SWOT dinâmico (análise KPIs + diagnóstico por gate + prescrição) | Esconder |
| Probing Questions Panel | Esconder |
| Feedback do mentor (visualização e envio) | Esconder |
| Validação de ciclo | Esconder |
| Navegação de ciclos (se visível para aluno) | Esconder |

Componentes que permanecem visíveis para ambos tiers:

| Componente / Seção | Status |
|---|---|
| Registro de trades (AddTradeModal) | Mantém |
| Dashboard de KPIs (payoff, RO, compliance) | Mantém |
| Scores emocionais | Mantém |
| Gráficos de evolução | Mantém |
| Detecção de padrões (TILT, revenge) | Mantém |
| Semáforos e indicadores visuais | Mantém |
| CSV Import | Mantém |

**Implementação:**
- Criar hook `useMentorshipTier()` que lê `mentorshipTier` do student logado
- Usar condicionais na renderização: `{isAlpha && <ComponenteExclusivo />}`
- Alternativa: prop `tier` passada nos componentes relevantes

**Testes:**
- Aluno self-service NÃO vê componentes exclusivos Alpha
- Aluno Alpha vê tudo (sem regressão)
- Troca de tier reflete imediatamente na UI

### C3: Dashboard Self-Service — Ajustes de Layout

**Objetivo:** A dashboard do aluno self-service deve parecer completa, não "com buracos" onde os componentes Alpha foram removidos.

- Reorganizar layout da dashboard quando componentes são escondidos
- Garantir que os KPIs visíveis ocupam o espaço de forma adequada
- Opcional: adicionar seção informativa tipo "Quer ir mais fundo? Conheça a Mentoria Alpha" no espaço que seria do assessment/feedback (upsell contextual)

**Impacto:** Layout/CSS, nenhuma lógica de negócio.

### C4: Rename Externo — Espelho

**Objetivo:** Trocar referências públicas de "Acompanhamento 2.0" para "Espelho".

- `<title>` do HTML → "Espelho — Marcio Portes"
- Logo/header do app → "Espelho"
- Textos de UI que referenciem "Acompanhamento 2.0" → "Espelho"
- Favicon (se aplicável)
- DebugBadge: manter referência técnica interna (não mudar)

**O que NÃO muda:**
- Nome do repo GitHub
- Nome do Firebase project
- Nome do Vercel project
- Nomes de collections, functions, variáveis no código
- Documentação técnica interna (docs/PROJECT.md, CHANGELOG, etc.)

### C5: Custom Domain

**Objetivo:** App acessível via `app.marcioportes.com.br`.

- Configurar custom domain no Vercel: `app.marcioportes.com.br`
- DNS: CNAME `app` → `cname.vercel-dns.com`
- Firebase Auth: adicionar domínio autorizado
- Testar login/auth no novo domínio
- Manter domínio antigo funcionando (redirect ou dual) durante transição

**Nota:** Esta sub-tarefa pode ser feita independentemente das demais.

---

## Escopo e Sequência

```
C1 (mentorshipTier)     → Fundação, habilita todo o resto
        │
        ├── C2 (UI condicional)  → Core do épico
        │       │
        │       └── C3 (layout)  → Polish
        │
        ├── C4 (rename)          → Independente, pode ser paralelo
        │
        └── C5 (custom domain)   → Independente, pode ser paralelo
```

C1 é pré-requisito para C2 e C3. C4 e C5 são independentes e podem ser feitos a qualquer momento.

---

## Critérios de Aceite

1. Aluno com `mentorshipTier: 'self-service'` vê: diário, KPIs, scores, gráficos, padrões
2. Aluno com `mentorshipTier: 'self-service'` NÃO vê: ciclos, assessment AI, feedback, probing questions
3. Aluno com `mentorshipTier: 'alpha'` mantém comportamento atual (zero regressão)
4. Mentor consegue visualizar tier de cada aluno e alterar
5. Dashboard self-service sem "buracos" visuais
6. App exibe "Espelho" em título, header, textos públicos
7. `app.marcioportes.com.br` funciona com auth
8. Testes cobrindo condicionais de tier

---

## Estimativa

| Sub-tarefa | Esforço | Sessões Claude estimadas |
|---|---|---|
| C1: mentorshipTier | Baixo | 1 sessão |
| C2: UI condicional | Médio | 2-3 sessões |
| C3: Layout ajustes | Baixo | 1 sessão |
| C4: Rename externo | Baixo | 1 sessão |
| C5: Custom domain | Baixo | 1 sessão (+ config DNS manual) |
| **Total** | **~6-7 sessões** | |

---

## Notas

- Este épico é de **baixo risco técnico**: nenhuma CF nova, nenhuma collection nova, nenhuma lógica de negócio alterada. É primariamente UI condicional.
- Issue #097 (AI Assessment Report) deve estar mergeado antes de C2, pois C2 precisa saber quais componentes esconder.
- Os debts críticos (Node.js 20 deprecation 30/04/2026, firebase-functions SDK ≥5.1.0) devem ser resolvidos em paralelo ou antes deste épico.
- A comunicação ao grupo sobre o novo modelo de tiers deve ser coordenada com o deploy deste épico.
- O upsell contextual (C3) na dashboard self-service é opcional mas recomendado — é vitrine para Mentoria Alpha dentro do produto.
