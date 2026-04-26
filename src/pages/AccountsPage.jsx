/**
 * AccountsPage
 * @see version.js para versão do produto
 * @description Gestão de contas com auditoria de saldo e cronologia.
 * 
 * CHANGELOG (produto):
 * - 1.6.0: Fix auditoria — comparação de datas por string YYYY-MM-DD (sem fuso),
 *          dateTime do INITIAL_BALANCE corrigido com formato ISO completo
 * - 1.0.6: Fix data Brasil (toISOString UTC → local)
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Plus, PlusCircle, Wallet, Edit2, Trash2, ShieldCheck, FlaskConical, Trophy, X, Search, Building2, ChevronRight,
  TrendingUp, TrendingDown, RefreshCw, AlertTriangle, CheckCircle, ArrowRight, Calendar
} from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useMasterData } from '../hooks/useMasterData';
import { useAuth } from '../contexts/AuthContext';
import { usePlans } from '../hooks/usePlans';
import { usePropFirmTemplates } from '../hooks/usePropFirmTemplates';
import {
  PROP_FIRM_LABELS,
  PROP_FIRM_PHASES,
  PROP_FIRM_PHASE_LABELS,
  ATTACK_PROFILES,
  DEFAULT_ATTACK_PROFILE,
  STYLE_LABELS,
  STYLE_DESCRIPTIONS,
  STYLE_ATR_FRACTIONS,
  DEFAULT_ATTACK_STYLE,
  formatProfileMcTip,
  normalizeAttackProfile,
  ATTACK_PLAN_PROFILE_LABELS,
  DEFAULT_TEMPLATES_ENRICHED,
  getTemplatesByFirm as groupByFirm
} from '../constants/propFirmDefaults';
import { calculateAttackPlan } from '../utils/attackPlanCalculator';
import { calculatePlanMechanics, buildMesaConstraints, toLegacyAttackPlanShape } from '../utils/calculatePlanMechanics';
import { computePropPlanDefaults } from '../utils/propPlanDefaults';
import { getAllowedInstrumentsForFirm, getInstrument } from '../constants/instrumentsTable';
import AccountDetailPage from './AccountDetailPage';
import StudentAccountGroup from '../components/StudentAccountGroup';
import PlanManagementModal from '../components/PlanManagementModal';
import DebugBadge from '../components/DebugBadge';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

// Helper de Moeda Blindado
const formatCurrency = (value, currency = 'BRL') => {
  if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'pt-BR', currency: 'USD' },
    EUR: { locale: 'pt-BR', currency: 'EUR' }
  };
  const c = config[currency] || config.BRL;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency }).format(value);
};

// Helper de Data para "dd/mm/aaaa" (Display visual)
const formatBrDate = (dateObj) => {
  if (!dateObj) return '-';
  // Usa UTC para garantir que a data seja exatamente a gravada, sem fuso do navegador
  return dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

// Helper Seguro para Objeto de Data (Lógica de Fuso Horário)
const getDateObject = (val) => {
  if (!val) return new Date();
  
  // Se for Timestamp do Firestore
  if (typeof val.toDate === 'function') return val.toDate(); 
  
  // Se for string YYYY-MM-DD
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    // [FIX DATA BRASIL]: Forçamos T12:00:00Z (meio dia UTC) para evitar que
    // o fuso horário local (ex: GMT-3) faça a data voltar para o dia anterior.
    return new Date(`${val}T12:00:00Z`);
  }
  
  return new Date(val);
};

// [FIX v1.0.6] Helper para converter Data para YYYY-MM-DD (Input value)
// Usa métodos LOCAIS (getFullYear, getMonth) em vez de UTC (toISOString)
const dateToInputString = (dateObj) => {
  if (!dateObj) return '';
  
  const year = dateObj.getFullYear();
  // getMonth começa em 0, por isso +1
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * @param {Object} [props]
 * @param {{ accountId: string, autoOpenPlanModal?: boolean }} [props.initialAccount] — preseleção
 *   externa (ex.: banner "Criar plano retroativo" em OrderImportPage, issue #156 Fase F).
 *   Quando presente, navega direto ao AccountDetailPage da conta e abre o PlanManagementModal
 *   (padrão _autoOpenPlanModal de #154).
 * @param {Function} [props.onInitialConsumed] — invocado após aplicar a preseleção para limpar
 *   o estado no parent (evita re-navegação em unmount/rerender).
 */
