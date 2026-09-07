/**
 * Fixture do módulo do mentor (issue #427)
 *
 * Uma fonte de dado, dois consumidores: o harness visual e os testes Vitest.
 *
 * TODAS as datas são relativas ao `hoje` injetado. Isso não é preferência de
 * estilo — `buildMentorRadar` classifica por `diasSemOperar` e por semana
 * corrente (`src/utils/mentorRiskRadar.js`). Fixture com data absoluta envelhece
 * em 24h e a turma inteira migra para a faixa "Inativo", o que tornaria o
 * screenshot de ontem incomparável com o de hoje.
 *
 * A composição é deliberada, não aleatória: cada uma das 7 faixas tem pelo menos
 * um aluno, senão a lista da turma — que é a espinha visual da Torre — não é
 * avaliável. E os buckets de assinatura são mistos de propósito, para o header da
 * Torre (só alpha + trial-alpha) mostrar número DIFERENTE da lista de
 * Acompanhamento (mais larga). Fixture homogênea esconderia esse comportamento,
 * que é correto e documentado.
 */
import { FakeTimestamp } from '../../../harness/store';

const DIA = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const maisDias = (base, n) => new Date(base.getTime() + n * DIA);

/** PRNG determinística — a mesma fixture em toda rodada, senão o diff de screenshot é ruído. */
const rng = (semente) => () => {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return semente / 0x7fffffff;
};

/** `lacksAuthUser` usa comprimento de id como heurística de "aluno sem Auth". */
const uid = (n) => `aluno${String(n).padStart(2, '0')}`.padEnd(28, 'x');

const TICKERS = [['WIN', 'B3', 'BRL'], ['WDO', 'B3', 'BRL'], ['MNQ', 'CME', 'USD'], ['MES', 'CME', 'USD']];
const SETUPS = ['Fractal TTrades', 'Rompimento', 'Pullback', 'Reversão', 'VWAP'];

/**
 * Perfis da turma. `faixa` é o alvo declarado; `diasDesdeUltimo` e os gatilhos
 * são o que produz a faixa em `faixaDeAtencao`. Manter os dois lado a lado torna
 * a fixture auditável: se a Torre classificar diferente, um dos dois está errado.
 */
const PERFIS = [
  { n: 1,  nome: 'Ana Ribeiro',      bucket: 'alpha',        faixa: 'ACAO_HOJE',    diasDesdeUltimo: 0,  gatilho: 'TILT' },
  { n: 2,  nome: 'Bruno Tavares',    bucket: 'alpha',        faixa: 'ACAO_HOJE',    diasDesdeUltimo: 0,  gatilho: 'ALEM_DO_STOP' },
  { n: 3,  nome: 'Carla Menezes',    bucket: 'alpha',        faixa: 'ACAO_HOJE',    diasDesdeUltimo: 0,  gatilho: 'RISK_OVER_RO' },
  { n: 4,  nome: 'Diego Salles',     bucket: 'alpha',        faixa: 'SUMIU',        diasDesdeUltimo: 21, gatilho: null },
  { n: 5,  nome: 'Eduarda Lopes',    bucket: 'alpha',        faixa: 'SUMIU',        diasDesdeUltimo: 40, gatilho: null },
  { n: 6,  nome: 'Felipe Andrade',   bucket: 'alpha',        faixa: 'RISCO_ALTO',   diasDesdeUltimo: 2,  gatilho: 'AVERAGING_DOWN' },
  { n: 7,  nome: 'Gabriela Nunes',   bucket: 'alpha',        faixa: 'FORA_DO_PLANO', diasDesdeUltimo: 1, gatilho: 'FLAG' },
  { n: 8,  nome: 'Henrique Dias',    bucket: 'trial-alpha',  faixa: 'FORA_DO_PLANO', diasDesdeUltimo: 3, gatilho: 'FLAG' },
  { n: 9,  nome: 'Isabela Moraes',   bucket: 'alpha',        faixa: 'ESFRIANDO',    diasDesdeUltimo: 9,  gatilho: null },
  { n: 10, nome: 'João Peixoto',      bucket: 'alpha',        faixa: 'EM_DIA',       diasDesdeUltimo: 0,  gatilho: null },
  { n: 11, nome: 'Larissa Costa',    bucket: 'espelho',      faixa: 'EM_DIA',       diasDesdeUltimo: 2,  gatilho: null },
  { n: 12, nome: 'Marcos Vinícius',  bucket: 'espelho',      faixa: 'NUNCA_OPEROU', diasDesdeUltimo: null, gatilho: null },
];

