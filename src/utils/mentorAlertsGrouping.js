/**
 * mentorAlertsGrouping — issue #101
 *
 * O painel de Alertas Emocionais listava UMA LINHA POR ALERTA, ordenada só por
 * severidade e sem janela de tempo. Na base de 27/08 isso são 235 alertas vivos,
 * nenhum lido, com idade mediana de 105 dias: as cinco linhas visíveis viravam
 * cinco alertas da mesma pessoa, de meses atrás. O mentor lia "quatro Sandras" e
 * não lia turma nenhuma.
 *
 * Aqui o alerta volta a ser sobre ALUNO: uma linha por pessoa, com quantos
 * alertas, o mais grave e o mais recente. E com janela — alerta de três meses
 * atrás não é alerta, é histórico.
 */

const ORDEM_SEVERIDADE = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Converte os alertas client-side (`useEmotionalProfile`) no formato do painel.
 *
 * DETERMINÍSTICO POR CONTRATO. O mapeamento anterior fazia
 * `timestamp: a.date ? new Date(a.date) : new Date()` — e nenhum alerta do hook
 * tem campo `date` (todos usam `timestamp`). Ou seja: TODO alerta nascia
 * carimbado com a hora atual, diferente a cada execução. Como o painel guarda o
 * resultado em estado e compara por JSON, o carimbo novo sempre diferia do
 * anterior, disparava `setState`, que re-renderizava, que remapeava — um loop
 * que não parava. Visível como painel pulando e como "agora" em alerta velho.
 *
 * Duas chamadas com a mesma entrada precisam devolver a MESMA saída. É isso que
 * o teste desta função trava.
 */
export function mapearAlertasDoAluno(alerts, { studentName, studentEmail } = {}) {
  return (alerts ?? [])
    .filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH')
    .map((a) => ({
      id: `local_${studentEmail}_${a.id || `${a.type}_${a.timestamp || 'na'}`}`,
      type: a.type,
      severity: a.severity || 'MEDIUM',
      studentName,
      studentEmail,
      message: a.message,
      // O carimbo é o do alerta. Sem carimbo, sem carimbo — nunca "agora".
      timestamp: a.timestamp ?? a.date ?? null,
      source: 'client',
      read: false,
    }));
}

/** Timestamp em ms de campos que chegam como Firestore Timestamp, Date ou string. */
export const paraMs = (ts) => {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

/**
 * @param {Array} alertas — alertas já mesclados (Firestore + client-side)
 * @param {Object} [opts]
 * @param {number|null} [opts.janelaDias=7] — null desliga a janela (ver histórico)
 * @param {Date} [opts.now]
 * @returns {{ linhas: Array, forasDaJanela: number }}
 *   linhas: [{ studentEmail, studentName, total, severity, ultimoMs, message, alertas }]
 */
export function agruparAlertasPorAluno(alertas, opts = {}) {
  const janelaDias = opts.janelaDias === undefined ? 7 : opts.janelaDias;
  const agora = (opts.now ?? new Date()).getTime();
  const limite = janelaDias == null ? null : agora - janelaDias * 86400000;

  const porAluno = new Map();
  let forasDaJanela = 0;

  for (const a of alertas ?? []) {
    const email = String(a?.studentEmail ?? '').toLowerCase();
    if (!email) continue;
    const ms = paraMs(a.timestamp ?? a.createdAt);
    // Alerta sem data entra: some por falta de carimbo é pior que aparecer demais.
    if (limite != null && ms != null && ms < limite) {
      forasDaJanela += 1;
      continue;
    }
    const linha = porAluno.get(email) ?? {
      studentEmail: a.studentEmail,
      studentName: a.studentName || a.studentEmail,
      total: 0,
      severity: 'LOW',
      ultimoMs: null,
      message: '',
      alertas: [],
    };
    linha.total += 1;
    linha.alertas.push(a);
    if (a.studentName) linha.studentName = a.studentName;

    const sev = a.severity || 'MEDIUM';
    if ((ORDEM_SEVERIDADE[sev] ?? 3) < (ORDEM_SEVERIDADE[linha.severity] ?? 3)) linha.severity = sev;
    // A mensagem exibida é a do alerta mais recente — é o que o mentor precisa ler.
    if (ms != null && (linha.ultimoMs == null || ms > linha.ultimoMs)) {
      linha.ultimoMs = ms;
      linha.message = a.message || linha.message;
    } else if (!linha.message) {
      linha.message = a.message || '';
    }
    porAluno.set(email, linha);
  }

  const linhas = [...porAluno.values()].sort((a, b) => {
    const s = (ORDEM_SEVERIDADE[a.severity] ?? 3) - (ORDEM_SEVERIDADE[b.severity] ?? 3);
    if (s !== 0) return s;
    return (b.ultimoMs ?? 0) - (a.ultimoMs ?? 0);
  });

  return { linhas, forasDaJanela };
}

export default agruparAlertasPorAluno;
