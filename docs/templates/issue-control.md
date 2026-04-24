# Issue #NNN — tipo: Título descritivo

> **Template enxuto (R4).** Máximo 400 linhas. Excedente vira anexo separado (`issue-NNN-anexo-*.md`).
> **Proibido:** CHANGELOG draft, reprodução de rationale (mora em `docs/decisions.md`), análise de impacto reescrita (mora em `docs/protocols/opening.md`), narrativa de sessão.

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Regra — construção do documento de controle com Marcio:**

1. **Discussão em nível de negócio** — o máximo possível. Marcio não é consultado sobre escolha técnica (arquitetura, nome de arquivo, padrão de teste) **a menos que ele pergunte**. Apresentar negócio (o que o usuário vê/faz, o que o sistema garante) e derivar técnico sozinho.
2. **Mockup SEMPRE** — toda tela nova ou modificação de UI apresenta mockup visual/textual (campos, layout, fluxo de navegação, estados) antes de qualquer código. Aplica também para fluxos de interação (eventos de click, efeitos visíveis, mensagens de erro). INV-18 (Spec Review Gate) operacionalizado em mockup.
3. **Memória de Cálculo SEMPRE** — toda feature que envolva cálculo, score, agregação, regra de negócio numérica, ou decisão condicional apresenta a **memória de cálculo** antes do código: fórmulas, fontes de dados (qual collection, qual campo), pesos, fallbacks, casos limites (zero trades, stage inicial, aluno legado, múltiplos planos). A memória é negociada em bloco com o mockup — se o cálculo for óbvio de um one-liner é só 2 linhas; se tem composição (ex.: 4D × pesos × gates), é seção detalhada com exemplo numérico. Objetivo: detectar gaps semânticos antes de virar bug (ex.: baseline ignorado, unidade errada, campo lido de path errado).
4. **Exceção de mockup / memória** — só se Marcio autorizar explicitamente ("pode pular mockup", "sem memória, vai direto"). Pedido da exceção é sempre explícito: "quer pular o mockup desta?" / "a memória aqui é trivial, posso pular?". Nunca presumir.
5. **Autorização escrita** — após mockup + memória revisados, Marcio escreve "autorizado", "aprovado", "go", ou equivalente inequívoco no chat/documento. Sem isso, o documento de controle é **RASCUNHO** e o Gate Pré-Código **não pode ser iniciado**.

**Status atual do documento:**
- [ ] Mockup apresentado (ou exceção autorizada por Marcio)
- [ ] Memória de cálculo apresentada (ou exceção autorizada por Marcio)
- [ ] Marcio autorizou (data + frase)
- [ ] Gate Pré-Código liberado

## Context
_(5–10 linhas — problema + objetivo, não repita o body do issue)_

## Spec
Ver issue body no GitHub: #NNN. _(Link, não duplicar.)_

## Mockup
_(obrigatório para UI nova ou modificação — exceção só com autorização explícita do Marcio.
Formato: descrição textual da tela com campos, layout, fluxo de navegação, estados, mensagens.
Para backend/CF: schema JSON com input/output. Para lógica: cenário em linguagem natural.
Ver INV-18 para detalhamento por tipo.)_

## Memória de Cálculo
_(obrigatória quando há fórmula, score, agregação, regra condicional ou composição — exceção
só com autorização explícita. Deve declarar explicitamente:
- **Inputs**: quais collections/campos são lidos (path completo), tipos, valores default.
- **Fórmula**: equação ou pseudocódigo com pesos/thresholds nomeados.
- **Baseline**: se há estado inicial (ex.: assessment, marco zero), qual é e como é combinado.
- **Casos limites**: zero amostras, aluno legado, múltiplos planos, campo ausente, fallback.
- **Exemplo numérico**: 1 cenário concreto (valores reais) rodando a fórmula de ponta a ponta.
Objetivo: detectar gaps semânticos antes de virar bug — ex.: "baseline não está sendo lido",
"unidade errada", "campo no path errado", "o que acontece se o aluno tem 2 planos ativos?".)_

## Phases
_(lista linear das fases acordadas — uma por linha)_
- A1 — ...
- A2 — ...
- B1 — ...

## Sessions
_(log linear; 1 linha por task)_
- `task NN [slug] commit <sha> ok`
- `task NN [slug] commit <sha> fail — <motivo em 1 linha>`

## Shared Deltas
_(diffs propostos para o integrador aplicar no MAIN após o merge)_
- `docs/PROJECT.md` — _(o que muda)_
- `src/version.js` — bump vX.Y.Z
- `docs/registry/versions.md` — marcar vX.Y.Z consumida
- `docs/registry/chunks.md` — liberar CHUNK-NN
- `CHANGELOG.md` — nova entrada `[X.Y.Z] - DD/MM/YYYY`

## Decisions
_(apenas IDs — texto mora em `docs/decisions.md`)_
- DEC-AUTO-NNN-01
- DEC-AUTO-NNN-02

## Chunks
- CHUNK-NN (escrita) — _(motivo)_
- CHUNK-NN (leitura) — _(motivo)_
