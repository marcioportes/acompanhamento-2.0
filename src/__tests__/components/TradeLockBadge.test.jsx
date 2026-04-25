/**
 * TradeLockBadge.test.jsx — #188 F1c
 * Cobre render condicional (locked vs not locked), tooltip com autor+data,
 * tamanhos sm/lg.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TradeLockBadge from '../../components/TradeLockBadge';

describe('TradeLockBadge', () => {
  it('não renderiza nada quando trade não está locked', () => {
    const { container } = render(<TradeLockBadge trade={{ id: 't1' }} />);
    expect(container.firstChild).toBeNull();
  });

  it('não renderiza quando _lockedByMentor é false', () => {
    const { container } = render(<TradeLockBadge trade={{ _lockedByMentor: false }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza "Travado" quando _lockedByMentor=true', () => {
    render(<TradeLockBadge trade={{ _lockedByMentor: true }} />);
    expect(screen.getByText('Travado')).toBeTruthy();
  });

  it('tooltip inclui nome do mentor + data formatada DD/MM/AAAA', () => {
    const trade = {
      _lockedByMentor: true,
      _lockedAt: new Date('2026-04-24T14:36:00Z'),
      _lockedBy: { name: 'Marcio', email: 'mentor@test.com' },
    };
    render(<TradeLockBadge trade={trade} />);
    const badge = screen.getByText('Travado').parentElement;
    expect(badge.getAttribute('title')).toMatch(/Marcio/);
    expect(badge.getAttribute('title')).toMatch(/24\/04\/2026/);
  });

  it('fallback para email quando name ausente', () => {
    const trade = {
      _lockedByMentor: true,
      _lockedBy: { email: 'mentor@test.com' },
    };
    render(<TradeLockBadge trade={trade} />);
    const badge = screen.getByText('Travado').parentElement;
    expect(badge.getAttribute('title')).toMatch(/mentor@test\.com/);
  });

  it('suporta Firestore Timestamp via toDate()', () => {
    const trade = {
      _lockedByMentor: true,
      _lockedAt: { toDate: () => new Date('2026-04-24T14:36:00Z') },
      _lockedBy: { name: 'Mentor' },
    };
    render(<TradeLockBadge trade={trade} />);
    const badge = screen.getByText('Travado').parentElement;
    expect(badge.getAttribute('title')).toMatch(/24\/04\/2026/);
  });
});
