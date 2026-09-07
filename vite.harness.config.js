/**
 * Config do harness visual (issue #427) — NUNCA usado em build de produção.
 *
 * `npm run build` roda com `vite.config.js`, que só enxerga `index.html`. A
 * garantia de que nada daqui vaza é estrutural, não uma flag que alguém esquece
 * de desligar. Um teste de invariante reforça o outro lado: nada fora de
 * `src/harness/` pode importar de lá.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const daRaiz = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Aliasar o SDK, e não os hooks, é o ponto central: `firebase.js`,
  // `AuthContext` e todos os hooks rodam REAIS. O que a foto mostra é o código
  // que vai para produção.
  resolve: {
    alias: {
      'firebase/app': daRaiz('./src/harness/fake/app.js'),
      'firebase/auth': daRaiz('./src/harness/fake/auth.js'),
      'firebase/firestore': daRaiz('./src/harness/fake/firestore.js'),
      'firebase/storage': daRaiz('./src/harness/fake/storage.js'),
      'firebase/functions': daRaiz('./src/harness/fake/functions.js'),
    },
  },
  optimizeDeps: { exclude: ['firebase'] },
  server: { port: 5310, strictPort: true },
});
