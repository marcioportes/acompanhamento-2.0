# Cloud Functions

> CFs são a cadeia de side-effects inquebrável (INV-03). Mudança em um elo exige análise de impacto em todos os elos downstream.

## Triggers de `trades`

| Function | Trigger | Responsabilidade |
|----------|---------|-----------------|
| `onTradeCreated` | `trades` onCreate | Atualiza PL do plano + compliance stats + emotional scoring. **Debt crítico:** dispara em trades `IMPORTED`, corrompendo PL. |
| `onTradeUpdated` | `trades` onUpdate | Recalcula PL, compliance, maturity (v1.43.0). |

## Callables (via API Claude — Sonnet 4.6)

| Function | Uso | Secret |
|----------|-----|--------|
| `classifyOpenResponse` | Classifica respostas abertas do onboarding | `ANTHROPIC_API_KEY` |
| `generateProbingQuestions` | Gera 3-5 perguntas de sondagem adaptativa | `ANTHROPIC_API_KEY` |
| `analyzeProbingResponse` | Analisa respostas do probing | `ANTHROPIC_API_KEY` |
| `generateAssessmentReport` | Relatório completo pré-mentor | `ANTHROPIC_API_KEY` |
| `classifyMaturityProgression` | Narrativa de progressão de maturidade (UP/regressão) | `ANTHROPIC_API_KEY` |
| `analyzeShadowBehavior` | 15 padrões comportamentais em segundo plano | `ANTHROPIC_API_KEY` |

## Schedule

| Function | Schedule | Responsabilidade |
|----------|----------|-----------------|
| `checkSubscriptions` | `0 8 * * *` (08h BRT) | Detecta vencimentos, marca overdue, expira trials, sincroniza accessTier (DEC-055/056) |

## Regras

- **Secrets:** toda CF com Claude API declara `secrets: ['ANTHROPIC_API_KEY']`.
- **Runtime:** Node.js 22.x (migrado de 20 em v1.22.0 — DT-016/028 resolvidos).
- **SDK:** firebase-functions ≥5.1.0 (era 4.9.0; atualizado em v1.22.0).
- **Pipeline:** `trades → onTradeCreated/Updated → (PL, compliance, emotional, maturity, mentor alerts)`. Qualquer mudança = análise de impacto em todos os downstream.
