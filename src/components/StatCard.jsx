import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend = null, 
  trendValue = null,
  color = 'blue',
  size = 'default',
  className = ''
}) => {
  const colorClasses = {
    blue: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
    green: 'from-emerald-500/20 to-teal-500/20 text-emerald-400',
    red: 'from-red-500/20 to-orange-500/20 text-red-400',
    purple: 'from-purple-500/20 to-pink-500/20 text-purple-400',
    yellow: 'from-yellow-500/20 to-orange-500/20 text-yellow-400',
    slate: 'from-slate-500/20 to-slate-500/20 text-slate-400',
  };

  const iconColorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    red: 'bg-red-500/20 text-red-400',
    purple: 'bg-purple-500/20 text-purple-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    slate: 'bg-slate-500/20 text-slate-400',
  };

  const sizeClasses = {
    small: 'p-4',
    default: 'p-6',
    large: 'p-8',
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className={`stat-card ${sizeClasses[size]} ${className}`}>
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} opacity-50 rounded-2xl`}></div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
            <p className={`font-display font-bold ${size === 'large' ? 'text-4xl' : size === 'small' ? 'text-xl' : 'text-2xl'} text-white`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
          
          {Icon && (
            <div className={`p-3 rounded-xl ${iconColorClasses[color]}`}>
              <Icon className={size === 'small' ? 'w-5 h-5' : 'w-6 h-6'} />
            </div>
          )}
        </div>

        {(trend !== null || trendValue !== null) && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/50">
            {trend && getTrendIcon()}
            {trendValue && (
              <span className={`text-sm font-medium ${
                trend === 'up' ? 'text-emerald-400' : 
                trend === 'down' ? 'text-red-400' : 
                'text-slate-400'
              }`}>
                {trendValue}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
