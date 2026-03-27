# Issue NNN — Título do Issue
> **Branch:** `feature/issue-NNN-descricao`  
> **Milestone:** v1.x.0 — Nome do Milestone  
> **Aberto em:** DD/MM/YYYY  
> **Status:** 🟡 Em andamento | ✅ Encerrado  
> **PR:** #NNN (quando encerrado)

---

## 1. SPEC

> O que este issue implementa. Copiado/adaptado do GitHub issue.

### Contexto
_Por que essa feature/fix é necessária._

### Comportamento esperado
_O que deve funcionar ao final._

### Acceptance criteria
- [ ] Critério 1
- [ ] Critério 2

### Arquivos envolvidos (estimativa inicial)
- `src/...`
- `functions/...`

### Chunks necessários
- CHUNK-XX: check-out em DD/MM/YYYY

### Deltas de shared files previstos
_Listar aqui antes de iniciar para coordenação com sessões paralelas._
- `src/App.jsx`: adicionar rota X
- `functions/index.js`: exportar CF Y
- `firestore.rules`: regra para collection Z

---

## 2. SESSÕES

---

### Sessão — DD/MM/YYYY

**Contexto de entrada:**  
_Estado do repo ao iniciar. Versão, branch, o que estava pendente._

**O que foi feito:**
- Item 1
- Item 2

**Decisões tomadas:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| DEC-NNN | Descrição | Motivo |

> ⚠️ Copiar estas entradas para a seção 7 do PROJECT.md ao encerrar a sessão.

**Arquivos tocados:**
```
src/components/X.jsx          — descrição da mudança
src/hooks/useY.js             — descrição da mudança
functions/assessment/Z.js     — descrição da mudança
```

**Comandos git executados:**
```powershell
git add ...
git commit -m "feat: descrição (issue #NNN)"
git push origin feature/issue-NNN-descricao
```

**Testes rodados:**
```powershell
npm test
# Resultado: X suites, Y testes, Z passando
```

**ZIPs entregues:**
- `nome-do-zip-vX.Y.Z.zip` — o que contém

**Dívidas técnicas identificadas:**

| ID | Descrição | Prioridade |
|----|-----------|-----------|
| DT-NNN | Descrição | ALTA/MÉDIA/BAIXA |

> ⚠️ Copiar estas entradas para a seção 9 do PROJECT.md ao encerrar a sessão.

**Deltas de shared files desta sessão:**

```javascript
// src/App.jsx — adicionar após linha X:
import NovoComponente from './components/NovoComponente';
// ...rota nova:
{ path: '/nova-rota', element: <NovoComponente /> }

// functions/index.js — adicionar:
exports.novaFunction = require('./assessment/novaFunction');

// src/version.js — bump para:
version: 'X.Y.Z', build: 'YYYYMMDD'
```

**Pendências para próxima sessão:**
- [ ] Item pendente 1
- [ ] Item pendente 2

---

<!-- Repetir bloco "### Sessão" para cada sessão adicional neste issue -->

---

## 3. ENCERRAMENTO

> Preencher quando o PR for mergeado.

**Data de encerramento:** DD/MM/YYYY  
**PR:** #NNN  
**Versão final:** vX.Y.Z  
**Commits incluídos:**
```
hash1 — mensagem
hash2 — mensagem
```

**Checklist final:**
- [ ] Todos os acceptance criteria atendidos
- [ ] Testes passando (npm test)
- [ ] PROJECT.md atualizado (DEC, DT, CHANGELOG)
- [ ] CHANGELOG entry adicionada ao PROJECT.md seção 10
- [ ] Chunks liberados no PROJECT.md seção 6.3
- [ ] Issue fechado no GitHub
- [ ] Branch deletada

**Lições aprendidas / notas para próximas sessões:**
_Opcional — registrar apenas se houver algo relevante que não se encaixa em DEC ou DT._
