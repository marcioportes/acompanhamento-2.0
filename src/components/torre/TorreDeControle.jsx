/**
 * TorreDeControle — issue #101
 *
 * Destino próprio do mentor, construído por seção (D8). O overview atual segue
 * intocado até a Fase D, quando a Torre vira o destino padrão.
 *
 *   Fase A (aqui) — S1 Header.
 *   Fase B — S2 Prioridade do Dia + S3 Radar de Risco.
 *   Fase C — S4 Fora do Plano + S5 Stop × Gain.
 *   Fase D — S6 Visão Rápida por Aluno + promoção a destino padrão.
 *
 * Camada de leitura: nenhuma persistência nova (INV-15). Tudo é derivado do que
 * o mentor já escuta.
 */
import { Radar } from 'lucide-react';
import useMentorRiskRadar from '../../hooks/useMentorRiskRadar';
import TorreHeader from './TorreHeader';
import DebugBadge from '../DebugBadge';

const Placeholder = ({ titulo, fase }) => (
  <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl px-5 py-8 text-center">
    <div className="text-sm text-slate-400 font-semibold">{titulo}</div>
    <div className="text-[11px] text-slate-600 mt-1">Fase {fase}</div>
  </div>
);

const TorreDeControle = ({ allTrades, plans, students, subscriptions }) => {
  const { dia, header } = useMentorRiskRadar({ allTrades, plans, students, subscriptions });

  const [ano, mes, diaDoMes] = String(dia).split('-');

  return (
    // pb-20: o DebugBadge é fixed e não pode cobrir conteúdo no fim do scroll.
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-blue-400" />
          <h1 className="text-xl font-bold text-white">Torre de Controle</h1>
        </div>
        <span className="text-xs text-slate-500 font-mono">{`${diaDoMes}/${mes}/${ano}`}</span>
      </div>

      <TorreHeader header={header} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Placeholder titulo="Prioridade do Dia" fase="B" />
          <Placeholder titulo="Radar de Risco" fase="B" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Placeholder titulo="Fora do Plano" fase="C" />
            <Placeholder titulo="Stop × Gain" fase="C" />
          </div>
        </div>
        <Placeholder titulo="Visão Rápida por Aluno" fase="D" />
      </div>

      <DebugBadge component="TorreDeControle" />
    </div>
  );
};

export default TorreDeControle;
