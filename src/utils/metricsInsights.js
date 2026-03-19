/**
 * metricsInsights.js -- Gerador de conclusoes diagnosticas para KPIs
 * @version 1.0.0 (v1.19.5)
 * 
 * Gera textos acionaveis para tooltips dos paineis de metricas.
 * Cada funcao recebe os dados e retorna um array de insights com severidade.
 * 
 * Insights sao contextuais: a mesma metrica gera textos diferentes
 * dependendo da combinacao com outras metricas.
 */

/**
 * Gera insights do painel Financeiro.
 * @param {Object} params
 * @param {Object} params.stats - { totalPL, winRate, profitFactor, totalTrades }
 * @param {number} params.drawdown
 * @param {Object} params.maxDrawdownData - { maxDD, maxDDPercent }
 * @param {Object|null} params.evLeakage - { evReal }
 * @param {string} params.currency
 * @returns {Array<{ text: string, severity: 'success'|'info'|'warning'|'danger' }>}
 */
export const getFinancialInsights = ({ stats, drawdown, maxDrawdownData, evLeakage, currency }) => {
  const insights = [];
  if (!stats) return insights;

  const cur = currency || 'BRL';
  const expectancy = evLeakage?.evReal;

  if (expectancy != null && !isNaN(expectancy)) {
    if (expectancy > 0) {
      insights.push({ text: `Resultado medio positivo: ${fmt(expectancy, cur)}/trade`, severity: 'success' });
    } else if (expectancy < 0) {
      insights.push({ text: `Resultado medio negativo: ${fmt(expectancy, cur)}/trade -- sistema sem vantagem no periodo`, severity: 'danger' });
    } else {
      insights.push({ text: 'Resultado medio zero -- breakeven no periodo', severity: 'warning' });
    }
  }

  if (stats.profitFactor != null && stats.profitFactor !== Infinity) {
    if (stats.profitFactor < 1) {
      insights.push({ text: `Profit Factor ${stats.profitFactor.toFixed(2)} -- perde mais do que ganha em valor absoluto`, severity: 'danger' });
    } else if (stats.profitFactor >= 2) {
      insights.push({ text: `Profit Factor ${stats.profitFactor.toFixed(2)} -- boa relacao ganho/perda`, severity: 'success' });
    }
  }

  if (drawdown > 10) {
    insights.push({ text: `Drawdown ${drawdown.toFixed(1)}% -- capital em risco significativo`, severity: 'danger' });
  } else if (drawdown > 5) {
    insights.push({ text: `Drawdown ${drawdown.toFixed(1)}% -- monitorar de perto`, severity: 'warning' });
  }

  if (maxDrawdownData?.maxDDPercent > 15) {
    insights.push({ text: `Max Drawdown historico de ${maxDrawdownData.maxDDPercent.toFixed(1)}% -- revisar gestao de risco`, severity: 'danger' });
  }

  if (insights.length === 0) {
    insights.push({ text: 'Metricas financeiras dentro dos parametros', severity: 'info' });
  }

  return insights;
};

/**
 * Gera insights do painel Desempenho.
 * @param {Object} params
 * @param {Object} params.stats - { winRate }
 * @param {Object|null} params.winRatePlanned - { rate, gap }
 * @param {Object|null} params.riskAsymmetry - { asymmetryRatio, avgRoEfficiency, winsCount }
 * @param {Object|null} params.complianceRate - { rate, violations }
 * @returns {Array<{ text: string, severity: 'success'|'info'|'warning'|'danger' }>}
 */
