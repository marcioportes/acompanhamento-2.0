import { createContext, useContext, useMemo } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import { useSetups } from '../hooks/useSetups';
import { usePlans } from '../hooks/usePlans';
import { useMovements } from '../hooks/useMovements';
import { useNotifications } from '../hooks/useNotifications';
import { useMasterData } from '../hooks/useMasterData';

/**
 * Context que centraliza todos os dados do sistema
 */
const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
  // Hooks de dados
  const accounts = useAccounts();
  const setups = useSetups();
  const plans = usePlans();
  const movements = useMovements();
  const notifications = useNotifications();
  const masterData = useMasterData();

  // Verificar se está carregando algum dado
  const isLoading = useMemo(() => (
    accounts.loading ||
    setups.loading ||
    plans.loading ||
    movements.loading ||
    notifications.loading ||
    masterData.loading
  ), [
    accounts.loading,
    setups.loading,
    plans.loading,
    movements.loading,
    notifications.loading,
    masterData.loading
  ]);

  // Agregar erros
  const errors = useMemo(() => {
    const errs = [];
    if (accounts.error) errs.push({ source: 'accounts', message: accounts.error });
    if (setups.error) errs.push({ source: 'setups', message: setups.error });
    if (plans.error) errs.push({ source: 'plans', message: plans.error });
    if (movements.error) errs.push({ source: 'movements', message: movements.error });
    if (notifications.error) errs.push({ source: 'notifications', message: notifications.error });
    if (masterData.error) errs.push({ source: 'masterData', message: masterData.error });
    return errs;
  }, [
    accounts.error,
    setups.error,
    plans.error,
    movements.error,
    notifications.error,
    masterData.error
  ]);

  const value = {
    // Estados de loading/error
    isLoading,
    errors,
    hasErrors: errors.length > 0,

    // Contas
    accounts: accounts.accounts,
    accountsLoading: accounts.loading,
    addAccount: accounts.addAccount,
    updateAccount: accounts.updateAccount,
    deleteAccount: accounts.deleteAccount,
    getAccountsByStudent: accounts.getAccountsByStudent,
    getActiveAccount: accounts.getActiveAccount,

    // Setups
    setups: setups.setups,
    setupsLoading: setups.loading,
    addSetup: setups.addSetup,
    updateSetup: setups.updateSetup,
    deleteSetup: setups.deleteSetup,
    getSetupById: setups.getSetupById,
    getGlobalSetups: setups.getGlobalSetups,
    getUserSetups: setups.getUserSetups,

    // Planos
    plans: plans.plans,
    plansLoading: plans.loading,
    addPlan: plans.addPlan,
    updatePlan: plans.updatePlan,
    deletePlan: plans.deletePlan,
    getPlansByStudent: plans.getPlansByStudent,
    getActivePlans: plans.getActivePlans,
    getPlanBySetup: plans.getPlanBySetup,
    getPlanById: plans.getPlanById,
    validateTradeAgainstPlan: plans.validateTradeAgainstPlan,

    // Movimentações
    movements: movements.movements,
    movementsLoading: movements.loading,
    addMovement: movements.addMovement,
    updateMovement: movements.updateMovement,
    deleteMovement: movements.deleteMovement,
    getMovementsByAccount: movements.getMovementsByAccount,
    getAccountTotals: movements.getAccountTotals,

    // Notificações
    notifications: notifications.notifications,
    notificationsLoading: notifications.loading,
    unreadCount: notifications.unreadCount,
    markAsRead: notifications.markAsRead,
    markAllAsRead: notifications.markAllAsRead,
    deleteNotification: notifications.deleteNotification,
    getUnreadNotifications: notifications.getUnreadNotifications,

    // Dados Mestres
    currencies: masterData.currencies,
    brokers: masterData.brokers,
    tickers: masterData.tickers,
    exchanges: masterData.exchanges,
    emotions: masterData.emotions,
    masterDataLoading: masterData.loading,
    getCurrencyByCode: masterData.getCurrencyByCode,
    getBrokerById: masterData.getBrokerById,
    getTickerBySymbol: masterData.getTickerBySymbol,
    getExchangeByCode: masterData.getExchangeByCode,
    getEmotionById: masterData.getEmotionById,
    getTickersByExchange: masterData.getTickersByExchange,
    getEmotionsByCategory: masterData.getEmotionsByCategory,
    getNegativeEmotions: masterData.getNegativeEmotions
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

/**
 * Hook para acessar o DataContext
 */
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData deve ser usado dentro de um DataProvider');
  }
  return context;
};

export default DataContext;
