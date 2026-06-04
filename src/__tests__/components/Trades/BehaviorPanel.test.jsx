/**
 * BehaviorPanel — leitura consolidada do comportamento (CHUNK-11 Fase 2, #301).
 * Cobre: ① violações (redFlags), ② padrões (famílias canônicas + severidade),
 * ③ trava de gate, visibilidade (aluno vê dados, controles de limpar são mentor-only),
 * e o slot do mentor.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BehaviorPanel from '../../../components/Trades/BehaviorPanel';

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
});
