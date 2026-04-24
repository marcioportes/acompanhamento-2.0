# Protocolo — Encerramento de Sessão (§4.3 + Verificação Crítica §4.4)

> Protocolo obrigatório após PR mergeado. Inclui auto-arquivamento via `scripts/archive-issue.sh`.

### 4.3 Protocolo de Encerramento de Sessão

Ao final de cada sessão, antes de encerrar:

1. **Atualizar `docs/dev/issues/issue-NNN-nome.md`** com:
   - Resumo do que foi feito
   - Decisões tomadas (formato DEC-xxx)
   - Arquivos tocados
   - Comandos git executados
   - Testes rodados
   - Pendências para próxima sessão

2. **Atualizar este PROJECT.md** com:
   - Novas entradas no Decision Log (seção 7)
   - Novas/resolvidas dívidas técnicas (seção 9)
   - Entrada no CHANGELOG (seção 10)

3. **Commit dos docs** junto com o código:
   ```bash
   git add docs/PROJECT.md docs/dev/issues/issue-NNN-nome.md
   git commit -m "docs: atualizar PROJECT.md e issue-NNN sessão DD/MM/YYYY"
   ```

4. **Liberar locks de chunks desta sessão** no registry (seção 6.3) — liberar APENAS os locks registrados por esta sessão/issue. Nunca tocar em locks de outras sessões.

5. **Remover worktree** após merge confirmado (duas etapas — ambas obrigatórias, nenhuma pode ser omitida):
   ```bash
   git worktree remove ~/projects/issue-{NNN}           # desregistra do git
   rm -rf ~/projects/issue-{NNN}                        # remove diretório físico residual (cache .vite, node_modules stale, etc.)
   ```
   `git worktree remove` pode deixar o diretório físico intacto. O `rm -rf` é **sempre necessário** — não é opcional. Verificação obrigatória após ambos os comandos:
   ```bash
   ls ~/projects/                                        # issue-{NNN} NÃO deve aparecer
   git worktree list                                     # apenas main deve aparecer
   ```
   Se `issue-{NNN}` ainda aparecer no `ls`, o `rm -rf` não foi executado — executar agora.

6. **Mover issue file para archive** após merge confirmado — usar o script:
   ```
   scripts/archive-issue.sh NNN       # move issue-NNN-*.md para docs/dev/archive/YYYY-QQ/
   ```
   O script normaliza padding (119 / 0119), determina o quarter automaticamente e usa `git mv` (preserva histórico). Variante `scripts/archive-issue.sh --all-closed` arquiva de uma vez todos os issues cujo estado no GitHub é `CLOSED`.

### 4.4 Diretriz Crítica de Verificação

**Regra absoluta: toda afirmação verificável exige verificação prévia. Sem exceção.**

Aplica-se a QUALQUER conclusão sobre o estado do projeto, incluindo mas não limitado a:

- Fluxo de dados, origem de campos, estrutura de collections
- Estado de branches, PRs, merges, deploys
- Existência ou ausência de arquivos, funções, componentes, campos
- Interpretação de outputs de terminal (git, npm, firebase, logs)
- Interpretação de screenshots, erros, stack traces
- Estado de features (implementado, pendente, quebrado)
- Compatibilidade entre componentes, hooks, CFs

**Protocolo obrigatório (nesta ordem):**

1. Classificar: "estou prestes a afirmar algo verificável?" → Se sim, PARAR
2. Identificar a fonte de verdade (código, remote, Firestore, output direto)
3. Verificar com `grep` + `view` + `bash`, ou solicitar ao Marcio o comando de verificação quando não houver acesso direto
4. Cruzar com contexto existente (issue files, instruções de integração, PROJECT.md)
5. Só então concluir

**Se o Marcio colar um output de terminal, screenshot, ou log:**
- Tratar como dado bruto, não como fato confirmado
- Cruzar com pelo menos uma fonte adicional antes de afirmar
- Se houver ambiguidade, dizer "preciso confirmar — pode rodar `<comando>`?" em vez de assumir

**Nunca inferir. Se não verificou, não afirma. Se está incerto, diz "preciso verificar" e verifica. Não existe output trivial — todo dado verificável passa pelo protocolo.**

---

