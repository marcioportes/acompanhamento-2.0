/**
 * FeedbackRoute — `/trades/:tradeId` (issue #144, Fase A1/A2)
 *
 * O trade deixa de ser passado como OBJETO pelo App (`feedbackTrade`) e passa a
 * ser resolvido pelo id da URL contra a lista viva. Duas consequências:
 * o endereço do feedback é compartilhável, e o eco local que o App mantinha
 * depois de comentar (`setFeedbackTrade(prev => ...)`) deixa de existir — quem
 * atualiza a tela é o próprio snapshot.
 *
 * `allTrades` só é populado no modo mentor e `trades` no modo aluno; procurar
 * nos dois evita ramo por papel.
 */
import { useParams } from 'react-router-dom';
import FeedbackPage from '../../pages/FeedbackPage';
import Loading from '../../components/Loading';
import NaoEncontrado from './NaoEncontrado';
import { useAppData } from '../AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { useVoltar } from '../useVoltar';
import { homePath } from '../paths';

const FeedbackRoute = () => {
  const { tradeId } = useParams();
  const { isMentor } = useAuth();
  const {
    trades, allTrades, tradesLoading, plans,
    addFeedbackComment, updateTradeStatus, getPartials, uploadFeedbackImage,
  } = useAppData();
  const voltar = useVoltar(homePath(isMentor()));

  const trade = (allTrades?.length ? allTrades : trades)?.find((t) => t.id === tradeId);

  if (!trade && tradesLoading) return <Loading fullScreen text="Carregando trade..." />;
  if (!trade) return <NaoEncontrado titulo="Trade não encontrado" detalhe="O trade pode ter sido apagado." />;

  // Enriquece com o PL do plano para o cálculo de resultado % sobre PL.
  const plano = trade.planId ? plans.find((p) => p.id === trade.planId) : null;
  const enriquecido = plano ? { ...trade, _planPl: plano.pl } : trade;

  return (
    <FeedbackPage
      trade={enriquecido}
      onBack={voltar}
      onAddComment={addFeedbackComment}
      onUpdateStatus={updateTradeStatus}
      getPartials={getPartials}
      uploadFeedbackImage={uploadFeedbackImage}
    />
  );
};

export default FeedbackRoute;
