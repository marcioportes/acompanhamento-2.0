/**
 * #385 — o card não morre inteiro quando só o Sharpe falha.
 *
 * `computeCycleSharpe` carrega o módulo do Selic por `import()` dinâmico, que no bundle
 * vira um chunk próprio (`getSelicForDate-<hash>.js`). Aba aberta antes de um deploy pede
 * o chunk pelo nome antigo, recebe 404 e o import REJEITA. O hook zerava tudo e o card
 * exibia "Não foi possível carregar métricas do ciclo" — apagando CV, MEP e MEN, que são
 * puros, síncronos e não dependem de Selic.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CycleConsistencyCard from '../../components/dashboard/CycleConsistencyCard';

vi.mock('../../utils/cycleConsistency/computeCycleSharpe', () => ({
  computeCycleSharpe: vi.fn(() => Promise.reject(new Error(
    "Failed to fetch dynamically imported module: /assets/getSelicForDate-C8TUmgXJ.js",
  ))),
}));

const trades = [
  { id: 't1', date: '2026-08-04', result: 120, status: 'CLOSED', entry: 100, exit: 101, stopLoss: 99, side: 'LONG', qty: 1, mepPrice: 101.5, menPrice: 99.5 },
  { id: 't2', date: '2026-08-05', result: -60, status: 'CLOSED', entry: 100, exit: 99.5, stopLoss: 99, side: 'LONG', qty: 1, mepPrice: 100.4, menPrice: 99.2 },
  { id: 't3', date: '2026-08-06', result: 200, status: 'CLOSED', entry: 100, exit: 102, stopLoss: 99, side: 'LONG', qty: 1, mepPrice: 102.2, menPrice: 99.8 },
];
const plan = { pl: 30000, rrTarget: 2 };

describe('#385 — card de ciclo resiliente', () => {
  const props = {
    trades, plan, cycleStart: '2026-08-01', cycleEnd: '2026-08-31',
    cycleLabel: 'AGO/2026', avgTradeDuration: 12, durationDelta: null,
  };

  it('Sharpe falhando não apaga o card', async () => {
    render(<CycleConsistencyCard {...props} />);
    await waitFor(() => {
      expect(screen.queryByText(/Não foi possível carregar métricas do ciclo/i)).not.toBeInTheDocument();
    });
  });

  it('CV, MEP e MEN continuam na tela', async () => {
    render(<CycleConsistencyCard {...props} />);
    await waitFor(() => {
      expect(screen.getByText('CV norm.')).toBeInTheDocument();
    });
    expect(screen.getByText('MEP médio')).toBeInTheDocument();
    expect(screen.getByText('MEN médio')).toBeInTheDocument();
    expect(screen.getByText('Sharpe')).toBeInTheDocument();
  });

  it('diz ao aluno o que fazer em vez de só sumir', async () => {
    render(<CycleConsistencyCard {...props} />);
    await waitFor(() => {
      expect(screen.getByText(/Sharpe indisponivel nesta sessao/i)).toBeInTheDocument();
    });
  });
});

/**
 * #387 — o card não pode mudar de altura ao carregar: os blocos abaixo do grid
 * (Tempo W vs L, aviso de cobertura) precisam existir desde o primeiro paint, senão o
 * card cresce quando o Sharpe resolve e empurra os vizinhos da linha do grid.
 */
describe('#387 — sem layout shift', () => {
  // `avgTradeDuration` é objeto (`{ all }`) — o card lê `avgTradeDuration?.all`.
  const props = {
    trades, plan, cycleStart: '2026-08-01', cycleEnd: '2026-08-31',
    cycleLabel: 'AGO/2026', avgTradeDuration: { all: 12 },
    durationDelta: { level: 'winners-run', deltaPercent: 40, durationWin: 20, durationLoss: 14 },
  };

  it('os blocos abaixo do grid já estão na tela antes de o Sharpe resolver', async () => {
    render(<CycleConsistencyCard {...props} />);

    // Primeiro paint, com o Sharpe ainda pendente: o layout já é o definitivo.
    expect(screen.getByText('Tempo W vs L')).toBeInTheDocument();
    expect(screen.getByText(/Tempo medio geral/)).toBeInTheDocument();
    expect(screen.getByText('CV norm.')).toBeInTheDocument();
    expect(screen.getByText('MEP médio')).toBeInTheDocument();
    expect(screen.getByText('MEN médio')).toBeInTheDocument();

    // ...e continua sendo depois que o Sharpe resolve (aqui, rejeitando).
    await waitFor(() => {
      expect(screen.getByText(/Sharpe indisponivel nesta sessao/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Tempo W vs L')).toBeInTheDocument();
    expect(screen.getByText(/Tempo medio geral/)).toBeInTheDocument();
    expect(screen.getByText('CV norm.')).toBeInTheDocument();
  });

  it('o placeholder do Sharpe sai quando a métrica resolve', async () => {
    render(<CycleConsistencyCard {...props} />);

    await waitFor(() => {
      expect(screen.queryByText('···')).not.toBeInTheDocument();
    });
  });
});
