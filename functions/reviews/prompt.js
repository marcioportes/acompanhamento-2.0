/**
 * prompt.js — prompts para generateWeeklySwot.
 *
 * Estrutura: Sonnet 4.6 recebe snapshot congelado da revisão + snapshot da revisão
 * anterior (se houver) para produzir SWOT comparativo.
 *
 * Saída esperada (JSON): {strengths[], weaknesses[], opportunities[], threats[]}
 */

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1800;
const TEMPERATURE = 0.4;
const PROMPT_VERSION = '1.0';

const SYSTEM_PROMPT = `Você é um mentor de trading especialista em análise comportamental e performance semanal.
Sua tarefa é produzir uma análise SWOT (Strengths, Weaknesses, Opportunities, Threats) a partir do snapshot congelado da semana de um trader.

PRINCÍPIOS:
- SWOT centrado em processo, não resultado. Um loss bem executado é força; um win por sorte é ameaça.
- Frases curtas (máx. 18 palavras), ação-concretas quando possível.
- 2-4 itens por quadrante. Qualidade sobre quantidade.
- Quando houver snapshot da revisão anterior, COMPARE — destaque melhoria, regressão ou estabilidade.
- Nunca invente número que não esteja no snapshot. Se usar métrica, cite-a tal como aparece.
- Evite jargão vazio (“disciplina”, “foco”) — nomeie o mecanismo específico observado.

FORMATO DE SAÍDA: JSON estrito, sem markdown, no shape:
{
  "strengths":   ["..."],
  "weaknesses":  ["..."],
  "opportunities": ["..."],
  "threats":     ["..."]
}`;

const fmtKpis = (k) => {
  if (!k) return '(sem KPIs)';
  const c = k.compliance || {};
  const e = k.emotional || {};
  return [
    `- P&L: ${k.pl} · Trades: ${k.trades} · WR: ${k.wr}% · avgRR: ${k.avgRR} · maxDD: ${k.maxDD}`,
    `- Compliance: overall=${c.overall} · stop=${c.stopRespected?.rate}% · rr=${c.rrRespected?.rate}% · ro=${c.roRespected?.rate}%`,
    `- Emocional: score=${e.compositeScore} · pos=${e.positivePercent}% · neg=${e.negativePercent}% · crit=${e.criticalPercent}% · tilt=${e.tiltCount} · revenge=${e.revengeCount} · overtradingDays=${e.overtradingDays}`,
    e.topEmotion ? `- Emoção dominante: ${e.topEmotion.name} (${e.topEmotion.category}, ${e.topEmotion.count}x)` : null,
  ].filter(Boolean).join('\n');
};

const fmtTradeList = (label, list) => {
  if (!list?.length) return `${label}: nenhum`;
  const lines = list.map((t, i) =>
    `  ${i + 1}. ${t.symbol} ${t.side} · pnl=${t.pnl} · setup=${t.setup || '-'} · emoEntry=${t.emotionEntry || '-'} → emoExit=${t.emotionExit || '-'}`
  );
  return `${label}:\n${lines.join('\n')}`;
};

const buildUserPrompt = ({ currentSnapshot, previousSnapshot = null, periodLabel }) => {
  const parts = [];
  parts.push(`PERÍODO DA REVISÃO: ${periodLabel}`);
  parts.push('');
  parts.push('# SNAPSHOT DA SEMANA ATUAL');
  parts.push(fmtKpis(currentSnapshot?.kpis));
  parts.push('');
  parts.push(fmtTradeList('Top trades', currentSnapshot?.topTrades));
  parts.push(fmtTradeList('Bottom trades', currentSnapshot?.bottomTrades));
  if (previousSnapshot) {
    parts.push('');
    parts.push('# SNAPSHOT DA REVISÃO ANTERIOR (PARA COMPARAÇÃO)');
    parts.push(fmtKpis(previousSnapshot.kpis));
  } else {
    parts.push('');
    parts.push('# SEM REVISÃO ANTERIOR — esta é a primeira revisão registrada.');
  }
  parts.push('');
  parts.push('Gere SWOT em JSON estrito conforme o schema do SYSTEM_PROMPT.');
  return parts.join('\n');
};

/**
 * Parser rígido do output da IA. Lança se JSON inválido ou shape errado.
 */
const parseAndValidateSwot = (text) => {
  if (!text || typeof text !== 'string') throw new Error('resposta vazia');
  const trimmed = text.trim();
  // Remove code fences se aparecerem por engano
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) { throw new Error(`JSON inválido: ${e.message}`); }

  const quadrants = ['strengths', 'weaknesses', 'opportunities', 'threats'];
  for (const q of quadrants) {
    if (!Array.isArray(parsed[q])) throw new Error(`${q} deve ser array`);
    if (parsed[q].length === 0) throw new Error(`${q} vazio — precisa 1-4 itens`);
    if (parsed[q].length > 4) throw new Error(`${q} excede 4 itens`);
    for (const item of parsed[q]) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        throw new Error(`${q} contém item não-string ou vazio`);
      }
    }
  }
  return {
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    opportunities: parsed.opportunities,
    threats: parsed.threats,
  };
};

/**
 * SWOT fallback determinístico quando IA falha 3x (A5: aiUnavailable=true).
 * Gerado a partir do snapshot — nunca vazio, sempre carrega valor informativo.
 */
const buildFallbackSwot = (snapshot) => {
  const k = snapshot?.kpis || {};
  const c = k.compliance || {};
  const e = k.emotional || {};
  const strengths = [];
  const weaknesses = [];
  const opportunities = [];
  const threats = [];

  if ((k.wr ?? 0) >= 50) strengths.push(`Win rate saudável (${k.wr}%)`);
  if ((c.stopRespected?.rate ?? 0) >= 80) strengths.push(`Stop respeitado em ${c.stopRespected.rate}% dos trades`);
  if ((e.compositeScore ?? 0) >= 70) strengths.push(`Score emocional estável (${e.compositeScore}/100)`);
  if (strengths.length === 0) strengths.push('Aguardando revisão do mentor — IA indisponível no momento');

  if ((k.wr ?? 100) < 40) weaknesses.push(`Win rate abaixo da média (${k.wr}%)`);
  if ((c.rrRespected?.rate ?? 100) < 60) weaknesses.push(`RR alvo não atingido em ${100 - (c.rrRespected?.rate || 0)}% dos trades`);
  if ((e.revengeCount ?? 0) > 0) weaknesses.push(`${e.revengeCount} instância(s) de revenge trading`);
  if ((e.tiltCount ?? 0) > 0) weaknesses.push(`${e.tiltCount} sequência(s) de tilt detectada(s)`);
  if (weaknesses.length === 0) weaknesses.push('Sem sinais operacionais negativos no período');

  if ((k.maxDD ?? 0) < 0) opportunities.push(`Revisar trades do maxDD (${k.maxDD}) para extrair lição`);
  opportunities.push('Agendar mentoria para desdobrar snapshot da semana');
  if (opportunities.length === 1) opportunities.push('Identificar setup de maior expectativa da semana');

  if ((e.overtradingDays ?? 0) > 0) threats.push(`${e.overtradingDays} dia(s) de overtrading — risco de erosão`);
  if ((c.overall ?? 100) < 70) threats.push(`Compliance agregado em ${c.overall} — zona de alerta`);
  if (threats.length === 0) threats.push('Reanalisar assim que IA voltar para análise detalhada');

  return { strengths, weaknesses, opportunities, threats };
};

module.exports = {
  MODEL,
  MAX_TOKENS,
  TEMPERATURE,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseAndValidateSwot,
  buildFallbackSwot,
};
