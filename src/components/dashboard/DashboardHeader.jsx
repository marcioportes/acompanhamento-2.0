/**
 * DashboardHeader
 * @version 2.0.0 (v1.41.0)
 * @description Header do StudentDashboard: título + botões de ação.
 *   v2.0.0: #164 review — remove AccountFilterBar (redundante com ContextBar #118,
 *           que é o seletor unificado de Conta/Plano/Ciclo/Período).
 *   v1.0.0: Extraído do StudentDashboard para modularização.
 */

import { PlusCircle, Filter, Upload } from 'lucide-react';
import DebugBadge from '../DebugBadge';
import PageHeader from '../ui/PageHeader';

/**
 * @param {Object} props
 * @param {Object|null} viewAs
 * @param {boolean} showFilters
 * @param {Function} onToggleFilters
 * @param {Function} onNewTrade
 * @param {Function} onCsvImport
 * @param {Function} onOrderImport
 */
const DashboardHeader = ({
  viewAs,
  showFilters,
  onToggleFilters,
  onNewTrade,
  onCsvImport,
  onOrderImport,
}) => {
  return (
    /* Três ações com três cores (âmbar, azul, verde) e um título de 30px: o topo
       gritava mais que o saldo do plano logo abaixo. Ação secundária é secundária
       — só "Novo Trade", que é o que o aluno vem fazer, guarda o acento. */
    <>
      <PageHeader
        titulo={viewAs ? `Dashboard de ${viewAs.name || viewAs.email}` : 'Meu Dashboard'}
        contexto={viewAs ? 'Visualização do mentor' : 'Acompanhe sua performance de trading'}
        acoes={(
          <>
            <button
              onClick={onToggleFilters}
              className="btn-secondary"
              style={showFilters ? { background: 'var(--surface-3)', color: 'var(--ink)' } : undefined}
            >
              <Filter className="w-3.5 h-3.5" strokeWidth={1.75} /> Filtros
            </button>
            {!viewAs && (
              <>
                <button data-acao="csv-import" onClick={onCsvImport} className="btn-secondary">
                  <Upload className="w-3.5 h-3.5" strokeWidth={1.75} /> Importar Performance
                </button>
                <button data-acao="order-import" onClick={onOrderImport} className="btn-secondary">
                  <Upload className="w-3.5 h-3.5" strokeWidth={1.75} /> Importar Ordens
                </button>
                <button data-acao="novo-trade" onClick={onNewTrade} className="btn-primary">
                  <PlusCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> Novo Trade
                </button>
              </>
            )}
          </>
        )}
      />
      <DebugBadge component="DashboardHeader" embedded />
    </>
  );
};

export default DashboardHeader;
