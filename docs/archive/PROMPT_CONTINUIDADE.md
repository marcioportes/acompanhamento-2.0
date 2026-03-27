# PROMPT DE CONTINUIDADE - Acompanhamento 2.0

## 🎯 CONTEXTO DO PROJETO

**Projeto:** Acompanhamento 2.0 - Trading Journal e Mentorship Platform  
**Stack:** React 18 + Vite + Firebase/Firestore + Tailwind CSS  
**Repositório:** marcioportes/acompanhamento-2.0

---

## 🏷 GOVERNANÇA DE VERSIONAMENTO (SemVer)

**REGRA ABSOLUTA:** O sistema possui UMA ÚNICA versão global controlada em `src/version.js`.

### Proibido
- Versão individual por componente/arquivo (`@version X.X.X` no header)
- Versionamento isolado de hook, serviço ou módulo interno
- Versões divergentes dentro do mesmo deploy

### Headers de arquivo
- **NÃO usar** `@version X.X.X`
- **USAR** `@see version.js para versão do produto`
- **CHANGELOG** no header referencia a versão do PRODUTO em que a mudança entrou

### Exemplo de header correto
```javascript
/**
 * NomeDoComponente
 * @description Descrição do componente
 * @see version.js para versão do produto
 * 
 * CHANGELOG:
 * - 1.4.0: Descrição da mudança
 * - 1.3.0: Descrição da mudança anterior
 */
```

### Incremento de versão
- **MAJOR (X.0.0):** Breaking changes, mudança incompatível
- **MINOR (1.X.0):** Nova feature, nova tela, novo módulo
- **PATCH (1.4.X):** Bug fix, ajuste visual, refatoração interna

### DebugBadge (OBRIGATÓRIO em toda tela/página)
Componente: `src/components/DebugBadge.jsx`
Exibe no canto inferior direito: `NomeDaPagina • vX.Y.Z+BUILD`

**Uso:**
```jsx
import DebugBadge from '../components/DebugBadge';

// No final do JSX da página, antes do fechamento do div raiz:
<DebugBadge component="NomeDaPagina" />
```

**Regra:** Toda tela/página nova ou modificada DEVE incluir o DebugBadge.

---

## 📋 VERSÕES EM PRODUÇÃO (20/02/2026)

**IMPORTANTE:** Antes de modificar qualquer arquivo, peça ao usuário para enviar o arquivo atual em produção para comparar versões e evitar regressões.

**Versão do Produto:** `1.4.0` (ver `src/version.js`)

| Arquivo | Localização | DebugBadge |
|---------|-------------|------------|
| `App.jsx` | `src/` | N/A (não é tela) |
| `StudentFeedbackPage.jsx` | `src/pages/` | ✅ |
| `FeedbackPage.jsx` | `src/pages/` | ⏳ Pendente |
| `StudentDashboard.jsx` | `src/pages/` | ⏳ Pendente |
| `TradesJournal.jsx` | `src/pages/` | ⏳ Pendente |
| `MentorDashboard.jsx` | `src/pages/` | ⏳ Pendente |
| `DebugBadge.jsx` | `src/components/` | N/A (é o badge) |
| `version.js` | `src/` | N/A (SSOT de versão) |

---

## ✅ FUNCIONALIDADES IMPLEMENTADAS E APROVADAS

### Sistema de Feedback (Máquina de Estados)
```
OPEN → Mentor dá feedback → REVIEWED
REVIEWED → Aluno encerra (com ou sem comentário) → CLOSED
REVIEWED → Aluno envia dúvida → QUESTION
QUESTION → Mentor responde → REVIEWED
```

### UX Aprovada

**Aluno em trade REVIEWED:**
- 2 botões lado a lado:
  - "Encerrar Trade" (verde) - funciona com ou sem texto
  - "Enviar Dúvida" (amarelo) - requer texto

**Mentor em trade OPEN ou QUESTION:**
- Botão "Enviar Feedback" ou "Responder Dúvida"

**TradeDetailModal:**
- Botão "Ver conversa completa" quando há feedback
- Trata corretamente Timestamps do Firebase (seconds/nanoseconds)

**TradesJournal:**
- Passa `onNavigateToFeedback` para permitir ver conversas

---

## 🐛 BUGS CONHECIDOS RESOLVIDOS

1. **Timestamp como React child** - formatDate agora trata objetos Firebase `{seconds, nanoseconds}`
2. **Login ia para Feedback** - currentView sempre inicia como 'dashboard'
3. **Primeiro comentário do mentor sumia** - Lógica de merge corrigida
4. **Aluno podia comentar sem ação** - Agora só tem 2 botões: Encerrar ou Dúvida

---

## ⚠️ REGRAS DE SEGURANÇA PARA O ASSISTENTE

1. **SEMPRE peça o arquivo em produção** antes de modificar, para comparar e evitar regressões
2. **Versão ÚNICA do produto** em `src/version.js` - NUNCA versione componentes individualmente
3. **Não sobrescreva funcionalidades aprovadas** - verifique o que já existe
4. **Incremente versão do PRODUTO em version.js:**
   - PATCH (x.x.1): bug fixes
   - MINOR (x.1.0): novas features retrocompatíveis
   - MAJOR (1.0.0): breaking changes
5. **DebugBadge obrigatório** em toda tela/página nova ou modificada
6. **Headers sem @version** - use `@see version.js` e CHANGELOG referenciando versão do produto

---

## 📁 ESTRUTURA DE ARQUIVOS RELEVANTES

```
src/
├── App.jsx                    # Roteamento e estado global
├── contexts/
│   └── AuthContext.jsx        # Autenticação e isMentor()
├── hooks/
│   └── useTrades.js           # CRUD + Sistema de Feedback
├── pages/
│   ├── FeedbackPage.jsx       # Tela de chat mentor/aluno
│   ├── StudentFeedbackPage.jsx # Lista de trades do aluno
│   ├── TradesJournal.jsx      # Diário de trades
│   └── MentorDashboard.jsx    # Dashboard do mentor
└── components/
    └── TradeDetailModal.jsx   # Modal de visualização de trade
```

---

## 🔄 COMO CONTINUAR

1. Usuário descreve o problema ou feature
2. Assistente pede arquivo em produção se for modificação
3. Assistente compara versão em produção com versão documentada
4. Assistente faz a modificação preservando funcionalidades existentes
5. Assistente incrementa versão e documenta no CHANGELOG
6. Assistente entrega arquivo completo para deploy

---

## 📝 PENDÊNCIAS CONHECIDAS

- [ ] Sistema Emocional v2.0 - Fase 1.3.1 (especificação completa existe)
- [ ] Verificar se campo `notes` aparece em todos os contextos
- [ ] Embed FeedbackPage dentro do StudentFeedbackPage (commit pendente)
- [ ] Adicionar DebugBadge nas telas: FeedbackPage, StudentDashboard, TradesJournal, MentorDashboard
- [ ] Documentar governança em `/docs/governance/versioning.md`

---

**Última atualização:** 20/02/2026 - Produto v1.4.0
