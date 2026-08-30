/**
 * FilaDeFeedback — a fila em árvore: aluno → dia → plano → trade (issue #408).
 *
 * Marcio, 27/08: *"eu faço por aluno, mas não converso durante o feedback, mas
 * sim, por aluno/dia/trades"* — e depois fixou a hierarquia com o nível de plano:
 * *"aluno/dia/plano/trade"*.
 *
 * O QUE MUDA: a tela entregava uma lista plana de trades por aluno. Cada trade
 * chegava sem passado, e o mentor reconstruía o contexto de cabeça. O que só
 * existe no conjunto ficava invisível — a Sandra em 26/08 aparecia como cinco
 * linhas soltas quando é UM dia em que o plano autoriza uma operação, o stop foi
 * atingido na primeira, e ela abriu mais três.
 *
 * O NÍVEL DE PLANO NÃO É DETALHE: o período é medido por plano, com limiares e
 * moeda próprios. Com um plano só ele colapsa e não estorva; com dois, é o que
 * impede de somar reais com dólares e medir o total contra o stop de um só.
 *
 * Nada é calculado aqui: `buildFilaDeFeedback` monta a árvore sobre o
 * `buildPeriodState` do #402, e o texto por operação vem de `authorizationNotice`.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Ban, MessageSquare, HelpCircle, CheckSquare, Square } from 'lucide-react';
import { DayTile, dayResultContent, dayBudgetContent, dayStopContent, authorizationNotice, dayOrderingNotice } from '../metrics/dayMetricTiles';
import { formatCurrencyDynamic } from '../../utils/currency';
import { fmtTradeTime } from '../../utils/tradeTimezone';

const dataBR = (iso) => String(iso).split('-').reverse().join('/');

/** Uma operação da fila: hora, ativo, resultado, o aviso do período e o atalho. */
const Operacao = ({ linha, periodState, moeda, onAbrirTrade, selecionado, onAlternarSelecao }) => {
  const trade = linha.trade;
  if (!trade) return null;
  const aviso = authorizationNotice(linha, periodState, moeda ?? 'BRL');
  const res = Number(trade.result) || 0;

  return (
    <div className="w-full px-3 py-2 flex items-start justify-between gap-3 hover:bg-slate-800/40 transition-colors rounded-lg">
      <div className="flex items-start gap-3 min-w-0">
        {onAlternarSelecao && (
          <button
            onClick={(e) => { e.stopPropagation(); onAlternarSelecao(trade.id); }}
            className="mt-0.5 flex-shrink-0"
            title={selecionado ? 'Tirar da seleção' : 'Selecionar para feedback em massa'}
          >
            {selecionado
              ? <CheckSquare className="w-4 h-4 text-blue-400" />
              : <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />}
          </button>
        )}
        <button onClick={() => onAbrirTrade?.(trade)} className="flex items-start gap-3 min-w-0 text-left">
        <span className="text-[11px] font-mono text-slate-500 mt-0.5 w-11 flex-shrink-0">
          {trade.entryTime ? fmtTradeTime(trade.entryTime) : '--:--'}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{trade.ticker}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              trade.side === 'SHORT' ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
            }`}>{trade.side}</span>
            {trade.status === 'QUESTION' && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400">
                <HelpCircle className="w-3 h-3" /> dúvida
              </span>
            )}
          </div>
          {aviso && (
            <div className={`text-[11px] mt-0.5 flex items-start gap-1 ${aviso.tone === 'alert' ? 'text-red-400' : 'text-amber-400'}`}>
              {aviso.tone === 'alert' ? <Ban className="w-3 h-3 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
              <span><strong>{aviso.title}</strong> — {aviso.detail}</span>
            </div>
          )}
        </div>
        </button>
      </div>
      <span className={`text-sm font-mono font-bold flex-shrink-0 ${res >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {res >= 0 ? '+' : ''}{formatCurrencyDynamic(res, moeda ?? 'BRL')}
      </span>
    </div>
  );
};

