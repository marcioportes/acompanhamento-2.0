/**
 * StatTile — número que decide alguma coisa.
 *
 * Escala 28 / 13 / 11: valor, rótulo, detalhe. O padrão antigo pulava de 30px
 * para 9px em caixa alta espremida — sem degrau no meio, o rótulo virava textura
 * e o tile deixava de dizer o que media.
 *
 * A cor vive num ponto de 5px, nunca no fundo. Quatro tiles com fundo colorido
 * lado a lado competem entre si e nenhum vence.
 */
const COR = {
  neutro: null,
  positivo: 'var(--pos)',
  negativo: 'var(--neg)',
  atencao: 'var(--warn)',
  info: 'var(--info)',
};

const StatTile = ({
  icone: Icone = null,
  valor,
  sufixo = null,
  rotulo,
  detalhe = null,
  tom = 'neutro',
  ativo = false,
  onClick = null,
  title = null,
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick ?? undefined}
      title={title || undefined}
      /* Âncora de teste: seletor por tag (`<p>`) quebra a cada mudança de
         markup, que é exatamente o que um face lift faz. */
      data-tile={rotulo}
      className={`text-left px-4 py-3.5 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: ativo ? 'var(--surface-2)' : 'var(--surface)',
        border: `1px solid ${ativo ? 'var(--accent-line)' : 'var(--line)'}`,
        borderRadius: 'var(--r)',
      }}
    >
      <div className="flex items-center gap-1.5">
        {Icone && <Icone className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} style={{ color: 'var(--ink-4)' }} />}
        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--ink-3)' }}>{rotulo}</span>
        {COR[tom] && <span className="w-[5px] h-[5px] rounded-full ml-auto flex-shrink-0" style={{ background: COR[tom] }} />}
      </div>

      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="text-[28px] font-semibold leading-none tabular" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {valor}
        </span>
        {sufixo && <span className="text-[13px]" style={{ color: 'var(--ink-4)' }}>{sufixo}</span>}
      </div>

      {detalhe && <div className="text-[11px] mt-1.5 truncate" style={{ color: 'var(--ink-4)' }}>{detalhe}</div>}
    </Tag>
  );
};

export default StatTile;
