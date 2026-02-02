import { Loader2 } from 'lucide-react';

/**
 * Componente de loading reutilizável
 */
const Loading = ({ 
  fullScreen = false, 
  text = 'Carregando...',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={`${sizeClasses[size]} text-blue-500 animate-spin mx-auto mb-4`} />
          <p className="text-slate-400">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <Loader2 className={`${sizeClasses[size]} text-blue-500 animate-spin mx-auto mb-2`} />
        {text && <p className="text-slate-500 text-sm">{text}</p>}
      </div>
    </div>
  );
};

export default Loading;
