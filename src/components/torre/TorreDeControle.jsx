/**
 * TorreDeControle — issue #101
 *
 * Aba do Dashboard do mentor, com a tela inteira: é o layout do mockup
 * (`docs/dev/mentor-dashboard-v2-mockup.png`) — header de quatro tiles, coluna
 * principal com Prioridade do Dia / Radar de Risco / Fora do Plano × Stop-Gain,
 * e trilho direito com a Visão Rápida por Aluno.
 *
 *   Fase A (aqui) — S1 Header.
 *   Fase B — S2 Prioridade do Dia + S3 Radar de Risco.
 *   Fase C — S4 Fora do Plano + S5 Stop × Gain.
 *   Fase D — S6 Visão Rápida por Aluno.
 *
 * As seções que ainda não chegaram ocupam o lugar delas no layout, nomeadas: a
 * tela já tem a forma final, e dá pra ver o que falta sem abrir o issue.
 *
 * Camada de leitura: nenhuma persistência nova (INV-15). Não abre listener —
 * recebe o que o `MentorDashboard` já escuta.
 * Sem DebugBadge próprio: é seção, e a página já tem o dela.
 */
import useMentorRiskRadar from '../../hooks/useMentorRiskRadar';
import TorreHeader from './TorreHeader';
import TorrePrioridade from './TorrePrioridade';
import TorreRadar from './TorreRadar';
import TorreForaDoPlano from './TorreForaDoPlano';
import TorreStopGain from './TorreStopGain';

const Secao = ({ titulo, fase, altura = 'h-40' }) => (
  <div className={`bg-slate-900/40 border border-dashed border-slate-800 rounded-xl px-5 flex flex-col items-center justify-center ${altura}`}>
    <div className="text-sm text-slate-500 font-semibold">{titulo}</div>
    <div className="text-[10px] text-slate-700 uppercase tracking-wide mt-1.5">Fase {fase}</div>
  </div>
);

const TorreDeControle = ({ allTrades, plans, students, subscriptions, onAbrirAluno }) => {
  const { dia, janelaDias, header, priority, radar, foraPlano, stopGain } = useMentorRiskRadar({
    allTrades, plans, students, subscriptions,
  });

  const [ano, mes, diaDoMes] = String(dia).split('-');

  return (
    <div className="mb-8">
      {/* No mockup os quatro tiles atravessam a tela inteira; as duas colunas
          começam abaixo deles. */}
      <div className="flex items-center justify-end mb-2">
        <span className="text-[11px] text-slate-600 font-mono">{`hoje · ${diaDoMes}/${mes}/${ano}`}</span>
      </div>

      <TorreHeader header={header} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="xl:col-span-2 space-y-6">
          <TorrePrioridade priority={priority} onAbrirAluno={onAbrirAluno} />
          <TorreRadar radar={radar} janelaDias={janelaDias} onAbrirAluno={onAbrirAluno} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TorreForaDoPlano foraPlano={foraPlano} onAbrirAluno={onAbrirAluno} />
            <TorreStopGain stopGain={stopGain} />
          </div>
        </div>

        <Secao titulo="Visão Rápida por Aluno" fase="D" altura="h-full min-h-[20rem]" />
      </div>
    </div>
  );
};

export default TorreDeControle;
