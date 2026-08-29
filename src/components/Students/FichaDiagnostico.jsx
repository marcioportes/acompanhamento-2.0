/**
 * FichaDiagnostico — a primeira coisa da ficha do aluno (issue #101).
 *
 * Responde duas perguntas, no setup e no emocional: **o que dói** e **o que
 * funciona** — e entrega ao mentor uma frase pronta para a conversa.
 *
 * Marcio, 29/08: *"a página deveria ser mais contundente... do jeito que está
 * parece uma sequência de postes com fios embaraçados; de alguma forma a energia
 * passa por ali, mas quando precisa de manutenção é um caos"*.
 *
 * Nada aqui é escondido por amostra pequena: na medição de 29/08 os três melhores
 * setups da ficha estavam atrás do fole "Esporádicos". O tamanho da amostra vai
 * escrito ao lado, para o mentor pesar — que é diferente de sonegar.
 *
 * Unidade: R. O aluno pode ter duas contas em moedas diferentes; dinheiro só
 * aparece quando o grupo inteiro está numa moeda.
 */
import { TrendingDown, TrendingUp, Quote } from 'lucide-react';
import { formatCurrencyDynamic } from '../../utils/currency';
import { fraseParaOFeedback } from '../../utils/studentDiagnosis';

const Medida = ({ grupo, tom }) => {
  if (!grupo) {
    return <div className="text-sm text-slate-600 mt-1">sem sinal no período</div>;
  }
  const cor = tom === 'dor' ? 'text-red-400' : 'text-emerald-400';
  const valor = grupo.comR > 0
    ? `${grupo.r >= 0 ? '+' : ''}${grupo.r.toFixed(1)}R`
    : grupo.moedaUnica
      ? formatCurrencyDynamic(grupo.pl, grupo.moedaUnica)
      : `${grupo.n} trades`;

  return (
    <>
      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
        <span className="text-lg font-bold text-white leading-tight">{grupo.chave}</span>
        <span className={`font-mono font-bold ${cor}`}>{valor}</span>
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">
        {grupo.n} {grupo.n === 1 ? 'trade' : 'trades'} · {grupo.wr}% de acerto
        {grupo.rPorTrade != null && ` · ${grupo.rPorTrade >= 0 ? '+' : ''}${grupo.rPorTrade.toFixed(2)}R por trade`}
        {grupo.n < 3 && <span className="text-slate-600"> · amostra pequena</span>}
      </div>
    </>
  );
};

const Celula = ({ titulo, grupo, tom }) => (
  <div className={`p-4 rounded-xl border ${
    tom === 'dor' ? 'border-red-500/20 bg-red-500/[0.04]' : 'border-emerald-500/20 bg-emerald-500/[0.04]'
  }`}>
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
      {tom === 'dor'
        ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
        : <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
      {titulo}
    </div>
    <Medida grupo={grupo} tom={tom} />
  </div>
);

const FichaDiagnostico = ({ diagnostico, nome }) => {
  if (!diagnostico || diagnostico.trades === 0) return null;

  const { setups, emocoes } = diagnostico;
  const frase = fraseParaOFeedback(diagnostico);
  const primeiroNome = nome?.split(' ')[0] ?? 'o aluno';

  return (
    <div className="glass-card p-4 sm:p-5 mb-8">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-bold text-white">O que dói e o que funciona</h3>
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">
          {diagnostico.trades} trades · histórico completo
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Celula titulo="Setup que mais custa" grupo={setups.dor} tom="dor" />
        <Celula titulo="Setup que mais entrega" grupo={setups.forca} tom="forca" />
        <Celula titulo="Emoção que mais custa" grupo={emocoes.dor} tom="dor" />
        <Celula titulo="Emoção que mais entrega" grupo={emocoes.forca} tom="forca" />
      </div>

      {frase && (
        <div className="mt-4 pt-4 border-t border-slate-800/60 flex gap-3">
          <Quote className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Para a conversa com {primeiroNome}
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{frase}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FichaDiagnostico;
