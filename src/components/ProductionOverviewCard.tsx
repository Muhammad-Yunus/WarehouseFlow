import { Activity, ArrowUpRight } from 'lucide-react';
import { ZoneMetrics } from '../types/fleet';

interface ProductionOverviewCardProps {
  metrics: ZoneMetrics;
  onExpand?: () => void;
}

export function ProductionOverviewCard({ metrics, onExpand }: ProductionOverviewCardProps) {
  const totalTicks = 52;
  const activeTicks = Math.round((metrics.efficiency / 100) * totalTicks);

  // Arc from -198 deg to +18 deg (total 216 deg)
  const startDeg = -198;
  const sweepDeg = 216;
  const cx = 130;
  const cy = 114;
  const innerR = 78;
  const outerR = 94;

  const ticks = Array.from({ length: totalTicks }, (_, i) => {
    const angleDeg = startDeg + (i / (totalTicks - 1)) * sweepDeg;
    const rad = (angleDeg * Math.PI) / 180;
    const x1 = cx + innerR * Math.cos(rad);
    const y1 = cy + innerR * Math.sin(rad);
    const x2 = cx + outerR * Math.cos(rad);
    const y2 = cy + outerR * Math.sin(rad);
    const isLit = i < activeTicks;
    return { x1, y1, x2, y2, isLit, key: i };
  });

  return (
    <section className="production-card-bg rounded-[28px] p-4.5 text-white flex flex-col justify-between relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-white/18 border border-white/25 flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <h2 className="text-[14px] font-normal tracking-[-0.01em] text-white/95 whitespace-nowrap">
            Production Overview
          </h2>
        </div>

        <button
          type="button"
          onClick={onExpand}
          aria-label="Production details"
          className="w-7 h-7 rounded-full bg-white/18 hover:bg-white/28 border border-white/25 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

      {/* Semi-circular Radial Tick Gauge */}
      <div className="relative flex flex-col items-center justify-center my-1">
        <svg viewBox="0 0 260 154" className="w-full max-w-[260px] h-auto overflow-visible">
          {ticks.map((t) => (
            <line
              key={t.key}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isLit ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.28)'}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pt-5">
          <span className="font-dots text-[42px] leading-none text-white tracking-tight">
            {metrics.efficiency}%
          </span>
          <span className="text-[11px] font-normal text-white/85 mt-1.5 tracking-wide">
            Efficiency
          </span>
        </div>
      </div>

      {/* Bottom 3 Frosted Metric Pods */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[18px] bg-white/14 border border-white/22 px-3 py-2.5">
          <div className="text-[10.5px] text-white/85 whitespace-nowrap">Robots</div>
          <div className="font-dots text-[22px] leading-tight text-white mt-1.5">
            {metrics.robots.toLocaleString()}
          </div>
        </div>
        <div className="rounded-[18px] bg-white/14 border border-white/22 px-3 py-2.5">
          <div className="text-[10.5px] text-white/85 whitespace-nowrap">Tasks</div>
          <div className="font-dots text-[22px] leading-tight text-white mt-1.5">
            {metrics.tasks.toLocaleString()}
          </div>
        </div>
        <div className="rounded-[18px] bg-white/14 border border-white/22 px-3 py-2.5">
          <div className="text-[10.5px] text-white/85 whitespace-nowrap">On Time</div>
          <div className="font-dots text-[22px] leading-tight text-white mt-1.5">
            {metrics.onTime}%
          </div>
        </div>
      </div>
    </section>
  );
}
