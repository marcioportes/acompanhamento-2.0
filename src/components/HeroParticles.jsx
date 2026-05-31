import { useEffect, useRef } from 'react';

/**
 * HeroParticles
 * @version 1.0.0
 * @description Canvas de partículas teal atrás do hero — porte JSX de
 *   marcioportes-portal/app/components/HeroParticles.tsx. ~70 pontos
 *   rgba(45,212,191,0.7) com drift lento + linhas conectando pares
 *   próximos (dist < 110px). Desativado em mobile/pointer coarse.
 *
 *   Renderiza absolute inset-0; o pai deve ser `relative overflow-hidden`.
 */
export default function HeroParticles() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    if (isMobile) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let particles = [];
    let rafId = 0;

    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      w = canvas.width = rect.width;
      h = canvas.height = rect.height;
    }

    function spawn() {
      particles = [];
      const count = Math.min(70, Math.floor((w * h) / 22000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          r: Math.random() * 1.4 + 0.4,
        });
      }
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(45, 212, 191, 0.7)';
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(45, 212, 191, ${0.12 * (1 - dist / 110)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    resize();
    spawn();
    tick();

    const handleResize = () => {
      resize();
      spawn();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none opacity-70 hidden lg:block"
      style={{ zIndex: 0 }}
    />
  );
}
