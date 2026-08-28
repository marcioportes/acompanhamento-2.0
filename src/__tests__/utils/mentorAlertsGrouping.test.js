/**
 * #101 — agrupamento do painel de alertas. Base real de 27/08: 235 alertas vivos,
 * zero lidos, idade mediana 105 dias. Na janela de 7 dias são 26 alertas de
 * apenas 4 alunos — quatro linhas, não vinte e seis.
 */
import { describe, it, expect } from 'vitest';
import { agruparAlertasPorAluno, paraMs, mapearAlertasDoAluno } from '../../utils/mentorAlertsGrouping';

const AGORA = new Date('2026-08-27T12:00:00-03:00');
const diasAtras = (n) => new Date(AGORA.getTime() - n * 86400000);

const alerta = (email, extra = {}) => ({
  studentEmail: email,
  studentName: email.split('@')[0],
  message: 'msg',
  severity: 'MEDIUM',
  timestamp: diasAtras(1),
  ...extra,
});

describe('paraMs', () => {
  it('aceita Timestamp do Firestore, Date e string', () => {
    const d = new Date('2026-08-20T10:00:00Z');
    expect(paraMs({ toDate: () => d })).toBe(d.getTime());
    expect(paraMs(d)).toBe(d.getTime());
    expect(paraMs('2026-08-20T10:00:00Z')).toBe(d.getTime());
  });

  it('devolve null pro que não é data', () => {
    expect(paraMs(null)).toBeNull();
    expect(paraMs('nem data')).toBeNull();
  });
});

describe('agruparAlertasPorAluno', () => {
  it('quatro alertas da Sandra viram UMA linha — o defeito que o mentor viu', () => {
    const { linhas } = agruparAlertasPorAluno(
      [alerta('sandra@x.com'), alerta('sandra@x.com'), alerta('sandra@x.com'), alerta('sandra@x.com')],
      { now: AGORA },
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].total).toBe(4);
  });

  it('agrupa sem depender de caixa do email', () => {
    const { linhas } = agruparAlertasPorAluno(
      [alerta('Sandra@x.com'), alerta('sandra@X.com')],
      { now: AGORA },
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].total).toBe(2);
  });

  it('a linha carrega a pior severidade do aluno', () => {
    const { linhas } = agruparAlertasPorAluno(
      [alerta('a@x.com', { severity: 'MEDIUM' }), alerta('a@x.com', { severity: 'CRITICAL' })],
      { now: AGORA },
    );
    expect(linhas[0].severity).toBe('CRITICAL');
  });

  it('a mensagem exibida é a do alerta mais recente', () => {
    const { linhas } = agruparAlertasPorAluno(
      [
        alerta('a@x.com', { message: 'antigo', timestamp: diasAtras(5) }),
        alerta('a@x.com', { message: 'recente', timestamp: diasAtras(1) }),
      ],
      { now: AGORA },
    );
    expect(linhas[0].message).toBe('recente');
    expect(linhas[0].ultimoMs).toBe(diasAtras(1).getTime());
  });

  it('janela de 7 dias corta o histórico e diz quanto ficou de fora', () => {
    const { linhas, forasDaJanela } = agruparAlertasPorAluno(
      [
        alerta('a@x.com', { timestamp: diasAtras(2) }),
        alerta('b@x.com', { timestamp: diasAtras(105) }), // idade mediana da base
        alerta('c@x.com', { timestamp: diasAtras(184) }), // o mais velho da base
      ],
      { now: AGORA },
    );
    expect(linhas.map((l) => l.studentEmail)).toEqual(['a@x.com']);
    expect(forasDaJanela).toBe(2);
  });

  it('janela nula mostra tudo — é o "ver histórico"', () => {
    const { linhas, forasDaJanela } = agruparAlertasPorAluno(
      [alerta('a@x.com', { timestamp: diasAtras(2) }), alerta('b@x.com', { timestamp: diasAtras(184) })],
      { now: AGORA, janelaDias: null },
    );
    expect(linhas).toHaveLength(2);
    expect(forasDaJanela).toBe(0);
  });

  it('alerta sem data entra na janela — sumir por falta de carimbo é pior', () => {
    const { linhas } = agruparAlertasPorAluno([alerta('a@x.com', { timestamp: null })], { now: AGORA });
    expect(linhas).toHaveLength(1);
  });

  it('ordena por severidade e, dentro dela, pelo mais recente', () => {
    const { linhas } = agruparAlertasPorAluno(
      [
        alerta('medio@x.com', { severity: 'MEDIUM', timestamp: diasAtras(0) }),
        alerta('critico-velho@x.com', { severity: 'CRITICAL', timestamp: diasAtras(4) }),
        alerta('critico-novo@x.com', { severity: 'CRITICAL', timestamp: diasAtras(1) }),
      ],
      { now: AGORA },
    );
    expect(linhas.map((l) => l.studentEmail)).toEqual([
      'critico-novo@x.com', 'critico-velho@x.com', 'medio@x.com',
    ]);
  });

  it('alerta sem email não vira linha órfã', () => {
    const { linhas } = agruparAlertasPorAluno([{ message: 'sem dono' }], { now: AGORA });
    expect(linhas).toEqual([]);
  });

  it('entrada vazia não explode', () => {
    expect(agruparAlertasPorAluno(null).linhas).toEqual([]);
  });
});

