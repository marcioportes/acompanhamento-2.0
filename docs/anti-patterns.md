# Anti-Patterns Documentados

> AP-01..08 — padrões a EVITAR. Documentados para prevenir recorrência.



### AP-01: Shortcut Through Production
Escrever dados externos diretamente em collections de produção. Cloud Functions não distinguem origem — dados incompletos disparam o mesmo pipeline que dados válidos.

### AP-02: Patch Cascading
Quando um bypass causa bugs, adicionar guards em cada componente afetado em vez de corrigir a causa raiz. Cada patch é um ponto de falha adicional.

### AP-03: Optimistic Reuse
Assumir que uma collection/método pode ser reaproveitada sem análise de impacto. Collections têm contratos implícitos com CFs e listeners.

### AP-04: Invariant Drift
Claude recebe diretrizes explícitas e as ignora em nome de eficiência. Entrega código sem testes, sem version.js, sem CHANGELOG, sem aguardar aprovação.

### AP-05: Promessa Verbal Sem Execução
Claude reconhece a falha (AP-04), verbaliza compromisso de seguir invariantes, e viola as mesmas regras na mesma sessão. Mais grave que AP-04 — destrói confiança.

### AP-06: Criação de Estruturas Firestore Sem Aprovação
Claude assume como o banco funciona em vez de verificar. Nunca criar subcollections, campos ou estruturas novas sem grep no código existente + aprovação explícita.

### AP-07: Inferência Superficial
Claude afirma algo sobre fluxo de dados, origem de campos ou estado de implementação baseado em leitura parcial ou nomes de variáveis, sem rastrear o fluxo real. Regra: se não leu todos os arquivos relevantes, não afirma.

### AP-08: Build Verde, App Quebrada
`vite build` e `vitest run` passam mas o app não renderiza no browser. Build faz tree-shaking estático, testes com jsdom não executam a ordem real de hooks/variáveis no componente completo. Erros de TDZ (temporal dead zone), ordenação de hooks, e dependências circulares só aparecem no browser. Regra: antes de apresentar gate pré-entrega, rodar `npm run dev` e confirmar que as telas afetadas renderizam. Console do browser limpo (sem erros vermelhos) é evidência obrigatória.

---

