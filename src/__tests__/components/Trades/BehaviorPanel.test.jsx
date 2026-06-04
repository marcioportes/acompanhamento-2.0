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

  it('trade sem profile e sem flags mostra estado vazio', () => {
    render(<BehaviorPanel trade={{ id: 'T2', currency: 'USD' }} isMentor embedded />);
    expect(screen.getByText(/Sem violações ou padrões detectados/)).toBeInTheDocument();
  });
});
