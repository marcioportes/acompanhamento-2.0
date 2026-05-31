/**
 * EspelhoLogo
 * @version 1.0.0
 * @description Marca do produto "Espelho do Trader" — porte JSX da identidade pública
 *   do portal (marcioportes-portal/app/components/EspelhoLogo.tsx). Símbolo ‹|› —
 *   duas chevrons espelhadas em torno de um eixo central tracejado — em paleta teal.
 *
 *   - <EspelhoMark/>   → símbolo ‹|› isolado (header/sidebar/favicon). Cor via SVG (teal).
 *   - <EspelhoLockup/> → lockup «‹|› Espelho» com reflexo esmaecido (hero/decoração).
 *     font-size herdado do pai (símbolo em `em`, escala junto).
 *
 * Tokens canônicos: mark primário #2dd4bf (teal-400), secundário #5eead4 (teal-300).
 */

/** Símbolo isolado ‹|› — sidebar / login / favicon. Escala pela className do pai. */
export function EspelhoMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <path d="M26 16 L14 32 L26 48" stroke="#2dd4bf" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="32" y1="20" x2="32" y2="44" stroke="#2dd4bf" strokeWidth="3" strokeDasharray="3 4.5" opacity="0.55" />
      <path d="M38 16 L50 32 L38 48" stroke="#5eead4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

/** Símbolo ‹|› em currentColor — escala pelo font-size (h em `em`), pro lockup. */
function MarkCluster() {
  return (
    <svg viewBox="0 0 44 48" fill="none" aria-hidden="true" className="h-[0.82em] w-auto flex-shrink-0">
      <path d="M18 8 L8 24 L18 40" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="22" y1="12" x2="22" y2="36" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3.5" opacity="0.55" />
      <path d="M26 8 L36 24 L26 40" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Uma linha do lockup. `reflection`: símbolo herda currentColor (fade uniforme). */
function Row({ reflection }) {
  return (
    <span className="inline-flex items-center gap-[0.3em] font-extrabold tracking-tight leading-none">
      <span className={reflection ? undefined : 'text-teal-400'}>
        <MarkCluster />
      </span>
      <span>Espelho</span>
    </span>
  );
}

/** Lockup «‹|› Espelho» com reflexo. font-size vem do pai. */
export function EspelhoLockup({ className }) {
  return (
    <span className={`inline-flex flex-col items-center ${className ?? ''}`}>
      <Row />
      <span
        aria-hidden="true"
        className="text-teal-300/35 select-none mt-[0.04em]"
        style={{
          transform: 'scaleY(-1)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 68%)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 68%)',
        }}
      >
        <Row reflection />
      </span>
    </span>
  );
}

export default EspelhoLockup;
