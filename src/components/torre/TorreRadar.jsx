/**
 * TorreRadar — S3 da Torre (issue #101, Fase B · MC-6)
 *
 * ALUNO · IMPACTO · GATILHO · TEMPO, uma linha por aluno.
 *
 * IMPACTO vem da severidade que o motor unificado (CHUNK-11) já atribuiu —
 * `SEVERITY_LABELS` Alta/Média/Baixa — em vez de um limiar novo. GATILHO é o
 * rótulo em português da família dominante (`BEHAVIOR_LABELS`). Duas réguas para
 * a mesma coisa seria o começo do drift.
 *
 * Quem está na Prioridade não se repete aqui: a mesma pessoa cobrada duas vezes
 * na mesma tela vira ruído.
 */
import { Shield } from 'lucide-react';
import { BEHAVIOR_LABELS, SEVERITY_LABELS, SEVERITY_STYLES } from '../Trades/behaviorDisplay';

/** "agora", "10 min", "2h", "3d" — recência do fato, não da leitura. */
export const desdeQuando = (ms, agora = Date.now()) => {
  if (!ms) return '';
  const seg = Math.max(0, (agora - ms) / 1000);
  if (seg < 60) return 'agora';
  if (seg < 3600) return `${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `${Math.floor(seg / 3600)}h`;
  return `${Math.floor(seg / 86400)}d`;
};

const TorreRadar = ({ radar = [], janelaDias = 7, onAbrirAluno }) => (
  <div className="glass-card">
    <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-slate-400" />
        <h3 className="font-semibold text-white">Radar de Risco</h3>
      </div>
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">últimos {janelaDias} dias</span>
    </div>

    {radar.length === 0 ? (
      <div className="p-8 text-center">
        <Shield className="w-10 h-10 text-emerald-400/50 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Nenhum padrão de risco na janela.</p>
      </div>
    ) : (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
              <th className="p-4 font-bold">Aluno</th>
              <th className="p-4 font-bold">Impacto</th>
              <th className="p-4 font-bold">Gatilho</th>
              <th className="p-4 font-bold text-right">Tempo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-sm">
            {radar.map((aluno) => {
              const r = aluno.radar;
              const estilo = SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.LOW; // string de classes
              return (
                <tr
                  key={aluno.studentId}
                  className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                  onClick={() => onAbrirAluno?.({ email: aluno.email, name: aluno.name, studentId: aluno.studentId })}
                >
                  <td className="p-4 font-medium text-white whitespace-nowrap">{aluno.name}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${estilo}`}>
                      {SEVERITY_LABELS[r.severity] ?? r.severity}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300">
                    {BEHAVIOR_LABELS[r.code] ?? r.family}
                    {r.ocorrencias > 1 && (
                      <span className="text-slate-500 text-xs"> · {r.ocorrencias} ocorrências</span>
                    )}
                  </td>
                  <td className="p-4 text-right text-xs text-slate-500 whitespace-nowrap">
                    {desdeQuando(r.quandoMs)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default TorreRadar;
