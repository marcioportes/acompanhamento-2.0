/**
 * pageChrome.test.js — invariante de arquitetura de informação (issue #144, C1).
 *
 * Regra: o CONTAINER da página é do shell, e a tipografia do título é do
 * `PageHeader`. Página roteada não declara padding próprio nem `<h1>` solto.
 *
 * Sem essa cerca a drift volta sozinha: cada tela nova copia a anterior, e foi
 * assim que o app chegou a seis paddings (`p-6 lg:p-8`, `py-6 pb-32`, `p-6`,
 * `p-6 lg:p-8 pb-20`, ...) e seis tratamentos de `<h1>` convivendo — o topo
 * mudando de altura e de peso a cada navegação.
 *
 * Cerca de fonte (mesmo estilo de studentDashboardReferences.test.js): barata,
 * sem mount, e falha no lugar certo — o arquivo que reintroduziu a exceção.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.resolve(__dirname, '../../pages');

/**
 * Páginas montadas DENTRO de uma rota, portanto dentro do shell. As de fora
 * (login, e as que são montadas como sub-tela por outra página) seguem donas do
 * próprio container.
 */
const ROTEADAS = [
  'AccountsPage.jsx',
  'ClosuresPage.jsx',
  'FeedbackPage.jsx',
  'MentorDashboard.jsx',
  'PropFirmPage.jsx',
  'ReviewQueuePage.jsx',
  'SettingsPage.jsx',
  'StudentDashboard.jsx',
  'StudentOnboardingPage.jsx',
  'StudentReviewsPage.jsx',
  'StudentsManagement.jsx',
  'SubscriptionsPage.jsx',
  'TradeReportPage.jsx',
  'WeeklyReviewPage.jsx',
];

const ler = (arquivo) => fs.readFileSync(path.join(PAGES, arquivo), 'utf8');

describe('#144 C1 — o container da página é do AppShell', () => {
  it.each(ROTEADAS)('%s não declara padding de página', (arquivo) => {
    const src = ler(arquivo);
    // `min-h-screen p-*` era a assinatura do container próprio. Estado vazio usa
    // `min-h-[60vh]`, que não empilha altura com o shell.
    expect(src).not.toMatch(/min-h-screen\s+p[xy]?-\d/);
  });

  it.each(ROTEADAS)('%s não abre a página com um <h1> fora do PageHeader', (arquivo) => {
    const src = ler(arquivo);
    const h1s = src.match(/<h1[^>]*className="([^"]*)"/g) ?? [];
    // Sobra só o h1 de tela de barreira ("Acesso Negado", "Aluno não encontrado"),
    // que é bloco de erro e não cabeçalho de página.
    const titulosDePagina = h1s.filter((h) => /text-2xl lg:text-3xl|font-display font-bold text-white">\{/.test(h));
    expect(titulosDePagina).toEqual([]);
  });
});

describe('#144 C1 — o AppShell é quem paga o container', () => {
  const shell = fs.readFileSync(path.resolve(__dirname, '../../routes/AppShell.jsx'), 'utf8');

  it('declara padding, altura e o respiro do DebugBadge uma vez só', () => {
    expect(shell).toMatch(/min-h-screen px-6 lg:px-8 py-6 pb-20/);
  });
});
