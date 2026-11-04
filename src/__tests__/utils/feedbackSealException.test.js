/**
 * #497 — conversa do aluno em ciclo selado.
 * O emulador de rules não roda neste ambiente; a regra é testada pelo espelho
 * (feedbackSealException.js) e a paridade com firestore.rules é conferida no texto.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  isSealedConversationUpdate,
  SEALED_CONVERSATION_FIELDS,
  SEALED_CONVERSATION_FROM,
  SEALED_CONVERSATION_TO,
} from '../../utils/feedbackSealException';

const RULES = fs.readFileSync(path.resolve(__dirname, '../../../firestore.rules'), 'utf8');

const block497 = () => {
  const start = RULES.indexOf('// Exceção #497');
  expect(start).toBeGreaterThan(-1);
  return RULES.slice(start, RULES.indexOf(')\n      ) && (', start));
};
const listIn = (src, re) => (src.match(re)?.[1] || '').split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);

describe('#497 — espelho da rule: conversa do aluno em ciclo selado', () => {
  it('dúvida: REVIEWED → QUESTION com comentário passa', () => {
    expect(isSealedConversationUpdate('REVIEWED', 'QUESTION', ['feedbackHistory', 'status', 'updatedAt'])).toBe(true);
  });
  it('encerrar: REVIEWED → CLOSED passa', () => {
    expect(isSealedConversationUpdate('REVIEWED', 'CLOSED', ['status', 'updatedAt'])).toBe(true);
  });
  it('comentário antes de encerrar: REVIEWED → REVIEWED só com feedbackHistory passa', () => {
    expect(isSealedConversationUpdate('REVIEWED', 'REVIEWED', ['feedbackHistory', 'updatedAt'])).toBe(true);
  });
  it('campo do trade junto com a conversa é negado', () => {
    expect(isSealedConversationUpdate('REVIEWED', 'CLOSED', ['status', 'result'])).toBe(false);
    expect(isSealedConversationUpdate('REVIEWED', 'QUESTION', ['feedbackHistory', 'status', 'emotionEntry'])).toBe(false);
  });
  it('metadado do mentor (mentorFeedback) não entra pela exceção do aluno', () => {
    expect(isSealedConversationUpdate('REVIEWED', 'REVIEWED', ['feedbackHistory', 'mentorFeedback'])).toBe(false);
  });
  it('DISCUSSED continua negado, de origem ou de destino', () => {
    expect(isSealedConversationUpdate('DISCUSSED', 'CLOSED', ['status'])).toBe(false);
    expect(isSealedConversationUpdate('REVIEWED', 'DISCUSSED', ['status'])).toBe(false);
  });
  it('fora de REVIEWED não há conversa do aluno (OPEN, QUESTION, CLOSED)', () => {
    expect(isSealedConversationUpdate('OPEN', 'QUESTION', ['feedbackHistory', 'status'])).toBe(false);
    expect(isSealedConversationUpdate('QUESTION', 'CLOSED', ['status'])).toBe(false);
    expect(isSealedConversationUpdate('CLOSED', 'REVIEWED', ['status'])).toBe(false);
    expect(isSealedConversationUpdate(undefined, 'CLOSED', ['status'])).toBe(false);
  });
  it('reabrir para OPEN é negado', () => {
    expect(isSealedConversationUpdate('REVIEWED', 'OPEN', ['status'])).toBe(false);
  });
  it('changedKeys inválido é negado', () => {
    expect(isSealedConversationUpdate('REVIEWED', 'CLOSED', null)).toBe(false);
  });
});

describe('#497 — paridade espelho × firestore.rules', () => {
  it('allowlist de campos é a mesma', () => {
    expect(listIn(block497(), /hasOnly\(\[([^\]]+)\]\)/).sort()).toEqual([...SEALED_CONVERSATION_FIELDS].sort());
  });
  it('status de origem é o mesmo', () => {
    expect(block497()).toContain(`resource.data.get('status', 'OPEN') == '${SEALED_CONVERSATION_FROM}'`);
  });
  it('status de destino são os mesmos', () => {
    expect(listIn(block497(), /in \[([^\]]+)\]/).sort()).toEqual([...SEALED_CONVERSATION_TO].sort());
  });
  it('a exceção não faz get() do plano', () => {
    expect(block497()).not.toMatch(/get\(\/databases/);
  });
  it('a guarda de DISCUSSED segue na rule depois das exceções', () => {
    const after = RULES.slice(RULES.indexOf('// Exceção #497'));
    expect(after).toContain("request.resource.data.get('status', 'OPEN') != 'DISCUSSED'");
  });
  it('o payload do aluno no app cabe na allowlist (dúvida e encerrar)', () => {
    const hook = fs.readFileSync(path.resolve(__dirname, '../../hooks/useTrades.js'), 'utf8');
    const fnStart = hook.indexOf('const addFeedbackComment');
    const objStart = hook.indexOf('const updateData = {', fnStart);
    const comment = hook.slice(objStart, hook.indexOf('};', objStart));
    const keys = [...comment.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...SEALED_CONVERSATION_FIELDS].sort());
    const status = hook.slice(hook.indexOf('const updateTradeStatus'), hook.indexOf('}, [user]);', hook.indexOf('const updateTradeStatus')));
    expect(status).toContain('{ status: newStatus, updatedAt: serverTimestamp() }');
  });
});
