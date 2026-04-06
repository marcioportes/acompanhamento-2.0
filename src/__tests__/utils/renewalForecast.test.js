/**
 * Tests: Renewal forecast helper — issue #122
 * @description Testa agrupamento de subscriptions por mês de vencimento e soma de receita prevista.
 *   - Agrupa por mês/ano do endDate
 *   - Soma amount por mês
 *   - Lista alunos por mês
 *   - Filtra apenas subscriptions ativas paid com endDate futuro
 *   - Formato datas BR (INV-06)
 */

import { describe, it, expect } from 'vitest';
import { groupRenewalsByMonth, formatBRL, formatDateBR } from '../../utils/renewalForecast';

// ── Fixtures ────────────────────────────────────────────

const NOW = new Date('2026-04-05T12:00:00Z');

const makeSub = (overrides) => ({
  id: 'sub-1',
  studentId: 'st-1',
  studentName: 'Aluno Teste',
  status: 'active',
  type: 'paid',
  amount: 497,
  currency: 'BRL',
  endDate: new Date('2026-05-15T12:00:00Z'),
  ...overrides,
});

// ── Tests ───────────────────────────────────────────────

describe('groupRenewalsByMonth', () => {
  it('agrupa uma subscription no mês correto', () => {
    const subs = [makeSub({ endDate: new Date('2026-05-15T12:00:00Z') })];
    const result = groupRenewalsByMonth(subs, NOW);

    expect(result).toHaveLength(1);
    expect(result[0].monthKey).toBe('2026-05');
    expect(result[0].totalAmount).toBe(497);
    expect(result[0].students).toHaveLength(1);
    expect(result[0].students[0].name).toBe('Aluno Teste');
  });

  it('soma amounts de múltiplos alunos no mesmo mês', () => {
    const subs = [
      makeSub({ id: 's1', studentName: 'Aluno A', amount: 497, endDate: new Date('2026-05-10T12:00:00Z') }),
      makeSub({ id: 's2', studentName: 'Aluno B', amount: 297, endDate: new Date('2026-05-20T12:00:00Z') }),
    ];
    const result = groupRenewalsByMonth(subs, NOW);

    expect(result).toHaveLength(1);
    expect(result[0].totalAmount).toBe(794);
    expect(result[0].students).toHaveLength(2);
  });

  it('separa meses diferentes em grupos distintos', () => {
    const subs = [
      makeSub({ id: 's1', studentName: 'A', endDate: new Date('2026-05-10T12:00:00Z') }),
      makeSub({ id: 's2', studentName: 'B', endDate: new Date('2026-06-15T12:00:00Z') }),
      makeSub({ id: 's3', studentName: 'C', endDate: new Date('2026-05-25T12:00:00Z') }),
    ];
    const result = groupRenewalsByMonth(subs, NOW);

    expect(result).toHaveLength(2);
    expect(result[0].monthKey).toBe('2026-05');
    expect(result[0].students).toHaveLength(2);
    expect(result[1].monthKey).toBe('2026-06');
    expect(result[1].students).toHaveLength(1);
  });

  it('ordena cronologicamente', () => {
    const subs = [
      makeSub({ id: 's1', endDate: new Date('2026-08-01T12:00:00Z') }),
      makeSub({ id: 's2', endDate: new Date('2026-05-01T12:00:00Z') }),
      makeSub({ id: 's3', endDate: new Date('2026-06-01T12:00:00Z') }),
    ];
    const result = groupRenewalsByMonth(subs, NOW);

    expect(result.map(r => r.monthKey)).toEqual(['2026-05', '2026-06', '2026-08']);
  });

  describe('filtragem', () => {
    it('inclui active e overdue, exclui cancelled/paused', () => {
      const subs = [
        makeSub({ status: 'active' }),
        makeSub({ id: 's2', status: 'overdue', endDate: new Date('2026-05-15T12:00:00Z') }),
        makeSub({ id: 's3', status: 'cancelled' }),
        makeSub({ id: 's4', status: 'paused' }),
      ];
      const result = groupRenewalsByMonth(subs, NOW);
      const allStudents = result.flatMap(r => r.students);
      expect(allStudents).toHaveLength(2);
    });

    it('overdue com endDate no passado aparece no mês corrente', () => {
      const subs = [
        makeSub({ id: 's1', status: 'overdue', amount: 300, endDate: new Date('2026-03-01T12:00:00Z') }),
      ];
      const result = groupRenewalsByMonth(subs, NOW);
      expect(result).toHaveLength(1);
      expect(result[0].monthKey).toBe('2026-04'); // mês corrente, não março
      expect(result[0].students[0].overdue).toBe(true);
    });

    it('overdue com endDate futura fica no mês do endDate', () => {
      const subs = [
        makeSub({ id: 's1', status: 'overdue', endDate: new Date('2026-06-10T12:00:00Z') }),
      ];
      const result = groupRenewalsByMonth(subs, NOW);
      expect(result[0].monthKey).toBe('2026-06');
    });

    it('exclui trials', () => {
      const subs = [
        makeSub({ type: 'paid' }),
        makeSub({ id: 's2', type: 'trial' }),
      ];
      const result = groupRenewalsByMonth(subs, NOW);
      expect(result[0].students).toHaveLength(1);
    });

    it('active com endDate no passado vai para mês corrente (pendente)', () => {
      const subs = [
        makeSub({ endDate: new Date('2026-05-15T12:00:00Z') }), // futuro
        makeSub({ id: 's2', endDate: new Date('2026-03-01T12:00:00Z'), amount: 300 }), // passado → mês corrente
      ];
      const result = groupRenewalsByMonth(subs, NOW);
      expect(result).toHaveLength(2); // abril (pendente) + maio (futuro)
      const abril = result.find(r => r.monthKey === '2026-04');
      expect(abril).toBeDefined();
      expect(abril.students).toHaveLength(1);
      expect(abril.totalAmount).toBe(300);
    });

    it('exclui subscription sem endDate', () => {
      const subs = [
        makeSub({ endDate: new Date('2026-05-15T12:00:00Z') }),
        makeSub({ id: 's2', endDate: null }),
      ];
      const result = groupRenewalsByMonth(subs, NOW);
      expect(result[0].students).toHaveLength(1);
    });

    it('retorna array vazio quando nenhuma subscription é elegível', () => {
      const subs = [
        makeSub({ status: 'cancelled' }),
        makeSub({ id: 's2', type: 'trial' }),
      ];
      const result = groupRenewalsByMonth(subs, NOW);
      expect(result).toEqual([]);
    });
  });

  it('trata amount undefined como 0', () => {
    const subs = [makeSub({ amount: undefined })];
    const result = groupRenewalsByMonth(subs, NOW);
    expect(result[0].totalAmount).toBe(0);
  });

  it('endDate no dia de hoje é incluída (>= today)', () => {
    const subs = [makeSub({ endDate: new Date('2026-04-05T12:00:00Z') })];
    const result = groupRenewalsByMonth(subs, NOW);
    expect(result).toHaveLength(1);
  });

  describe('horizonte (maxMonths)', () => {
    it('exclui meses além do horizonte com default 6', () => {
      const subs = [
        makeSub({ id: 's1', endDate: new Date('2026-05-15T12:00:00Z') }), // +1 mês — dentro
        makeSub({ id: 's2', endDate: new Date('2027-04-15T12:00:00Z') }), // +12 meses — fora
      ];
      const result = groupRenewalsByMonth(subs, NOW);
      expect(result).toHaveLength(1);
      expect(result[0].monthKey).toBe('2026-05');
    });

    it('respeita maxMonths=2 — mostra apenas próximos 2 meses', () => {
      const subs = [
        makeSub({ id: 's1', endDate: new Date('2026-05-10T12:00:00Z') }), // +1 — dentro
        makeSub({ id: 's2', endDate: new Date('2026-06-10T12:00:00Z') }), // +2 — dentro
        makeSub({ id: 's3', endDate: new Date('2026-07-10T12:00:00Z') }), // +3 — fora
      ];
      const result = groupRenewalsByMonth(subs, NOW, 2);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.monthKey)).toEqual(['2026-05', '2026-06']);
    });

    it('maxMonths=0 retorna apenas mês corrente', () => {
      const subs = [
        makeSub({ id: 's1', endDate: new Date('2026-04-20T12:00:00Z') }), // mês corrente
        makeSub({ id: 's2', endDate: new Date('2026-05-10T12:00:00Z') }), // próximo — fora
      ];
      const result = groupRenewalsByMonth(subs, NOW, 0);
      expect(result).toHaveLength(1);
      expect(result[0].monthKey).toBe('2026-04');
    });
  });
});

describe('formatBRL', () => {
  it('formata valor como moeda brasileira', () => {
    const result = formatBRL(497);
    expect(result).toMatch(/R\$\s?497,00/);
  });

  it('formata zero', () => {
    const result = formatBRL(0);
    expect(result).toMatch(/R\$\s?0,00/);
  });

  it('formata centavos', () => {
    const result = formatBRL(1234.56);
    expect(result).toMatch(/1\.?234,56/);
  });
});

describe('formatDateBR (INV-06)', () => {
  it('formata data no padrão DD/MM/YYYY', () => {
    expect(formatDateBR(new Date('2026-05-15T12:00:00Z'))).toBe('15/05/2026');
  });

  it('retorna traço para null', () => {
    expect(formatDateBR(null)).toBe('—');
  });

  it('não sofre shift de fuso em datas midnight', () => {
    // Data criada em midnight UTC — não deve virar dia anterior em BR (UTC-3)
    expect(formatDateBR(new Date('2026-05-15T00:00:00Z'))).toBe('15/05/2026');
  });
});
