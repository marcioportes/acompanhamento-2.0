import { Lock } from 'lucide-react';

const formatDateBR = (value) => {
  if (!value) return null;
  try {
    const d = value?.toDate ? value.toDate() : new Date(value?.seconds ? value.seconds * 1000 : value);
    if (Number.isNaN(d.getTime())) return null;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return null;
  }
};

const TradeLockBadge = ({ trade, size = 'sm', className = '' }) => {
  if (!trade?._lockedByMentor) return null;

  const date = formatDateBR(trade._lockedAt);
  const who = trade._lockedBy?.name || trade._lockedBy?.email || 'mentor';
  const title = date
    ? `Travado por ${who} em ${date}`
    : `Travado por ${who}`;

  const iconSize = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
  const padding = size === 'lg' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]';

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 ${padding} ${className}`}
    >
      <Lock className={iconSize} />
      <span className="font-medium">Travado</span>
    </span>
  );
};

export default TradeLockBadge;
