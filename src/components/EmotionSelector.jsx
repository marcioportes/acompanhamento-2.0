/**
 * EmotionSelector
 * @version 1.3.0
 * @description Seletor de emoção com visual categorizado
 */

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { EMOTIONS, EMOTION_CATEGORIES } from '../utils/emotionalAnalysis';

const EmotionSelector = ({ 
  value, 
  onChange, 
  label = 'Emoção',
  placeholder = 'Selecione...',
  showScore = false,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedEmotion = value ? EMOTIONS[value.toUpperCase()] : null;

  const groupedEmotions = {
    POSITIVE: Object.values(EMOTIONS).filter(e => e.category === 'POSITIVE'),
    NEUTRAL: Object.values(EMOTIONS).filter(e => e.category === 'NEUTRAL'),
    NEGATIVE: Object.values(EMOTIONS).filter(e => e.category === 'NEGATIVE'),
    CRITICAL: Object.values(EMOTIONS).filter(e => e.category === 'CRITICAL')
  };

  const handleSelect = (emotionId) => {
    onChange(emotionId);
    setIsOpen(false);
  };

  const getCategoryStyle = (category) => {
    switch (category) {
      case 'POSITIVE': return 'border-l-emerald-500 bg-emerald-500/5';
      case 'NEUTRAL': return 'border-l-slate-500 bg-slate-500/5';
      case 'NEGATIVE': return 'border-l-amber-500 bg-amber-500/5';
      case 'CRITICAL': return 'border-l-red-500 bg-red-500/5';
      default: return '';
    }
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-400 mb-1">
          {label}
        </label>
      )}
      
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-left transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-600 cursor-pointer'
        } ${isOpen ? 'border-blue-500' : ''}`}
      >
        {selectedEmotion ? (
          <div className="flex items-center gap-2">
            <span className="text-xl">{selectedEmotion.emoji}</span>
            <span className="text-white">{selectedEmotion.label}</span>
            {showScore && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                selectedEmotion.score > 0 ? 'bg-emerald-500/20 text-emerald-400' :
                selectedEmotion.score < 0 ? 'bg-red-500/20 text-red-400' :
                'bg-slate-500/20 text-slate-400'
              }`}>
                {selectedEmotion.score > 0 ? '+' : ''}{selectedEmotion.score}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Options */}
          <div className="absolute z-20 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              {Object.entries(groupedEmotions).map(([category, emotions]) => (
                <div key={category} className={`border-l-4 ${getCategoryStyle(category)}`}>
                  {/* Category Header */}
                  <div className="px-3 py-2 bg-slate-800/50 sticky top-0">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {EMOTION_CATEGORIES[category].label}
                    </span>
                  </div>
                  
                  {/* Emotions */}
                  {emotions.map(emotion => (
                    <button
                      key={emotion.id}
                      type="button"
                      onClick={() => handleSelect(emotion.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors ${
                        value?.toUpperCase() === emotion.id ? 'bg-blue-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{emotion.emoji}</span>
                        <div className="text-left">
                          <p className="text-white">{emotion.label}</p>
                          <p className="text-xs text-slate-500">{emotion.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {showScore && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            emotion.score > 0 ? 'bg-emerald-500/20 text-emerald-400' :
                            emotion.score < 0 ? 'bg-red-500/20 text-red-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {emotion.score > 0 ? '+' : ''}{emotion.score}
                          </span>
                        )}
                        {value?.toUpperCase() === emotion.id && (
                          <Check className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmotionSelector;