/** O período de UM plano num dia: os três números e as operações. */
const CardDoPlano = ({ plano, colapsado, onAbrirTrade, selecionados, onAlternarSelecao }) => {
  const ps = plano.periodState;
  const moeda = plano.moeda ?? 'BRL';
  const ordem = dayOrderingNotice(ps);

  const tiles = [
    { label: 'Resultado', ...dayResultContent(ps, moeda) },
    { label: 'Folga do stop', ...dayBudgetContent(ps, moeda) },
    { label: 'Stop do dia', ...dayStopContent(ps, moeda) },
  ];

  const corpo = (
    <>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {tiles.map((t) => (
          <DayTile key={t.label} label={t.label} value={t.value} theme={t.theme}
                   bandLabel={t.bandLabel} caption={t.caption} tooltip={t.tooltip} />
        ))}
      </div>
      {ordem && (
        <p className="text-[11px] text-amber-400/80 mb-2">{ordem.detail ?? ordem.title}</p>
      )}
      <div className="space-y-0.5">
        {plano.linhas.map((l) => (
          <Operacao key={l.tradeId} linha={l} periodState={ps} moeda={moeda} onAbrirTrade={onAbrirTrade}
                    selecionado={selecionados?.has(l.tradeId)} onAlternarSelecao={onAlternarSelecao} />
        ))}
      </div>
    </>
  );

  // Um plano só no dia: sem moldura dupla — o card do plano colapsa no do dia.
  if (colapsado) return corpo;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xs font-bold text-white">{plano.planName ?? 'Sem plano'}</span>
        {plano.moeda && <span className="text-[10px] text-slate-500">{plano.moeda}</span>}
        {ps.closedBeyondStop && (
          <span className="text-[10px] text-red-400 font-semibold">ultrapassou o stop</span>
        )}
      </div>
      {corpo}
    </div>
  );
};

const CardDoDia = ({ dia, onAbrirTrade, selecionados, onAlternarSelecao, onSelecionarDia }) => {
  const umPlanoSo = dia.planos.length === 1;
  const idsDoDia = dia.planos.flatMap((p) => p.linhas.map((l) => l.tradeId)).filter(Boolean);
  const todoDiaSelecionado = idsDoDia.length > 0 && idsDoDia.every((id) => selecionados?.has(id));
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/20 p-3">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <h4 className="text-sm font-bold text-white">
          {dataBR(dia.data)}
          <span className="text-[11px] font-normal text-slate-500 ml-2">
            {dia.trades} {dia.trades === 1 ? 'operação' : 'operações'}
            {!umPlanoSo && ` em ${dia.planos.length} planos`}
            {umPlanoSo && dia.planos[0].planName && ` · plano ${dia.planos[0].planName}`}
          </span>
        </h4>
        <div className="flex items-center gap-3">
          {dia.alemDoStop && (
            <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wide">além do stop</span>
          )}
          {onSelecionarDia && idsDoDia.length > 1 && (
            <button
              onClick={() => onSelecionarDia(idsDoDia)}
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white"
              title="O dia inteiro costuma render um feedback só"
            >
              {todoDiaSelecionado ? <CheckSquare className="w-3.5 h-3.5 text-blue-400" /> : <Square className="w-3.5 h-3.5" />}
              o dia
            </button>
          )}
        </div>
      </div>
      <div className={umPlanoSo ? '' : 'space-y-3'}>
        {dia.planos.map((p) => (
          <CardDoPlano key={p.planId ?? 'sem-plano'} plano={p} colapsado={umPlanoSo} onAbrirTrade={onAbrirTrade}
                       selecionados={selecionados} onAlternarSelecao={onAlternarSelecao} />
        ))}
      </div>
    </div>
  );
};

