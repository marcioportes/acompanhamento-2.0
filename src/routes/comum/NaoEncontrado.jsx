/**
 * NaoEncontrado — rota inexistente ou registro que não existe (issue #144, A1)
 *
 * Endereço errado não vira tela de erro: o mentor volta pra Torre e o aluno pro
 * painel, que é a única porta de cada papel.
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { homePath } from '../paths';

const NaoEncontrado = ({ titulo = 'Página não encontrada', detalhe = null }) => {
  const { isMentor } = useAuth();
  const destino = homePath(isMentor());

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="glass-card p-8 text-center max-w-md">
        <h1 className="text-xl font-display font-bold text-white">{titulo}</h1>
        {detalhe && <p className="text-sm text-slate-400 mt-2">{detalhe}</p>}
        <Link to={destino} className="btn-primary inline-block mt-6">
          {isMentor() ? 'Ir para a Torre' : 'Ir para o painel'}
        </Link>
      </div>
    </div>
  );
};

export default NaoEncontrado;
