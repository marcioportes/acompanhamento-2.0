/**
 * useCycleExpiredQueue.js — fila de ciclos vencidos pendentes de fechamento.
 *
 * Cruza plans + cycleClosures e retorna lista ordenada por cycleEnd asc.
 * Sequencial: só o primeiro item da fila é "actionable" (próximo a ser fechado).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Fonte de verdade do "ciclo está fechado":
 *   cycleClosures/{planId}_{cycleKey}.status === 'CLOSED'
 *
 * cycleKey:
 *   Mensal      → 'YYYY-MM'
 *   Trimestral  → 'YYYY-Q1..Q4'
 *   Semestral   → 'YYYY-S1|S2'
 *   Anual       → 'YYYY'
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { usePlans } from './usePlans';
import { useTrades } from './useTrades';
import {
  getCycleStartDate,
  getCycleEndDate,
} from '../utils/planStateMachine';

const PAD2 = (n) => String(n).padStart(2, '0');

const buildCycleKey = (adjustmentCycle, date) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (adjustmentCycle) {
    case 'Trimestral': return `${y}-Q${Math.floor(m / 3) + 1}`;
    case 'Semestral':
    case 'Semanal':    return `${y}-S${m < 6 ? 1 : 2}`;
    case 'Anual':      return `${y}`;
    case 'Mensal':
    default:           return `${y}-${PAD2(m + 1)}`;
  }
};

const toISO = (date) => {
  const y = date.getFullYear();
  const m = PAD2(date.getMonth() + 1);
  const d = PAD2(date.getDate());
  return `${y}-${m}-${d}`;
};

/**
 * Avança data pra próximo ciclo. Mensal +1mês, Trimestral +3 meses, etc.
 */
const advanceCycle = (adjustmentCycle, date) => {
  const d = new Date(date);
  switch (adjustmentCycle) {
    case 'Trimestral': d.setMonth(d.getMonth() + 3); break;
    case 'Semestral':
    case 'Semanal':    d.setMonth(d.getMonth() + 6); break;
    case 'Anual':      d.setFullYear(d.getFullYear() + 1); break;
    case 'Mensal':
    default:           d.setMonth(d.getMonth() + 1); break;
  }
  return d;
};

/**
 * Enumera ciclos passados (já terminados) entre startDate e now.
 *
 * @returns {Array<{cycleKey, cycleStart, cycleEnd, cycleNumber}>}
 */
function enumerateExpiredCycles(adjustmentCycle, startDate, now) {
  const out = [];
  let cursor = getCycleStartDate(adjustmentCycle, startDate);
  let cycleNumber = 1;
  while (cursor < now) {
    const cs = getCycleStartDate(adjustmentCycle, cursor);
    const ce = getCycleEndDate(adjustmentCycle, cursor);
    if (ce >= now) break;     // só ciclos que JÁ terminaram (ce < now)
    out.push({
      cycleNumber,
      cycleKey: buildCycleKey(adjustmentCycle, cursor),
      cycleStart: toISO(cs),
      cycleEnd: toISO(ce),
    });
    cursor = advanceCycle(adjustmentCycle, cursor);
    cycleNumber++;
    if (cycleNumber > 240) break;     // safety: 20 anos mensais
  }
  return out;
}

/**
 * @param {string} studentId
 * @param {{ plans?: Array, trades?: Array }} [injected]
 *   Opcional. Quando StudentDashboard/MentorDashboard já carregou plans/trades
 *   via seu próprio caminho de leitura (studentEmail no aluno, studentId no
 *   override do mentor), passar aqui evita refetch divergente.
 * @returns {{queue, loading}}
 *   queue: Array<{
 *     planId, planName, accountId, adjustmentCycle,
 *     cycleKey, cycleNumber, cycleStart, cycleEnd,
 *     daysOverdue,
 *     tradesCount, resultPercent,
 *     actionable: bool,                    // só o primeiro=true
 *   }>
 */
