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
              Confirma o resumo abaixo. Após selar, trades em [{cs} → {ce}] ficam imutáveis (só editáveis via reabertura com justificativa).
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
            label="Trading Performance Score"
            value={tps != null ? `${Math.round(tps)} / 100` : '—'}
          />
          <Row
            label="AAR (Q4)"
            value={`${sustainCount} sustain · ${improveCount} improve`}
            status={(sustainCount + improveCount) >= 1 ? 'ok' : 'warn'}
          />
          <Row
            label="SWOT"
            value={`${swotItems} itens`}
          />
          <Row
            label="Decisão de plano"
            value={planChanged
              ? `ajustado (${forward?.planAdjustment?.decisionSource || 'manual_edit'})`
              : 'manter'}
            status={planChanged ? 'warn' : 'ok'}
          />
          <Row
            label="Compromissos"
            value={`${commitments} de 2`}
            status={commitments >= 1 ? 'ok' : 'error'}
          />
          <Row
            label="Próxima review"
            value={forward.nextReviewDate || '—'}
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
              <li>Trades dentro do ciclo ficam imutáveis (rejeitados em criar/editar/deletar)</li>
              <li>Plano será atualizado: cycleNumber+1 + cache de hard seal</li>
              {planChanged && (
                <li>Plan adjustment aplicado: novo PL/risco/RR conforme decisão</li>
              )}
              <li>Closure aparece no perfil como "Capítulo {(snap.cycleNumber ?? '?')}"</li>
              <li>Reabertura disponível depois — preserva versão original em <code className="bg-slate-800 px-1 rounded">originalSnapshot</code></li>
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
