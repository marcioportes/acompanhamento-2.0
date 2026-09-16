/**
 * PrecisamAtencaoLista — a aba "Precisam atenção" por trade (issue #444, M1).
 *
 * O que estes testes protegem: o header conta trades e alunos, cada linha diz o
 * motivo com rótulo e narrativa, o clique entrega o documento do trade ao
 * compositor de feedback, o vazio fala em trades e a lista colapsa a partir do
 * 6º aluno.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrecisamAtencaoLista, { primeiraFrase } from '../../../components/feedback/PrecisamAtencaoLista';
import { tradesNeedingAttention, agruparPorAlunoEPlano } from '../../../utils/studentsAttention';
import { BEHAVIOR_LABELS, narrativeFor } from '../../../components/Trades/behaviorDisplay';

const aluno = (id, name) => ({ id, email: `${id}@x.com`, name, firstLoginAt: '2026-01-10' });
const alpha = (id) => ({ studentId: id, status: 'active', type: 'paid', plan: 'alpha' });
const plans = [{ id: 'winfut', name: 'WINFUT' }, { id: 'apex', name: 'Apex EOD 50K' }];

const tr = (id, studentId, hora, extra = {}) => ({
  id, studentId, status: 'OPEN', date: '2026-08-26', entryTime: `2026-08-26T${hora}:00-03:00`,
  ticker: 'WINV26', result: -180, currency: 'BRL', planId: 'winfut',
  behaviorProfile: { families: [{ canonicalCode: 'LOSS_CHASING', severity: 'HIGH' }] },
  ...extra,
});

const montar = ({ trades, students, subscriptions, onAbrirTrade }) => {
  const itens = tradesNeedingAttention({ trades, students, subscriptions });
  return render(
    <PrecisamAtencaoLista
      alunos={agruparPorAlunoEPlano(itens, { students, plans })}
      totalTrades={itens.length}
      onAbrirTrade={onAbrirTrade}
    />,
  );
};

describe('<PrecisamAtencaoLista />', () => {
  const sandra = aluno('sandra', 'Sandra Maria');
  const joe = aluno('joe', 'Joe Hott');
  const base = {
    students: [sandra, joe],
    subscriptions: [alpha('sandra'), alpha('joe')],
  };

  it('header conta trades e alunos, com singular e plural', () => {
    const { unmount } = montar({ ...base, trades: [tr('s1', 'sandra', '10:42'), tr('s2', 'sandra', '11:05'), tr('j1', 'joe', '09:45')] });
    expect(screen.getByText('3 trades · 2 alunos · feedback prioritário')).toBeInTheDocument();
    unmount();
    montar({ ...base, trades: [tr('s1', 'sandra', '10:42')] });
    expect(screen.getByText('1 trade · 1 aluno · feedback prioritário')).toBeInTheDocument();
  });

  it('linha mostra data BR, hora, ticker, resultado na moeda e chip com rótulo e narrativa', () => {
    montar({ ...base, trades: [tr('s1', 'sandra', '10:42')] });
    const linha = screen.getByTestId('precisam-atencao-linha');
    expect(linha.textContent).toContain('26/08 10:42');
    expect(linha.textContent).toContain('WINV26');
    expect(linha.textContent).toMatch(/-R\$\s?180,00/);
    expect(screen.getByText(BEHAVIOR_LABELS.LOSS_CHASING)).toBeInTheDocument();
    const frase = primeiraFrase(narrativeFor({ canonicalCode: 'LOSS_CHASING' }));
    expect(frase.length).toBeGreaterThan(0);
    expect(screen.getByText(frase)).toBeInTheDocument();
  });

  it('aluno com dois planos: cabeçalho por plano com nome e moeda', () => {
    montar({
      ...base,
      trades: [
        tr('j1', 'joe', '09:45', { planId: 'apex', currency: 'USD', ticker: 'MNQU26', result: -314 }),
        tr('j2', 'joe', '10:00'),
      ],
    });
    expect(screen.getByText(/Apex EOD 50K \(USD\)/)).toBeInTheDocument();
    expect(screen.getByText(/WINFUT \(BRL\)/)).toBeInTheDocument();
    expect(screen.getAllByText('1 trade')).toHaveLength(2);
    expect(screen.getByText(/-US\$\s?314,00/)).toBeInTheDocument();
  });

  it('clique na linha e em "Abrir" entregam o documento do trade', () => {
    const onAbrirTrade = vi.fn();
    montar({ ...base, trades: [tr('s1', 'sandra', '10:42')], onAbrirTrade });
    fireEvent.click(screen.getByText('WINV26'));
    fireEvent.click(screen.getByText('Abrir'));
    expect(onAbrirTrade).toHaveBeenCalledTimes(2);
    expect(onAbrirTrade.mock.calls[0][0]).toMatchObject({ id: 's1', ticker: 'WINV26', result: -180 });
    expect(onAbrirTrade.mock.calls[1][0].id).toBe('s1');
  });

  it('vazio: nenhum trade pesado esperando feedback', () => {
    montar({ ...base, trades: [tr('s1', 'sandra', '10:42', { status: 'REVIEWED' })] });
    expect(screen.getByText('Nenhum trade pesado esperando feedback.')).toBeInTheDocument();
    expect(screen.getByText('0 trades · 0 alunos · feedback prioritário')).toBeInTheDocument();
  });

  it('colapsa a partir do 6º aluno', () => {
    const students = Array.from({ length: 7 }, (_, i) => aluno(`a${i}`, `Aluno ${i}`));
    const trades = students.map((s, i) => tr(`t${i}`, s.id, `1${i}:00`));
    montar({ students, subscriptions: students.map((s) => alpha(s.id)), trades });
    expect(screen.getAllByTestId('precisam-atencao-linha')).toHaveLength(5);
    fireEvent.click(screen.getByText('mais 2 alunos'));
    expect(screen.getAllByTestId('precisam-atencao-linha')).toHaveLength(7);
  });
});

describe('primeiraFrase', () => {
  it('corta no primeiro ponto seguido de espaço, sem cortar número', () => {
    expect(primeiraFrase('Perdeu R$ 1.234,00 no dia. Depois voltou.')).toBe('Perdeu R$ 1.234,00 no dia.');
    expect(primeiraFrase('sem ponto')).toBe('sem ponto');
    expect(primeiraFrase('')).toBe('');
  });
});
