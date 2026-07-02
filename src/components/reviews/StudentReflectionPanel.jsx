/**
 * StudentReflectionPanel — reflexão (auto-análise) do aluno na composição de feedback (#323).
 *
 * Completa o #315 C: aparece nos DOIS layouts da FeedbackPage.
 *  - Reflexão feita  → TradeReviewSection read-only (mentor cruza "faria de novo?" × comportamento).
 *  - Reflexão ausente + mentor → alerta âmbar pra COBRAR o hábito no feedback (Marcio: reflexão
 *    é parte do processo; mentor tem que ser avisado quando falta).
 *  - Reflexão ausente + não-mentor → nada (o prompt de reflexão do aluno vive no registro do trade).
 */
import { AlertTriangle } from 'lucide-react';
import TradeReviewSection from '../Trades/TradeReviewSection';
import DebugBadge from '../DebugBadge';

const StudentReflectionPanel = ({ trade, isMentor = false }) => {
  if (trade?.selfReview) return <TradeReviewSection trade={trade} />;
  if (!isMentor) return null;

  return (
    <div className="relative mt-4 border border-amber-500/30 rounded-xl p-4 bg-amber-500/10 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="text-sm text-amber-200">
        <span className="font-medium">O aluno não fez a auto-análise deste trade.</span>{' '}
        Cobre a reflexão no feedback — rever cada operação é parte do processo.
      </div>
      <DebugBadge component="StudentReflectionPanel" />
    </div>
  );
};

export default StudentReflectionPanel;
