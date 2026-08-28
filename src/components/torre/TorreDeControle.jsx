/**
 * TorreDeControle — issue #101
 *
 * O dashboard do mentor **é** a Torre. Não é destino paralelo: é a mesma tela,
 * reconstruída por seção. Cada fase substitui um pedaço do que está aqui hoje.
 *
 *   Fase A (aqui) — S1 Header. Substitui os quatro StatCards de média de turma.
 *   Fase B — S2 Prioridade do Dia + S3 Radar de Risco.
 *   Fase C — S4 Fora do Plano + S5 Stop × Gain.
 *   Fase D — S6 Visão Rápida por Aluno + destino do que sobrar do overview v1.
 *
 * Camada de leitura: nenhuma persistência nova (INV-15). Tudo é derivado do que
 * o mentor já escuta — este componente não abre listener.
 *
 * Sem DebugBadge próprio: é seção, e a página (`MentorDashboard`) já tem o dela.
 */
import useMentorRiskRadar from '../../hooks/useMentorRiskRadar';
import TorreHeader from './TorreHeader';

/** Roadmap visível: o mentor sabe o que ainda não chegou, sem caixa vazia ocupando a tela. */
const EmConstrucao = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 mb-8">
    <span className="uppercase tracking-wide text-slate-700">Em construção</span>
    <span>Prioridade do Dia · Radar de Risco <span className="text-slate-700">(B)</span></span>
    <span className="text-slate-800">|</span>
    <span>Fora do Plano · Stop × Gain <span className="text-slate-700">(C)</span></span>
    <span className="text-slate-800">|</span>
    <span>Visão Rápida por Aluno <span className="text-slate-700">(D)</span></span>
  </div>
);

const TorreDeControle = ({ allTrades, plans, students, subscriptions }) => {
  const { dia, header } = useMentorRiskRadar({ allTrades, plans, students, subscriptions });

  const [ano, mes, diaDoMes] = String(dia).split('-');

  return (
    <div className="mb-8">
      <div className="flex items-center justify-end mb-2">
        <span className="text-[11px] text-slate-600 font-mono">{`hoje · ${diaDoMes}/${mes}/${ano}`}</span>
      </div>

      <TorreHeader header={header} />
      <div className="h-4" />
      <EmConstrucao />
    </div>
  );
};

export default TorreDeControle;
