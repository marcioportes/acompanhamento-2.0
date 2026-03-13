## [1.19.3] - 2026-03-12

### Corrigido
- **C3: RR exibido com 2 casas decimais:** ExtractTable agora mostra `1.99:1` em vez de `2.0:1`. Red flags de RR também usam 2 casas. Resolve visual enganoso onde 1.99 arredondava para 2.0 parecendo compliant com alvo 2:1
- **C5: resultInPoints null quando há resultOverride:** Trades com resultado editado manualmente agora gravam `resultInPoints: null` em vez de manter o valor original dos pontos (inconsistente com o override). UI exibe "pts: editado" no TradeDetailModal e FeedbackPage

### Adicionado
- **Coluna Status Feedback no ExtractTable (QA #14):** Badge visual por trade indicando estado do feedback — Pendente (OPEN), Revisado (REVIEWED), Dúvida (QUESTION), Fechado (CLOSED). Usa campo `trade.status` já existente

### Modificado
- `ExtractTable.jsx` v4.0.0: Coluna Status com badges (CircleDot/CheckCircle2/HelpCircle/CheckCheck), RR `toFixed(2)`, colspan ajustado
- `compliance.js`: Red flag RR_BELOW_MINIMUM com 2 casas decimais na mensagem
- `useTrades.js`: `addTrade` e `updateTrade` (ambos caminhos: parciais e legado) setam `resultInPoints: null` quando `resultOverride` presente
- `TradeDetailModal.jsx`: Exibe "pts: editado" quando `resultInPoints` null e `resultEdited` true
- `FeedbackPage.jsx`: Mesmo tratamento de "Pontos: editado"
- `version.js`: v1.19.3+20260312

### Testes
- 8 novos testes: `resultInPointsOverride.test.js` — override zera pontos, sem override mantém, override zero válido, override negativo, string numérica, resultEdited flag
- 394 testes totais (17 suites), zero regressão
