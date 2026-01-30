# [Bug] Saldo Inicial da Conta Não Gera Movimentação

## 🐛 Descrição do Problema

Quando uma conta é criada com saldo inicial maior que zero, o sistema não registra essa entrada como uma movimentação do tipo DEPOSIT.

Isso causa inconsistência:
- O `currentBalance` mostra o valor correto
- Mas o histórico de movimentações não mostra de onde veio esse dinheiro
- Os totais consolidados ficam incorretos

## ✅ Comportamento Esperado

Ao criar uma conta com saldo inicial de R$ 10.000:

1. **Conta criada** com `initialBalance = 10000` e `currentBalance = 10000`
2. **Movimentação automática criada:**
   - Tipo: `DEPOSIT`
   - Valor: `10000`
   - Conta: `[id da conta]`
   - Data: `[data de criação da conta]`
   - Descrição: `"Saldo inicial da conta"`
   - `createdAt`: `[timestamp da criação]`

3. **Histórico de movimentações mostra:**
   - Total Depositado: R$ 10.000
   - Total Retirado: R$ 0
   - Saldo Líquido: R$ 10.000

## 🔧 Onde Corrigir

**Arquivo:** `src/hooks/useAccounts.js`

**Função:** `addAccount(accountData)`

**Lógica:**
```
1. Criar conta no Firestore
2. SE initialBalance > 0 ENTÃO:
   3. Criar movimentação automática:
      - type: 'DEPOSIT'
      - amount: initialBalance
      - accountId: [id da conta criada]
      - date: [data de criação]
      - description: 'Saldo inicial da conta'
      - studentId: [id do aluno]
      - studentEmail: [email do aluno]
4. Retornar sucesso
```

## 📋 Validações

- Se `initialBalance = 0`, NÃO criar movimentação
- Movimentação deve ter mesmo `createdAt` da conta
- Movimentação deve respeitar as mesmas regras de permissão (aluno cria, mentor vê)

## 🎯 Critérios de Aceitação

- [ ] Criar conta com saldo inicial R$ 10.000
- [ ] Verificar que movimentação foi criada automaticamente
- [ ] Histórico mostra "Saldo inicial da conta"
- [ ] Total Depositado = R$ 10.000
- [ ] Saldo atual = Saldo inicial = Total Depositado
- [ ] Criar conta com saldo inicial R$ 0 NÃO cria movimentação

## 🏷️ Labels
`bug`, `accounts`, `movements`, `high-priority`

## 📅 Prioridade
**Alta** - Afeta consistência dos dados financeiros