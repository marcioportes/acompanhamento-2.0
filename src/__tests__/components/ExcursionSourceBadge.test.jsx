/**
 * ExcursionSourceBadge.test.jsx — issue #187 Fase 2.5 (display)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExcursionSourceBadge, { EXCURSION_BADGE_STYLES } from '../../components/ExcursionSourceBadge';

describe('ExcursionSourceBadge', () => {
  it('renderiza badge para "manual"', () => {
    render(<ExcursionSourceBadge source="manual" />);
    expect(screen.getByText('manual')).toBeInTheDocument();
  });

  it('renderiza badge para "profitpro"', () => {
    render(<ExcursionSourceBadge source="profitpro" />);
    expect(screen.getByText('profitpro')).toBeInTheDocument();
  });

  it('renderiza badge para "yahoo"', () => {
    render(<ExcursionSourceBadge source="yahoo" />);
    expect(screen.getByText('yahoo')).toBeInTheDocument();
  });

  it('renderiza badge "indisponível" para "unavailable"', () => {
    render(<ExcursionSourceBadge source="unavailable" />);
    expect(screen.getByText('indisponível')).toBeInTheDocument();
  });

  it('NÃO renderiza nada para source null/undefined/inválida', () => {
    const { container: c1 } = render(<ExcursionSourceBadge source={null} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<ExcursionSourceBadge source={undefined} />);
    expect(c2.firstChild).toBeNull();
    const { container: c3 } = render(<ExcursionSourceBadge source="bogus" />);
    expect(c3.firstChild).toBeNull();
  });

  it('aplica title (tooltip) por source', () => {
    render(<ExcursionSourceBadge source="yahoo" />);
    const el = screen.getByText('yahoo');
    expect(el.getAttribute('title')).toMatch(/Yahoo Finance/);
  });

  it('EXCURSION_BADGE_STYLES expõe as 4 fontes válidas', () => {
    expect(Object.keys(EXCURSION_BADGE_STYLES).sort()).toEqual([
      'manual', 'profitpro', 'unavailable', 'yahoo',
    ]);
  });
});
