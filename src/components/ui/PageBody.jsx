/**
 * PageBody — o respiro padrão do conteúdo, abaixo do PageHeader.
 *
 * Existe para que o recuo lateral e o ritmo vertical sejam UM número e não vinte
 * decisões independentes: hoje as páginas alternam entre `p-6`, `p-8`, `p-4` e
 * `px-6 py-8`, e a diferença aparece quando se navega entre elas.
 */
const PageBody = ({ children, className = '' }) => (
  <div className={`px-6 pt-5 pb-10 ${className}`}>{children}</div>
);

export default PageBody;
