/**
 * Marcação de comportamento estrutural no extrato do plano — issue #357.
 *
 * Canal 2 decidido por Marcio (19/08/2026): posição sem proteção precisa aparecer na
 * leitura do ciclo, não só no painel do trade. O extrato é onde ele lê o período.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExtractTable from '../../../components/extract/ExtractTable';

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2)}`;

const row = (behaviorProfile) => ({
  date: '2026-08-18',
  trade: {
    id: 'T1', ticker: 'WINV26', side: 'LONG', qty: 8,
    entry: 169829.38, exit: 170155, result: 521,
    entryTime: '2026-08-18T13:58:31-03:00',
    status: 'OPEN',
    behaviorProfile,
  },
  result: 521,
  cumPnL: 521,
  periodCumPnL: 521,
});

const renderRows = (bp) => render(
  <ExtractTable rows={[row(bp)]} fmt={fmt} getEmotionConfig={() => null} />,
);

describe('ExtractTable — marcação comportamental (#357)', () => {
  it('marca SEM STOP quando a posição ficou descoberta', () => {
    renderRows({ families: [{ canonicalCode: 'UNPROTECTED_SIZE', valence: 'negative' }] });
    expect(screen.getByText('SEM STOP')).toBeInTheDocument();
  });

  it('marca RISCO > RO quando o risco financeiro passou do plano', () => {
    renderRows({ families: [{ canonicalCode: 'RISK_OVER_RO', valence: 'negative' }] });
    expect(screen.getByText('RISCO > RO')).toBeInTheDocument();
  });

  it('não marca nada quando a condução foi disciplinada', () => {
    renderRows({ families: [{ canonicalCode: 'SIZING_DISCIPLINE', valence: 'positive' }] });
    expect(screen.queryByText('SEM STOP')).toBeNull();
    expect(screen.queryByText('RISCO > RO')).toBeNull();
  });

  it('trade sem behaviorProfile não quebra a tabela', () => {
    renderRows(undefined);
    expect(screen.getByText('WINV26')).toBeInTheDocument();
  });
});