describe('mapearAlertasDoAluno — a causa do painel pulando', () => {
  // Nenhum alerta do useEmotionalProfile tem campo `date`; todos usam `timestamp`.
  const doHook = [
    { id: 'tilt_0', type: 'TILT_DETECTED', severity: 'CRITICAL', message: 'TILT', timestamp: '2026-08-25T10:00:00-03:00' },
    { id: 'revenge_0', type: 'REVENGE_DETECTED', severity: 'HIGH', message: 'Revenge', timestamp: '2026-08-25T11:00:00-03:00' },
    { id: 'x', type: 'OUTRO', severity: 'MEDIUM', message: 'ruído', timestamp: '2026-08-25T12:00:00-03:00' },
  ];

  it('é determinístico — duas chamadas com a mesma entrada dão a mesma saída', () => {
    // O mapeamento antigo carimbava `new Date()` em todo alerta (porque lia `a.date`,
    // que não existe). O painel guardava isso em estado e comparava por JSON: o
    // carimbo novo sempre diferia, disparava setState, re-renderizava, remapeava.
    const a = mapearAlertasDoAluno(doHook, { studentName: 'Sandra', studentEmail: 's@x.com' });
    const b = mapearAlertasDoAluno(doHook, { studentName: 'Sandra', studentEmail: 's@x.com' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('preserva o carimbo do alerta em vez de inventar "agora"', () => {
    const [tilt] = mapearAlertasDoAluno(doHook, { studentEmail: 's@x.com' });
    expect(tilt.timestamp).toBe('2026-08-25T10:00:00-03:00');
  });

  it('alerta sem carimbo fica sem carimbo — nunca "agora"', () => {
    const [a] = mapearAlertasDoAluno(
      [{ id: 'z', type: 'TILT_DETECTED', severity: 'CRITICAL', message: 'sem hora' }],
      { studentEmail: 's@x.com' },
    );
    expect(a.timestamp).toBeNull();
  });

  it('só sobe CRITICAL e HIGH ao painel', () => {
    const r = mapearAlertasDoAluno(doHook, { studentEmail: 's@x.com' });
    expect(r.map((a) => a.severity)).toEqual(['CRITICAL', 'HIGH']);
  });

  it('id é estável e carrega o dono', () => {
    const [a] = mapearAlertasDoAluno(doHook, { studentEmail: 's@x.com' });
    expect(a.id).toBe('local_s@x.com_tilt_0');
  });

  it('entrada vazia não explode', () => {
    expect(mapearAlertasDoAluno(null, { studentEmail: 's@x.com' })).toEqual([]);
  });
});
