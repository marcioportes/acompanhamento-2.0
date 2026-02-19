/**
 * TradeStatusBadge
 * @version 1.0.0
 * @description Badge visual para status do trade na máquina de estados
 */

import { Clock, CheckCircle, HelpCircle, Lock } from 'lucide-react';

const TRADE_STATUS = {
  OPEN: 'OPEN',
  REVIEWED: 'REVIEWED',
  QUESTION: 'QUESTION',
  CLOSED: 'CLOSED'
};

const STATUS_CONFIG = {
  [TRADE_STATUS.OPEN]: {
    label: 'Aguardando',
    icon: Clock,
    bgClass: 'bg-slate-500/20',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-500/30'
  },
  [TRADE_STATUS.REVIEWED]: {
    label: 'Revisado',
    icon: CheckCircle,
    bgClass: 'bg-emerald-500/20',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30'
  },
  [TRADE_STATUS.QUESTION]: {
    label: 'Dúvida',
    icon: HelpCircle,
    bgClass: 'bg-amber-500/20',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    animate: true
  },
  [TRADE_STATUS.CLOSED]: {
    label: 'Encerrado',
    icon: Lock,
    bgClass: 'bg-purple-500/20',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30'
  }
};

// Fallback para status legados
const LEGACY_STATUS_MAP = {
  'PENDING_REVIEW': TRADE_STATUS.OPEN,
  'IN_REVISION': TRADE_STATUS.QUESTION
};

const TradeStatusBadge = ({ status, size = 'sm' }) => {
  // Mapeia status legado
  const normalizedStatus = LEGACY_STATUS_MAP[status] || status || TRADE_STATUS.OPEN;
  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG[TRADE_STATUS.OPEN];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <span className={`
      inline-flex items-center rounded-full font-medium border
      ${config.bgClass} ${config.textClass} ${config.borderClass}
      ${sizeClasses[size]}
      ${config.animate ? 'animate-pulse' : ''}
    `}>
      <Icon className={iconSizes[size]} />
      {config.label}
    </span>
  );
};

export default TradeStatusBadge;
