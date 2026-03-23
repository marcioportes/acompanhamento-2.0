/**
 * StudentOnboardingPage.jsx
 * 
 * Página principal do onboarding do aluno.
 * Orquestra o fluxo completo baseado no onboardingStatus:
 * lead → pre_assessment → ai_assessed → probing → probing_complete → mentor_validated → active
 * 
 * Rota: /onboarding/:studentId
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

import { useAssessment } from '../hooks/useAssessment.js';
import { useQuestionnaire } from '../hooks/useQuestionnaire.js';
import { useProbing } from '../hooks/useProbing.js';

import { calculateFullAssessment } from '../utils/assessmentScoring.js';
import { classifyFullAssessment } from '../utils/profileClassifier.js';
import { detectAllIncongruences } from '../utils/incongruenceDetector.js';
import { prepareProbingPayload } from '../utils/probingTriggers.js';
import { prepareStagePayload } from '../utils/stageMapper.js';
import { QUESTION_MAP } from '../utils/assessmentQuestions.js';

import QuestionnaireFlow from '../components/Onboarding/QuestionnaireFlow.jsx';
import ProbingIntro from '../components/Onboarding/ProbingIntro.jsx';
import ProbingQuestionsFlow from '../components/Onboarding/ProbingQuestionsFlow.jsx';
import AIAssessmentReport from '../components/Onboarding/AIAssessmentReport.jsx';
import MentorValidation from '../components/Onboarding/MentorValidation.jsx';
import BaselineReport from '../components/Onboarding/BaselineReport.jsx';
import DebugBadge from '../components/DebugBadge.jsx';

const STATUS_LABELS = {
  lead: 'Novo Aluno',
  pre_assessment: 'Questionário em Andamento',
  ai_assessed: 'Aguardando Sondagem',
  probing: 'Sondagem em Andamento',
  probing_complete: 'Aguardando Validação do Mentor',
  mentor_validated: 'Assessment Validado',
  active: 'Aluno Ativo',
};

const STATUS_COLORS = {
  lead: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  pre_assessment: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ai_assessed: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  probing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  probing_complete: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  mentor_validated: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function StudentOnboardingPage() {
  const { studentId } = useParams();
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(null); // null = auto from status
  const [assessmentScores, setAssessmentScores] = useState(null);
  const [assessmentClassifications, setAssessmentClassifications] = useState(null);
  const [incongruenceData, setIncongruenceData] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [stageDiagnosis, setStageDiagnosis] = useState(null);

  // ── Hooks ────────────────────────────────────────────────

  const assessment = useAssessment(studentId);
  const {
    questionnaire: savedQuestionnaire,
    probing: savedProbing,
    initialAssessment,
    onboardingStatus,
    loading,
    error: assessmentError,
    startQuestionnaire,
    saveResponse,
    completeQuestionnaire,
    saveProbing,
    completeProbingQuestion,
    completeProbing,
    saveInitialAssessment,
  } = assessment;

  const questionnaire = useQuestionnaire({
    savedResponses: savedQuestionnaire?.responses || null,
    onSaveResponse: saveResponse,
  });

  const probing = useProbing({
    onSaveProbing: saveProbing,
    onCompleteProbingQuestion: completeProbingQuestion,
    onCompleteProbing: completeProbing,
  });

  // ── Determine active view ─────────────────────────────────

  const currentView = activeTab || onboardingStatus || 'lead';

  // Tabs available based on status progression
  const availableTabs = useMemo(() => {
    const tabs = [];
    const statusOrder = ['lead', 'pre_assessment', 'ai_assessed', 'probing', 'probing_complete', 'mentor_validated', 'active'];
    const currentIdx = statusOrder.indexOf(onboardingStatus);

    if (currentIdx >= 1) tabs.push({ key: 'pre_assessment', label: 'Questionário' });
    if (currentIdx >= 2) tabs.push({ key: 'ai_assessed', label: 'Sondagem' });
    if (currentIdx >= 4) tabs.push({ key: 'probing_complete', label: 'Relatório IA' });
    if (currentIdx >= 4) tabs.push({ key: 'mentor_validation', label: 'Validação' });
    if (currentIdx >= 5) tabs.push({ key: 'active', label: 'Marco Zero' });

    return tabs;
  }, [onboardingStatus]);

  // ── Handlers ──────────────────────────────────────────────

  const handleStartAssessment = useCallback(async () => {
    await startQuestionnaire();
  }, [startQuestionnaire]);

  const handleQuestionnaireComplete = useCallback(async () => {
    setProcessing(true);
    try {
      const allResponses = questionnaire.getAllResponses();

      // 1. Classify open responses via CF
      const classifyCF = httpsCallable(functions, 'classifyOpenResponse');
      const openResponses = allResponses.filter((r) => r.type === 'open');

      for (const resp of openResponses) {
        const question = QUESTION_MAP[resp.questionId];
        if (!question) continue;

        // Get closed responses from same dimension for cross-check
        const dimClosedResponses = allResponses
          .filter((r) => r.type === 'closed' && r.dimension === resp.dimension)
          .map((r) => ({
            questionId: r.questionId,
            selectedText: QUESTION_MAP[r.questionId]?.options?.find((o) => o.id === r.selectedOption)?.text || '',
            score: QUESTION_MAP[r.questionId]?.options?.find((o) => o.id === r.selectedOption)?.score || 0,
          }));

        const result = await classifyCF({
          questionId: resp.questionId,
          questionText: question.text,
          responseText: resp.text,
          rubric: question.aiRubric || '',
          closedResponses: dimClosedResponses,
          dimension: resp.dimension,
          subDimension: resp.subDimension,
        });

        // Enrich response with AI scores
        resp.aiScore = result.data.aiScore;
        resp.aiClassification = result.data.aiClassification;
        resp.aiJustification = result.data.aiJustification;
        resp.aiConfidence = result.data.aiConfidence;

        // Persist enriched response
        await saveResponse(resp);
      }

      // 2. Detect incongruences
      const incongruences = detectAllIncongruences(allResponses);
      setIncongruenceData(incongruences);

      // 3. Complete questionnaire in Firestore
      await completeQuestionnaire({
        incongruenceFlags: [...incongruences.intraFlags, ...incongruences.interFlags],
        gamingSuspect: incongruences.gamingSuspect,
        aiModelVersion: 'claude-sonnet-4-20250514',
      });

      // 4. Prepare probing payload
      const probPayload = prepareProbingPayload({
        responses: allResponses,
        interFlags: incongruences.interFlags,
        intraFlags: incongruences.intraFlags,
        gamingSuspect: incongruences.gamingSuspect,
      });

      // 5. Calculate preliminary scores (for context)
      // Stage not yet diagnosed — will be done in generateAssessmentReport
      const prelimScores = calculateFullAssessment(allResponses, 2, 0); // placeholder stage
      setAssessmentScores(prelimScores);
      setAssessmentClassifications(classifyFullAssessment(prelimScores));

      // Store probing payload for next step
      probing._probingPayload = probPayload;

    } catch (err) {
      console.error('Questionnaire completion error:', err);
    } finally {
      setProcessing(false);
    }
  }, [questionnaire, saveResponse, completeQuestionnaire, probing]);

  const handleProbingStart = useCallback(async () => {
    const allResponses = questionnaire.getAllResponses();
    const payload = prepareProbingPayload({
      responses: allResponses,
      interFlags: incongruenceData?.interFlags || [],
      intraFlags: incongruenceData?.intraFlags || [],
      gamingSuspect: incongruenceData?.gamingSuspect || false,
    });
    payload.allResponses = allResponses;
    await probing.generateQuestions(payload);
  }, [questionnaire, incongruenceData, probing]);

  const handleProbingComplete = useCallback(async () => {
    setProcessing(true);
    try {
      const allResponses = questionnaire.getAllResponses();

      // Generate full assessment report (includes stage diagnosis)
      const stagePayload = prepareStagePayload(allResponses, assessmentScores);

      const generateReportCF = httpsCallable(functions, 'generateAssessmentReport');
      const result = await generateReportCF({
        stagePayload,
        scores: assessmentScores,
        classifications: assessmentClassifications,
        incongruenceFlags: [
          ...(incongruenceData?.intraFlags || []),
          ...(incongruenceData?.interFlags || []),
        ],
        probingData: savedProbing,
      });

      const { stageDiagnosis: sd, report } = result.data;
      setStageDiagnosis(sd);
      setReportData(report);

      // Recalculate with diagnosed stage
      const finalScores = calculateFullAssessment(allResponses, sd.stage, 0);
      setAssessmentScores(finalScores);
      setAssessmentClassifications(classifyFullAssessment(finalScores));

    } catch (err) {
      console.error('Report generation error:', err);
    } finally {
      setProcessing(false);
    }
  }, [questionnaire, assessmentScores, assessmentClassifications, incongruenceData, savedProbing]);

  const handleMentorSave = useCallback(async (mentorValidation) => {
    setSaving(true);
    try {
      // Build initial_assessment document from mentor validation + AI scores
      const mentorScores = mentorValidation.mentorData;

      // Recalculate with mentor overrides
      // For now, build the full assessment doc
      const assessmentDoc = {
        interviewer: mentorValidation.interviewer,
        emotional: {
          recognition: { aiScore: assessmentScores?.emotional?.recognition, mentorScore: mentorScores.emotional.recognition.score, notes: mentorScores.emotional.recognition.notes },
          regulation: { aiScore: assessmentScores?.emotional?.regulation, mentorScore: mentorScores.emotional.regulation.score, notes: mentorScores.emotional.regulation.notes },
          locus: { aiScore: assessmentScores?.emotional?.locus, mentorScore: mentorScores.emotional.locus.score, notes: mentorScores.emotional.locus.notes },
          score: (mentorScores.emotional.recognition.score + mentorScores.emotional.regulation.score + mentorScores.emotional.locus.score) / 3,
          notes: mentorValidation.mentorData.overallNotes,
        },
        financial: {
          discipline: { aiScore: assessmentScores?.financial?.discipline, mentorScore: mentorScores.financial.discipline.score, notes: mentorScores.financial.discipline.notes },
          loss_management: { aiScore: assessmentScores?.financial?.loss_management, mentorScore: mentorScores.financial.loss_management.score, notes: mentorScores.financial.loss_management.notes },
          profit_taking: { aiScore: assessmentScores?.financial?.profit_taking, mentorScore: mentorScores.financial.profit_taking.score, notes: mentorScores.financial.profit_taking.notes },
          score: (mentorScores.financial.discipline.score * 0.40) + (mentorScores.financial.loss_management.score * 0.40) + (mentorScores.financial.profit_taking.score * 0.20),
          last_20_trades_metrics: null, // DEC-022: tábula rasa
          notes: '',
        },
        operational: {
          decision_mode: { aiScore: assessmentScores?.operational?.decision_mode, mentorScore: mentorScores.operational.decision_mode.score, notes: mentorScores.operational.decision_mode.notes },
          timeframe: { aiScore: assessmentScores?.operational?.timeframe, mentorScore: mentorScores.operational.timeframe.score, notes: mentorScores.operational.timeframe.notes },
          strategy_fit: { aiScore: assessmentScores?.operational?.strategy_fit, mentorScore: mentorScores.operational.strategy_fit.score, notes: mentorScores.operational.strategy_fit.notes },
          tracking: { aiScore: assessmentScores?.operational?.tracking, mentorScore: mentorScores.operational.tracking.score, notes: mentorScores.operational.tracking.notes },
          emotion_control: null, // Will be calculated below
          fit_score: null,
          notes: '',
        },
        experience: {
          stage: stageDiagnosis?.stage || 2,
          gates_met: 0, // DEC-022
          gates_total: 0,
          stage_score: null,
          progression_likelihood: 0,
          key_blockers: [],
          notes: '',
        },
        composite_score: null,
        composite_label: null,
        profile_name: reportData?.profileName || '',
        development_priorities: reportData?.developmentPriorities || [],
        next_review_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
        inter_dimensional_flags: incongruenceData?.interFlags?.map((f) => ({
          type: f.type,
          sourceDimension: f.sourceDimension,
          targetDimension: f.targetDimension,
          delta: f.delta,
          mentorResolution: 'pending',
          mentorNotes: '',
        })) || [],
      };

      // Calculate derived fields
      const emoScore = assessmentDoc.emotional.score;
      assessmentDoc.operational.emotion_control = emoScore;
      assessmentDoc.operational.fit_score =
        (mentorScores.operational.decision_mode.score * 0.25) +
        (mentorScores.operational.timeframe.score * 0.20) +
        (mentorScores.operational.strategy_fit.score * 0.20) +
        (mentorScores.operational.tracking.score * 0.15) +
        (emoScore * 0.20);

      const expStage = assessmentDoc.experience.stage;
      const stageBases = { 1: 0, 2: 20, 3: 40, 4: 60, 5: 80 };
      assessmentDoc.experience.stage_score = stageBases[expStage] || 0;

      assessmentDoc.composite_score =
        (emoScore * 0.25) +
        (assessmentDoc.financial.score * 0.25) +
        (assessmentDoc.operational.fit_score * 0.20) +
        (assessmentDoc.experience.stage_score * 0.30);

      // Classify composite
      const cs = assessmentDoc.composite_score;
      assessmentDoc.composite_label =
        cs >= 80 ? 'PROFESSIONAL TRADER' :
        cs >= 65 ? 'COMMITTED LEARNER' :
        cs >= 40 ? 'DEVELOPING TRADER' : 'AT RISK';

      // Calibration
      assessmentDoc.calibration = {
        emotional_delta: emoScore - (assessmentScores?.emotional?.score || 0),
        financial_delta: assessmentDoc.financial.score - (assessmentScores?.financial?.score || 0),
        operational_delta: assessmentDoc.operational.fit_score - (assessmentScores?.operational?.score || 0),
        experience_delta: 0,
        average_delta: null,
      };
      const deltas = [assessmentDoc.calibration.emotional_delta, assessmentDoc.calibration.financial_delta, assessmentDoc.calibration.operational_delta, assessmentDoc.calibration.experience_delta];
      assessmentDoc.calibration.average_delta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

      await saveInitialAssessment(assessmentDoc);

    } catch (err) {
      console.error('Mentor save error:', err);
    } finally {
      setSaving(false);
    }
  }, [assessmentScores, stageDiagnosis, reportData, incongruenceData, saveInitialAssessment]);

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Onboarding</h1>
          <p className="text-sm text-gray-500 mt-1">Assessment 4D — Trader Evolution Framework</p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${STATUS_COLORS[onboardingStatus] || STATUS_COLORS.lead}`}>
          {STATUS_LABELS[onboardingStatus] || onboardingStatus}
        </div>
      </div>

      {/* Tabs (when past lead) */}
      {availableTabs.length > 0 && (
        <div className="flex gap-1 mb-8 p-1 bg-white/[0.02] rounded-xl border border-white/5">
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-4 py-2 rounded-lg text-xs font-medium transition-all
                ${(activeTab || onboardingStatus) === tab.key
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {assessmentError && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {assessmentError}
        </div>
      )}

      {/* Processing indicator */}
      {processing && (
        <div className="mb-6 flex items-center gap-2 text-sm text-blue-400">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Processando... Isso pode levar alguns segundos.
        </div>
      )}

      {/* ── VIEWS ────────────────────────────────────────── */}

      {/* LEAD: Start assessment */}
      {currentView === 'lead' && (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-white mb-3">
            Iniciar Assessment 4D
          </h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-8">
            O questionário contém 34 perguntas sobre 4 dimensões: Emocional, Financeira, 
            Operacional e Experiência. Leva aproximadamente 20-30 minutos.
          </p>
          <button
            onClick={handleStartAssessment}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all"
          >
            Começar Questionário
          </button>
        </div>
      )}

      {/* PRE_ASSESSMENT: Questionnaire in progress */}
      {currentView === 'pre_assessment' && (
        <QuestionnaireFlow
          questionnaire={questionnaire}
          onComplete={handleQuestionnaireComplete}
        />
      )}

      {/* AI_ASSESSED: Ready for probing */}
      {currentView === 'ai_assessed' && (
        <ProbingIntro
          totalProbingQuestions={null}
          onStart={handleProbingStart}
          loading={probing.generating}
        />
      )}

      {/* PROBING: Probing in progress */}
      {currentView === 'probing' && (
        <ProbingQuestionsFlow
          probing={probing}
          onComplete={handleProbingComplete}
        />
      )}

      {/* PROBING_COMPLETE: Report + Validation */}
      {currentView === 'probing_complete' && activeTab !== 'mentor_validation' && (
        <AIAssessmentReport
          scores={assessmentScores}
          classifications={assessmentClassifications}
          incongruenceData={incongruenceData}
          probingData={savedProbing}
          reportData={reportData}
          stageDiagnosis={stageDiagnosis}
        />
      )}

      {currentView === 'probing_complete' && activeTab === 'mentor_validation' && (
        <MentorValidation
          aiScores={assessmentScores}
          aiClassifications={assessmentClassifications}
          onSave={handleMentorSave}
          saving={saving}
        />
      )}

      {/* ACTIVE / MENTOR_VALIDATED: Baseline Report */}
      {(currentView === 'mentor_validated' || currentView === 'active') && (
        <BaselineReport assessment={initialAssessment} />
      )}

      <DebugBadge />
    </div>
  );
}
