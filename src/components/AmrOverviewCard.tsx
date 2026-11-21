import { Bot, Zap } from 'lucide-react';
import { RobotUnit } from '../types/fleet';
import { AmrHeroCanvas } from './AmrHeroCanvas';

interface AmrOverviewCardProps {
  robot: RobotUnit;
}

export function AmrOverviewCard({ robot }: AmrOverviewCardProps) {
  // 5 discrete battery cells
  const filledCells = Math.max(1, Math.min(5, Math.round((robot.batteryHealth / 100) * 5)));

  // 6 vertical bars matching the staggered rising coral profile in the reference
  const barHeights = [
    Math.max(22, Math.round(robot.taskCompletion * 0.42)),
    Math.max(28, Math.round(robot.taskCompletion * 0.56)),
    Math.max(36, Math.round(robot.taskCompletion * 0.78)),
    Math.max(30, Math.round(robot.taskCompletion * 0.65)),
    Math.max(42, Math.round(robot.taskCompletion * 0.96)),
    Math.max(38, Math.round(robot.taskCompletion * 0.85)),
  ];

  return (
    <section className="bg-white/95 rounded-[28px] border border-white shadow-[0_12px_34px_rgba(24,28,22,0.055)] p-4.5 flex flex-col justify-between flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-full bg-[#ededeb] flex items-center justify-center text-[#3d403b] shrink-0">
          <Bot className="w-3.5 h-3.5" />
        </div>
        <h2 className="text-[14px] font-medium tracking-[-0.01em] text-[#212422] whitespace-nowrap">
          {robot.id} Overview
        </h2>
      </div>

      {/* 3D AMR Studio Viewport */}
      <div className="relative h-[220px] sm:h-[250px] xl:h-auto xl:flex-1 xl:min-h-[170px] w-full my-1">
        <AmrHeroCanvas hasCargo={robot.hasCargo} accentColor={robot.accentColor} />
      </div>

      {/* Bottom 2 Gradient Metric Tiles */}
      <div className="grid grid-cols-2 gap-2.5 shrink-0">
        {/* Battery Health */}
        <div className="battery-tile-bg rounded-[20px] p-3 text-white">
          <div className="text-[11px] font-medium text-white/95">Battery Health</div>
          <div className="font-dots text-[27px] leading-tight text-white mt-0.5 mb-2">
            {robot.batteryHealth}%
          </div>

          <div className="flex items-center">
            <div className="flex-1 h-[34px] rounded-[10px] border border-white/65 bg-white/15 p-[3px] flex items-center gap-[3px]">
              {Array.from({ length: 5 }, (_, idx) => {
                const filled = idx < filledCells;
                const isLastFilled = idx === filledCells - 1;
                return (
                  <div
                    key={idx}
                    className="flex-1 h-full rounded-[6px] flex items-center justify-center transition-all"
                    style={{
                      background: filled
                        ? 'linear-gradient(180deg, #98ef9f 0%, #44c564 100%)'
                        : 'rgba(255, 255, 255, 0.16)',
                      boxShadow: filled ? '0 1px 4px rgba(34, 139, 64, 0.28)' : 'none',
                    }}
                  >
                    {isLastFilled && (
                      <Zap className="w-3 h-3 text-white fill-white" strokeWidth={1.8} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="w-[3.5px] h-[14px] rounded-r-[3px] bg-white/65 ml-[2px]" />
          </div>
        </div>

        {/* Task Completion */}
        <div className="completion-tile-bg rounded-[20px] p-3 text-white">
          <div className="text-[11px] font-medium text-white/95">Task Completion</div>
          <div className="font-dots text-[27px] leading-tight text-white mt-0.5 mb-2">
            {robot.taskCompletion}%
          </div>

          <div className="flex items-end gap-[5px] h-[34px] pt-1">
            {barHeights.map((pct, idx) => (
              <div
                key={idx}
                className="flex-1 h-full rounded-[5px] bg-white/20 border border-white/30 overflow-hidden flex items-end"
              >
                <div
                  className="w-full rounded-[4px] transition-all duration-300"
                  style={{
                    height: `${Math.min(100, pct)}%`,
                    background: 'linear-gradient(180deg, #f88966 0%, #ef542b 100%)',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
