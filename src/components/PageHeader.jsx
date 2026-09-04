/**
 * PageHeader — o topo de toda página (issue #144, Fase C1)
 *
 * Antes, cada página declarava o seu: seis tratamentos diferentes de `<h1>`
 * conviviam (`text-2xl lg:text-3xl font-display font-bold`, `text-2xl font-bold`,
 * `text-xl font-semibold`, `text-lg font-bold`, ...) e seis paddings de container
 * (`p-6 lg:p-8`, `py-6 pb-32`, `p-6`, ...). O resultado era o topo mudando de
 * altura e de peso a cada navegação — a inconsistência que o olho lê como
 * "amador" sem conseguir nomear.
 *
 * O container mora no `AppShell`; a tipografia mora aqui. A página passa título,
 * uma linha de contexto e, quando tem, as ações do canto direito.
 */
const PageHeader = ({ titulo, linha = null, acoes = null, voltar = null }) => (
  <div className="mb-8">
    {voltar}
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">{titulo}</h1>
        {linha && <p className="text-slate-400 mt-1">{linha}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2 flex-wrap">{acoes}</div>}
    </div>
  </div>
);

export default PageHeader;
