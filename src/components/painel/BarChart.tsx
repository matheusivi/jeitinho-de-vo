/**
 * Gráfico de barras de uma série, desenhado no servidor em SVG.
 * Cor única validada (contraste e croma) contra o fundo branco do cartão; grade discreta;
 * cada barra tem uma área de toque maior que ela e um tooltip nativo com o valor exato.
 */
export const CHART_COLOR = "#008a9c";

type Bar = { label: string; value: number; tooltip: string; tick?: boolean };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function BarChart({
  bars, title, formatValue, height = 220,
}: { bars: Bar[]; title: string; formatValue: (v: number) => string; height?: number }) {
  const W = 760;
  const H = height;
  const pad = { top: 12, right: 8, bottom: 28, left: 72 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...bars.map((b) => b.value)));
  const slot = innerW / Math.max(1, bars.length);
  const gap = 2;
  const barW = Math.max(2, Math.min(28, slot - gap));
  const y = (v: number) => pad.top + innerH - (Math.max(0, v) / max) * innerH;
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const r = Math.min(4, barW / 2);

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} style={{ display: "block", maxWidth: "100%" }} className="pn-chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#e7e1d2" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={12} fill="var(--ink-muted)">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const x = cx - barW / 2;
          const top = y(b.value);
          const base = pad.top + innerH;
          const h = base - top;
          return (
            <g key={i} className="pn-bar">
              <title>{b.tooltip}</title>
              <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill="transparent" />
              {b.value > 0 && (
                <path
                  d={h > r
                    ? `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`
                    : `M${x},${base} V${top} H${x + barW} V${base} Z`}
                  fill={CHART_COLOR}
                />
              )}
              {b.tick && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--ink-muted)">{b.label}</text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="#b9b09a" strokeWidth={1} />
      </svg>
      <figcaption className="sr-only">{title}. Os valores de cada barra estão na tabela abaixo.</figcaption>
    </figure>
  );
}
