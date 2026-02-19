/**
 * EmotionalAlerts
 * @version 1.3.0
 * @description Exibe alertas de padrões emocionais detectados (TILT, REVENGE, FOMO, etc)
 */

import { 
  AlertTriangle, 
  Flame, 
  Target, 
  TrendingDown, 
  Zap,
  CheckCircle,
  X
} from 'lucide-react';

const ALERT_CONFIGS = {
  TILT: {
    icon: Flame,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-400',
    title: 'Tilt Detectado'
  },
  REVENGE: {
    icon: Target,
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    iconColor: 'text-orange-400',
    title: 'Revenge Trading'
  },
  FOMO: {
    icon: Zap,
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    title: 'FOMO Detectado'
  },
  OVERTRADING: {
    icon: TrendingDown,
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    iconColor: 'text-yellow-400',
    title: 'Overtrading'
  },
  ZONE: {
    icon: CheckCircle,
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
    title: 'In The Zone!'
  }
};

const SEVERITY_STYLES = {
  CRITICAL: 'border-l-4 border-l-red-500',
  HIGH: 'border-l-4 border-l-orange-500',
  MEDIUM: 'border-l-4 border-l-amber-500',
  LOW: 'border-l-4 border-l-yellow-500',
  POSITIVE: 'border-l-4 border-l-emerald-500'
};

const EmotionalAlerts = ({ 
  alerts = [], 
  onDismiss,
  compact = false,
  maxAlerts = 5
}) => {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const displayAlerts = alerts.slice(0, maxAlerts);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {displayAlerts.map((alert, index) => {
          const config = ALERT_CONFIGS[alert.type] || ALERT_CONFIGS.FOMO;
          const Icon = config.icon;
          
          return (
            <div
              key={index}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor} border ${config.borderColor}`}
            >
              <Icon className={`w-4 h-4 ${config.iconColor}`} />
              <span className="text-sm text-white">{config.title}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayAlerts.map((alert, index) => {
        const config = ALERT_CONFIGS[alert.type] || {
          icon: AlertTriangle,
          bgColor: 'bg-slate-500/10',
          borderColor: 'border-slate-500/30',
          iconColor: 'text-slate-400',
          title: 'Alerta'
        };
        const Icon = config.icon;
        const severityStyle = SEVERITY_STYLES[alert.severity] || '';

        return (
          <div
            key={index}
            className={`${config.bgColor} border ${config.borderColor} ${severityStyle} rounded-lg p-4`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                </div>
                <div>
                  <h4 className="font-semibold text-white">{config.title}</h4>
                  <p className="text-sm text-slate-400 mt-1">{alert.message}</p>
                  {alert.recommendation && (
                    <p className="text-sm text-blue-400 mt-2 flex items-center gap-1">
                      <span className="text-xs">💡</span>
                      {alert.recommendation}
                    </p>
                  )}
                </div>
              </div>
              
              {onDismiss && (
                <button
                  onClick={() => onDismiss(index)}
                  className="p-1 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
      
      {alerts.length > maxAlerts && (
        <p className="text-sm text-slate-500 text-center">
          + {alerts.length - maxAlerts} outros alertas
        </p>
      )}
    </div>
  );
};

export default EmotionalAlerts;
