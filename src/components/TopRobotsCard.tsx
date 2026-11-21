import { ChevronDown, ListFilter, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { RobotUnit } from '../types/fleet';

interface TopRobotsCardProps {
  robots: RobotUnit[];
  selectedRobotId: string;
  onSelectRobot: (id: string) => void;
}

function RobotThumbnail({ hasCargo }: { hasCargo: boolean }) {
  return (
    <div className="w-[38px] h-[29px] sm:w-[46px] sm:h-[34px] rounded-[9px] bg-[#f4f2ec] border border-[#e7e4dc] flex items-center justify-center shrink-0 overflow-hidden">
      <svg viewBox="0 0 64 44" className="w-8 h-6 sm:w-10 sm:h-7" aria-hidden="true">
        {/* Soft shadow */}
        <ellipse cx="32" cy="39" rx="22" ry="3.5" fill="rgba(0,0,0,0.12)" />
        {/* Wheels */}
        <rect x="12" y="29" width="7" height="9" rx="2" fill="#232524" />
        <rect x="45" y="29" width="7" height="9" rx="2" fill="#232524" />
        {/* Sage armor hull */}
        <rect x="13" y="20" width="38" height="14" rx="4" fill="#8b947c" />
        {/* Dark visor */}
        <rect x="19" y="22" width="26" height="8" rx="2" fill="#1b1c1b" />
        {/* Orange LED eyes */}
        <circle cx="27" cy="26" r="1.4" fill="#ff6a3d" />
        <circle cx="37" cy="26" r="1.4" fill="#ff6a3d" />
        {hasCargo ? (
          <>
            <rect x="16" y="17" width="32" height="3" rx="1" fill="#3a3c3a" />
            <rect x="18" y="8" width="13" height="9" rx="1" fill="#c8a47c" stroke="#a6835d" strokeWidth="0.6" />
            <rect x="33" y="8" width="13" height="9" rx="1" fill="#d1ae86" stroke="#a6835d" strokeWidth="0.6" />
          </>
        ) : (
          <rect x="17" y="18" width="30" height="2.5" rx="1" fill="#323432" />
        )}
      </svg>
    </div>
  );
}

function SegmentedGauge({
  value,
  accent,
}: {
  value: number;
  accent: 'orange' | 'green';
}) {
  const totalBars = 18;
  const activeBars = Math.round((value / 100) * totalBars);

  return (
    <div className="flex items-center gap-[2px]" aria-hidden="true">
      {Array.from({ length: totalBars }, (_, idx) => {
        const isLit = idx < activeBars;
        const t = idx / (totalBars - 1);
        let color = '#e5e6e1';
        if (isLit) {
          color =
            accent === 'orange'
              ? `rgba(241, 102, 65, ${1 - t * 0.68})`
              : `rgba(105, 148, 100, ${1 - t * 0.68})`;
        }
        return (
          <span
            key={idx}
            className="w-[2.5px] h-[11px] rounded-[1px]"
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}

export function TopRobotsCard({
  robots,
  selectedRobotId,
  onSelectRobot,
}: TopRobotsCardProps) {
  const [period, setPeriod] = useState<'Month' | 'Week'>('Month');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Picking'>('All');

  const filtered = robots
    .filter((r) => statusFilter === 'All' || r.status === statusFilter)
    .slice(0, 4);

  return (
    <section className="glass-surface-strong rounded-[24px] p-4 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#e6e7e2] flex items-center justify-center text-[#454843] shrink-0">
            <ListFilter className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-[14.5px] font-medium text-[#212422] truncate">
            Top Performing Robots
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
            title={`Filter: ${statusFilter}`}
            onClick={() =>
              setStatusFilter((f) =>
                f === 'All' ? 'Active' : f === 'Active' ? 'Picking' : 'All'
              )
            }
            className="w-8 h-8 rounded-full bg-[#f5f5f2] hover:bg-[#ecece7] flex items-center justify-center text-[#3a3d38] transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[144px] pr-0.5">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#ecece7] text-[11.5px] font-normal text-[#878a84]">
              <th className="pb-2 font-normal">Robot</th>
              <th className="pb-2 font-normal">Efficiency</th>
              <th className="pb-2 font-normal">Completed</th>
              <th className="pb-2 font-normal text-right pr-1">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2f2ee]">
            {filtered.map((robot) => {
              const isSelected = robot.id === selectedRobotId;
              const statusStyle =
                robot.status === 'Active'
                  ? 'bg-[#edf7ee] text-[#358a4b] border-[#d2ecd6]'
                  : robot.status === 'Picking'
                    ? 'bg-[#eef4fb] text-[#3b82c4] border-[#d3e3f5]'
                    : 'bg-[#fdf2e9] text-[#c76424] border-[#f4d6bc]';

              return (
                <tr
                  key={robot.id}
                  onClick={() => onSelectRobot(robot.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#faf8f3]' : 'hover:bg-[#f9f9f6]'
                  }`}
                >
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <RobotThumbnail hasCargo={robot.hasCargo} />
                      <div className="min-w-0">
                        <div className="text-[12px] sm:text-[12.5px] font-medium text-[#212422] leading-tight whitespace-nowrap">
                          {robot.id}
                        </div>
                        <div className="text-[10px] sm:text-[10.5px] text-[#8a8d87] leading-tight mt-0.5 whitespace-nowrap">
                          {robot.role}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] sm:text-[12.5px] font-medium text-[#212422] tabular-nums whitespace-nowrap">
                        {robot.efficiency}%
                      </span>
                      <div className="hidden lg:block">
                        <SegmentedGauge
                          value={robot.efficiency}
                          accent={robot.accentColor}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-2.5 pr-2">
                    <span className="text-[12px] sm:text-[12.5px] text-[#2b2e2b] tabular-nums whitespace-nowrap">
                      {period === 'Month'
                        ? robot.completedTasks
                        : Math.round(robot.completedTasks * 0.28)}{' '}
                      Tasks
                    </span>
                  </td>

                  <td className="py-2.5 text-right">
                    <span
                      className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-medium border whitespace-nowrap ${statusStyle}`}
                    >
                      {robot.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
