/**
 * App.jsx — providers e nada mais (issue #144, Fase A1)
 *
 * Era um God Component de 562 linhas: navegação por string (`currentView`), oito
 * estados de contexto de retorno, o guard de assessment, os badges do menu, o
 * modo "ver como aluno" e um `renderContent` com toda a árvore de telas.
 *
 * Hoje:
 *   AuthProvider > ToastProvider > AppRoutes > (guards) > AppShell > rota
 *
 * O que era estado virou endereço (`src/routes/paths.js`), o que era casca virou
 * `AppShell`, e o que era `if (currentView === ...)` virou tabela de rotas.
 * O `BrowserRouter` fica em `main.jsx` para que os testes possam montar o App
 * dentro de um `MemoryRouter`.
 */
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import AppRoutes from './routes/AppRoutes';

const App = () => (
  <AuthProvider>
    <ToastProvider>
      <AppRoutes />
    </ToastProvider>
  </AuthProvider>
);

export default App;