export const getPerformanceInsights = ({ stats, winRatePlanned, riskAsymmetry, complianceRate, asymmetryDiagnostic }) => {
  const insights = [];
  if (!stats) return insights;

  if (winRatePlanned && stats.winRate > 0) {
    const gap = stats.winRate - winRatePlanned.rate;
    if (gap > 30) {
      insights.push({ 
        text: `Acerta ${stats.winRate.toFixed(0)}% mas so ${winRatePlanned.rate.toFixed(0)}% atingem o alvo -- ansiedade de saida em ${gap.toFixed(0)}% dos wins`, 
        severity: 'danger' 
      });
    } else if (gap > 15) {
      insights.push({ 
        text: `WR Planejado ${winRatePlanned.rate.toFixed(0)}% vs WR ${stats.winRate.toFixed(0)}% -- saida antecipada em parte dos wins`, 
        severity: 'warning' 
      });
    } else if (gap <= 5) {
      insights.push({ text: 'Wins consistentes com o alvo do plano', severity: 'success' });
    }
  }

  if (riskAsymmetry && riskAsymmetry.asymmetryRatio != null && !isNaN(riskAsymmetry.asymmetryRatio)) {
    const ratio = riskAsymmetry.asymmetryRatio;
    if (ratio < 0.4) {
      insights.push({ 
        text: `Sizing critico: arrisca ${((1 - ratio) * 100).toFixed(0)}% menos nos wins que nos losses -- comportamento destrutivo`, 
        severity: 'danger' 
      });
    } else if (ratio < 0.7) {
      insights.push({ 
        text: `Sizing inconsistente: arrisca ${((1 - ratio) * 100).toFixed(0)}% menos nos wins`, 
        severity: 'warning' 
      });
    } else if (ratio >= 0.9 && ratio <= 1.1) {
      insights.push({ text: 'Sizing consistente entre wins e losses', severity: 'success' });
    }

    // Diagnostico contextual da assimetria (v1.19.6)
    if (ratio < 1.0 && asymmetryDiagnostic) {
      const { winsNoStop, winsTotal, lossesOverRisk, lossesTotal } = asymmetryDiagnostic;
      if (lossesOverRisk > 0 && lossesTotal > 0) {
        insights.push({
          text: `${lossesOverRisk} de ${lossesTotal} losses extrapolaram o risco planejado -- risco medio das perdas inflado`,
          severity: 'warning'
        });
      }
      if (winsNoStop > 0 && winsTotal > 0 && winsNoStop === winsTotal) {
        insights.push({
          text: `${winsNoStop} de ${winsTotal} wins sem stop -- risco nos acertos e estimado, nao medido`,
          severity: 'warning'
        });
      } else if (winsNoStop > 0 && winsTotal > 0) {
        insights.push({
          text: `${winsNoStop} de ${winsTotal} wins sem stop -- risco parcialmente estimado`,
          severity: 'warning'
        });
      }
    }
  }

  if (riskAsymmetry && !isNaN(riskAsymmetry.avgRoEfficiency)) {
    if (riskAsymmetry.avgRoEfficiency > 120) {
      insights.push({
        text: `Risco medio ${riskAsymmetry.avgRoEfficiency.toFixed(0)}% do permitido -- extrapolacao severa do plano`,
        severity: 'danger'
      });
    } else if (riskAsymmetry.avgRoEfficiency > 100) {
      insights.push({
        text: `Risco medio ${riskAsymmetry.avgRoEfficiency.toFixed(0)}% do permitido -- leve extrapolacao do plano`,
        severity: 'warning'
      });
    } else if (riskAsymmetry.avgRoEfficiency < 30) {
      insights.push({ 
        text: `Utiliza apenas ${riskAsymmetry.avgRoEfficiency.toFixed(0)}% do risco permitido -- opera muito abaixo da capacidade do plano`, 
        severity: 'warning' 
      });
    }
  }

  if (riskAsymmetry && riskAsymmetry.winsCount === 0) {
    insights.push({ text: 'Wins sem stop loss -- impossivel medir risco nos acertos', severity: 'warning' });
  }

  if (complianceRate && complianceRate.rate < 60) {
    insights.push({ 
      text: `${complianceRate.violations} violacoes em ${complianceRate.total} trades -- disciplina comprometida`, 
      severity: 'danger' 
    });
  }

  if (insights.length === 0) {
    insights.push({ text: 'Desempenho operacional dentro dos parametros', severity: 'info' });
  }

  return insights;
};

/**
 * Gera insights do painel Plano vs Resultado.
 * @param {Object} params
 * @param {Object|null} params.evLeakage - { evTheoretical, evReal, leakage, totalLeakage }
 * @param {Object|null} params.riskAsymmetry - { asymmetryRatio }
 * @param {Object|null} params.winRatePlanned - { rate, gap }
 * @param {Object} params.stats - { winRate }
 * @param {string} params.currency
 * @returns {Array<{ text: string, severity: 'success'|'info'|'warning'|'danger' }>}
 */
export const getPlanVsResultInsights = ({ evLeakage, riskAsymmetry, winRatePlanned, stats, currency }) => {
  const insights = [];
  const cur = currency || 'BRL';

  if (!evLeakage || evLeakage.leakage == null) {
    insights.push({ text: 'Dados insuficientes para avaliar aderencia ao plano', severity: 'info' });
    return insights;
  }

  const lk = evLeakage.leakage;

  if (lk < 0) {
    insights.push({ text: `Superando o plano -- entregando ${Math.abs(lk).toFixed(0)}% acima do esperado`, severity: 'success' });
  } else if (lk <= 10) {
    insights.push({ text: 'Execucao aderente ao plano', severity: 'success' });
  } else if (lk <= 30) {
    insights.push({ text: `Perda de ${lk.toFixed(0)}% do potencial do plano`, severity: 'info' });
  } else if (lk <= 60) {
    insights.push({ 
      text: `Captura apenas ${(100 - lk).toFixed(0)}% do potencial -- ${fmt(-evLeakage.totalLeakage, cur)} perdidos no periodo`, 
      severity: 'warning' 
    });
  } else {
    insights.push({ 
      text: `Perda critica: ${lk.toFixed(0)}% do potencial desperdicado -- ${fmt(-evLeakage.totalLeakage, cur)} perdidos`, 
      severity: 'danger' 
    });
  }

  // Diagnostico da causa principal
  if (lk > 15) {
    const hasAnxiety = winRatePlanned && stats && (stats.winRate - winRatePlanned.rate) > 20;
    const hasSizing = riskAsymmetry && riskAsymmetry.asymmetryRatio != null && riskAsymmetry.asymmetryRatio < 0.7;

    if (hasAnxiety && hasSizing) {
      insights.push({ text: 'Causa: saida antecipada nos wins + sizing inconsistente', severity: 'warning' });
    } else if (hasAnxiety) {
      insights.push({ text: 'Causa principal: saida antecipada -- wins nao atingem o alvo RR', severity: 'warning' });
    } else if (hasSizing) {
      insights.push({ text: 'Causa principal: sizing -- arrisca menos nos wins que nos losses', severity: 'warning' });
    }
  }

  return insights;
};

/**
 * Helper: formata moeda de forma compacta.
 */
const fmt = (value, currency) => {
  if (value == null || isNaN(value)) return '-';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? 'EUR' : 'R$';
  return `${sign}${sym} ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export default {
  getFinancialInsights,
  getPerformanceInsights,
  getPlanVsResultInsights,
};
