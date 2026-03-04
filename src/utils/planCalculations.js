/**
 * planCalculations.js
 * @version 1.0.0 (v1.15.0)
 * @description Funções puras de cálculo de P&L por período e ciclo.
 *   Extraídas do StudentDashboard para reuso e testabilidade.
 */

/**
 * Calcula P&L de um período operacional (Diário, Semanal, Mensal).
 * @param {Array} trades - Trades do plano
 * @param {string} periodType - 'Diário' | 'Semanal' | 'Mensal'
 * @returns {number} P&L do período atual
 */
export const calculatePeriodPnL = (trades, periodType) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let startDate;
  switch (periodType) {
    case 'Diário': startDate = startOfDay; break;
    case 'Semanal': startDate = startOfWeek; break;
    case 'Mensal': startDate = startOfMonth; break;
    default: startDate = startOfWeek;
  }
  return trades.filter(t => new Date(t.date) >= startDate).reduce((sum, t) => sum + (Number(t.result) || 0), 0);
};

/**
 * Calcula P&L de um ciclo de ajuste (Semanal, Mensal, Trimestral).
 * @param {Array} trades - Trades do plano
 * @param {string} cycleType - 'Semanal' | 'Mensal' | 'Trimestral'
 * @returns {number} P&L do ciclo atual
 */
export const calculateCyclePnL = (trades, cycleType) => {
  const now = new Date();
  let startDate;
  switch (cycleType) {
    case 'Semanal': 
      startDate = new Date(now); 
      startDate.setDate(now.getDate() - now.getDay()); 
      startDate.setHours(0, 0, 0, 0); 
      break;
    case 'Mensal': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'Trimestral': startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
    default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return trades.filter(t => new Date(t.date) >= startDate).reduce((sum, t) => sum + (Number(t.result) || 0), 0);
};

/**
 * Helpers de filtro de tipo de conta.
 */
export const isRealAccount = (acc) => acc.type === 'REAL' || acc.type === 'PROP' || acc.isReal === true;
export const isDemoAccount = (acc) => acc.type === 'DEMO' || acc.isReal === false || acc.isReal === undefined;
