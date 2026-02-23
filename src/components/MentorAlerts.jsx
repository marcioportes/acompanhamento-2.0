/**
 * MentorAlerts
 * @version 1.0.0 (Fase 1.5.0)
 * @description Painel de alertas emocionais consolidado.
 *   Lê notifications do Firestore (tipo EMOTIONAL_ALERT, RED_FLAG, etc.)
 *   + gera alertas client-side via useEmotionalProfile para cada aluno.
 * 
 * USAGE (no MentorDashboard overview):
 * <MentorAlerts students={students} getTradesByStudent={fn} onViewStudent={fn} />
 */

import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Bell, AlertTriangle, Flame, Zap, Brain, Shield, Eye, Check, ChevronDown, ChevronUp 
} from 'lucide-react';
import { useEmotionalProfile } from '../hooks/useEmotionalProfile';
import { useComplianceRules } from '../hooks/useComplianceRules';
import DebugBadge from '../components/DebugBadge';

const timeAgo = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
};

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_STYLE = {
  CRITICAL: { border: 'border-red-500/40', bg: 'bg-red-500/5', badge: 'bg-red-500/20 text-red-400', label: 'CRÍTICO' },
  HIGH:     { border: 'border-orange-500/40', bg: 'bg-orange-500/5', badge: 'bg-orange-500/20 text-orange-400', label: 'ALTO' },
  MEDIUM:   { border: 'border-yellow-500/40', bg: 'bg-yellow-500/5', badge: 'bg-yellow-500/20 text-yellow-400', label: 'ATENÇÃO' },
  LOW:      { border: 'border-slate-600', bg: 'bg-slate-800/30', badge: 'bg-slate-600/20 text-slate-400', label: 'INFO' },
};

const ALERT_ICON = {
  EMOTIONAL_ALERT: Brain,
  TILT: Flame,
  REVENGE: Zap,
  STATUS_CRITICAL: AlertTriangle,
  RED_FLAG: AlertTriangle,
};

/**
 * Wrapper para gerar alertas client-side por aluno
 */
const StudentAlertGenerator = ({ trades, studentName, studentEmail, detectionConfig, statusThresholds, onAlerts }) => {
  const { alerts, status, isReady } = useEmotionalProfile({ trades, detectionConfig, statusThresholds });
  
  useEffect(() => {
    if (isReady && alerts && alerts.length > 0) {
      const mapped = alerts
        .filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH')
        .map(a => ({
          id: `local_${studentEmail}_${a.type}_${a.date}`,
          type: a.type,
          severity: a.severity || 'MEDIUM',
          studentName,
          studentEmail,
          message: a.message,
          timestamp: a.date ? new Date(a.date) : new Date(),
          source: 'client',
          read: false
        }));
      onAlerts(studentEmail, mapped);
    }
  }, [isReady, alerts]);

  return null; // Componente invisível
};

const MentorAlerts = ({ students = [], getTradesByStudent, onViewStudent, maxVisible = 5 }) => {
  const [firestoreAlerts, setFirestoreAlerts] = useState([]);
  const [clientAlerts, setClientAlerts] = useState({}); // { email: alerts[] }
  const [showAll, setShowAll] = useState(false);
  const { detectionConfig, statusThresholds } = useComplianceRules();

  // Listener de notificações do Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('targetRole', '==', 'mentor'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data(), source: 'firestore' }));
      setFirestoreAlerts(data);
    }, (err) => {
      console.warn('[MentorAlerts] Firestore listener error:', err.message);
    });
    return () => unsub();
  }, []);

  const handleClientAlerts = (email, alerts) => {
    setClientAlerts(prev => {
      if (JSON.stringify(prev[email]) === JSON.stringify(alerts)) return prev;
      return { ...prev, [email]: alerts };
    });
  };

  const handleMarkRead = async (alert) => {
    if (alert.source === 'firestore') {
      try {
        await updateDoc(doc(db, 'notifications', alert.id), { read: true });
      } catch (e) {
        console.error('[MentorAlerts] Error marking read:', e);
      }
    }
  };

  // Merge + deduplicate + sort
  const allAlerts = useMemo(() => {
    const fromFs = firestoreAlerts
      .filter(a => a.type === 'EMOTIONAL_ALERT' || a.type === 'RED_FLAG')
      .map(a => ({
        ...a,
        severity: a.severity || 'MEDIUM',
        timestamp: a.createdAt,
        read: a.read || false
      }));

    const fromClient = Object.values(clientAlerts).flat();

    // Deduplicate: se Firestore já tem um alert para o mesmo aluno+tipo, skip client
    const fsKeys = new Set(fromFs.map(a => `${a.studentEmail}_${a.type}`));
    const deduped = fromClient.filter(a => !fsKeys.has(`${a.studentEmail}_${a.type}`));

    return [...fromFs, ...deduped]
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));
  }, [firestoreAlerts, clientAlerts]);

  const unreadCount = allAlerts.filter(a => !a.read).length;
  const visibleAlerts = showAll ? allAlerts : allAlerts.slice(0, maxVisible);

  return (
    <div className="glass-card overflow-hidden">
      {/* Invisible alert generators */}
      {students.map(s => {
        const trades = getTradesByStudent ? getTradesByStudent(s.email) : [];
        if (trades.length === 0) return null;
        return (
          <StudentAlertGenerator
            key={s.email}
            trades={trades}
            studentName={s.name}
            studentEmail={s.email}
            detectionConfig={detectionConfig}
            statusThresholds={statusThresholds}
            onAlerts={handleClientAlerts}
          />
        );
      })}

      {/* Header */}
      <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-white">Alertas Emocionais</h3>
          {unreadCount > 0 && (
            <span className="min-w-[20px] h-5 flex items-center justify-center text-xs font-bold rounded-full bg-red-500/20 text-red-400 px-1.5">
              {unreadCount}
            </span>
          )}
        </div>
        {allAlerts.length > maxVisible && (
          <button 
            onClick={() => setShowAll(!showAll)} 
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            {showAll ? <><ChevronUp className="w-3 h-3" /> Menos</> : <><ChevronDown className="w-3 h-3" /> Ver todos ({allAlerts.length})</>}
          </button>
        )}
      </div>

      {/* Body */}
      {allAlerts.length === 0 ? (
        <div className="p-8 text-center">
          <Shield className="w-10 h-10 text-emerald-400/50 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Nenhum alerta emocional ativo.</p>
          <p className="text-xs text-slate-600 mt-1">Todos os alunos dentro dos parâmetros.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/50">
          {visibleAlerts.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.LOW;
            const Icon = ALERT_ICON[alert.type] || AlertTriangle;

            return (
              <div key={alert.id} className={`p-4 border-l-4 ${style.border} ${style.bg} ${alert.read ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                      <Icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${style.badge}`}>
                          {style.label}
                        </span>
                        <span className="text-sm font-medium text-white truncate">
                          {alert.studentName || alert.studentEmail}
                        </span>
                        <span className="text-[10px] text-slate-500">{timeAgo(alert.timestamp)}</span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{alert.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {onViewStudent && (
                      <button 
                        onClick={() => onViewStudent({ email: alert.studentEmail, name: alert.studentName })}
                        className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"
                        title="Ver aluno"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!alert.read && (
                      <button 
                        onClick={() => handleMarkRead(alert)}
                        className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
                        title="Marcar como lido"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <DebugBadge component="MentorAlerts" />
    </div>
  );
};

export default MentorAlerts;
