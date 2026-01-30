import { useState, useCallback } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import AccountsList from '../components/AccountsList';
import AddAccountModal from '../components/AddAccountModal';
import Loading from '../components/Loading';

const AccountsPage = () => {
  const { user, isMentor } = useAuth();
  const { 
    accounts, 
    loading, 
    error,
    addAccount, 
    updateAccount, 
    deleteAccount,
    getAccountsByStudent
  } = useAccounts();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handler para adicionar/editar conta
  const handleSubmit = useCallback(async (accountData, accountId) => {
    setIsSubmitting(true);
    try {
      if (accountId) {
        // Editando conta existente
        await updateAccount(accountId, accountData);
      } else {
        // Criando nova conta
        await addAccount(accountData);
      }
      setShowAddModal(false);
      setEditingAccount(null);
    } catch (err) {
      console.error('Erro ao salvar conta:', err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [addAccount, updateAccount]);

  // Handler para deletar conta
  const handleDelete = useCallback(async (account) => {
    try {
      await deleteAccount(account.id);
    } catch (err) {
      console.error('Erro ao deletar conta:', err);
    }
  }, [deleteAccount]);

  // Handler para definir conta como ativa
  const handleSetActive = useCallback(async (account) => {
    try {
      // Primeiro, desativar todas as outras contas do mesmo usuário
      const userAccounts = accounts.filter(acc => acc.studentId === account.studentId);
      
      for (const acc of userAccounts) {
        if (acc.id !== account.id && acc.active) {
          await updateAccount(acc.id, { active: false });
        }
      }
      
      // Ativar a conta selecionada
      await updateAccount(account.id, { active: true });
    } catch (err) {
      console.error('Erro ao definir conta ativa:', err);
    }
  }, [accounts, updateAccount]);

  // Handler para abrir modal de edição
  const handleEdit = useCallback((account) => {
    setEditingAccount(account);
    setShowAddModal(true);
  }, []);

  // Handler para abrir modal de nova conta
  const handleAddNew = useCallback(() => {
    setEditingAccount(null);
    setShowAddModal(true);
  }, []);

  // Handler para fechar modal
  const handleCloseModal = useCallback(() => {
    setShowAddModal(false);
    setEditingAccount(null);
  }, []);

  if (loading) {
    return <Loading text="Carregando contas..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Erro ao carregar contas
          </h3>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <AccountsList
        accounts={accounts}
        onAddAccount={handleAddNew}
        onEditAccount={handleEdit}
        onDeleteAccount={handleDelete}
        onSetActiveAccount={handleSetActive}
        showStudent={isMentor()}
        loading={loading}
      />

      {/* Modal de Adicionar/Editar */}
      <AddAccountModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        editAccount={editingAccount}
        loading={isSubmitting}
      />
    </div>
  );
};

export default AccountsPage;
