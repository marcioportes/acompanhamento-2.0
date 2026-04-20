/**
 * studentDashboardReferences.test.js — regressão SEV1 issue #162.
 *
 * Em 20/04/2026 o merge do PR #160 (#102 v1.38.0) deixou uma referência à
 * variável `assessmentStudentId` em `src/pages/StudentDashboard.jsx` sem que
 * o identificador estivesse declarado no escopo de `StudentDashboardBody`.
 * Resultado: `ReferenceError: assessmentStudentId is not defined` no render
 * do dashboard do aluno em produção — plataforma fora do ar.
 *
 * Este teste é uma cerca anti-regressão cirúrgica: falha se o mesmo
 * identificador reaparecer em `StudentDashboard.jsx`. Não substitui lint
 * `no-undef`; serve de guarda explícita enquanto `npm run lint` não é
 * obrigatório no CI.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STUDENT_DASHBOARD = path.resolve(
  __dirname,
  '../../pages/StudentDashboard.jsx',
);

describe('StudentDashboard.jsx — identificadores não declarados (#162)', () => {
  it('não referencia `assessmentStudentId` (fix SEV1 v1.38.1)', () => {
    const src = fs.readFileSync(STUDENT_DASHBOARD, 'utf8');
    const hits = src.match(/\bassessmentStudentId\b/g) || [];
    expect(hits).toEqual([]);
  });
});
