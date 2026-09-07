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
 *   3. MINHAS PENDÊNCIAS — o que EU devo: feedbacks e revisões.
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
import TorreAgenda from './TorreAgenda';
import TorreTurma from './TorreTurma';
import { FAIXA } from '../../utils/mentorRiskRadar';

const TorreDeControle = ({
  radar,
  onAbrirAluno,
  extrasAcao = null,
  totalDecisoes = 0,
  rascunhos = 0,
  fechamentosPendentes = 0,
  onIrParaFeedback,
  onIrParaRevisoes,
  onIrParaFechamentos,
}) => {
  const { dia, header, turma = [] } = radar ?? {};

  // Agenda é o padrão: a pergunta do dia é "o que eu faço agora", e a lista da
  // turma responde outra ("como está cada um"). A segunda continua a um clique,
  // porque ver todo mundo — inclusive quem está quieto — é o que impede a tela
  // de só enxergar quem faz barulho.
  const [visao, setVisao] = useState('agenda');

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div
          className="inline-flex items-center gap-0.5 p-0.5"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)' }}
        >
          {[['agenda', 'Agenda'], ['turma', 'A turma']].map(([id, rotulo]) => (
            <button
              key={id}
              data-visao={id}
              onClick={() => setVisao(id)}
              className="px-3 h-7 text-[12px] transition-colors"
              style={{
                borderRadius: 'var(--r-sm)',
                background: visao === id ? 'var(--surface-3)' : 'transparent',
                color: visao === id ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: visao === id ? 600 : 400,
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-mono tabular" style={{ color: 'var(--ink-4)' }}>
          {ano ? `hoje · ${diaDoMes}/${mes}/${ano}` : ''}
        </span>
      </div>

      {visao === 'agenda' ? (
        <TorreAgenda
          radar={radar}
          onAbrirAluno={onAbrirAluno}
          onIrParaFeedback={onIrParaFeedback}
          onIrParaRevisoes={onIrParaRevisoes}
          onIrParaFechamentos={onIrParaFechamentos}
          rascunhos={rascunhos}
          fechamentosPendentes={fechamentosPendentes}
          totalDecisoes={totalDecisoes}
          decisoes={extrasAcao}
        />
      ) : (
        <>
          <TorreHeader header={header} filtro={filtro} onFiltrar={setFiltro} />
          <TorreTurma
            turma={turmaVisivel}
            total={turma.length}
            filtro={filtro}
            onLimparFiltro={() => setFiltro(null)}
            onAbrirAluno={onAbrirAluno}
          />
        </>
      )}
    </div>
  );
};

export default TorreDeControle;
