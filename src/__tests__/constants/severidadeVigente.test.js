/**
 * #101 (29/08/2026) — teto de severidade na LEITURA.
 *
 * Marcio: "sair abaixo do RR não é grave, é baixo... infelizmente não temos fonte.
 * period" — e depois: "não esquece de replicar isso pro motor de comportamento
 * para refletir na tela de feedback".
 *
 * Os trades antigos continuam com `EARLY_EXIT` gravado como HIGH/MEDIUM pela régua
 * abandonada. Backfill de snapshot é o que o #402 proibiu, então o teto é aplicado
 * na leitura — mesma mecânica das red flags revogadas.
 */
import { describe, it, expect } from 'vitest';
import { severidadeVigente } from '../../constants/behavioralTaxonomy';

describe('severidadeVigente', () => {
  it('rebaixa EARLY_EXIT gravado como alta', () => {
    expect(severidadeVigente('EARLY_EXIT', 'HIGH')).toBe('LOW');
    expect(severidadeVigente('EARLY_EXIT', 'MEDIUM')).toBe('LOW');
  });

  it('mantém EARLY_EXIT que já era baixa', () => {
    expect(severidadeVigente('EARLY_EXIT', 'LOW')).toBe('LOW');
  });

  it('sem severidade gravada, assume o teto', () => {
    expect(severidadeVigente('EARLY_EXIT', null)).toBe('LOW');
  });

  it('não mexe em padrão nenhum além do que tem teto', () => {
    expect(severidadeVigente('TILT', 'HIGH')).toBe('HIGH');
    expect(severidadeVigente('UNPROTECTED_SIZE', 'HIGH')).toBe('HIGH');
    expect(severidadeVigente('RISK_OVER_RO', 'HIGH')).toBe('HIGH');
  });

  it('código desconhecido devolve o que veio', () => {
    expect(severidadeVigente('NAO_EXISTE', 'HIGH')).toBe('HIGH');
    expect(severidadeVigente('NAO_EXISTE', null)).toBeNull();
  });

  it('NONE não é promovido a LOW por acidente', () => {
    expect(severidadeVigente('EARLY_EXIT', 'NONE')).toBe('NONE');
  });
});

describe('paridade com o espelho do servidor', async () => {
  const mirror = await import('../../../functions/maturity/behavioralTaxonomyMirror');

  it('os dois lados rebaixam igual', () => {
    for (const gravada of ['HIGH', 'MEDIUM', 'LOW', 'NONE', null]) {
      expect(mirror.severidadeVigente('EARLY_EXIT', gravada))
        .toBe(severidadeVigente('EARLY_EXIT', gravada));
      expect(mirror.severidadeVigente('TILT', gravada))
        .toBe(severidadeVigente('TILT', gravada));
    }
  });

  it('o padrão da taxonomia é BAIXA nos dois', () => {
    expect(mirror.getPattern('EARLY_EXIT').severityDefault).toBe('LOW');
  });
});
