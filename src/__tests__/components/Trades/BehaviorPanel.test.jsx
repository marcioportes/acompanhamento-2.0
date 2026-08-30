/**
 * BehaviorPanel — leitura consolidada do comportamento (CHUNK-11 Fase 2, #301).
 * Cobre: ① violações (redFlags), ② padrões (famílias canônicas + severidade),
 * ③ trava de gate, visibilidade (aluno vê dados, controles de limpar são mentor-only),
 * e o slot do mentor.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BehaviorPanel from '../../../components/Trades/BehaviorPanel';
import { buildPeriodState } from '../../../utils/dayState';

const trade = {
  id: 'T1',
  currency: 'USD',
  redFlags: [{ type: 'NO_STOP', message: 'Trade sem stop loss definido' }],
  behaviorProfile: {
    version: '1.0.0',
    families: [
      { family: 'LOSS_CHASING', canonicalCode: 'LOSS_CHASING', severity: 'HIGH', source: 'shadow', resolutionLayer: 'MEDIUM', emotionMapping: 'REVENGE', valence: 'negative', isGate: true, confidence: 0.8, evidence: { count: 2 } },
      { family: 'CLEAN_EXECUTION', canonicalCode: 'CLEAN_EXECUTION', severity: null, source: 'shadow', resolutionLayer: 'LOW', emotionMapping: 'DISCIPLINE', valence: 'positive', isGate: false, confidence: null, evidence: null },
    ],
    gateInputs: ['LOSS_CHASING'],
    scoreContribution: { tilt: false, revenge: true },
  },
};

describe('BehaviorPanel', () => {
  it('② renderiza família com nome PT canônico + severidade', () => {
    render(<BehaviorPanel trade={trade} isMentor embedded />);
    expect(screen.getByText('⚠ Revenge trading')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('✦ Execução limpa')).toBeInTheDocument(); // positivo
  });

  it('③ destaca a trava de gate com os padrões que travam', () => {
    render(<BehaviorPanel trade={trade} isMentor embedded />);
    expect(screen.getByText('Trava progressão de estágio')).toBeInTheDocument();
    // gate label usa o nome PT da família
    expect(screen.getByText('Revenge trading')).toBeInTheDocument();
  });

  it('① mostra a violação de adesão ao plano', () => {
    render(<BehaviorPanel trade={trade} isMentor embedded />);
    expect(screen.getByText(/Trade sem stop loss definido/)).toBeInTheDocument();
  });

  it('aluno (isMentor=false) vê os dados mas NÃO o botão de limpar', () => {
    render(<BehaviorPanel trade={trade} isMentor={false} embedded onToggleViolation={() => {}} />);
    expect(screen.getByText('⚠ Revenge trading')).toBeInTheDocument(); // vê o padrão
    expect(screen.queryByText('✕ Limpar')).not.toBeInTheDocument();    // sem controle
  });

  it('mentor com handler vê "Limpar" e o clique dispara onToggleViolation', () => {
    const onToggle = vi.fn();
    render(<BehaviorPanel trade={trade} isMentor embedded onToggleViolation={onToggle} />);
    const btn = screen.getByText('✕ Limpar');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledWith('NO_STOP');
  });

  it('sem handler, não renderiza botão de limpar (ex.: TradeDetailModal)', () => {
    render(<BehaviorPanel trade={trade} isMentor embedded />);
    expect(screen.queryByText('✕ Limpar')).not.toBeInTheDocument();
  });

  it('renderiza o slot do mentor sob "Interpretação do mentor"', () => {
    render(<BehaviorPanel trade={trade} isMentor embedded mentorSlot={<div>SLOT_MENTOR</div>} />);
    expect(screen.getByText('Interpretação do mentor')).toBeInTheDocument();
    expect(screen.getByText('SLOT_MENTOR')).toBeInTheDocument();
  });

  it('trade SEM profile (motor não rodou) → "ainda não calculado", não "limpo"', () => {
    render(<BehaviorPanel trade={{ id: 'T2', currency: 'USD' }} isMentor embedded />);
    expect(screen.getByText(/ainda não calculado/)).toBeInTheDocument();
  });

  it('motor rodou e nada negativo → afirmação de execução alinhada (não ausência)', () => {
    const t = {
      id: 'T5', currency: 'USD',
      behaviorProfile: { version: '1.0.0', families: [], gateInputs: [], scoreContribution: { tilt: false, revenge: false } },
    };
    render(<BehaviorPanel trade={t} isMentor embedded />);
    expect(screen.getByText(/execução alinhada/)).toBeInTheDocument();
    expect(screen.queryByText(/ainda não calculado/)).not.toBeInTheDocument();
  });

  it('legado COM redFlags mas SEM profile → mostra violação E "ainda não calculado" (decoupled)', () => {
    const t = {
      id: 'T6', currency: 'USD',
      redFlags: [{ type: 'NO_STOP', message: 'Trade sem stop loss definido' }],
      // sem behaviorProfile (motor comportamental nunca rodou)
    };
    render(<BehaviorPanel trade={t} isMentor embedded />);
    expect(screen.getByText(/Trade sem stop loss definido/)).toBeInTheDocument(); // ① violação
    expect(screen.getByText(/ainda não calculado/)).toBeInTheDocument();          // ② estado do motor
  });

  it('confronto MISALIGNED → banner vermelho "execução sugere"', () => {
    const t = {
      id: 'T8', currency: 'USD',
      behaviorProfile: {
        version: '1.0.0', families: [], gateInputs: [], scoreContribution: { tilt: false, revenge: false },
        emotionConfront: { verdict: 'MISALIGNED', declared: { name: 'Confiante', category: 'POSITIVE' }, suggested: { emotion: 'REVENGE', code: 'LOSS_CHASING', severity: 'HIGH' } },
      },
    };
    render(<BehaviorPanel trade={t} isMentor embedded />);
    expect(screen.getByText('Confronto emocional')).toBeInTheDocument();
    expect(screen.getByText(/declarou “Confiante”, mas a execução sugere Vingança/)).toBeInTheDocument();
  });

  it('confronto ALIGNED + declarada negativa + limpo → reforço "boa regulação"', () => {
    const t = {
      id: 'T9', currency: 'USD',
      behaviorProfile: {
        version: '1.0.0', families: [], gateInputs: [], scoreContribution: { tilt: false, revenge: false },
        emotionConfront: { verdict: 'ALIGNED', declared: { name: 'Ansioso', category: 'NEGATIVE' }, suggested: null },
      },
    };
    render(<BehaviorPanel trade={t} isMentor embedded />);
    expect(screen.getByText(/boa regulação emocional/)).toBeInTheDocument();
  });

  it('confronto ideal (positiva + limpo) → sem banner (ALIGNED silencioso)', () => {
    const t = {
      id: 'T10', currency: 'USD',
      behaviorProfile: {
        version: '1.0.0', families: [], gateInputs: [], scoreContribution: { tilt: false, revenge: false },
        emotionConfront: { verdict: 'ALIGNED', declared: { name: 'Calmo', category: 'POSITIVE' }, suggested: null },
      },
    };
    render(<BehaviorPanel trade={t} isMentor embedded />);
    expect(screen.queryByText('Confronto emocional')).not.toBeInTheDocument();
  });

  it('motor rodou, sem padrão, mas com violação → "Nenhum padrão comportamental"', () => {
    const t = {
      id: 'T7', currency: 'USD',
      redFlags: [{ type: 'NO_STOP', message: 'Trade sem stop loss definido' }],
      behaviorProfile: { version: '1.0.0', families: [], gateInputs: [], scoreContribution: { tilt: false, revenge: false } },
    };
    render(<BehaviorPanel trade={t} isMentor embedded />);
    expect(screen.getByText(/Nenhum padrão comportamental detectado/)).toBeInTheDocument();
    expect(screen.queryByText(/execução alinhada/)).not.toBeInTheDocument(); // não afirma "alinhada" com violação presente
  });

  it('renderiza NARRATIVA semântica (não despeja campos crus no card)', () => {
    const t = {
      id: 'T3', currency: 'USD',
      behaviorProfile: {
        version: '1.0.0', gateInputs: [], scoreContribution: { tilt: false, revenge: false },
        families: [{
          family: 'HOLD_ASYMMETRY', canonicalCode: 'HOLD_ASYMMETRY', severity: 'HIGH', source: 'shadow',
          resolutionLayer: 'LOW', emotionMapping: 'FEAR', valence: 'negative', isGate: false, confidence: 0.95,
          evidence: { tradeDurationMinutes: 60, avgWinDurationMinutes: 5, ratio: 12 },
        }],
      },
    };
    render(<BehaviorPanel trade={t} isMentor embedded />);
    // narrativa tece os números numa frase
    expect(screen.getByText(/Você segurou este trade por 60 min/)).toBeInTheDocument();
    // campos crus NÃO aparecem no card colapsado
    expect(screen.queryByText(/tradeDurationMinutes:/)).not.toBeInTheDocument();
    // ao expandir, aparece o accordion "Evidência técnica" com os campos crus
    fireEvent.click(screen.getByText(/Você segurou este trade por 60 min/));
    expect(screen.getByText('Evidência técnica')).toBeInTheDocument();
    expect(screen.getByText(/tradeDurationMinutes:/)).toBeInTheDocument();
  });

  it('#315: aluno (isMentor=false) expande mas NÃO vê "Evidência técnica" — só a narrativa', () => {
    const t = {
      id: 'T3b', currency: 'USD',
      behaviorProfile: {
        version: '1.0.0', gateInputs: [], scoreContribution: { tilt: false, revenge: false },
        families: [{
          family: 'HOLD_ASYMMETRY', canonicalCode: 'HOLD_ASYMMETRY', severity: 'HIGH', source: 'shadow',
          resolutionLayer: 'LOW', emotionMapping: 'FEAR', valence: 'negative', isGate: false, confidence: 0.95,
          evidence: { tradeDurationMinutes: 60, avgWinDurationMinutes: 5, ratio: 12 },
        }],
      },
    };
    render(<BehaviorPanel trade={t} isMentor={false} embedded />);
    fireEvent.click(screen.getByText(/Você segurou este trade por 60 min/));
    expect(screen.queryByText('Evidência técnica')).not.toBeInTheDocument();
    expect(screen.queryByText(/tradeDurationMinutes:/)).not.toBeInTheDocument();
    // narrativa permanece
    expect(screen.getByText(/Você segurou este trade por 60 min/)).toBeInTheDocument();
  });

  it('#315: aluno (isMentor=false) no SUB_SIZING não vê o accordion cru, mas vê o texto educacional', () => {
    const t = {
      id: 'T3c', currency: 'BRL',
      behaviorProfile: {
        version: '1.0.0', gateInputs: [], scoreContribution: { tilt: false, revenge: false },
        families: [{
          family: 'SUB_SIZING', canonicalCode: 'SUB_SIZING', severity: 'HIGH', source: 'shadow',
          resolutionLayer: 'LOW', emotionMapping: 'AVOIDANCE', valence: 'negative', isGate: true, confidence: 0.9,
          evidence: {
            scenario: 'WIN_RR_MISS', planRrTarget: 2, utilizationPct: 26, planRoAmount: 200,
            actualRiskAmount: 52, expectedGainAtPlanRR: 400, actualGain: 6, planRsDelivered: 0.03,
          },
        }],
      },
    };
    render(<BehaviorPanel trade={t} isMentor={false} embedded />);
    fireEvent.click(screen.getByText('⚠ Operação subdimensionada')); // título do card (desambigua da frase-chave)
    expect(screen.queryByText('Evidência técnica')).not.toBeInTheDocument();
    expect(screen.queryByText(/utilizationPct:/)).not.toBeInTheDocument();
    // texto educacional (prosa) permanece
    expect(screen.getByText(/abaixo do alvo do próprio trade/)).toBeInTheDocument();
  });

  it('cai na descrição (prosa) quando faltam campos da narrativa — nunca dump cru', () => {
    const t = {
      id: 'T4', currency: 'USD',
      behaviorProfile: {
        version: '1.0.0', gateInputs: [], scoreContribution: { tilt: false, revenge: false },
        families: [{
          family: 'LOSS_CHASING', canonicalCode: 'LOSS_CHASING', severity: 'HIGH', source: 'shadow',
          resolutionLayer: 'MEDIUM', emotionMapping: 'REVENGE', valence: 'negative', isGate: true,
          confidence: null, evidence: { foo: 1 },
        }],
      },
    };
    render(<BehaviorPanel trade={t} isMentor embedded />);
    expect(screen.getByText(/Reentrada rápida após uma perda/)).toBeInTheDocument(); // descrição-prosa
    expect(screen.queryByText(/foo:/)).not.toBeInTheDocument(); // sem dump cru colapsado
  });

  it('C: mentor vê "Dispensar" no finding negativo; clique → onToggleViolation(canonicalCode:tradeId)', () => {
    const onToggle = vi.fn();
    render(<BehaviorPanel trade={trade} isMentor embedded onToggleViolation={onToggle} />);
    fireEvent.click(screen.getByText('✕ Dispensar'));
    expect(onToggle).toHaveBeenCalledWith('LOSS_CHASING:T1');
  });

  it('C: finding dispensado aparece greyed com "Restaurar"', () => {
    const t = { ...trade, mentorClearedViolations: ['LOSS_CHASING:T1'] };
    render(<BehaviorPanel trade={t} isMentor embedded onToggleViolation={() => {}} />);
    expect(screen.getByText('↺ Restaurar')).toBeInTheDocument();
    expect(screen.getByText(/dispensado pelo mentor/)).toBeInTheDocument();
    expect(screen.queryByText('✕ Dispensar')).not.toBeInTheDocument();
  });

  it('C: aluno não vê o botão de dispensar', () => {
    render(<BehaviorPanel trade={trade} isMentor={false} embedded onToggleViolation={() => {}} />);
    expect(screen.queryByText('✕ Dispensar')).not.toBeInTheDocument();
  });
});

describe('R:R em dinheiro (#373)', () => {
  // Caso real de 20/08/2026: WINV26 LONG 10, +R$ 610, stop a 247,5 pts.
  const tradeRR = {
    id: 'T-RR',
    currency: 'BRL',
    entry: 171842.5,
    stopLoss: 171595,
    qty: 10,
    result: 610,
    tickerRule: { tickSize: 5, tickValue: 1 },
    redFlags: [
      { type: 'RISCO_ACIMA_PERMITIDO', message: 'Risco 1.7% excede máximo do plano (0.84%)' },
      { type: 'RR_ABAIXO_MINIMO', message: 'RR 1.2x abaixo do mínimo (2x)' },
    ],
  };
  const plano = { pl: 30000, riskPerOperation: 0.84, rrTarget: 2 };

  it('mostra o risco tomado e o resultado em dinheiro', () => {
    render(<BehaviorPanel trade={tradeRR} plan={plano} isMentor embedded />);

    expect(screen.getByText(/Arriscou/)).toBeInTheDocument();
    expect(screen.getByText(/1,65% do capital/)).toBeInTheDocument();
    expect(screen.getByText('1,23x')).toBeInTheDocument();
  });

  it('mostra o RO do plano e o que o mesmo resultado seria nele', () => {
    render(<BehaviorPanel trade={tradeRR} plan={plano} isMentor embedded />);

    expect(screen.getByText(/O plano autoriza/)).toBeInTheDocument();
    expect(screen.getByText('2,42x')).toBeInTheDocument();
  });

  it('sem plano, ainda mostra o risco tomado', () => {
    render(<BehaviorPanel trade={tradeRR} isMentor embedded />);

    expect(screen.getByText(/Arriscou/)).toBeInTheDocument();
    expect(screen.queryByText(/O plano autoriza/)).not.toBeInTheDocument();
  });

  it('trade sem stop nem plano não renderiza o bloco', () => {
    render(<BehaviorPanel trade={trade} isMentor embedded />);

    expect(screen.queryByText(/Risco × retorno/)).not.toBeInTheDocument();
  });
});

describe('#402 — a caixa verde não pode contradizer a ressalva de autorização', () => {
  // Caso real reportado em produção (27/08/2026): o painel dizia
  // "Aberta sem previsão de stop — restavam R$ 0,00 até o stop do período, e o plano prevê R$ 40,00"
  // e, logo abaixo, "Nenhuma violação de plano nem padrão de risco — execução alinhada".
  const planoSemFolga = { pl: 4000, riskPerOperation: 1, periodStop: 1, rrTarget: 2 };

  const tradeLimpo = {
    id: 't1', date: '2026-08-27', ticker: 'WINV26', side: 'LONG',
    entry: 100, exit: 90, stopLoss: 90, qty: 1, result: -40,
    entryTime: '2026-08-27T11:00:00-03:00', exitTime: '2026-08-27T11:10:00-03:00',
    currency: 'BRL', redFlags: [],
    behaviorProfile: { families: [], gateInputs: [] },
  };
  const anterior = {
    id: 't0', date: '2026-08-27', ticker: 'WINV26', side: 'LONG',
    entry: 100, exit: 90, qty: 1, result: -40,
    entryTime: '2026-08-27T09:00:00-03:00', exitTime: '2026-08-27T09:10:00-03:00',
  };

  it('com ressalva de abertura, NÃO afirma "nenhuma violação de plano"', () => {
    const ps = buildPeriodState([anterior, tradeLimpo], planoSemFolga);
    // sanidade do fixture: a 2ª operação abre sem previsão de stop
    expect(ps.rows[1].authorization).toBe('SEM_FOLGA');

    render(<BehaviorPanel trade={tradeLimpo} plan={planoSemFolga} periodState={ps} isMentor embedded />);

    expect(screen.getByText(/Aberta sem previsão de stop/i)).toBeInTheDocument();
    expect(screen.queryByText(/execução alinhada/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma violação de plano/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum padrão comportamental de risco na execução/i)).toBeInTheDocument();
  });

  it('sem ressalva e sem violação, a afirmação verde continua valendo', () => {
    const folgado = { pl: 100000, riskPerOperation: 1, periodStop: 5, rrTarget: 2 };
    const ps = buildPeriodState([tradeLimpo], folgado);
    expect(ps.rows[0].authorization).toBe('AUTORIZADA');

    render(<BehaviorPanel trade={tradeLimpo} plan={folgado} periodState={ps} isMentor embedded />);
    expect(screen.getByText(/execução alinhada/i)).toBeInTheDocument();
  });

  it('sem periodState (modal do trade), nada muda — a verde segue como antes', () => {
    render(<BehaviorPanel trade={tradeLimpo} plan={planoSemFolga} isMentor embedded />);
    expect(screen.getByText(/execução alinhada/i)).toBeInTheDocument();
  });
});
