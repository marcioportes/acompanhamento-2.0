import { formatCurrencyDynamic } from '../utils/currency';

const colorFor = (value) => (value >= 0 ? 'text-emerald-400' : 'text-red-400');

const MultiCurrencyAmount = ({
  totalsByCurrency,
  className = '',
  layout = 'stack',
  showSign = false,
  emptyFallback = '—',
}) => {
  const entries = Array.from(totalsByCurrency?.entries?.() || []);

  if (entries.length === 0) {
    return <span className={`text-slate-500 ${className}`}>{emptyFallback}</span>;
  }

  const renderValue = (cur, totalPL) => {
    const sign = showSign && totalPL >= 0 ? '+' : '';
    return `${sign}${formatCurrencyDynamic(totalPL, cur)}`;
  };

  if (entries.length === 1) {
    const [cur, { totalPL }] = entries[0];
    return (
      <span className={`${colorFor(totalPL)} ${className}`}>
        {renderValue(cur, totalPL)}
      </span>
    );
  }

  const wrapper = layout === 'inline' ? 'flex gap-3 flex-wrap' : 'flex flex-col gap-0.5';

  return (
    <div className={`${wrapper} ${className}`}>
      {entries.map(([cur, { totalPL }]) => (
        <span key={cur} className={`${colorFor(totalPL)} text-sm`}>
          <span className="text-slate-500 font-medium mr-1">{cur}</span>
          {renderValue(cur, totalPL)}
        </span>
      ))}
    </div>
  );
};

export default MultiCurrencyAmount;
