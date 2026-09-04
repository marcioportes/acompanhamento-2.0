/**
 * paths.js — SSoT dos endereços do app (issue #144, Fase A1)
 *
 * Antes do roteador, "onde estou" era uma string em `App.jsx` (`currentView`) e
 * cada travessia entre telas tinha regra própria: oito estados de contexto de
 * retorno e flags penduradas no objeto do trade (`_fromLedgerPlanId`,
 * `_fromReviewContext`). O endereço passa a ser a URL, e "voltar" passa a ser o
 * histórico — não uma regra escrita à mão por par origem→destino.
 *
 * Funções (e não literais) para toda rota com parâmetro: quem monta URL na mão
 * erra o encoding e a barra final.
 */

/** Rotas sem papel definido — servem mentor e aluno. */
export const PUBLIC_PATHS = {
  login: '/login',
};

/** Mentor. A Torre é a porta: `/` redireciona pra cá (decisão de produto #144). */
export const MENTOR_PATHS = {
  torre: '/torre',
  analises: '/analises',
  alunos: '/alunos',
  aluno: (studentId) => `/alunos/${encodeURIComponent(studentId)}`,
  alunoComoAluno: (studentId) => `/alunos/${encodeURIComponent(studentId)}/como-aluno`,
  alunoPlano: (studentId, planId) =>
    `/alunos/${encodeURIComponent(studentId)}/plano/${encodeURIComponent(planId)}`,
  alunoRevisao: (studentId, reviewId) =>
    `/alunos/${encodeURIComponent(studentId)}/revisao/${encodeURIComponent(reviewId)}`,
  alunoAssessment: (studentId) => `/alunos/${encodeURIComponent(studentId)}/assessment`,
  pendenciasRevisoes: '/pendencias/revisoes',
  pendenciasFeedback: '/pendencias/feedback',
  pendenciasFechamentos: '/pendencias/fechamentos',
  pendenciasAtencao: '/pendencias/atencao',
  assinaturas: '/assinaturas',
  configuracoes: '/configuracoes',
};

/** Aluno. */
export const STUDENT_PATHS = {
  painel: '/painel',
  feedback: '/feedback',
  revisoes: '/revisoes',
  ciclos: '/ciclos',
  relatorio: '/relatorio',
  mesaProp: '/mesa-prop',
  maturidade: '/maturidade',
  plano: (planId) => `/plano/${encodeURIComponent(planId)}`,
};

/** Compartilhadas entre os dois papéis. */
export const SHARED_PATHS = {
  contas: '/contas',
  trade: (tradeId) => `/trades/${encodeURIComponent(tradeId)}`,
  onboarding: '/onboarding',
};

/** Destino do login e do `/` — a única porta de cada papel. */
export const homePath = (isMentor) => (isMentor ? MENTOR_PATHS.torre : STUDENT_PATHS.painel);

export const PATHS = {
  ...PUBLIC_PATHS,
  ...MENTOR_PATHS,
  ...STUDENT_PATHS,
  ...SHARED_PATHS,
};

export default PATHS;
