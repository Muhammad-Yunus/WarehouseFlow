import { Maximize2, Minimize2, Minus, Plus, Rotate3d } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AmrOverviewCard } from './components/AmrOverviewCard';
import { ProductionOverviewCard } from './components/ProductionOverviewCard';
import { RobotActivityCard } from './components/RobotActivityCard';
import { SideRail } from './components/SideRail';
import { TopBar } from './components/TopBar';
import { TopRobotsCard } from './components/TopRobotsCard';
import { WarehouseCanvas, WarehouseCanvasHandle } from './components/WarehouseCanvas';
import { FLEET_ROBOTS, ZONE_METRICS } from './data/fleetData';
import { DateRangeOption, NavSection, ZoneOption } from './types/fleet';

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [zone, setZone] = useState<ZoneOption>('Warehouse A: Zone B');
  const [dateRange, setDateRange] = useState<DateRangeOption>('Today');
  const [selectedRobotId, setSelectedRobotId] = useState<string>('AMR-024');
  const [isLive, setIsLive] = useState(true);
  const [isExpanded3D, setIsExpanded3D] = useState(false);

  const warehouseRef = useRef<WarehouseCanvasHandle | null>(null);

  const metrics = ZONE_METRICS[zone][dateRange];

  const filteredRobots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FLEET_ROBOTS;
    return FLEET_ROBOTS.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const selectedRobot = useMemo(
    () => FLEET_ROBOTS.find((r) => r.id === selectedRobotId) ?? FLEET_ROBOTS[0],
    [selectedRobotId]
  );

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      zone,
      dateRange,
      metrics,
      fleet: FLEET_ROBOTS,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowos-${zone.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flowos-canvas-bg px-4 py-3.5 md:px-6 md:py-4 flex flex-col select-none">
      {/* Top Navigation & Filters */}
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        zone={zone}
        onZoneChange={setZone}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onExport={handleExport}
      />

      {/* Main 2-Column Asymmetric Workspace */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_318px] xl:grid-cols-[1fr_336px] gap-4">
        {/* Left + Center Viewport Column */}
        <div className="relative flex flex-col min-h-0">
          {/* Sub-Header: Title + Viewport Toolbar */}
          <div className="relative z-20 flex items-start justify-between gap-4 pl-1 pr-1 pt-0.5">
            <div>
              <h1 className="text-[34px] xl:text-[39px] font-light tracking-[-0.028em] text-[#1e201e] leading-[1.08]">
                Warehouse Operations
              </h1>
              <p className="text-[12.5px] font-normal text-[#666963] mt-1">
                Deadlines, tasks, and documents that need your attention
              </p>
            </div>

            {/* 3D Viewport Controls */}
            <div className="flex items-center gap-1.5 pt-1.5 shrink-0">
              <button
                type="button"
                onClick={() => warehouseRef.current?.resetCamera()}
                title="Reset 3D perspective"
                aria-label="Reset 3D perspective"
                className="glass-surface hover:bg-white/90 w-[34px] h-[34px] rounded-full flex items-center justify-center text-[#363935] transition-colors cursor-pointer"
              >
                <Rotate3d className="w-[15px] h-[15px]" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded3D((v) => !v)}
                title={isExpanded3D ? 'Restore split layout' : 'Expand 3D floorplan'}
                aria-label={isExpanded3D ? 'Restore split layout' : 'Expand 3D floorplan'}
                className="glass-surface hover:bg-white/90 w-[34px] h-[34px] rounded-full flex items-center justify-center text-[#363935] transition-colors cursor-pointer"
              >
                {isExpanded3D ? (
                  <Minimize2 className="w-[14px] h-[14px]" strokeWidth={1.75} />
                ) : (
                  <Maximize2 className="w-[14px] h-[14px]" strokeWidth={1.75} />
                )}
              </button>
              <button
                type="button"
                onClick={() => warehouseRef.current?.zoomIn()}
                title="Zoom in"
                aria-label="Zoom in"
                className="glass-surface hover:bg-white/90 w-[34px] h-[34px] rounded-full flex items-center justify-center text-[#363935] transition-colors cursor-pointer"
              >
                <Plus className="w-[15px] h-[15px]" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => warehouseRef.current?.zoomOut()}
                title="Zoom out"
                aria-label="Zoom out"
                className="glass-surface hover:bg-white/90 w-[34px] h-[34px] rounded-full flex items-center justify-center text-[#363935] transition-colors cursor-pointer"
              >
                <Minus className="w-[15px] h-[15px]" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => setIsLive((v) => !v)}
                title={isLive ? 'Pause live telemetry' : 'Resume live telemetry'}
                className="glass-surface hover:bg-white/90 h-[34px] px-3.5 rounded-full flex items-center gap-2 text-[12px] font-medium text-[#212422] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span
                  className={`w-[6px] h-[6px] rounded-full ${
                    isLive ? 'bg-[#42c465]' : 'bg-[#9ca098]'
                  }`}
                />
                <span>{isLive ? 'Live' : 'Paused'}</span>
              </button>
            </div>
          </div>

          {/* Interactive 3D Warehouse Floorplan + Floating Side Rail */}
          <div className="relative flex-1 min-h-0 -mt-3 -mb-7">
            <div className="absolute left-1 top-[24%] z-20">
              <SideRail
                activeSection={activeSection}
                onSelectSection={(sec) => {
                  setActiveSection(sec);
                  if (sec === 'dashboard') {
                    warehouseRef.current?.resetCamera();
                  }
                }}
              />
            </div>

            <WarehouseCanvas
              ref={warehouseRef}
              robots={FLEET_ROBOTS}
              selectedRobot={selectedRobot}
              isLive={isLive}
              onSelectRobot={setSelectedRobotId}
              onInspectRobot={(id) => {
                setSelectedRobotId(id);
                setIsExpanded3D(false);
              }}
            />
          </div>

          {/* Bottom Cards Row */}
          {!isExpanded3D && (
            <div className="relative z-20 grid grid-cols-1 md:grid-cols-[1.08fr_1fr] gap-3.5 shrink-0 pl-1">
              <TopRobotsCard
                robots={filteredRobots}
                selectedRobotId={selectedRobot.id}
                onSelectRobot={setSelectedRobotId}
              />
              <RobotActivityCard activeMissions={metrics.activeMissions} />
            </div>
          )}
        </div>

        {/* Right Telemetry & Hero Robot Column */}
        <div className="flex flex-col gap-3.5 min-h-0">
          <ProductionOverviewCard
            metrics={metrics}
            onExpand={() => setActiveSection('telemetry')}
          />
          <AmrOverviewCard robot={selectedRobot} />
        </div>
      </main>
    </div>
  );
}
