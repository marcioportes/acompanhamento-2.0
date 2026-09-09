/**
 * windowBalance.js
 * @description Patrimônio da JANELA selecionada na ContextBar — issue #432.
 *
 * PROBLEMA QUE RESOLVE:
 *   O painel Financeiro lia `account.currentBalance` (o saldo de AGORA) ao lado do
 *   resultado da janela selecionada. Selecionar um ciclo fechado mostrava o resultado
 *   daquele ciclo colado no patrimônio de hoje: dois números de períodos diferentes,
 *   sem o PL inicial que dá sentido ao resultado.
 *
 * CONTRATO — a identidade que faz o card fechar:
 *   abertura(janela) + resultado(janela) = saldo ao FIM da janela
 *
 *   `currentBalance` é escalar sem dimensão temporal: para qualquer janela que não
 *   termine hoje, ele responde outra pergunta. Por isso o saldo aqui é DERIVADO.
 *
 * PATRIMONIAL ≠ AMOSTRA (a distinção que evita o número mentiroso):
 *   `windowTrades` são os trades da janela SEM os filtros granulares (ticker, setup,
 *   emoção, busca). Filtrar por ticker encolhe a amostra que se quer analisar, não o
 *   patrimônio do aluno — somar a abertura com um recorte produziria um "saldo" que
 *   nunca existiu. O recorte vive no tile de Resultado (`stats.totalPL`); o patrimônio
 *   vive aqui.
 *
 * MOEDAS NUNCA SE SOMAM (#289): uma entrada por moeda, sem conversão cambial em
 * ponto nenhum. Contas de moedas diferentes têm aberturas independentes.
 *
 * @see src/utils/openingBalance.js — computeOpeningBalance (carry-over entre ciclos, #267)
 * @see src/hooks/useDashboardMetrics.js — consumidor
 */

import { computeOpeningBalance } from './openingBalance';
import { resolveCurrency } from './currency';

/**
 * Patrimônio da janela, por moeda.
 *
 * @param {Object} params
 * @param {Array}  params.accounts        — contas no escopo ativo (accountsInScope)
 * @param {Date|string|null} params.windowStart — início da janela; null = todo o histórico
 * @param {Array}  params.tradesForCarry  — trades do escopo SEM recorte de janela (alimenta a abertura)
 * @param {Array}  params.windowTrades    — trades DENTRO da janela, sem filtros granulares
 * @param {Array}  params.closures        — cycleClosures do escopo (ajuste manual não-trade)
 * @returns {Map<string, {currency, opening, result, end, accountCount}>}
 */
export const buildWindowBalances = ({
  accounts = [],
  windowStart = null,
  tradesForCarry = [],
  windowTrades = [],
  closures = [],
}) => {
  const out = new Map();
  if (!Array.isArray(accounts) || accounts.length === 0) return out;

  // Uma conta pertence a exatamente uma moeda — o agrupamento é particionamento.
  const byCurrency = new Map();
  for (const acc of accounts) {
    if (!acc?.id) continue;
    const currency = resolveCurrency(acc?.currency);
    if (!byCurrency.has(currency)) byCurrency.set(currency, { ids: new Set(), initial: 0 });
    const group = byCurrency.get(currency);
    group.ids.add(acc.id);
    group.initial += Number(acc?.initialBalance) || 0;
  }

  for (const [currency, group] of byCurrency.entries()) {
    const inGroup = (t) => group.ids.has(t?.accountId);

    const opening = computeOpeningBalance({
      windowStart,
      initialBalance: group.initial,
      trades: (tradesForCarry || []).filter(inGroup),
      closures: (closures || []).filter(inGroup),
    });

    const result = (windowTrades || [])
      .filter(inGroup)
      .reduce((sum, t) => sum + (Number(t?.result) || 0), 0);

    out.set(currency, {
      currency,
      opening,
      result,
      end: opening + result,
      accountCount: group.ids.size,
    });
  }

  return out;
};

/**
 * Soma das entradas de um Map de `buildWindowBalances` — só é legítimo chamar quando
 * o escopo é de MOEDA ÚNICA (dominantCurrency != null). Com moedas diferentes o
 * resultado não tem significado e a UI deve renderizar linha a linha.
 */
export const totalsForSingleCurrency = (balances) => {
  const entries = [...(balances?.values?.() || [])];
  if (entries.length === 0) return { opening: 0, result: 0, end: 0 };
  return entries.reduce(
    (acc, b) => ({ opening: acc.opening + b.opening, result: acc.result + b.result, end: acc.end + b.end }),
    { opening: 0, result: 0, end: 0 }
  );
};

export default buildWindowBalances;
