import { BarChart3, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { ACTIVITY_COLUMNS } from '../data/fleetData';

interface RobotActivityCardProps {
  activeMissions: number;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function RobotActivityCard({ activeMissions }: RobotActivityCardProps) {
  const [period, setPeriod] = useState<'Month' | 'Week'>('Month');
  const defaultHighlight =
    ACTIVITY_COLUMNS.find((c) => c.highlighted)?.id ?? 17;
  const [activeColId, setActiveColId] = useState<number>(defaultHighlight);

  const activeCol =
    ACTIVITY_COLUMNS.find((c) => c.id === activeColId) ??
    ACTIVITY_COLUMNS[defaultHighlight];

  // Calculate horizontal tooltip offset based on active column index (0..37)
  const tooltipLeftPct = Math.min(72, Math.max(8, (activeCol.id / (ACTIVITY_COLUMNS.length - 1)) * 100 + 3));

  return (
    <section className="glass-surface-strong rounded-[24px] p-4 flex flex-col justify-between min-w-0 relative">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#e6e7e2] flex items-center justify-center text-[#454843] shrink-0">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-[14.5px] font-medium text-[#212422] truncate">
            Robot Activity
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setPeriod((p) => (p === 'Month' ? 'Week' : 'Month'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5f5f2] hover:bg-[#ecece7] text-[11.5px] font-medium text-[#2c2f2c] transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>{period}</span>
            <ChevronDown className="w-3 h-3 text-[#656862]" />
          </button>
          <button
            type="button"
            onClick={() => setActiveColId(defaultHighlight)}
            title="Reset peak focus"
            className="w-8 h-8 rounded-full bg-[#f5f5f2] hover:bg-[#ecece7] flex items-center justify-center text-[#3a3d38] transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Big Dot-Matrix Stat */}
      <div className="flex items-baseline gap-2.5 mt-2 mb-1">
        <span className="font-dots text-[32px] leading-none text-[#1f2120]">
          {period === 'Month' ? activeMissions : Math.round(activeMissions * 0.34)}
        </span>
        <span className="text-[14px] text-[#3a3d38] font-normal">
          Active Missions
        </span>
      </div>

      {/* Dot-Matrix Histogram Chart */}
      <div className="relative pt-7 pb-1">
        {/* Floating Tooltip Card */}
        <div
          style={{ left: `${tooltipLeftPct}%` }}
          className="absolute top-0 z-10 pointer-events-none transition-all duration-150"
        >
          <div className="rounded-2xl bg-white border border-[#f0efe9] shadow-[0_12px_28px_rgba(24,28,22,0.09)] px-3.5 py-2 min-w-[114px]">
            <div className="text-[10.5px] text-[#8a8d87] leading-tight">
              {activeCol.dateLabel}
            </div>
            <div className="text-[13.5px] font-semibold text-[#1f2120] leading-tight mt-0.5 tabular-nums">
              {activeCol.missions} Missions
            </div>
            <div className="text-[10.5px] text-[#5e625c] leading-tight mt-0.5 tabular-nums">
              {activeCol.delta}
            </div>
          </div>
        </div>

        {/* Columns of dots */}
        <div className="flex items-end justify-between gap-[2.5px] h-[94px]">
          {ACTIVITY_COLUMNS.map((col) => {
            const isThuPeakZone = col.day === 'Thu';
            const isSelected = col.id === activeCol.id;

            return (
              <button
                key={col.id}
                type="button"
                onMouseEnter={() => setActiveColId(col.id)}
                onClick={() => setActiveColId(col.id)}
                aria-label={`${col.day} ${col.dateLabel}: ${col.missions} missions`}
                className="flex flex-col-reverse items-center gap-[3px] flex-1 h-full justify-start cursor-pointer group focus:outline-none"
              >
                {Array.from({ length: col.dots }, (_, dotIdx) => {
                  const isTop = dotIdx === col.dots - 1;
                  const ratio = dotIdx / Math.max(1, col.dots - 1);

                  let dotColor = `rgba(92, 95, 90, ${0.42 + (1 - ratio) * 0.45})`;
                  if (isThuPeakZone || isSelected) {
                    dotColor = `rgba(239, 86, 44, ${0.72 + (1 - ratio) * 0.28})`;
                  }

                  if (isSelected && isTop) {
                    return (
                      <span
                        key={dotIdx}
                        className="w-[7px] h-[7px] rounded-full border-2 border-[#ef562c] bg-white shadow-sm shrink-0"
                      />
                    );
                  }

                  return (
                    <span
                      key={dotIdx}
                      className="w-[4px] h-[4px] rounded-full transition-transform group-hover:scale-125 shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                  );
                })}
              </button>
            );
          })}
        </div>

        {/* X-Axis Labels */}
        <div className="grid grid-cols-7 text-center mt-2">
          {DAYS.map((day) => (
            <span
              key={day}
              className={`text-[11px] ${
                activeCol.day === day
                  ? 'text-[#212422] font-medium'
                  : 'text-[#6e716b] font-normal'
              }`}
            >
              {day}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