export function useCycleExpiredQueue(studentId, injected = {}) {
  // Hooks rodam sempre (regra dos hooks); quando injected, descartamos o resultado.
  // Fallback é raro (testes/uso isolado); caminho real do app injeta plans/trades
  // já carregados pelo Student/MentorDashboard via studentEmail (aluno) ou
  // studentId override (mentor visualizando aluno).
  const fetchedPlans = usePlans(studentId);
  const fetchedTrades = useTrades(studentId);
  const plans = injected.plans ?? fetchedPlans.plans ?? [];
  const trades = injected.trades ?? fetchedTrades.trades ?? [];
  const plansLoading = injected.plans ? false : fetchedPlans.loading;
  const tradesLoading = injected.trades ? false : fetchedTrades.loading;

  const [closures, setClosures] = useState([]);
  const [closuresLoading, setClosuresLoading] = useState(false);

  // Subscribe a cycleClosures CLOSED do aluno
  useEffect(() => {
    if (!studentId) return undefined;
    setClosuresLoading(true);
    const q = query(
      collection(db, 'cycleClosures'),
      where('studentId', '==', studentId),
      where('status', '==', 'CLOSED'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setClosures(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setClosuresLoading(false);
      },
      (err) => {
        console.error('[useCycleExpiredQueue] erro:', err);
        setClosuresLoading(false);
      },
    );
    return () => unsub();
  }, [studentId]);

  const queue = useMemo(() => {
    const now = new Date();
    const closedKeys = new Set(closures.map((c) => `${c.planId}_${c.cycleKey}`));
    const out = [];

    for (const plan of plans) {
      // Plano precisa estar ativo (não excluído) — se houver flag, respeitar
      if (plan?.archived === true) continue;

      const adjustmentCycle = plan.adjustmentCycle || 'Mensal';
      // Origem: createdAt do plano OU primeira data de trade desse plano (o que vier antes)
      const planCreatedAt = plan.createdAt?.toDate
        ? plan.createdAt.toDate()
        : plan.createdAt
          ? new Date(plan.createdAt)
          : null;
      const planTrades = trades.filter((t) => t.planId === plan.id && t.date);
      const firstTradeDate = planTrades.length > 0
        ? new Date(planTrades.map((t) => t.date).sort()[0] + 'T12:00:00')
        : null;
      const startDate = planCreatedAt || firstTradeDate || now;
      if (startDate >= now) continue;

      const cycles = enumerateExpiredCycles(adjustmentCycle, startDate, now);
      for (const c of cycles) {
        const key = `${plan.id}_${c.cycleKey}`;
        if (closedKeys.has(key)) continue;

        // Aggregar trades do ciclo
        const cycleTrades = planTrades.filter(
          (t) => t.date >= c.cycleStart && t.date <= c.cycleEnd,
        );
        const daysOverdue = Math.floor((now - new Date(c.cycleEnd + 'T23:59:59')) / 86400000);

        // Ciclo vazio: pula apenas se atraso < 7d. Acima disso, força reflexão
        // ("por que não operei?" → TILT, pausa, abandono são sinais valiosos).
        if (cycleTrades.length === 0 && daysOverdue < 7) continue;

        const result = cycleTrades.reduce((s, t) => s + (typeof t.result === 'number' ? t.result : 0), 0);
        const resultPercent = plan.pl > 0 ? (result / plan.pl) * 100 : null;

        out.push({
          planId: plan.id,
          planName: plan.name || plan.id,
          accountId: plan.accountId,
          adjustmentCycle,
          cycleKey: c.cycleKey,
          cycleNumber: c.cycleNumber,
          cycleStart: c.cycleStart,
          cycleEnd: c.cycleEnd,
          daysOverdue: Math.max(0, daysOverdue),
          tradesCount: cycleTrades.length,
          resultPercent,
        });
      }
    }

    out.sort((a, b) => a.cycleEnd.localeCompare(b.cycleEnd));
    // Só o primeiro é actionable (sequencial)
    return out.map((item, idx) => ({ ...item, actionable: idx === 0 }));
  }, [plans, trades, closures]);

  return {
    queue,
    loading: plansLoading || tradesLoading || closuresLoading,
  };
}

export default useCycleExpiredQueue;