const familiaDe = (codigo, severidade) => ({
  families: [{ canonicalCode: codigo, severity: severidade, valence: 'negative' }],
});

export const buildMentorDataset = ({ hoje = '2026-09-03', cenario = 'cheio' } = {}) => {
  const base = new Date(`${hoje}T12:00:00-03:00`);
  const rand = rng(20260903);
  const vazio = cenario === 'vazio';

  const students = [];
  const plans = [];
  const trades = [];
  const accounts = [];
  const subcollections = {};
  const cycleClosures = [];

  PERFIS.forEach((perfil) => {
    const id = uid(perfil.n);
    const email = `${perfil.nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@exemplo.com`;

    students.push({
      id, email, name: perfil.nome,
      whatsappNumber: `+55119${String(80000000 + perfil.n * 137).slice(0, 8)}`,
      firstLoginAt: FakeTimestamp.fromDate(maisDias(base, -120)),
      loginBlocked: false,
      accessStatus: 'active',
      status: 'active',
      createdAt: FakeTimestamp.fromDate(maisDias(base, -150)),
    });

    subcollections[`students/${id}/subscriptions`] = [{
      id: `sub-${perfil.n}`,
      type: perfil.bucket === 'trial-alpha' ? 'trial' : 'paid',
      plan: perfil.bucket === 'espelho' ? 'self_service' : 'alpha',
      status: 'active',
      amount: perfil.bucket === 'espelho' ? 297 : 1500,
      currency: 'BRL',
      billingPeriodMonths: 1,
      ...(perfil.bucket === 'trial-alpha'
        ? { trialEndsAt: FakeTimestamp.fromDate(maisDias(base, 8)) }
        : { renewalDate: FakeTimestamp.fromDate(maisDias(base, 12)) }),
    }];

    subcollections[`students/${id}/maturity`] = [{
      id: 'current',
      stage: perfil.n <= 4 ? 'CONSISTENCIA' : 'FUNDACAO',
      score: 40 + Math.round(rand() * 45),
      promotionEligible: perfil.n === 10,
      regression: perfil.n === 2,
      updatedAt: FakeTimestamp.fromDate(maisDias(base, -3)),
    }];

    subcollections[`students/${id}/reviews`] = perfil.n <= 3
      ? [{ id: `rev-${perfil.n}`, status: 'DRAFT', weekStart: iso(maisDias(base, -7)),
           createdAt: FakeTimestamp.fromDate(maisDias(base, -2)) }]
      : [];

    const contaId = `conta-${perfil.n}`;
    const moeda = perfil.n % 4 === 2 ? 'USD' : 'BRL';
    accounts.push({
      id: contaId, studentId: id, studentEmail: email, name: moeda === 'USD' ? 'CME · Prop' : 'B3 · Real',
      type: 'REAL', currency: moeda, currentBalance: 100000, active: true,
    });

    const planoId = `plano-${perfil.n}`;
    plans.push({
      id: planoId, name: `Ciclo Set/26 — ${perfil.nome.split(' ')[0]}`,
      studentId: id, studentEmail: email, studentName: perfil.nome, accountId: contaId,
      pl: moeda === 'USD' ? 25000 : 100000,
      riskPerOperation: 0.5, rrTarget: 2,
      cycleGoal: 20, cycleStop: 10, periodGoal: 1, periodStop: 0.5,
      operationPeriod: 'Diário', adjustmentCycle: 'Mensal',
      currency: moeda, active: true,
      createdAt: FakeTimestamp.fromDate(maisDias(base, -30)),
    });

    if (vazio || perfil.diasDesdeUltimo === null) return;

    // ~10 semanas de histórico; densidade maior perto de hoje.
    const nTrades = 12 + Math.round(rand() * 10);
    for (let i = 0; i < nTrades; i += 1) {
      const recente = i < 4;
      const offset = recente
        ? -(perfil.diasDesdeUltimo + i)
        : -(perfil.diasDesdeUltimo + 5 + Math.round(rand() * 60));
      const d = maisDias(base, offset);
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      const [ticker, exchange, moedaT] = TICKERS[Math.floor(rand() * TICKERS.length)];
      const ganhou = rand() > 0.42;
      const resultado = Number(((ganhou ? 1 : -1) * (120 + rand() * 900)).toFixed(2));
      const doDia = offset === -perfil.diasDesdeUltimo;

      const comGatilho = doDia && perfil.gatilho && perfil.gatilho !== 'FLAG' && perfil.gatilho !== 'ALEM_DO_STOP';
      const comFlag = (perfil.gatilho === 'FLAG' && i === 0);

      trades.push({
        id: `t-${perfil.n}-${i}`,
        studentId: id, studentEmail: email, studentName: perfil.nome,
        planId: planoId, accountId: contaId,
        date: iso(d),
        entryTime: new Date(d.getTime() + (10 + i % 6) * 3600000).toISOString(),
        ticker, exchange, side: rand() > 0.5 ? 'LONG' : 'SHORT',
        setup: SETUPS[Math.floor(rand() * SETUPS.length)],
        // 15% sem moeda declarada — é o caso que MultiCurrencyAmount tem de
        // exibir sem somar, e onde o número tabular vai ser julgado.
        currency: rand() > 0.15 ? moedaT : undefined,
        qty: 1 + Math.floor(rand() * 5),
        entry: Number((5000 + rand() * 200).toFixed(2)),
        exit: Number((5000 + rand() * 200).toFixed(2)),
        result: resultado,
        status: i < 2 && perfil.n <= 5 ? 'OPEN' : (i === 2 && perfil.n <= 5 ? 'QUESTION' : 'REVIEWED'),
        hasRedFlags: comFlag,
        redFlags: comFlag ? [{ type: 'NO_STOP', message: 'Operação sem stop definido' }] : [],
        mentorClearedViolations: [],
        behaviorProfile: comGatilho
          ? familiaDe(perfil.gatilho, perfil.gatilho === 'TILT' ? 'HIGH' : 'MEDIUM')
          : { families: [] },
        htfUrl: rand() > 0.15 ? 'https://placehold.co/1200x700/0f172a/64748b?text=HTF' : null,
        ltfUrl: rand() > 0.4 ? 'https://placehold.co/1200x700/0f172a/64748b?text=LTF' : null,
        createdAt: FakeTimestamp.fromDate(d),
      });
    }

    if (perfil.n <= 3 && !vazio) {
      cycleClosures.push({
        id: `fech-${perfil.n}`, studentId: id, planId: planoId,
        status: 'CLOSED',
        closedAt: FakeTimestamp.fromDate(maisDias(base, -(perfil.n))),
        cycleKey: '2026-08', cycleNumber: 4,
        mentor: { closingCommentAt: perfil.n === 3 ? FakeTimestamp.fromDate(maisDias(base, -1)) : null },
        behavioralSummary: { critical: perfil.n === 1 },
        metrics: { tradingPerformanceScore: 52 + perfil.n * 6 },
        snapshot: { resultPercent: perfil.n === 2 ? -4.2 : 6.8, tradesCount: 18 + perfil.n },
        maturity: { promotionEligible: perfil.n === 3, regression: perfil.n === 2 },
      });
    }
  });

  return {
    collections: {
      students, plans, trades, accounts, cycleClosures,
      orders: [], setups: SETUPS.map((s, i) => ({ id: `setup-${i}`, name: s, active: true })),
      tickers: TICKERS.map(([t, ex], i) => ({ id: `tk-${i}`, symbol: t, exchange: ex, active: true })),
      exchanges: [...new Set(TICKERS.map((t) => t[1]))].map((e, i) => ({ id: `ex-${i}`, name: e, active: true })),
      currencies: [{ id: 'BRL', code: 'BRL', symbol: 'R$' }, { id: 'USD', code: 'USD', symbol: '$' }],
      emotions: ['Confiante', 'Ansioso', 'Neutro', 'Frustrado'].map((e, i) => ({ id: `em-${i}`, name: e, active: true })),
      notifications: [], movements: [], brokers: [], users: [],
    },
    subcollections,
  };
};

export default buildMentorDataset;
