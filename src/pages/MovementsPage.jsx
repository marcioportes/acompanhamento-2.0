import { useState, useCallback } from 'react';
import { 
  ArrowDownCircle,
  ArrowUpCircle,
  PlusCircle
} from 'lucide-react';
import { useMovements } from '../hooks/useMovements';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import MovementsList from '../components/MovementsList';
import AddMovementModal from '../components/AddMovementModal';
import Loading from '../components/Loading';

const MovementsPage = () => {
  const { user, isMentor } = useAuth();
  const { accounts, loading: accountsLoading } = useAccounts();
  const { 
    movements, 
    loading: movementsLoading, 
    error,
    addMovement, 
    deleteMovement 
  } = useMovements();

  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handler para adicionar movimentação
  const handleSubmit = useCallback(async (movementData) => {
    setIsSubmitting(true);
    try {
      await addMovement(movementData);
      setShowAddModal(false);
    } catch (err) {
      console.error('Erro ao criar movimentação:', err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [addMovement]);

  // Handler para deletar movimentação
  const handleDelete = useCallback(async (movement) => {
    try {
      await deleteMovement(movement.id);
    } catch (err) {
      console.error('Erro ao deletar movimentação:', err);
    }
  }, [deleteMovement]);

  const loading = accountsLoading || movementsLoading;

  if (loading) {
    return <Loading text="Carregando movimentações..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Erro ao carregar movimentações
          </h3>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">
            Movimentações
          </h1>
          <p className="text-slate-500 mt-1">
            Gerencie depósitos e saques das suas contas
          </p>
        </div>
        
        {!isMentor() && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Nova Movimentação
            </button>
          </div>
        )}
      </div>

      {/* Aviso se não tem contas */}
      {accounts.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
            <ArrowDownCircle className="w-10 h-10 text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Nenhuma conta cadastrada
          </h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Você precisa criar uma conta de trading antes de registrar movimentações.
          </p>
        </div>
      ) : (
        <MovementsList
          movements={movements}
          accounts={accounts}
          onDelete={!isMentor() ? handleDelete : undefined}
          showStudent={isMentor()}
        />
      )}

      {/* Modal de Adicionar */}
      <AddMovementModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleSubmit}
        loading={isSubmitting}
      />
    </div>
  );
};

export default MovementsPage;
