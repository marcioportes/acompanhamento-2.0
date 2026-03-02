/**
 * Tests: validateBulkFeedback
 * @description Testa validação de inputs do feedback em massa
 * 
 * Cenários críticos:
 * - Seleção vazia, feedback vazio
 * - Trades de alunos diferentes (deve rejeitar)
 * - Trades com status != OPEN (deve rejeitar)
 * - Limite de 50 trades
 * - Happy path
 */

import { describe, it, expect } from 'vitest';
import { validateBulkFeedback } from '../../utils/bulkFeedback';

const makeTrade = (id, studentEmail = 'aluno@test.com', status = 'OPEN') => ({
  id, studentEmail, status
});

describe('validateBulkFeedback', () => {

  describe('happy path', () => {
    it('inputs válidos → valid true, sem erros', () => {
      const trades = [
        makeTrade('t1'),
        makeTrade('t2'),
        makeTrade('t3'),
      ];

      const result = validateBulkFeedback(['t1', 't2'], 'Bom trabalho!', trades);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('1 trade selecionado → válido (edge case mínimo)', () => {
      const trades = [makeTrade('t1')];
      const result = validateBulkFeedback(['t1'], 'Feedback', trades);
      expect(result.valid).toBe(true);
    });

    it('50 trades selecionados → válido (limite exato)', () => {
      const trades = Array.from({ length: 50 }, (_, i) => makeTrade(`t${i}`));
      const ids = trades.map(t => t.id);
      const result = validateBulkFeedback(ids, 'Feedback', trades);
      expect(result.valid).toBe(true);
    });
  });

  describe('seleção inválida', () => {
    it('nenhum trade selecionado → erro', () => {
      const result = validateBulkFeedback([], 'Feedback', []);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Nenhum trade selecionado');
    });

    it('tradeIds null → erro', () => {
      const result = validateBulkFeedback(null, 'Feedback', []);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Nenhum trade selecionado');
    });

    it('mais de 50 trades → erro', () => {
      const trades = Array.from({ length: 51 }, (_, i) => makeTrade(`t${i}`));
      const ids = trades.map(t => t.id);
      const result = validateBulkFeedback(ids, 'Feedback', trades);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Máximo 50');
    });
  });

  describe('feedback vazio', () => {
    it('content vazio → erro', () => {
      const trades = [makeTrade('t1')];
      const result = validateBulkFeedback(['t1'], '', trades);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Feedback vazio');
    });

    it('content só espaços → erro', () => {
      const trades = [makeTrade('t1')];
      const result = validateBulkFeedback(['t1'], '   ', trades);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Feedback vazio');
    });

    it('content null → erro', () => {
      const trades = [makeTrade('t1')];
      const result = validateBulkFeedback(['t1'], null, trades);
      expect(result.valid).toBe(false);
    });
  });

  describe('alunos diferentes', () => {
    it('trades de 2 alunos → erro', () => {
      const trades = [
        makeTrade('t1', 'aluno1@test.com'),
        makeTrade('t2', 'aluno2@test.com'),
      ];

      const result = validateBulkFeedback(['t1', 't2'], 'Feedback', trades);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('alunos diferentes');
    });

    it('trades do mesmo aluno → válido', () => {
      const trades = [
        makeTrade('t1', 'aluno@test.com'),
        makeTrade('t2', 'aluno@test.com'),
      ];

      const result = validateBulkFeedback(['t1', 't2'], 'Feedback', trades);

      expect(result.valid).toBe(true);
    });
  });

  describe('status não-OPEN', () => {
    it('trade REVIEWED → erro', () => {
      const trades = [
        makeTrade('t1', 'aluno@test.com', 'OPEN'),
        makeTrade('t2', 'aluno@test.com', 'REVIEWED'),
      ];

      const result = validateBulkFeedback(['t1', 't2'], 'Feedback', trades);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('não estão em status OPEN');
    });

    it('trade QUESTION → erro (precisa resposta individual)', () => {
      const trades = [
        makeTrade('t1', 'aluno@test.com', 'OPEN'),
        makeTrade('t2', 'aluno@test.com', 'QUESTION'),
      ];

      const result = validateBulkFeedback(['t1', 't2'], 'Feedback', trades);

      expect(result.valid).toBe(false);
    });

    it('trade CLOSED → erro', () => {
      const trades = [makeTrade('t1', 'aluno@test.com', 'CLOSED')];
      const result = validateBulkFeedback(['t1'], 'Feedback', trades);
      expect(result.valid).toBe(false);
    });

    it('todos OPEN → válido', () => {
      const trades = [
        makeTrade('t1', 'aluno@test.com', 'OPEN'),
        makeTrade('t2', 'aluno@test.com', 'OPEN'),
      ];
      const result = validateBulkFeedback(['t1', 't2'], 'Feedback', trades);
      expect(result.valid).toBe(true);
    });
  });

  describe('IDs não encontrados', () => {
    it('trade ID inexistente → erro', () => {
      const trades = [makeTrade('t1')];
      const result = validateBulkFeedback(['t1', 'inexistente'], 'Feedback', trades);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('não encontrado');
    });
  });

  describe('múltiplos erros simultâneos', () => {
    it('feedback vazio + alunos diferentes → 2 erros', () => {
      const trades = [
        makeTrade('t1', 'a@test.com'),
        makeTrade('t2', 'b@test.com'),
      ];

      const result = validateBulkFeedback(['t1', 't2'], '', trades);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