const LinhaDoAluno = ({ aluno, aberto, onAlternar, onAbrirTrade, selecionados, onAlternarSelecao, onSelecionarDia }) => {
  // Com uma moeda só, o líquido vem no cabeçalho. Com duas, não há total honesto:
  // o número desce para o nível do plano.
  const resumo = [
    `${aluno.diasDistintos} ${aluno.diasDistintos === 1 ? 'dia' : 'dias'}`,
    aluno.planosDistintos > 1 ? `${aluno.planosDistintos} planos` : null,
    aluno.liquidoAgregado != null
      ? `${aluno.liquidoAgregado >= 0 ? '+' : ''}${formatCurrencyDynamic(aluno.liquidoAgregado, aluno.moedaUnica)}`
      : null,
  ].filter(Boolean).join(' · ');

  const alertas = [
    aluno.diasAlemDoStop ? `${aluno.diasAlemDoStop} ${aluno.diasAlemDoStop === 1 ? 'dia ultrapassou' : 'dias ultrapassaram'} o stop` : null,
    aluno.opsAposStop ? `${aluno.opsAposStop} ${aluno.opsAposStop === 1 ? 'operação depois' : 'operações depois'} do stop` : null,
    aluno.opsSemOrcamento ? `${aluno.opsSemOrcamento} sem orçamento` : null,
  ].filter(Boolean);

  return (
    <div className="glass-card overflow-hidden">
      <button onClick={onAlternar} className="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          {aberto ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
            {(aluno.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-white truncate">{aluno.name}</div>
            <div className="text-[11px] text-slate-500">{resumo}</div>
            {alertas.length > 0 && (
              <div className="text-[11px] text-amber-400 mt-0.5">⚠ {alertas.join(' · ')}</div>
            )}
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-bold text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-full flex-shrink-0">
          <MessageSquare className="w-3.5 h-3.5" />
          {aluno.totalPendentes}
        </span>
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3">
          {aluno.dias.map((d) => (
            <CardDoDia key={d.data} dia={d} onAbrirTrade={onAbrirTrade}
                       selecionados={selecionados} onAlternarSelecao={onAlternarSelecao} onSelecionarDia={onSelecionarDia} />
          ))}
        </div>
      )}
    </div>
  );
};

const FilaDeFeedback = ({ fila = [], onAbrirTrade, selecionados, onAlternarSelecao, onSelecionarDia, onAplicarEmMassa }) => {
  // Um aluno aberto por vez: a fila é para triar, não para comparar dois alunos.
  const [aberto, setAberto] = useState(fila.length === 1 ? fila[0].studentId : null);

  if (fila.length === 0) {
    return (
      <div className="glass-card p-10 text-center">
        <MessageSquare className="w-10 h-10 text-emerald-400/50 mx-auto mb-3" />
        <p className="text-sm text-slate-400">Nenhum trade esperando feedback.</p>
        <p className="text-xs text-slate-600 mt-1">A fila está limpa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fila.map((aluno) => (
        <LinhaDoAluno
          key={aluno.studentId ?? aluno.email}
          aluno={aluno}
          aberto={aberto === (aluno.studentId ?? aluno.email)}
          onAlternar={() => setAberto(aberto === (aluno.studentId ?? aluno.email) ? null : (aluno.studentId ?? aluno.email))}
          onAbrirTrade={onAbrirTrade}
          selecionados={selecionados}
          onAlternarSelecao={onAlternarSelecao}
          onSelecionarDia={onSelecionarDia}
        />
      ))}

      {/* Barra de ação: só existe quando há seleção. */}
      {selecionados?.size > 0 && (
        <div className="sticky bottom-4 flex justify-center">
          <button
            onClick={onAplicarEmMassa}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/25"
          >
            <MessageSquare className="w-4 h-4" />
            Escrever feedback para {selecionados.size} {selecionados.size === 1 ? 'operação' : 'operações'}
          </button>
        </div>
      )}
    </div>
  );
};

export default FilaDeFeedback;
