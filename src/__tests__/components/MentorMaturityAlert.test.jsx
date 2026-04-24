/**
 * MentorMaturityAlert.test.jsx — issue #119 task 18 (Fase F fechamento).
 *
 * Cobre filtro por regressão, ordenação por severity, expand/collapse,
 * render de reasons e blocker gates, callback de navegação, e edge cases
 * (severity desconhecida, maturity sem gates/reasons/blockers, lista vazia).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';

vi.mock('../../components/DebugBadge', () => ({
  __esModule: true,
  default: ({ component }) => <div data-testid="debug-badge">{component}</div>,
}));

const mockCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock('../../firebase', () => ({
  functions: {},
}));

import MentorMaturityAlert from '../../components/MentorMaturityAlert';

const buildMaturity = ({
  detected = true,
  severity = 'HIGH',
  reasons = [],
  currentStage = 3,
  suggestedStage = 2,
  blockers = [],
  gates = [],
} = {}) => ({
  currentStage,
  signalRegression: {
    detected,
    severity,
    reasons,
    suggestedStage,
  },
  proposedTransition: { blockers },
  gates,
});

describe('MentorMaturityAlert', () => {
  beforeEach(() => {
    mockCallable.mockReset();
  });

  it('retorna null quando nenhum aluno tem regressão detectada', () => {
    const students = [
      { id: 'u1', name: 'Aline', email: 'aline@x.com' },
      { id: 'u2', name: 'Bruno', email: 'bruno@x.com' },
    ];
    const map = new Map([
      ['u1', buildMaturity({ detected: false })],
      ['u2', { signalRegression: null }],
    ]);
    render(<MentorMaturityAlert students={students} maturityMap={map} />);
    expect(screen.queryByTestId('mentor-maturity-alert')).toBeNull();
  });

  it('renderiza card com severity HIGH quando há regressão', () => {
    const students = [{ id: 'u1', name: 'Marcos', email: 'marcos@x.com' }];
    const map = new Map([
      ['u1', buildMaturity({ severity: 'HIGH', reasons: ['composite 42 < base 35'] })],
    ]);
    render(<MentorMaturityAlert students={students} maturityMap={map} />);
    expect(screen.getByTestId('mentor-maturity-alert')).toBeTruthy();
    expect(screen.getByTestId('mentor-alert-count').textContent).toBe('1');
    expect(screen.getByTestId('alert-severity-u1').textContent).toBe('HIGH');
    expect(screen.getByText(/Marcos/)).toBeTruthy();
  });

  it('ordena alunos por severity HIGH > MED > LOW', () => {
    const students = [
      { id: 'u-low', name: 'AlunoLow' },
      { id: 'u-high', name: 'AlunoHigh' },
      { id: 'u-med', name: 'AlunoMed' },
    ];
    const map = new Map([
      ['u-low', buildMaturity({ severity: 'LOW' })],
      ['u-high', buildMaturity({ severity: 'HIGH' })],
      ['u-med', buildMaturity({ severity: 'MED' })],
    ]);
    render(<MentorMaturityAlert students={students} maturityMap={map} />);
    const rows = screen.getAllByTestId(/^alert-row-/);
    expect(rows).toHaveLength(3);
    expect(rows[0].getAttribute('data-testid')).toBe('alert-row-u-high');
    expect(rows[1].getAttribute('data-testid')).toBe('alert-row-u-med');
    expect(rows[2].getAttribute('data-testid')).toBe('alert-row-u-low');
  });

  it('expande e colapsa detalhe ao clicar no toggle (aria-expanded reflete)', () => {
    const students = [{ id: 'u1', name: 'Marcos' }];
    const map = new Map([['u1', buildMaturity({ reasons: ['queda de WR'] })]]);
    render(<MentorMaturityAlert students={students} maturityMap={map} />);
    const toggle = screen.getByTestId('alert-toggle-u1');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('alert-detail-u1')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('alert-detail-u1')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('alert-detail-u1')).toBeNull();
  });

  it('renderiza razões quando detalhe está aberto', () => {
    const students = [{ id: 'u1', name: 'Marcos' }];
    const map = new Map([
      [
        'u1',
        buildMaturity({
          reasons: ['composite 42.3 < base 35', 'WR caiu 15pp'],
        }),
      ],
    ]);
    render(<MentorMaturityAlert students={students} maturityMap={map} />);
    fireEvent.click(screen.getByTestId('alert-toggle-u1'));
    const detail = screen.getByTestId('alert-detail-u1');
    expect(within(detail).getByText(/composite 42\.3 < base 35/)).toBeTruthy();
    expect(within(detail).getByText(/WR caiu 15pp/)).toBeTruthy();
    expect(within(detail).getByText(/Razões/i)).toBeTruthy();
  });

  it('renderiza blocker gates com valor vs threshold quando abertos', () => {
    const students = [{ id: 'u1', name: 'Aline' }];
    const map = new Map([
      [
        'u1',
        buildMaturity({
          blockers: ['maxdd-under-20', 'emotional-55'],
          gates: [
            {
              id: 'maxdd-under-20',
              label: 'MaxDD < 20%',
              value: 22,
              threshold: 20,
            },
            {
              id: 'emotional-55',
              label: 'Emocional ≥ 55',
              value: 48,
              threshold: 55,
            },
            {
              id: 'outro-gate',
              label: 'gate passado',
              value: 90,
              threshold: 80,
            },
          ],
        }),
      ],
    ]);
    render(<MentorMaturityAlert students={students} maturityMap={map} />);
    fireEvent.click(screen.getByTestId('alert-toggle-u1'));
    const detail = screen.getByTestId('alert-detail-u1');
    expect(within(detail).getByText(/Gates pendentes \(2\)/)).toBeTruthy();
    expect(within(detail).getByText(/MaxDD < 20% — 22\.00 vs 20/)).toBeTruthy();
    expect(within(detail).getByText(/Emocional ≥ 55 — 48\.00 vs 55/)).toBeTruthy();
    expect(within(detail).queryByText(/gate passado/)).toBeNull();
  });

  it('chama onSelectStudent com student correto ao clicar em "ver aluno"', () => {
    const student = { id: 'u1', name: 'Marcos', email: 'marcos@x.com' };
    const map = new Map([['u1', buildMaturity()]]);
    const onSelect = vi.fn();
    render(
      <MentorMaturityAlert
        students={[student]}
        maturityMap={map}
        onSelectStudent={onSelect}
      />
    );
    fireEvent.click(screen.getByTestId('alert-toggle-u1'));
    fireEvent.click(screen.getByTestId('alert-select-u1'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(student);
  });

  it('usa fallback LOW para severity desconhecida', () => {
    const students = [{ id: 'u1', name: 'X' }];
    const map = new Map([['u1', buildMaturity({ severity: 'CRITICAL' })]]);
    render(<MentorMaturityAlert students={students} maturityMap={map} />);
    const badge = screen.getByTestId('alert-severity-u1');
    // valor literal preservado no texto mas com estilo LOW aplicado
    expect(badge.textContent).toBe('CRITICAL');
    expect(badge.className).toContain('amber');
  });

  it('não quebra quando maturity não tem gates/reasons/blockers', () => {
    const students = [{ id: 'u1', email: 'minimal@x.com' }];
    const map = new Map([
      [
        'u1',
        {
          signalRegression: { detected: true, severity: 'MED' },
          // sem proposedTransition, sem gates, sem reasons, sem currentStage
        },
      ],
    ]);
    render(<MentorMaturityAlert students={students} maturityMap={map} />);
    expect(screen.getByTestId('alert-row-u1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('alert-toggle-u1'));
    const detail = screen.getByTestId('alert-detail-u1');
    // detail abre mesmo sem conteúdo, sem lançar erro
    expect(detail).toBeTruthy();
    // fallback para email quando sem name
    expect(screen.getByText('minimal@x.com')).toBeTruthy();
    // fallback textual quando sem stages
    expect(screen.getByText(/sinal detectado/)).toBeTruthy();
  });

  it('renderiza DebugBadge quando embedded=false (default)', () => {
    const students = [{ id: 'u1', name: 'X' }];
    const map = new Map([['u1', buildMaturity()]]);
    render(<MentorMaturityAlert students={students} maturityMap={map} />);
    expect(screen.getByTestId('debug-badge')).toBeTruthy();
    expect(screen.getByText('MentorMaturityAlert')).toBeTruthy();
  });

  it('omite DebugBadge quando embedded=true', () => {
    const students = [{ id: 'u1', name: 'X' }];
    const map = new Map([['u1', buildMaturity()]]);
    render(
      <MentorMaturityAlert students={students} maturityMap={map} embedded />
    );
    expect(screen.queryByTestId('debug-badge')).toBeNull();
  });

  describe('botão Atualizar maturidade (task 24 — I2)', () => {
    it('renderiza botão dentro do detalhe expandido com aluno em regressão', () => {
      const students = [{ id: 'u1', name: 'Marcos' }];
      const map = new Map([['u1', buildMaturity()]]);
      render(<MentorMaturityAlert students={students} maturityMap={map} />);
      expect(screen.queryByTestId('alert-refresh-u1')).toBeNull();

      fireEvent.click(screen.getByTestId('alert-toggle-u1'));
      const btn = screen.getByTestId('alert-refresh-u1');
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toMatch(/Atualizar maturidade/);
      expect(btn).not.toBeDisabled();
    });

    it('click dispara recompute(studentId) com o UID correto', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { success: true, stageCurrent: 3, gatesMet: 4, gatesTotal: 6 },
      });
      const students = [{ id: 'u-target', name: 'Aline' }];
      const map = new Map([['u-target', buildMaturity()]]);
      render(<MentorMaturityAlert students={students} maturityMap={map} />);

      fireEvent.click(screen.getByTestId('alert-toggle-u-target'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-refresh-u-target'));
      });

      expect(mockCallable).toHaveBeenCalledTimes(1);
      expect(mockCallable).toHaveBeenCalledWith({ studentId: 'u-target' });
    });

    it('estado loading desabilita o botão e mostra "Atualizando..."', async () => {
      let resolveCall;
      mockCallable.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveCall = resolve;
        })
      );

      const students = [{ id: 'u1', name: 'Marcos' }];
      const map = new Map([['u1', buildMaturity()]]);
      render(<MentorMaturityAlert students={students} maturityMap={map} />);

      fireEvent.click(screen.getByTestId('alert-toggle-u1'));
      act(() => {
        fireEvent.click(screen.getByTestId('alert-refresh-u1'));
      });

      await waitFor(() => {
        const btn = screen.getByTestId('alert-refresh-u1');
        expect(btn).toBeDisabled();
        expect(btn.textContent).toMatch(/Atualizando\.\.\./);
      });

      await act(async () => {
        resolveCall({ data: { success: true, stageCurrent: 1, gatesMet: 0, gatesTotal: 0 } });
      });
    });

    it('estado throttled exibe "Próxima em HH:MM" (formato BR 24h)', async () => {
      const future = new Date();
      future.setHours(14, 37, 0, 0);
      mockCallable.mockResolvedValueOnce({
        data: { throttled: true, nextAllowedAt: future.getTime() },
      });

      const students = [{ id: 'u1', name: 'Marcos' }];
      const map = new Map([['u1', buildMaturity()]]);
      render(<MentorMaturityAlert students={students} maturityMap={map} />);

      fireEvent.click(screen.getByTestId('alert-toggle-u1'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-refresh-u1'));
      });

      const expected = future.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const msg = screen.getByTestId('alert-refresh-throttled-u1');
      expect(msg.textContent).toBe(`Próxima em ${expected}`);
    });
  });
});
