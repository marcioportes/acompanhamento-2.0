/**
 * Step8Seal.jsx — Etapa 8: Confirmação + selagem
 *
 * Resumo do ritual + checkbox obrigatório de irreversibilidade.
 * Botão "Selar e Fechar Ciclo" no footer dispara submit() do hook.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useState } from 'react';
import { Lock, AlertTriangle, CheckCircle, Award, ShieldAlert } from 'lucide-react';
import { formatDateBR } from '../../../utils/renewalForecast';

function Row({ label, value, status }) {
  const cls =
    status === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5' :
    status === 'warn' ? 'border-amber-500/30 bg-amber-500/5' :
    status === 'error' ? 'border-red-500/30 bg-red-500/5' :
    'border-slate-700/50 bg-slate-800/30';
  return (
    <div className={`flex items-center justify-between border rounded-lg p-3 ${cls}`}>
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-sm font-mono text-slate-100">{value}</span>
    </div>
  );
}

export default function Step8Seal({ draft, cycleStart, cycleEnd, onConfirm, confirmed }) {
  const cs = cycleStart, ce = cycleEnd;
  const snap = draft.snapshot || {};
  const tps = draft.metrics?.tradingPerformanceScore;
  const aar = draft.aar || {};
  const swot = draft.swot || {};
  const forward = draft.forward || {};
  const planChanged = forward?.planAdjustment?.changed === true;

  const sustainCount = (aar.sustain || []).length;
  const improveCount = (aar.improve || []).length;
  const swotItems =
    (swot.strengths || []).length +
    (swot.weaknesses || []).length +
    (swot.opportunities || []).length +
    (swot.threats || []).length;
  const commitments = (forward.behavioralCommitments || []).length;

  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-blue-500/20 text-blue-400 rounded-xl p-2.5">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Tudo pronto pro selo</h3>
            <p className="text-xs text-slate-500">
              Confirma o resumo abaixo. Após selar, trades em [{cs} → {ce}] ficam travados (só liberados via reabertura com justificativa).
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              Itens marcados <span className="text-slate-400">(opcional)</span> podem ficar vazios — você não é obrigado a escrever.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Row
            label="Período"
            value={`${cs} → ${ce}`}
          />
          <Row
            label="Resultado"
            value={snap.resultPercent != null ? `${snap.resultPercent >= 0 ? '+' : ''}${snap.resultPercent.toFixed(1)}% (R$ ${(snap.result || 0).toLocaleString('pt-BR')})` : '—'}
            status={snap.cycleStatus === 'GOAL_HIT' ? 'ok' : snap.cycleStatus === 'STOP_HIT' ? 'error' : 'warn'}
          />
          <Row
            label="Trades fechados no ciclo"
            value={snap.tradesCount ?? '—'}
          />
          <Row
            label="Nota geral do ciclo"
            value={tps != null ? `${Math.round(tps)} / 100` : '—'}
          />
          <Row
            label="Lições do ciclo"
            value={
              (sustainCount + improveCount) === 0
                ? 'não preenchido (opcional)'
                : `${sustainCount} a manter · ${improveCount} a ajustar`
            }
          />
          <Row
            label="Pontos fortes / fracos / oportunidades / ameaças"
            value={swotItems === 0 ? 'não preenchido (opcional)' : `${swotItems} itens mapeados`}
          />
          <Row
            label="Decisão para o próximo ciclo"
            value={planChanged
              ? `plano ajustado (${
                  forward?.planAdjustment?.decisionSource === 'ai_suggested' ? 'recomendação aceita' :
                  forward?.planAdjustment?.decisionSource === 'manual_edit' ? 'editado por você' :
                  forward?.planAdjustment?.decisionSource || 'manual'
                })`
              : 'manter o plano atual'}
            status={planChanged ? 'warn' : 'ok'}
          />
          <Row
            label="Compromissos"
            value={commitments === 0 ? 'sem compromissos (opcional)' : `${commitments} de 2`}
          />
          <Row
            label="Vou revisitar em"
            value={forward.nextReviewDate ? formatDateBR(forward.nextReviewDate) : '—'}
          />
        </div>
      </div>

      {/* Atenção: irreversibilidade */}
      <div className="glass-card p-6 border border-amber-500/40 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-amber-100 mb-1">Antes de selar</h4>
            <ul className="text-xs text-slate-300 space-y-1 mb-4 list-disc list-inside">
              <li>Os trades deste ciclo ficam travados — não dá mais para criar, editar ou apagar</li>
              <li>Seu plano avança para o próximo ciclo automaticamente</li>
              {planChanged && (
                <li>Os ajustes que você decidiu no plano (capital, risco, RR) passam a valer no próximo ciclo</li>
              )}
              <li>Este ciclo entra no seu Currículo como <strong>Capítulo {snap.cycleNumber ?? '—'}</strong> — você pode revisitar quando quiser</li>
              <li>Se precisar reabrir depois, dá — o app guarda esta versão original intacta para comparar</li>
            </ul>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => onConfirm(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-slate-200">
                Confirmo que revisei os dados, escrevi minha reflexão, e entendo que após selar
                <strong> não posso mais editar trades de {cs} → {ce}</strong> sem reabrir o ciclo.
              </span>
            </label>
          </div>
        </div>
      </div>

      {!confirmed && (
        <div className="glass-card p-4 border border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">
            <Lock className="w-3 h-3 inline mr-1" />
            Marque o checkbox acima pra liberar o botão "Selar" no rodapé.
          </p>
        </div>
      )}
    </div>
  );
}
