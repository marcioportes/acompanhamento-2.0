/**
 * Catálogo das telas do mentor a fotografar (issue #427).
 *
 * `aba` usa `[data-tab]` e `menu` usa `[data-view]` — atributos adicionados
 * justamente para o roteiro sobreviver ao redesign. Seletor por texto quebraria
 * na primeira tela que mudasse de rótulo, que é o que este trabalho vai fazer.
 */
export const TELAS = [
  { id: 'torre',                cenario: 'cheio',  aba: 'torre' },
  { id: 'torre-vazia',          cenario: 'vazio',  aba: 'torre' },
  // A Torre abre na Agenda; a lista da turma é a segunda visão, e continua
  // sendo fotografada porque é ela que mostra quem está quieto.
  { id: 'turma',                cenario: 'cheio',  aba: 'torre', visao: 'turma' },
  { id: 'turma-vazia',          cenario: 'vazio',  aba: 'torre', visao: 'turma' },
  // Sem aba: com os listeners pendurados o MentorDashboard devolve <Loading/> e a
  // barra de abas nem existe. Clicar nela era esperar por um elemento que o
  // próprio estado impede de existir — o teste travava os 60s do timeout.
  { id: 'carregando',           cenario: 'cheio',  latencia: 99999, semEspera: true },
  { id: 'analises',             cenario: 'cheio',  aba: 'overview' },
  { id: 'alunos',               cenario: 'cheio',  aba: 'students' },
  { id: 'aguardando-feedback',  cenario: 'cheio',  aba: 'pending' },
  { id: 'aguardando-vazio',     cenario: 'vazio',  aba: 'pending' },
  { id: 'precisam-atencao',     cenario: 'cheio',  aba: 'attention' },
  { id: 'precisam-atencao-vazio', cenario: 'vazio', aba: 'attention' },
  { id: 'fechamentos',          cenario: 'cheio',  aba: 'closures' },
  { id: 'ficha-aluno',          cenario: 'cheio',  aba: 'torre', visao: 'turma', cliqueLinhaAluno: true },
  { id: 'fila-de-revisao',      cenario: 'cheio',  menu: 'reviews' },
  { id: 'acompanhamento',       cenario: 'cheio',  menu: 'students' },
  { id: 'contas-mentor',        cenario: 'cheio',  menu: 'accounts' },
  { id: 'assinaturas',          cenario: 'cheio',  menu: 'subscriptions' },

  // O lado do aluno. Mesma fixture, mesmo `hoje` — o que muda é o email
  // entregue no `onAuthStateChanged`, e daí em diante o AuthProvider real
  // decide tudo. Sem estas, metade do produto seguia sem foto.
  { id: 'aluno-pendencias',     cenario: 'cheio',  papel: 'aluno' },
  { id: 'aluno-dashboard',      cenario: 'cheio',  papel: 'aluno', fecharPendencias: true },
  { id: 'aluno-feedback',       cenario: 'cheio',  papel: 'aluno', fecharPendencias: true, menu: 'feedback' },
  { id: 'aluno-revisoes',       cenario: 'cheio',  papel: 'aluno', fecharPendencias: true, menu: 'student-reviews' },
  { id: 'aluno-ciclos',         cenario: 'cheio',  papel: 'aluno', fecharPendencias: true, menu: 'closures' },
  { id: 'aluno-relatorio',      cenario: 'cheio',  papel: 'aluno', fecharPendencias: true, menu: 'journal' },
  { id: 'aluno-contas',         cenario: 'cheio',  papel: 'aluno', fecharPendencias: true, menu: 'accounts' },
];
