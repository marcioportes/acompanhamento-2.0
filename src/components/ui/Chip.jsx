/**
 * Chip — etiqueta de estado.
 *
 * Fundo neutro sempre; o significado entra num ponto de 5px. Numa lista de doze
 * alunos onde nove não estão "em dia", nove etiquetas coloridas empatam e a tela
 * volta a não ter foco. O ponto ordena sem gritar.
 *
 * `tom="perigo"` é a única exceção: além do ponto, tinge o texto. Reservado para
 * o que exige ato hoje.
 */
const COR = {
  neutro: 'var(--ink-3)',
  positivo: 'var(--pos)',
  atencao: 'var(--warn)',
  perigo: 'var(--neg)',
  info: 'var(--info)',
  apagado: 'var(--ink-4)',
};

const Chip = ({ children, tom = 'neutro', semPonto = false, className = '' }) => (
  <span className={`chip ${className}`} style={{ color: tom === 'perigo' ? 'var(--neg)' : 'var(--ink-2)' }}>
    {!semPonto && <span className="chip-dot" style={{ background: COR[tom] ?? COR.neutro }} />}
    {children}
  </span>
);

export default Chip;
