Prompt para Opus 4.5 - Correções e Sistema de Movimentações
Olá! Você implementou o Sistema de Contas para mim anteriormente. Testei e encontrei problemas + features que faltam.
🐛 Problemas Encontrados
Problema 1: Erro ao Carregar Contas (Aluno)
Quando faço login como aluno, aparece erro:
Erro ao carregar contas
The query requires an index
O Firestore está reclamando que falta um índice composto para a query de contas.

Problema 2: Trade Não Está Vinculado à Conta
Quando crio um trade pelo AddTradeModal, não consigo selecionar em qual conta esse trade está sendo executado. O campo accountId não existe no formulário, mas deveria existir porque:

Cada trade precisa estar vinculado a uma conta
O saldo da conta precisa ser atualizado quando o trade acontece
As Cloud Functions já esperam receber accountId nos trades


✨ Feature Faltando: Sistema de Movimentações
O que é
Alunos precisam poder registrar quando:

Fazem um depósito (colocam dinheiro na conta)
Fazem um saque (retiram dinheiro da conta)

Como funciona no sistema

Cada movimentação tem: tipo (DEPOSIT/WITHDRAWAL), valor, conta, data, descrição
O useMovements hook já existe e funciona
As Cloud Functions já atualizam o saldo automaticamente quando uma movimentação é criada
Mentor vê movimentações de todos; aluno vê só as suas

O que precisa existir

Modal para criar movimentação - Aluno escolhe tipo, valor, conta, descrição
Lista de movimentações - Visualizar histórico de aportes/saques
Página de movimentações - Gerenciar tudo em um lugar
Integração no menu - Item "Movimentações" no Sidebar
Ação rápida - Botão no card de conta para adicionar movimentação

Regras

Movimentações não podem ser editadas (só deletadas)
Ao deletar, o saldo volta automaticamente
Deve mostrar totais: quanto depositou, quanto sacou, saldo líquido


🎯 O que Você Precisa Fazer
Corrija os 2 problemas e implemente o sistema de movimentações completo.
Use os mesmos padrões visuais e arquiteturais que você usou no sistema de contas. O hook useMovements já existe e funciona - apenas crie a interface.
Entregue os arquivos completos prontos para instalar.