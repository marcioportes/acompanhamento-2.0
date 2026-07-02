import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudentReflectionPanel from '../../../components/reviews/StudentReflectionPanel';

describe('StudentReflectionPanel (#323)', () => {
  it('reflexão feita → mostra a auto-análise (read-only)', () => {
    const trade = { result: 100, selfReview: { wouldRepeat: true, answers: {} } };
    render(<StudentReflectionPanel trade={trade} isMentor />);
    expect(screen.getByText('Reflexão')).toBeInTheDocument();
    // não mostra o aviso de ausência
    expect(screen.queryByText(/não fez a auto-análise/i)).not.toBeInTheDocument();
  });

  it('sem reflexão + mentor → aviso âmbar pra cobrar', () => {
    render(<StudentReflectionPanel trade={{ result: -50 }} isMentor />);
    expect(screen.getByText(/não fez a auto-análise/i)).toBeInTheDocument();
    expect(screen.getByText(/Cobre a reflexão no feedback/i)).toBeInTheDocument();
  });

  it('sem reflexão + NÃO mentor → não renderiza nada', () => {
    const { container } = render(<StudentReflectionPanel trade={{ result: 10 }} isMentor={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sem reflexão + mentor default (prop ausente) → não renderiza aviso', () => {
    const { container } = render(<StudentReflectionPanel trade={{ result: 10 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
