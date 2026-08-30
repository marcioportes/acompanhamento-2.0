/**
 * PlanoDeConversa — o que levar para a revisão (issue #101).
 *
 * Marcio, 29/08: *"preciso de uma análise concisa para entender o que pode mudar
 * para resolver a dor e manter o que funciona... que me dê leverage de não ter que
 * minerar informação cada vez que tenho que fazer uma revisão"*.
 *
 * Três blocos, nesta ordem: MUDAR NO OPERACIONAL (o que altera o resultado),
 * MUDAR NO EMOCIONAL (o que altera a decisão) e PRESERVAR (o que já funciona e
 * ninguém diz ao aluno que ele faz).
 *
 * Cada linha tem três partes, e nenhuma sobra:
 *   a MUDANÇA  — uma frase imperativa, é o combinado que sai da revisão
 *   a EVIDÊNCIA — o número que a sustenta, para o aluno não achar que é opinião
 *   COMO DIZER  — a fala pronta, que é o que economiza o tempo do mentor
 *
 * Nada aqui é gerado por IA: são regras determinísticas sobre campos que existem
 * na base. Prescrição sobre campo vazio é adivinhação com cara de análise.
 */
import { useState } from 'react';
import { Wrench, Brain, Shield, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { TIPO_PRESCRICAO } from '../../utils/studentDiagnosis';

const BLOCOS = [
  {
    tipo: TIPO_PRESCRICAO.OPERACIONAL,
    titulo: 'Mudar no operacional',
    subtitulo: 'altera o resultado',
    Icon: Wrench,
    cor: 'text-amber-400',
    borda: 'border-amber-500/25 bg-amber-500/[0.04]',
  },
  {
    tipo: TIPO_PRESCRICAO.EMOCIONAL,
    titulo: 'Mudar no emocional',
    subtitulo: 'altera a decisão',
    Icon: Brain,
    cor: 'text-purple-400',
    borda: 'border-purple-500/25 bg-purple-500/[0.04]',
  },
  {
    tipo: TIPO_PRESCRICAO.PRESERVAR,
    titulo: 'Preservar',
    subtitulo: 'o que já funciona',
    Icon: Shield,
    cor: 'text-emerald-400',
    borda: 'border-emerald-500/25 bg-emerald-500/[0.04]',
  },
];

const Item = ({ p }) => {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-start gap-2 text-left group"
      >
        {aberto
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 mt-1 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-600 mt-1 flex-shrink-0 group-hover:text-slate-400" />}
        <div className="min-w-0">
          <div className="text-sm text-white font-medium leading-snug">{p.mudanca}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{p.evidencia}</div>
        </div>
      </button>
      {aberto && (
        <div className="mt-2 ml-5 pl-3 border-l-2 border-slate-700 text-sm text-slate-300 leading-relaxed italic">
          “{p.comoDizer}”
        </div>
      )}
    </div>
  );
};

const PlanoDeConversa = ({ prescricoes: lista = [], nome, compacto = false }) => {
  const [copiado, setCopiado] = useState(false);
  if (!lista.length) return null;

  const primeiroNome = nome?.split(' ')[0] ?? 'o aluno';

  // O roteiro inteiro em texto: colar no feedback ou levar para a call.
  const copiarRoteiro = () => {
    const texto = BLOCOS.map(({ tipo, titulo }) => {
      const itens = lista.filter((p) => p.tipo === tipo);
      if (!itens.length) return null;
      return `${titulo.toUpperCase()}\n${itens.map((p) => `- ${p.mudanca} (${p.evidencia})\n  "${p.comoDizer}"`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
    navigator.clipboard?.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className={`glass-card p-4 sm:p-5 ${compacto ? 'h-full' : 'mb-8'}`}>
      <div className="flex items-baseline justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h3 className="font-bold text-white">Plano de conversa</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            o que combinar com {primeiroNome} nesta revisão · clique para ver a fala
          </p>
        </div>
        <button
          onClick={copiarRoteiro}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/50 transition-colors"
        >
          {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copiado ? 'copiado' : 'copiar roteiro'}
        </button>
      </div>

      {/* Lado a lado com o diagnóstico, os três blocos empilham: em meia tela
          cada coluna ficaria com ~190px e toda frase quebraria em quatro linhas. */}
      <div className={`grid gap-3 ${compacto ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {BLOCOS.map(({ tipo, titulo, subtitulo, Icon, cor, borda }) => {
          const itens = lista.filter((p) => p.tipo === tipo);
          return (
            <div key={tipo} className={`rounded-xl border p-3 ${borda}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${cor}`} />
                <span className="text-xs font-bold text-white">{titulo}</span>
                <span className="text-[10px] text-slate-500">{subtitulo}</span>
              </div>
              {itens.length === 0 ? (
                <p className="text-xs text-slate-600">nada a apontar aqui</p>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {itens.map((p) => <Item key={p.mudanca} p={p} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlanoDeConversa;
