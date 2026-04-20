/**
 * AutoLiqBadge.test.jsx
 * @description Testes de render do badge visual AutoLiq.
 * @see src/components/OrderImport/AutoLiqBadge.jsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AutoLiqBadge from '../../components/OrderImport/AutoLiqBadge';

describe('AutoLiqBadge', () => {
  it('renderiza com texto canônico + classe de tema vermelho', () => {
    render(<AutoLiqBadge />);
    const badge = screen.getByTestId('autoliq-badge');
    expect(badge).toHaveTextContent('Evento de sistema — AutoLiq detectado');
    expect(badge.className).toMatch(/bg-red-500\/10/);
    expect(badge.className).toMatch(/text-red-400/);
    expect(badge.className).toMatch(/border-red-500\/30/);
  });

  it('respeita override de label e modo compact', () => {
    render(<AutoLiqBadge label="Liquidação forçada" compact />);
    const badge = screen.getByTestId('autoliq-badge');
    expect(badge).toHaveTextContent('Liquidação forçada');
    expect(badge.className).toMatch(/text-\[10px\]/);
    expect(badge.className).toMatch(/px-1\.5/);
  });
});
