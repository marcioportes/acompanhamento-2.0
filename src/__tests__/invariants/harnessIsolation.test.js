/**
 * harnessIsolation.test.js — o harness visual não pode vazar para produção (issue #427).
 *
 * O isolamento já é estrutural: `npm run build` roda com `vite.config.js`, que
 * enxerga só `index.html`, e o alias dos cinco specifiers do Firebase mora
 * exclusivamente em `vite.harness.config.js`. Este teste fecha o outro lado —
 * o dia em que alguém importar `src/harness/` de dentro de um componente e o
 * bundle de produção levar junto um Firestore de mentira.
 *
 * Exceção declarada: a fixture (`src/__tests__/fixtures/mentor/`) importa
 * `FakeTimestamp` do store. É deliberado — uma fonte de dado só, servindo o
 * harness e os testes Vitest; duas fixtures divergiriam na primeira mudança de
 * schema. Fixture não entra em bundle.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RAIZ = path.resolve(SRC_DIR, '..');

/** Quem pode importar de `src/harness/`, por prefixo relativo a `src/`. */
const PERMITIDOS = ['harness/', '__tests__/fixtures/'];

const IMPORTA_HARNESS = /(?:from|import)\s*\(?\s*['"][^'"]*(?:^|[./])harness\/[^'"]*['"]/;

function varrer(dir) {
  const saida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === 'node_modules') continue;
      saida.push(...varrer(completo));
    } else if (/\.(jsx?|tsx?)$/.test(entrada.name)) {
      saida.push(completo);
    }
  }
  return saida;
}

describe('isolamento do harness visual (#427)', () => {
  it('nada fora de src/harness/ e das fixtures importa de src/harness/', () => {
    const infratores = varrer(SRC_DIR)
      .map((f) => path.relative(SRC_DIR, f).split(path.sep).join('/'))
      .filter((rel) => !PERMITIDOS.some((p) => rel.startsWith(p)))
      .filter((rel) => IMPORTA_HARNESS.test(fs.readFileSync(path.join(SRC_DIR, rel), 'utf8')));

    expect(infratores, `arquivo de produção importando o harness:\n${infratores.join('\n')}`).toEqual([]);
  });

  // O `manualChunks` do build cita 'firebase/*' legitimamente; o que não pode
  // aparecer é a palavra harness — alias, entrada ou input de rollup.
  it('o build de produção não conhece o harness', () => {
    const config = fs.readFileSync(path.join(RAIZ, 'vite.config.js'), 'utf8');
    expect(config).not.toMatch(/harness/);
  });

  it('o alias do harness cobre exatamente os cinco specifiers do SDK', () => {
    const config = fs.readFileSync(path.join(RAIZ, 'vite.harness.config.js'), 'utf8');
    for (const mod of ['app', 'auth', 'firestore', 'storage', 'functions']) {
      expect(config).toMatch(new RegExp(`'firebase/${mod}':`));
    }
  });
});
