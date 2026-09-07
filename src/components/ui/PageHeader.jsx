/**
 * PageHeader — a barra de identificação de tela.
 *
 * Uma barra de 56px, fixa no topo, com o nome da tela em 15px e o contexto ao
 * lado. Antes cada página abria com um título de 30-40px e um subtítulo embaixo:
 * ~120px da primeira dobra gastos para dizer em que tela você já sabia que estava,
 * empurrando para baixo justamente o que exigia decisão.
 *
 * A altura casa com a do bloco da marca no Sidebar, para que o topo da barra e o
 * topo do menu fiquem na mesma linha.
 *
 * `acoes` é o canto direito — o botão primário da tela mora aqui, não solto no
 * meio do conteúdo.
 */
const PageHeader = ({ titulo, contexto = null, acoes = null, icone: Icone = null }) => (
  <header
    className="sticky top-0 z-30 min-h-14 flex items-center gap-3 px-6 py-2"
    style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}
  >
    {Icone && <Icone className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} style={{ color: 'var(--ink-3)' }} />}
    <h1 className="text-[15px] font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{titulo}</h1>
    {contexto && <span className="meta truncate">{contexto}</span>}
    {acoes && <div className="ml-auto flex items-center gap-2 flex-shrink-0">{acoes}</div>}
  </header>
);

export default PageHeader;
