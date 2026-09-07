/**
 * Entrada do harness visual (issue #427)
 *
 * Monta o `<App/>` REAL. Isso é deliberado: a casca, o menu e a barra de abas
 * são parte do que vai ser redesenhado, e um shell próprio de harness seria a
 * primeira coisa a divergir da produção — divergindo exatamente naquilo que se
 * quer olhar.
 *
 * O que troca de lugar é só o SDK do Firebase, por `resolve.alias` em
 * `vite.harness.config.js`. Nenhum arquivo de produção sabe que isto existe.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App.jsx';
import '../index.css';
import { semearTudo, setLatencia, lerCollection } from './store';
import { buildMentorDataset } from '../__tests__/fixtures/mentor';
import { definirUsuario } from './fake/auth';

const params = new URLSearchParams(window.location.search);
const cenario = params.get('cenario') ?? 'cheio';
const hoje = params.get('hoje') ?? '2026-09-03';
const latencia = Number(params.get('latencia') ?? 0);
// `?papel=aluno` fotografa o outro lado do produto. `?aluno=<id>` escolhe qual;
// sem ele, entra o primeiro da fixture, que é o aluno com dado mais denso.
const papel = params.get('papel') ?? 'mentor';

setLatencia(latencia);
semearTudo(buildMentorDataset({ hoje, cenario }));

if (papel === 'aluno') {
  const alunos = lerCollection('students');
  const escolhido = params.get('aluno')
    ? alunos.find((a) => a.id === params.get('aluno') || a.email === params.get('aluno'))
    : alunos[0];
  if (escolhido) {
    definirUsuario({ uid: escolhido.id, email: escolhido.email, displayName: escolhido.name });
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Sinal para o Playwright: a árvore montou. O `waitForSelector` de cada tela
// ainda é necessário — este só diz que o React chegou.
requestAnimationFrame(() => {
  requestAnimationFrame(() => { window.__HARNESS_READY__ = true; });
});
