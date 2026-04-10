/**
 * TradeStatusBadges.jsx
 * @version 1.0.0 (v1.1.0 — issue #93 redesign Fase 4)
 * @description Badges de origem + estado para trades. Usado em 4 lugares
 *   do diário: TradesList, TradeDetailModal, ExtractTable, FeedbackPage.
 *
 * Dois badges independentes:
 *   - "Importado" (blue/indigo): trade.source === 'order_import'
 *     Permanente — rastreabilidade de origem.
 *   - "Complemento pendente" (amber): falta emoção de entrada OU setup
 *     Transitório — some quando aluno preenche.
 *
 * Critério de pendente (com fallback para trades legados):
 *   !(trade.emotionEntry || trade.emotion) || !trade.setup
 *
 * emotionExit NÃO entra no critério (decisão de produto).
 *
 * Variants:
 *   - 'pill' (default): pills completas com texto
 *   - 'icon' (compacto): só ícones com tooltip — para tabelas densas
 */

import { Upload, AlertCircle } from 'lucide-react';

export const isImported = (trade) => trade?.source === 'order_import';

export const needsComplement = (trade) => {
  if (!trade) return false;
  const hasEmotion = !!(trade.emotionEntry || trade.emotion);
  const hasSetup = !!trade.setup;
  return !hasEmotion || !hasSetup;
};

const TradeStatusBadges = ({ trade, variant = 'pill' }) => {
  if (!trade) return null;

  const imported = isImported(trade);
  const pending = needsComplement(trade);

  if (!imported && !pending) return null;

  if (variant === 'icon') {
    return (
      <span className="inline-flex items-center gap-1 ml-1">
        {imported && (
          <span title="Importado do Order Import" className="inline-flex">
            <Upload className="w-3 h-3 text-blue-400" aria-label="Importado" />
          </span>
        )}
        {pending && (
          <span title="Falta preencher emoção de entrada e/ou setup" className="inline-flex">
            <AlertCircle className="w-3 h-3 text-amber-400" aria-label="Complemento pendente" />
          </span>
        )}
      </span>
    );
  }

  // variant === 'pill' (default)
  return (
    <span className="inline-flex items-center gap-1.5">
      {imported && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-500/10 text-blue-300 border-blue-500/30"
          title="Trade criado a partir de ordens da corretora (Order Import)"
        >
          <Upload className="w-3 h-3" />
          Importado
        </span>
      )}
      {pending && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-500/10 text-amber-300 border-amber-500/30"
          title="Falta preencher emoção de entrada e/ou setup"
        >
          <AlertCircle className="w-3 h-3" />
          Complemento pendente
        </span>
      )}
    </span>
  );
};

export default TradeStatusBadges;
