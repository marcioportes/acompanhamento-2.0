# TASK - Fase 1: Correção de Bugs Críticos

## Contexto
Você implementou o Sistema de Contas e Movimentações anteriormente. Durante os testes, identifiquei 4 bugs críticos que impedem o funcionamento correto do sistema financeiro. 

## Importante
O sistema ainda está em dev (PC) com a última atualização que enviou, preocupe-se com essa situação para que o versionamento seja feito corretamente no git.

---

## 🐛 Bug #1: Saldo Inicial Não Gera Movimentação

### O Problema
Quando crio uma conta com saldo inicial de R$ 10.000:
- A conta é criada corretamente
- O `initialBalance` e `currentBalance` mostram R$ 10.000
- MAS: O histórico de movimentações está vazio
- MAS: Os totais mostram "Total Depositado: R$ 0"

### O Que Deveria Acontecer
Ao criar uma conta com saldo inicial > 0, o sistema deveria automaticamente criar uma movimentação do tipo DEPOSIT com:
- Valor = saldo inicial da conta
- Descrição = "Saldo inicial da conta"
- Data = data de criação da conta
- Mesmos campos de identificação do aluno (studentId, studentEmail)

### Regra
- Se saldo inicial = 0, NÃO criar movimentação
- Se saldo inicial > 0, criar movimentação automática

---

## 🐛 Bug #2: Saldo Não Atualiza Após Trade

### O Problema
Quando executo um trade vinculado a uma conta:
- O trade é registrado corretamente
- O resultado do trade é calculado (ex: +R$ 500 ou -R$ 200)
- MAS: O `currentBalance` da conta não muda
- MAS: Não aparece no histórico de movimentações

### O Que Deveria Acontecer
Quando um trade é criado/editado/deletado:
- O resultado do trade (positivo ou negativo) deveria impactar o saldo da conta
- Deveria aparecer no histórico como entrada/saída relacionada ao trade
- O `currentBalance` deveria refletir: saldo inicial + movimentações + resultado dos trades

### Nota Importante
Você implementou Cloud Functions que fazem isso (`onTradeResultUpdated`). Verifique se:
- A Cloud Function está sendo disparada corretamente
- O `accountId` está sendo passado corretamente no trade
- A função está realmente atualizando o saldo

---

## 🐛 Bug #3: Nem Todas as Contas Aparecem (Aluno)

### O Problema
Quando faço login como aluno e tenho múltiplas contas:
- Algumas contas aparecem na lista
- Outras contas criadas não aparecem
- Não consigo identificar um padrão claro

### O Que Deveria Acontecer
Na tela de Contas (aluno logado):
- Todas as contas que eu criei devem aparecer
- Contas ativas e inativas devem aparecer (com indicação visual diferente)
- A lista deve estar ordenada (conta ativa primeiro, depois por data de criação)

### Possíveis Causas
- Query do Firestore pode estar filtrada incorretamente
- Pode ter problema com o índice (mas você já corrigiu isso)
- Pode ser problema de permissões no Firestore Rules

---

## 🐛 Bug #4: Conta Nova Demora para Aparecer no Dropdown de Trade

### O Problema
Fluxo que acontece:
1. Abro modal "Nova Conta"
2. Crio conta "Minha Conta Real" com saldo R$ 10.000
3. Fecho o modal (conta criada com sucesso)
4. Abro modal "Novo Trade"
5. No dropdown de contas: a conta nova NÃO aparece
6. Preciso fechar e abrir o modal novamente, ou recarregar a página

### O Que Deveria Acontecer
Quando crio uma nova conta:
- Ela deveria aparecer IMEDIATAMENTE no dropdown de seleção de conta do AddTradeModal
- Não deveria precisar recarregar nada
- O hook `useAccounts` já usa `onSnapshot` (tempo real), então deveria funcionar

### Possível Causa
O componente `AddTradeModal` ou `AccountSelector` pode não estar reagindo à atualização da lista de contas que vem do hook.

---

## 🎯 O Que Você Precisa Fazer

Corrija os 4 bugs acima. Para cada um:
1. Identifique a causa raiz
2. Implemente a correção
3. Garanta que não quebra nada que já funciona

## 📦 Formato de Entrega

Gere um ZIP com:
- Todos os arquivos modificados
- README.md explicando:
  - O que foi corrigido em cada bug
  - Se precisa rodar algum comando (ex: firebase deploy)
  - Como testar cada correção

---

## ⚠️ Importante

- Mantenha o padrão de código existente
- Use os hooks e Cloud Functions que já existem
- Se o problema for nas Cloud Functions, indique e forneça o código corrigido
- Teste mentalmente cada correção antes de gerar o código