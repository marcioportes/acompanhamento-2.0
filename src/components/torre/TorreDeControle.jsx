/**
 * TorreDeControle — a home do mentor (issue #101, Fase E)
 *
 * UMA tela que responde "o que eu faço agora?", em três faixas:
 *
 *   1. AGIR AGORA — quem exige atitude hoje (prioridade do dia, promoções
 *      prontas, regressões de maturidade). Some quando não há nada.
 *   2. A TURMA — uma linha por aluno, todos, ordenada por quem precisa de você.
 *      É a espinha dorsal, e substitui Radar de Risco, Fora do Plano e o painel
 *      de Alertas Emocionais, que recortavam a mesma população três vezes.
 *   3. MINHAS PENDÊNCIAS — o que EU devo: revisões, feedbacks e fechamentos.
 *      (#144 — os fechamentos entraram aqui quando o menu do mentor perdeu as
 *      quatro filas irmãs e a Torre virou a única porta.)
 *
 * O que era diagnóstico (calendário, Stop × Gain, retrato do aluno) saiu daqui e
 * foi para a aba Análises: gráfico serve para investigar DEPOIS de escolher a
 * pessoa, não para competir com a triagem.
 *
 * Presentacional: recebe o resultado de `useMentorRiskRadar` pronto, para que a
 * mesma passada alimente as duas abas sem recalcular.
 */
import { useState, useMemo } from 'react';
import TorreHeader from './TorreHeader';
import TorrePrioridade from './TorrePrioridade';
import TorreTurma from './TorreTurma';
import { FAIXA } from '../../utils/mentorRiskRadar';

const TorreDeControle = ({ radar, onAbrirAluno, extrasAcao = null, pendencias = null, rodape = null }) => {
  const { dia, header, priority = [], turma = [] } = radar ?? {};

  // O número do tile clica e recorta a lista — contador que não filtra é decoração.
  const [filtro, setFiltro] = useState(null);
  const turmaVisivel = useMemo(() => {
    if (filtro === 'hoje') return turma.filter((a) => a.operouHoje);
    if (filtro === 'atencao') return turma.filter((a) => a.atencao.faixa <= FAIXA.FORA_DO_PLANO);
    if (filtro === 'fora') return turma.filter((a) => a.foraDoPlanoSemana?.pct > 0);
    return turma;
  }, [turma, filtro]);

  const [ano, mes, diaDoMes] = String(dia ?? '').split('-');

  return (
    <div className="mb-8 space-y-6">
      <div className="flex items-center justify-end">
        <span className="text-[11px] text-slate-600 font-mono">
          {ano ? `hoje · ${diaDoMes}/${mes}/${ano}` : ''}
        </span>
      </div>

      <TorreHeader header={header} filtro={filtro} onFiltrar={setFiltro} />

      <TorrePrioridade priority={priority} onAbrirAluno={onAbrirAluno} />
      {extrasAcao}

      <TorreTurma
        turma={turmaVisivel}
        total={turma.length}
        filtro={filtro}
        onLimparFiltro={() => setFiltro(null)}
        onAbrirAluno={onAbrirAluno}
      />

      {pendencias}
      {rodape}
    </div>
  );
};

export default TorreDeControle;