const AccountsPage = ({ initialAccount = null, onInitialConsumed } = {}) => {
  const { accounts, loading, addAccount, updateAccount, deleteAccount } = useAccounts();
  const { brokers } = useMasterData();
  const { user, isMentor } = useAuth();
  const { plans, addPlan, updatePlan } = usePlans();
  const { templates: firestoreTemplates } = usePropFirmTemplates();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showBrokerSuggestions, setShowBrokerSuggestions] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [propPlanDefaults, setPropPlanDefaults] = useState(null); // defaults do attackPlan para criar plano após conta PROP
  
  const [auditState, setAuditState] = useState({ status: 'idle', message: '', issueType: null, ledgerBalance: 0, suggestion: null });
  const [isFixing, setIsFixing] = useState(false);

  const [balancesByAccountId, setBalancesByAccountId] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    broker: '',
    currency: 'BRL',
    initialBalance: '',
    currentBalance: '',
    createdAt: '',
    type: 'DEMO',
  });

  // --- Prop firm state (#52, #201) ---
  const [propFirmData, setPropFirmData] = useState({
    selectedFirm: '',
    selectedTemplateId: '',
    phase: PROP_FIRM_PHASES.EVALUATION,
    attackProfile: DEFAULT_ATTACK_PROFILE,
    selectedInstrument: '', // #52 Fase 1.5 — instrumento principal da conta
    attackStyle: DEFAULT_ATTACK_STYLE // #201 — estilo operacional (independente do profile)
  });

  const allTemplates = useMemo(
    () => firestoreTemplates.length > 0 ? firestoreTemplates : DEFAULT_TEMPLATES_ENRICHED,
    [firestoreTemplates]
  );
  const firmGroups = useMemo(() => groupByFirm(allTemplates), [allTemplates]);
  const firmList = useMemo(() => Object.keys(firmGroups), [firmGroups]);
  const productsForFirm = useMemo(
    () => firmGroups[propFirmData.selectedFirm] ?? [],
    [firmGroups, propFirmData.selectedFirm]
  );
  const selectedTemplate = useMemo(
    () => allTemplates.find(t => t.id === propFirmData.selectedTemplateId) ?? null,
    [allTemplates, propFirmData.selectedTemplateId]
  );
  // Lista de instrumentos permitidos para a firma selecionada (#52 Fase 1.5)
  const allowedInstruments = useMemo(() => {
    if (!selectedTemplate?.firm) return [];
    return getAllowedInstrumentsForFirm(selectedTemplate.firm);
  }, [selectedTemplate]);
  const attackPlan = useMemo(() => {
    if (!selectedTemplate) return null;
    try {
      // #201: quando aluno selecionou instrumento, usa motor novo (stop estrutural ATR
      // por estilo + sizing dinâmico). Sem instrumento, fallback para abstract legado.
      if (propFirmData.selectedInstrument && propFirmData.attackStyle) {
        const instrument = getInstrument(propFirmData.selectedInstrument);
        if (instrument) {
          const constraints = buildMesaConstraints(selectedTemplate, propFirmData.phase);
          const planNew = calculatePlanMechanics({
            constraints,
            instrument,
            style: propFirmData.attackStyle,
            profile: propFirmData.attackProfile
          });
          return toLegacyAttackPlanShape(planNew, selectedTemplate);
        }
      }
      return calculateAttackPlan(
        selectedTemplate,
        null,
        null,
        propFirmData.attackProfile,
        propFirmData.phase,
        propFirmData.selectedInstrument || null
      );
    } catch { return null; }
  }, [selectedTemplate, propFirmData.attackProfile, propFirmData.phase, propFirmData.selectedInstrument, propFirmData.attackStyle]);

  // Preseleção externa (issue #156 Fase F) — aplica assim que `accounts` carregar
  // e a conta alvo estiver disponível. Propaga flag `_autoOpenPlanModal` ao
  // AccountDetailPage (padrão #154) e chama `onInitialConsumed` para limpar o sinal no parent.
  useEffect(() => {
    if (!initialAccount?.accountId) return;
    if (!accounts || accounts.length === 0) return;
    const acc = accounts.find(a => a.id === initialAccount.accountId);
    if (!acc) return;
    setSelectedAccount({
      ...acc,
      _autoOpenPlanModal: !!initialAccount.autoOpenPlanModal,
    });
    if (onInitialConsumed) onInitialConsumed();
  }, [initialAccount, accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill quando template selecionado
  useEffect(() => {
    if (selectedTemplate && formData.type === 'PROP') {
      setFormData(prev => ({
        ...prev,
        currency: 'USD',
        initialBalance: selectedTemplate.accountSize?.toString() ?? prev.initialBalance,
        name: prev.name || selectedTemplate.name
      }));
    }
  }, [selectedTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  const brokerNames = useMemo(() => brokers.map(b => b.name).sort(), [brokers]);
  const filteredBrokers = useMemo(() => {
    if (!formData.broker) return brokerNames.slice(0, 5);
    return brokerNames.filter(b => b.toLowerCase().includes(formData.broker.toLowerCase())).slice(0, 8);
  }, [formData.broker, brokerNames]);

  // Listener para cards
  useEffect(() => {
    if (!accounts || accounts.length === 0) { setBalancesByAccountId({}); return; }
    const unsubs = [];
    accounts.forEach((acc) => {
      if (!acc?.id) return;
      const q = query(collection(db, 'movements'), where('accountId', '==', acc.id));
      const unsub = onSnapshot(q, (snapshot) => {
          const totalBalance = snapshot.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
          setBalancesByAccountId(prev => ({ ...prev, [acc.id]: totalBalance }));
        },
        (err) => console.error('[AccountsPage] Erro listener:', err)
      );
      unsubs.push(unsub);
    });
    return () => { unsubs.forEach(fn => { try { fn(); } catch (_) {} }); };
  }, [accounts]);

  const groupedAccounts = useMemo(() => {
    if (!isMentor()) return {};
    const groups = {};
    accounts.forEach(acc => {
      const studentId = acc.studentId || 'unknown';
      if (!groups[studentId]) groups[studentId] = { studentName: acc.studentName || 'Aluno Sem Nome', studentEmail: acc.studentEmail || '', accounts: [] };
      groups[studentId].accounts.push(acc);
    });
    Object.values(groups).forEach(group => { group.accounts.sort((a, b) => getDateObject(b.createdAt) - getDateObject(a.createdAt)); });
    return groups;
  }, [accounts, isMentor]);

  const filteredGroups = useMemo(() => {
    if (!isMentor()) return {};
    if (!searchTerm.trim()) return groupedAccounts;
    const search = searchTerm.toLowerCase();
    const filtered = {};
    Object.entries(groupedAccounts).forEach(([studentId, data]) => {
      if (data.studentName.toLowerCase().includes(search) || data.studentEmail.toLowerCase().includes(search) || data.accounts.some(acc => acc.name.toLowerCase().includes(search))) {
        filtered[studentId] = data;
      }
    });
    return filtered;
  }, [groupedAccounts, searchTerm, isMentor]);

  const openModal = (account = null) => {
    setAuditState({ status: 'idle', message: '', issueType: null, ledgerBalance: 0, suggestion: null });
    if (account) {
      setEditingAccount(account);
      const dateObj = account.createdAt ? getDateObject(account.createdAt) : new Date();

      setFormData({
        name: account.name || '',
        broker: account.broker || account.brokerName || '',
        currency: account.currency || 'BRL',
        initialBalance: account.initialBalance || '',
        currentBalance: '', // SSOT: Não usamos currentBalance na edição
        createdAt: dateToInputString(dateObj), // [FIX] Usa helper corrigido
        type: account.type || (account.isReal ? 'REAL' : 'DEMO')
      });
      // Rehydratação prop firm (#52)
      if (account.propFirm) {
        setPropFirmData({
          selectedFirm: account.propFirm.firmName || '',
          selectedTemplateId: account.propFirm.templateId || '',
          phase: account.propFirm.phase || PROP_FIRM_PHASES.EVALUATION,
          attackProfile: normalizeAttackProfile(account.propFirm.suggestedPlan?.profile),
          selectedInstrument: account.propFirm.selectedInstrument?.symbol || '',
          attackStyle: account.propFirm.suggestedPlan?.style || DEFAULT_ATTACK_STYLE
        });
      } else {
        setPropFirmData({ selectedFirm: '', selectedTemplateId: '', phase: PROP_FIRM_PHASES.EVALUATION, attackProfile: DEFAULT_ATTACK_PROFILE, selectedInstrument: '', attackStyle: DEFAULT_ATTACK_STYLE });
      }
      setIsModalOpen(true);
      setShowBrokerSuggestions(false);
      return;
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        broker: '',
        currency: 'BRL',
        initialBalance: '',
        currentBalance: '',
        createdAt: dateToInputString(new Date()),
        type: 'DEMO'
      });
    }
    setPropFirmData({ selectedFirm: '', selectedTemplateId: '', phase: PROP_FIRM_PHASES.EVALUATION, attackProfile: DEFAULT_ATTACK_PROFILE, selectedInstrument: '', attackStyle: DEFAULT_ATTACK_STYLE });
    setIsModalOpen(true);
    setShowBrokerSuggestions(false);
  };

  // --- ENGINE DE AUDITORIA ---
  const handleRunAudit = async () => {
    if (!editingAccount) return;
    setAuditState({ status: 'loading', message: 'Analisando histórico...' });

    try {
      const q = query(collection(db, 'movements'), where('accountId', '==', editingAccount.id));
      const snapshot = await getDocs(q);
      
      let ledgerTotal = 0;
      let earliestDateStr = null;  // YYYY-MM-DD string
      let initialBalanceMovId = null;
      let initialBalanceDateStr = null;

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        ledgerTotal += (Number(data.amount) || 0);

        // Extrair data como string YYYY-MM-DD pura (sem converter para Date, sem fuso)
        const movDateStr = data.date || (data.dateTime ? data.dateTime.split('T')[0] : null);
        if (movDateStr && (!earliestDateStr || movDateStr < earliestDateStr)) {
          earliestDateStr = movDateStr;
        }

        if (data.type === 'INITIAL_BALANCE') {
          initialBalanceMovId = docSnap.id;
          initialBalanceDateStr = movDateStr;
        }
      });

      // Data de abertura da conta como string YYYY-MM-DD
      const accountDateStr = formData.createdAt || (editingAccount.createdAt 
        ? (typeof editingAccount.createdAt === 'string' 
            ? editingAccount.createdAt.split('T')[0]
            : dateToInputString(getDateObject(editingAccount.createdAt)))
        : null);
      
      let issue = 'OK';
      let msg = 'Conta saudável. Cronologia e saldos conferem.';

      // Comparação 1: Data da conta posterior ao primeiro lançamento (strings, sem fuso)
      if (accountDateStr && earliestDateStr && accountDateStr > earliestDateStr) {
        issue = 'CHRONOLOGY_ERROR';
        msg = `Cronologia Inválida! Existem lançamentos em ${formatBrDate(getDateObject(earliestDateStr))}, antes da abertura da conta (${formatBrDate(getDateObject(accountDateStr))}).`;
      }
      // Comparação 2: INITIAL_BALANCE com data posterior a outros movimentos
      else if (initialBalanceDateStr && earliestDateStr && initialBalanceDateStr > earliestDateStr) {
        issue = 'CHRONOLOGY_ERROR';
        msg = `Cronologia Inválida! O saldo inicial está em ${formatBrDate(getDateObject(initialBalanceDateStr))}, mas existem lançamentos a partir de ${formatBrDate(getDateObject(earliestDateStr))}.`;
      }
      // Comparação 3: Divergência de saldo
      else if (editingAccount.currentBalance !== undefined && Math.abs(ledgerTotal - (Number(editingAccount.currentBalance) || 0)) > 0.05) {
        issue = 'BALANCE_MISMATCH';
        msg = `Divergência de Saldo! O valor gravado (${formatCurrency(editingAccount.currentBalance, formData.currency)}) difere da soma dos movimentos (${formatCurrency(ledgerTotal, formData.currency)}).`;
      }

      setAuditState({
        status: issue === 'OK' ? 'ok' : 'issue',
        issueType: issue,
        message: msg,
        ledgerBalance: ledgerTotal,
        suggestion: {
          newStartDate: earliestDateStr || accountDateStr,
          initialMovId: initialBalanceMovId
        }
      });

    } catch (error) {
      console.error(error);
      setAuditState({ status: 'error', message: 'Erro na auditoria: ' + error.message });
    }
  };

  // --- CORREÇÃO AUTOMÁTICA ---
  const handleFixIssues = async () => {
    if (!auditState.suggestion || !editingAccount) return;
    setIsFixing(true);

    try {
      const batch = writeBatch(db);
      
      const accountRef = doc(db, 'accounts', editingAccount.id);
      const updates = {
        currentBalance: auditState.ledgerBalance
      };

      if (auditState.issueType === 'CHRONOLOGY_ERROR') {
        const newDate = auditState.suggestion.newStartDate;
        updates.createdAt = newDate;

        if (auditState.suggestion.initialMovId) {
          const movRef = doc(db, 'movements', auditState.suggestion.initialMovId);
          // Fix: dateTime com formato ISO completo (antes era string sem T)
          batch.update(movRef, { 
            date: newDate, 
            dateTime: `${newDate}T00:00:00.000Z` 
          });
        }
      }

      batch.update(accountRef, updates);
      await batch.commit();

      setFormData(prev => ({
        ...prev,
        currentBalance: auditState.ledgerBalance,
        createdAt: updates.createdAt || prev.createdAt
      }));

      setAuditState(prev => ({
        ...prev,
        status: 'ok',
        message: 'Correções aplicadas com sucesso!',
        issueType: 'OK',
      }));

    } catch (error) {
      alert('Erro ao corrigir: ' + error.message);
    } finally {
      setIsFixing(false);
    }
  };

  // --- HANDLE SUBMIT (v1.0.6) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.broker.trim()) return alert('Preencha os campos obrigatórios');
    
    // Payload Base
    const basePayload = {
      name: formData.name.trim(),
      broker: formData.broker.trim(),
      brokerName: formData.broker.trim(),
      currency: formData.currency,
      type: formData.type,
      isReal: (formData.type === 'REAL' || formData.type === 'PROP'),
      createdAt: formData.createdAt // String YYYY-MM-DD local
    };

    try {
      if (editingAccount) {
        const updatePayload = {
          ...basePayload,
          initialBalance: Number(formData.initialBalance),
        };
        // SSOT: Remove explicitamente currentBalance
        delete updatePayload.currentBalance;

        await updateAccount(editingAccount.id, updatePayload);
      } else {
        const createPayload = {
          ...basePayload,
          initialBalance: Number(formData.initialBalance),
          currentBalance: Number(formData.initialBalance)
        };
        // Prop firm — incluir campo propFirm se tipo PROP (#52 + Fase 1.5)
        if (formData.type === 'PROP' && selectedTemplate) {
          const evalDays = selectedTemplate.evalTimeLimit;
          // selectedInstrument inline (Fase 1.5)
          let instrumentField = null;
          if (propFirmData.selectedInstrument) {
            const inst = getInstrument(propFirmData.selectedInstrument);
            if (inst) {
              instrumentField = {
                symbol: inst.symbol,
                name: inst.name,
                type: inst.type,
                isMicro: inst.isMicro,
                pointValue: inst.pointValue,
                avgDailyRange: inst.avgDailyRange,
                minStopPoints: inst.minStopPoints
              };
            }
          }
          createPayload.propFirm = {
            templateId: selectedTemplate.id,
            firmName: selectedTemplate.firm,
            productName: selectedTemplate.name,
            phase: propFirmData.phase,
            drawdownMax: selectedTemplate.drawdown?.maxAmount ?? 0,
            evalDeadline: evalDays
              ? new Date(Date.now() + evalDays * 24 * 60 * 60 * 1000).toISOString()
              : null,
            selectedInstrument: instrumentField,
            suggestedPlan: attackPlan ? { ...attackPlan, style: propFirmData.attackStyle } : null
          };
        }
        const newAccountId = await addAccount(createPayload);

        // Auto-abrir modal de plano para conta PROP com defaults do attackPlan (#52 + Fase 1.5 + #136)
        if (formData.type === 'PROP' && attackPlan && selectedTemplate && newAccountId) {
          const pl = Number(formData.initialBalance);
          const defaults = computePropPlanDefaults(attackPlan, pl);

          setPropPlanDefaults({
            __isDefaults: true,
            accountId: newAccountId,
            name: `Plano ${selectedTemplate.name}`,
            type: 'Day Trade',
            pl,
            currency: formData.currency,
            adjustmentCycle: 'Mensal',
            cycleGoal: defaults.cycleGoalPct,
            cycleStop: defaults.cycleStopPct,
            operationPeriod: 'Diário',
            periodGoal: defaults.periodGoalPct,
            periodStop: defaults.periodStopPct,
            riskPerOperation: defaults.riskPctPerOp,
            rrTarget: defaults.rrTarget
          });
          setIsModalOpen(false);
          setTimeout(() => {
            setEditingPlan(null);
            setShowPlanModal(true);
          }, 800);
          return;
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Deseja excluir esta conta? O histórico será perdido.")) await deleteAccount(id);
  };

  // Handler: Mentor atualiza plano do aluno (com audit trail)
  const handleMentorUpdatePlan = async (planId, planData, auditInfo) => {
    setPlanSubmitting(true);
    try {
      await updatePlan(planId, planData, auditInfo);
    } finally {
      setPlanSubmitting(false);
    }
  };

  // Handler: criação de plano em nome do dono da conta (issue #183).
  // AccountsPage usa `usePlans()` sem overrideStudentId; sem este wrapper,
  // `addPlan` cairia no fallback `user.uid` e gravaria o UID do MENTOR como dono
  // → aluno não enxergaria o plano.
  const handleCreatePlanForSelectedAccount = async (planData) => {
    if (!selectedAccount) throw new Error('Nenhuma conta selecionada');
    return addPlan({
      ...planData,
      studentId: selectedAccount.studentId,
      studentEmail: selectedAccount.studentEmail,
      studentName: selectedAccount.studentName,
    });
  };

  // Handler: Mentor salva plano via PlanManagementModal (chamado do accordion)
  const handleMentorSavePlan = async (planData) => {
    if (!editingPlan) return;
    setPlanSubmitting(true);
    try {
      await updatePlan(editingPlan.id, planData, {
        editedBy: 'mentor',
        email: user?.email || 'unknown',
        editedAt: new Date().toISOString(),
        source: 'AccountsPage',
      });
      setShowPlanModal(false);
      setEditingPlan(null);
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
      alert('Erro: ' + error.message);
    } finally {
      setPlanSubmitting(false);
    }
  };

  // Callback para StudentAccountGroup
  const handleOpenEditPlan = (plan) => {
    setEditingPlan(plan);
    setShowPlanModal(true);
  };

  const getAccountBadge = (acc) => {
    const type = acc.type || (acc.isReal ? 'REAL' : 'DEMO');
    switch (type) {
      case 'REAL': return <div className="badge-account bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><ShieldCheck className="w-3 h-3" /> Conta Real</div>;
      case 'PROP': return <div className="badge-account bg-purple-500/10 text-purple-400 border-purple-500/20"><Trophy className="w-3 h-3" /> Mesa Proprietária</div>;
      default: return <div className="badge-account bg-yellow-500/10 text-yellow-400 border-yellow-500/20"><FlaskConical className="w-3 h-3" /> Simulado</div>;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando contas...</div>;

  if (selectedAccount) {
    const mergedAccount = { ...selectedAccount, currentBalance: balancesByAccountId[selectedAccount.id] ?? selectedAccount.currentBalance ?? 0 };
    return <AccountDetailPage account={mergedAccount} onBack={() => setSelectedAccount(null)} plans={plans} onUpdatePlan={handleMentorUpdatePlan} onCreatePlan={handleCreatePlanForSelectedAccount} planSubmitting={planSubmitting} />;
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div><h1 className="text-2xl lg:text-3xl font-display font-bold text-white">{isMentor() ? 'Contas dos Alunos' : 'Minhas Contas'}</h1><p className="text-slate-400 mt-1">{isMentor() ? 'Visualize as contas de trading de seus alunos' : 'Gerencie suas contas de trading'}</p></div>
          {!isMentor() && (<button onClick={() => openModal()} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Conta</button>)}
        </div>
        {isMentor() && (<div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors" /></div>)}
      </div>

      {isMentor() ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Object.entries(filteredGroups).map(([studentId, data]) => (<StudentAccountGroup key={studentId} studentName={data.studentName} studentEmail={data.studentEmail} accounts={data.accounts} plans={plans} balancesByAccountId={balancesByAccountId} onAccountClick={setSelectedAccount} onEditAccount={openModal} onEditPlan={handleOpenEditPlan} getAccountBadge={getAccountBadge} formatCurrency={formatCurrency} />))}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(acc => {
            const saldoInicial = acc.initialBalance || 0;
            const saldoAtual = balancesByAccountId[acc.id] ?? acc.currentBalance ?? saldoInicial;
            const profit = saldoAtual - saldoInicial;
            const isProfitable = profit >= 0;
            const isSolvent = saldoAtual >= 0;
            const ProfitIcon = isProfitable ? TrendingUp : TrendingDown;
            return (
              <div key={acc.id} onClick={() => setSelectedAccount(acc)} className="relative glass-card p-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl group">
                {getAccountBadge(acc)}
                <div className="mb-4"><div className="flex items-center gap-2 mb-1"><Wallet className="w-5 h-5 text-blue-400" /><h3 className="text-xl font-semibold text-white group-hover:text-emerald-400 transition-colors">{acc.name}</h3></div><p className="text-sm text-slate-400 flex items-center gap-2">{acc.broker || acc.brokerName || 'Broker não informado'}</p></div>
                <div className="space-y-3"><div className="flex justify-between items-center"><span className="text-sm text-slate-400">Saldo Inicial</span><span className="text-white font-mono">{formatCurrency(saldoInicial, acc.currency)}</span></div><div className="flex justify-between items-center"><span className="text-sm text-slate-400">Saldo Atual</span><div className="flex items-center gap-2"><ProfitIcon className={`w-4 h-4 ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`} /><span className={`font-bold font-mono ${isSolvent ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(saldoAtual, acc.currency)}</span></div></div></div>
                <div className="mt-6 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}><button onClick={(e) => { e.stopPropagation(); setSelectedAccount({ ...acc, _autoOpenPlanModal: true }); }} className="p-2 hover:bg-emerald-500/20 rounded text-emerald-400" title="Novo plano"><PlusCircle className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); openModal(acc); }} className="p-2 hover:bg-blue-500/20 rounded text-blue-400" title="Editar conta"><Edit2 className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }} className="p-2 hover:bg-red-500/20 rounded text-red-400" title="Excluir conta"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">{editingAccount ? 'Editar Conta' : 'Nova Conta'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div><label className="input-label mb-3">Tipo de Conta</label><div className="grid grid-cols-3 gap-3">{[{ id: 'REAL', icon: ShieldCheck, label: 'Real', color: 'emerald' }, { id: 'DEMO', icon: FlaskConical, label: 'Demo', color: 'yellow' }, { id: 'PROP', icon: Trophy, label: 'Mesa', color: 'purple' }].map(type => (<div key={type.id} onClick={() => setFormData({ ...formData, type: type.id })} className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${formData.type === type.id ? `bg-${type.color}-500/10 border-${type.color}-500/50 text-white` : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><type.icon className={`w-6 h-6 ${formData.type === type.id ? `text-${type.color}-400` : 'text-slate-500'}`} /><span className="text-xs font-bold uppercase">{type.label}</span></div>))}</div></div>
              {/* Prop Firm — seletor condicional (#52) */}
              {formData.type === 'PROP' && (
                <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-300 uppercase">Configuração da Mesa</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="input-label">Mesa Proprietária *</label>
                      <select className="input-dark w-full" value={propFirmData.selectedFirm} onChange={(e) => setPropFirmData(prev => ({ ...prev, selectedFirm: e.target.value, selectedTemplateId: '' }))}>
                        <option value="">Selecione a mesa</option>
                        {firmList.map(firm => (<option key={firm} value={firm}>{PROP_FIRM_LABELS[firm] ?? firm}</option>))}
                      </select>
                    </div>
                    {propFirmData.selectedFirm && (
                      <div>
                        <label className="input-label">Produto *</label>
                        <select className="input-dark w-full" value={propFirmData.selectedTemplateId} onChange={(e) => setPropFirmData(prev => ({ ...prev, selectedTemplateId: e.target.value }))}>
                          <option value="">Selecione o produto</option>
                          {productsForFirm.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                        </select>
                      </div>
                    )}
                  </div>
                  {selectedTemplate && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="input-label">Fase da Conta</label>
                          <select className="input-dark w-full" value={propFirmData.phase} onChange={(e) => setPropFirmData(prev => ({ ...prev, phase: e.target.value }))}>
                            {Object.entries(PROP_FIRM_PHASE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="input-label">Instrumento Principal *</label>
                          <select
                            className="input-dark w-full"
                            value={propFirmData.selectedInstrument}
                            onChange={(e) => setPropFirmData(prev => ({ ...prev, selectedInstrument: e.target.value }))}
                          >
                            <option value="">Selecione o instrumento</option>
                            {allowedInstruments.map(inst => (
                              <option key={inst.symbol} value={inst.symbol}>
                                {inst.symbol} {inst.isMicro ? '(Micro)' : ''} — {inst.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {/* #201: estilo operacional independente do profile */}
                      <div>
                        <label className="input-label">Estilo Operacional *</label>
                        <select
                          className="input-dark w-full"
                          value={propFirmData.attackStyle}
                          onChange={(e) => setPropFirmData(prev => ({ ...prev, attackStyle: e.target.value }))}
                        >
                          {Object.entries(STYLE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label} ({(STYLE_ATR_FRACTIONS[key] * 100).toFixed(0)}% ATR) — {STYLE_DESCRIPTIONS[key]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="input-label">Perfil do Plano de Ataque</label>
                        <div className="grid grid-cols-5 gap-1.5">
                          {Object.values(ATTACK_PROFILES).map((p) => {
                            const selected = propFirmData.attackProfile === p.code;
                            const isCons = p.family === 'conservative';
                            return (
                              <button
                                key={p.code}
                                type="button"
                                onClick={() => setPropFirmData(prev => ({ ...prev, attackProfile: p.code }))}
                                title={`${p.name} — ${p.description}\nRO: ${(p.roPct * 100).toFixed(0)}% do DD · ${p.maxTradesPerDay} trade${p.maxTradesPerDay > 1 ? 's' : ''}/dia\n${p.idealFor}\n\nMonte Carlo (Apex 50K · stop-on-win · 100k iter)\n${formatProfileMcTip(p)}\nFormato: PASS / BUST / dias médios`}
                                className={`p-1.5 rounded-md border text-[10px] font-semibold transition-all ${
                                  selected
                                    ? (isCons ? 'bg-blue-500/20 border-blue-500/60 text-blue-200' : 'bg-orange-500/20 border-orange-500/60 text-orange-200')
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                <div>{(p.roPct * 100).toFixed(0)}%</div>
                                <div className="text-[9px] opacity-70 mt-0.5">{p.code}</div>
                                {p.recommended && <div className="text-[8px] text-emerald-400 mt-0.5">★</div>}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {ATTACK_PROFILES[propFirmData.attackProfile]?.description ?? ''}
                          {' · '}{ATTACK_PROFILES[propFirmData.attackProfile]?.maxTradesPerDay ?? '—'} trade(s)/dia · RR 1:2
                        </p>
                        {ATTACK_PROFILES[propFirmData.attackProfile]?.mcStats && (
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">
                            {formatProfileMcTip(ATTACK_PROFILES[propFirmData.attackProfile])}
                            <span className="text-[9px] text-slate-600 ml-2">PASS/BUST/dias · MC Apex 50K stop-on-win</span>
                          </p>
                        )}
                      </div>

                      {/* Preview do plano de ataque em 3 blocos semanticamente distintos (issue #136):
                          1. Constraints da mesa (hard limits imutáveis)
                          2. Mecânica do plano (meta/stop operacional derivados de RO × RR, simétricos)
                          3. Ritmo de acumulação (EV estatístico rotulado como contexto, NÃO meta) */}
                      {attackPlan && attackPlan.mode === 'abstract' && (() => {
                        const ro = attackPlan.roPerTrade ?? 0;
                        const maxT = attackPlan.maxTradesPerDay ?? 0;
                        const rr = attackPlan.rrMinimum ?? 2;
                        const dailyStop = ro * maxT;
                        const dailyGoal = dailyStop * rr;
                        return (
                          <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Constraints da mesa</div>
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                                <div><div className="text-slate-500 text-[10px]">DD total</div><div className="text-slate-200 font-mono">${attackPlan.drawdownMax.toLocaleString()}</div></div>
                                <div><div className="text-slate-500 text-[10px]">Profit target</div><div className="text-slate-200 font-mono">${attackPlan.profitTarget.toLocaleString()}</div></div>
                                <div><div className="text-slate-500 text-[10px]">Prazo eval</div><div className="text-slate-200 font-mono">{attackPlan.evalBusinessDays} dias</div></div>
                                {attackPlan.dailyLossLimit > 0 && (
                                  <div className="col-span-3"><div className="text-slate-500 text-[10px]">Daily loss</div><div className="text-slate-200 font-mono">${attackPlan.dailyLossLimit.toLocaleString()} <span className="text-slate-600 text-[10px]">(hard limit da mesa)</span></div></div>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-700/50">
                              <div className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1.5">Mecânica do plano</div>
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                                <div><div className="text-slate-500 text-[10px]">RO por trade</div><div className="text-slate-200 font-mono">${ro.toLocaleString()}</div></div>
                                <div><div className="text-slate-500 text-[10px]">RR por trade</div><div className="text-slate-200 font-mono">{rr}:1</div></div>
                                <div><div className="text-slate-500 text-[10px]">Max trades/dia</div><div className="text-slate-200 font-mono">{maxT}</div></div>
                                <div><div className="text-red-400/70 text-[10px]">Stop operacional</div><div className="text-red-400 font-mono">-${dailyStop.toLocaleString()}/dia</div></div>
                                <div><div className="text-emerald-400/70 text-[10px]">Meta operacional</div><div className="text-emerald-400 font-mono">${dailyGoal.toLocaleString()}/dia</div></div>
                              </div>
                              <p className="text-[10px] text-slate-500 italic mt-1">Stops em pontos a definir conforme instrumento.</p>
                            </div>

                            {attackPlan.dailyTarget > 0 && (
                              <div className="pt-2 border-t border-slate-700/50">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Ritmo de acumulação (contexto, não meta)</div>
                                <div className="text-[11px] text-slate-400">
                                  EV esperado: <span className="font-mono">${attackPlan.dailyTarget.toLocaleString()}/dia</span> — média estatística para acumular o profit target em {attackPlan.evalBusinessDays} dias úteis. <span className="text-slate-500">Não é o alvo do dia.</span>
                                </div>
                              </div>
                            )}

                            {attackPlan.message && (
                              <p className="text-[10px] text-amber-400/80 italic pt-1">{attackPlan.message}</p>
                            )}
                          </div>
                        );
                      })()}

                      {attackPlan && attackPlan.mode === 'execution' && !attackPlan.incompatible && (() => {
                        const ro = attackPlan.roPerTrade ?? 0;
                        const maxT = attackPlan.maxTradesPerDay ?? 0;
                        const rr = attackPlan.rrMinimum ?? 2;
                        const dailyStop = ro * maxT;
                        const dailyGoal = dailyStop * rr;
                        return (
                          <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                                Plano de execução — {attackPlan.instrument.symbol} ({attackPlan.instrument.name}) · {attackPlan.profileName}
                              </div>
                            </div>

                            {/* BLOCO 1 — Constraints da mesa */}
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Constraints da mesa</div>
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                                <div><div className="text-slate-500 text-[10px]">DD total</div><div className="text-slate-200 font-mono">${attackPlan.drawdownMax.toLocaleString()}</div></div>
                                <div><div className="text-slate-500 text-[10px]">Profit target</div><div className="text-slate-200 font-mono">${attackPlan.profitTarget.toLocaleString()}</div></div>
                                <div><div className="text-slate-500 text-[10px]">Prazo eval</div><div className="text-slate-200 font-mono">{attackPlan.evalBusinessDays} dias</div></div>
                                {attackPlan.dailyLossLimit > 0 && (
                                  <div className="col-span-3"><div className="text-slate-500 text-[10px]">Daily loss</div><div className="text-slate-200 font-mono">${attackPlan.dailyLossLimit.toLocaleString()} <span className="text-slate-600 text-[10px]">(hard limit da mesa)</span></div></div>
                                )}
                              </div>
                            </div>

                            {/* BLOCO 2 — Mecânica do plano */}
                            <div className="pt-2 border-t border-slate-700/50">
                              <div className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1.5">Mecânica do plano</div>
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                                <div><div className="text-slate-500 text-[10px]">RO/trade</div><div className="text-slate-200 font-mono">${ro.toFixed(2)} <span className="text-slate-500 text-[10px]">({(attackPlan.roPct * 100).toFixed(0)}% DD)</span></div></div>
                                <div><div className="text-slate-500 text-[10px]">Stop/trade</div><div className="text-slate-200 font-mono">{attackPlan.stopPoints} pts <span className="text-slate-500 text-[10px]">${attackPlan.stopPerTrade.toFixed(0)}</span></div></div>
                                <div><div className="text-slate-500 text-[10px]">Target/trade</div><div className="text-slate-200 font-mono">{attackPlan.targetPoints} pts <span className="text-slate-500 text-[10px]">${attackPlan.targetPerTrade.toFixed(0)}</span></div></div>
                                <div><div className="text-slate-500 text-[10px]">RR/trade</div><div className="text-slate-200 font-mono">1:{rr}</div></div>
                                <div><div className="text-slate-500 text-[10px]">Max trades/dia</div><div className="text-slate-200 font-mono">{maxT}</div></div>
                                <div><div className="text-slate-500 text-[10px]">Sizing</div><div className="text-slate-200 font-mono">{attackPlan.sizing} contrato</div></div>
                                <div><div className="text-red-400/70 text-[10px]">Stop operacional</div><div className="text-red-400 font-mono">-${dailyStop.toLocaleString()}/dia</div></div>
                                <div><div className="text-emerald-400/70 text-[10px]">Meta operacional</div><div className="text-emerald-400 font-mono">${dailyGoal.toLocaleString()}/dia</div></div>
                                <div><div className="text-slate-500 text-[10px]">Stop / range NY</div><div className="text-slate-200 font-mono">{attackPlan.stopNyPct}%</div></div>
                                <div><div className="text-slate-500 text-[10px]">Losses até bust</div><div className="text-slate-200 font-mono">{attackPlan.lossesToBust}</div></div>
                              </div>
                              {maxT > 1 && (
                                <p className="text-[10px] text-slate-500 leading-snug mt-2">
                                  Execução: <span className="text-slate-400">{maxT} trades × 1 contrato</span> OU <span className="text-slate-400">1 trade × {maxT} contratos</span> — mesma distância em pontos. <span className="text-amber-400/80">Não reduzir stop/target para "compensar" mais contratos.</span>
                                </p>
                              )}
                            </div>

                            {/* BLOCO 3 — Ritmo de acumulação (contexto, NÃO meta) */}
                            {attackPlan.dailyTarget > 0 && (
                              <div className="pt-2 border-t border-slate-700/50">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Ritmo de acumulação (contexto, não meta)</div>
                                <div className="text-[11px] text-slate-400">
                                  EV diário: <span className="font-mono">${attackPlan.dailyTarget.toFixed(0)}/dia</span> — média estatística para acumular o profit target em {attackPlan.evalBusinessDays} dias úteis. EV/trade @ WR {(attackPlan.assumedWR * 100).toFixed(0)}%: <span className={`font-mono ${attackPlan.evPerTrade >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${attackPlan.evPerTrade.toFixed(2)}</span>. <span className="text-slate-500">Não é o alvo do dia.</span>
                                </div>
                              </div>
                            )}

                            {attackPlan.wrBelowBreakeven && (
                              <p className="text-[10px] text-amber-400 mt-1">⚠ WR assumido abaixo do breakeven (33.3%). EV negativa — plano matematicamente inviável.</p>
                            )}
                            {attackPlan.sessionRestricted && (
                              <p className="text-[10px] text-amber-400 mt-1">
                                ⚠ Stop {attackPlan.stopPoints} pts ({attackPlan.stopNyPct}% do range NY) — <strong>operar somente Ásia/London</strong>. NY consome esse stop por volatilidade.
                              </p>
                            )}
                            {attackPlan.stopIsNoise && (
                              <p className="text-[10px] text-amber-400/80 mt-1">⚠ Stop muito pequeno relativo ao range NY ({attackPlan.stopNyPct}%) — risco de ruído.</p>
                            )}
                          </div>
                        );
                      })()}

                      {attackPlan && attackPlan.mode === 'execution' && attackPlan.incompatible && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-xs font-semibold text-red-300">Instrumento incompatível com este perfil/conta</span>
                          </div>
                          <p className="text-[11px] text-red-200/80">
                            <strong>{attackPlan.instrument.symbol}</strong>: RO ${attackPlan.roPerTrade.toFixed(0)} resulta em stop {attackPlan.stopPoints} pts.
                            {' '}{attackPlan.inviabilityReason}.
                          </p>
                          {attackPlan.microSuggestion && (
                            <button
                              type="button"
                              onClick={() => setPropFirmData(prev => ({ ...prev, selectedInstrument: attackPlan.microSuggestion }))}
                              className="text-[11px] text-emerald-400 hover:text-emerald-300 underline"
                            >
                              ↳ Sugestão: usar {attackPlan.microSuggestion} (micro variant)
                            </button>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-500 space-y-0.5">
                        <div>DD máx: ${selectedTemplate.drawdown?.maxAmount?.toLocaleString()} ({selectedTemplate.drawdown?.type})</div>
                        <div>Target: ${selectedTemplate.profitTarget?.toLocaleString()}</div>
                        {selectedTemplate.evalTimeLimit && <div>Prazo eval: {selectedTemplate.evalTimeLimit} dias corridos</div>}
                        {selectedTemplate.dailyLossLimit && <div>Daily loss: ${selectedTemplate.dailyLossLimit?.toLocaleString()}</div>}
                        {selectedTemplate.restrictedInstruments?.length > 0 && (
                          <div className="text-amber-400/80">⚠ Instrumentos restritos: {selectedTemplate.restrictedInstruments.join(', ')}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="input-label">Nome da Conta *</label><input required className="input-dark w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                <div className="relative"><label className="input-label">Corretora / Mesa *</label><div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input required className="input-dark w-full pl-10" value={formData.broker} onChange={e => { setFormData({ ...formData, broker: e.target.value }); setShowBrokerSuggestions(true); }} /></div>{showBrokerSuggestions && filteredBrokers.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">{filteredBrokers.map(broker => (<button key={broker} type="button" className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2" onClick={() => { setFormData({ ...formData, broker: broker }); setShowBrokerSuggestions(false); }}><Search className="w-3 h-3 opacity-50" /> {broker}</button>))}</div>)}</div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div><label className="input-label">Moeda</label><select className="input-dark w-full" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}><option value="BRL">BRL (R$)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option></select></div>
                <div><label className="input-label">Saldo Inicial *</label><input required type="number" step="0.01" min="0" className="input-dark w-full" value={formData.initialBalance} onChange={e => setFormData({ ...formData, initialBalance: e.target.value })} /></div>
                <div><label className="input-label flex items-center gap-2"><Calendar className="w-3 h-3" /> Data de Abertura</label><input type="date" className="input-dark w-full" value={formData.createdAt} onChange={e => setFormData({ ...formData, createdAt: e.target.value })} /></div>
              </div>

              {editingAccount && (
                <div className={`mt-4 border rounded-xl p-4 transition-all ${auditState.status === 'issue' ? 'bg-amber-500/10 border-amber-500/30' : auditState.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {auditState.status === 'issue' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : auditState.status === 'ok' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <ShieldCheck className="w-4 h-4 text-blue-400" />}
                        Auditoria & Saúde
                      </h4>
                      {auditState.message && <p className={`text-xs mt-1 ${auditState.status === 'issue' ? 'text-amber-300' : auditState.status === 'ok' ? 'text-emerald-300' : 'text-slate-400'}`}>{auditState.message}</p>}
                    </div>
                    {auditState.status === 'idle' && <button type="button" onClick={handleRunAudit} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"><RefreshCw className="w-3 h-3" /> Verificar</button>}
                  </div>

                  {(auditState.status === 'issue' || auditState.status === 'ok') && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between text-xs bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                        <div><span className="block text-slate-500">Saldo Atual (Banco)</span><span className="font-mono font-bold text-white">{formatCurrency(formData.currentBalance, formData.currency)}</span></div>
                        <ArrowRight className="w-4 h-4 text-slate-600" />
                        <div className="text-right"><span className="block text-slate-500">Saldo Calculado (Ledger)</span><span className={`font-mono font-bold ${Math.abs(auditState.ledgerBalance - (Number(formData.currentBalance) || 0)) > 0.05 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatCurrency(auditState.ledgerBalance, formData.currency)}</span></div>
                      </div>
                      {auditState.status === 'issue' && (
                        <button type="button" onClick={handleFixIssues} disabled={isFixing} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                          {isFixing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          {auditState.issueType === 'CHRONOLOGY_ERROR' ? 'Corrigir Datas & Atualizar Saldo' : 'Atualizar Saldo Agora'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </form>
            <div className="p-6 border-t border-slate-800 bg-slate-900 flex gap-3"><button onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancelar</button><button type="submit" onClick={handleSubmit} className="btn-primary flex-1">Salvar</button></div>
          </div>
        </div>
      )}
      <style>{`.badge-account { position: absolute; top: 1rem; right: 1rem; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.625rem; text-transform: uppercase; font-weight: 700; display: flex; align-items: center; gap: 0.25rem; border-width: 1px; } .input-label { display: block; font-size: 0.75rem; color: rgb(148 163 184); margin-bottom: 0.5rem; font-weight: 500; } .input-dark { background: rgb(15 23 42); border: 1px solid rgb(51 65 85); padding: 0.625rem 0.75rem; border-radius: 0.5rem; color: white; outline: none; transition: border-color 0.2s; } .input-dark:focus { border-color: rgb(59 130 246); }`}</style>
      {/* Modal de plano — mentor (edição) ou aluno (criação pós conta PROP) */}
      {showPlanModal && (
        <PlanManagementModal
          isOpen={showPlanModal}
          onClose={() => { setShowPlanModal(false); setEditingPlan(null); setPropPlanDefaults(null); }}
          onSubmit={async (planData) => {
            setPlanSubmitting(true);
            try {
              if (editingPlan) {
                await updatePlan(editingPlan.id, planData, {
                  editedBy: isMentor() ? 'mentor' : 'student',
                  email: user?.email || 'unknown',
                  editedAt: new Date().toISOString(),
                  source: 'AccountsPage',
                });
              } else {
                await addPlan(planData);
              }
              setShowPlanModal(false);
              setEditingPlan(null);
              setPropPlanDefaults(null);
            } catch (error) {
              console.error('Erro ao salvar plano:', error);
              alert('Erro: ' + error.message);
            }
            setPlanSubmitting(false);
          }}
          editingPlan={editingPlan ?? propPlanDefaults}
          defaultAccountId={propPlanDefaults?.accountId}
          isSubmitting={planSubmitting}
        />
      )}
      <DebugBadge component="AccountsPage" />
    </div>
  );
};

export default AccountsPage;
