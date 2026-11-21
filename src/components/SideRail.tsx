import { AlertTriangle, Box, LayoutGrid, Radio, SlidersVertical } from 'lucide-react';
import { NavSection } from '../types/fleet';

interface SideRailProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

const RAIL_ITEMS: Array<{
  id: NavSection;
  label: string;
  Icon: typeof LayoutGrid;
}> = [
  { id: 'dashboard', label: 'Operations Overview', Icon: LayoutGrid },
  { id: 'inventory', label: 'Storage & Cargo', Icon: Box },
  { id: 'telemetry', label: 'Live Telemetry', Icon: Radio },
  { id: 'controls', label: 'Routing Controls', Icon: SlidersVertical },
  { id: 'alerts', label: 'Fleet Alerts', Icon: AlertTriangle },
];

export function SideRail({ activeSection, onSelectSection }: SideRailProps) {
  return (
    <aside
      aria-label="Workspace navigation"
      className="glass-surface flex flex-col items-center gap-2 rounded-full p-1.5 w-[50px] shrink-0"
    >
      {RAIL_ITEMS.map(({ id, label, Icon }) => {
        const isActive = activeSection === id;
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => onSelectSection(id)}
            className={`w-[38px] h-[38px] rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
              isActive
                ? 'bg-gradient-to-br from-[#ff6a42] to-[#eb4e27] text-white shadow-[0_6px_16px_rgba(235,78,39,0.34)]'
                : 'text-[#484b45] hover:bg-white/75 hover:text-[#1f2120]'
            }`}
          >
            <Icon className="w-[17px] h-[17px]" strokeWidth={1.85} />
          </button>
        );
      })}
    </aside>
  );
}
