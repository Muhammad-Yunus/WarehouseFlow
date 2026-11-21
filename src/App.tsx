import { Maximize2, Minimize2, Minus, Plus, Rotate3d } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AmrOverviewCard } from './components/AmrOverviewCard';
import { ProductionOverviewCard } from './components/ProductionOverviewCard';
import { RobotActivityCard } from './components/RobotActivityCard';
import { SideRail } from './components/SideRail';
import { TopBar } from './components/TopBar';
import { TopRobotsCard } from './components/TopRobotsCard';
import { WarehouseCanvas, WarehouseCanvasHandle } from './components/WarehouseCanvas';
import {
  ActivityColumn,
  AuthSetupStatus,
  AuthUser,
  DateRangeOption,
  FleetAlert,
  NavSection,
  RobotUnit,
  ZoneMetrics,
  ZoneOption,
} from './types/fleet';

const EMPTY_METRICS: ZoneMetrics = {
  efficiency: 0,
  robots: 0,
  tasks: 0,
  onTime: 0,
  activeMissions: 0,
};

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [zone, setZone] = useState<ZoneOption>('Warehouse A: Zone B');
  const [dateRange, setDateRange] = useState<DateRangeOption>('Today');
  const [selectedRobotId, setSelectedRobotId] = useState<string>('AMR-024');
  const [isLive, setIsLive] = useState(true);
  const [isExpanded3D, setIsExpanded3D] = useState(false);

  // Live backend-driven dashboard state (100% hydrated from PostgreSQL via /api/dashboard)
  const [robots, setRobots] = useState<RobotUnit[]>([]);
  const [metrics, setMetrics] = useState<ZoneMetrics>(EMPTY_METRICS);
  const [activityColumns, setActivityColumns] = useState<ActivityColumn[]>([]);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);

  // Auth Bearer token strictly kept in React memory (never localStorage/sessionStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [setupStatus, setSetupStatus] = useState<AuthSetupStatus | null>(null);

  const warehouseRef = useRef<WarehouseCanvasHandle | null>(null);

  const fetchSetupStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/setup-status');
      if (res.ok) {
        const data = (await res.json()) as AuthSetupStatus;
        setSetupStatus(data);
        return Boolean(data.dbConnected);
      }
    } catch {
      // Keep UI resilient if backend is restarting
    }
    return false;
  }, []);

  const fetchDashboardData = useCallback(
    async (tokenOverride?: string) => {
      const activeToken = tokenOverride ?? authToken;
      if (!activeToken) return;
      try {
        const params = new URLSearchParams({ zone, dateRange });
        const res = await fetch(`/api/dashboard?${params.toString()}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (res.status === 401) {
          setAuthToken(null);
          setAuthUser(null);
          setMetrics(EMPTY_METRICS);
          setRobots([]);
          setActivityColumns([]);
          setAlerts([]);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data.metrics) setMetrics(data.metrics);
        if (Array.isArray(data.robots)) setRobots(data.robots);
        if (Array.isArray(data.activityColumns)) setActivityColumns(data.activityColumns);
        if (Array.isArray(data.alerts)) setAlerts(data.alerts);
      } catch {
        // Preserve last valid frame if transient network error occurs
      }
    },
    [zone, dateRange, authToken]
  );

  useEffect(() => {
    let active = true;
    void fetchSetupStatus().then((connected) => {
      if (active && connected && authToken) {
        void fetchDashboardData();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchSetupStatus, fetchDashboardData, authToken]);

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => {
      if (setupStatus?.dbConnected) {
        if (authToken) {
          void fetchDashboardData();
        }
      } else {
        void fetchSetupStatus().then((connected) => {
          if (connected && authToken) {
            void fetchDashboardData();
          }
        });
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [isLive, setupStatus?.dbConnected, authToken, fetchDashboardData, fetchSetupStatus]);

  const filteredRobots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return robots;
    return robots.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [searchQuery, robots]);

  const selectedRobot = useMemo(
    () => robots.find((r) => r.id === selectedRobotId) ?? robots[0] ?? null,
    [selectedRobotId, robots]
  );

  const handleAcknowledgeAlert = async (id: number) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/alerts/${id}/acknowledge`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
      }
    } catch {
      // ignore
    }
  };

  const handleAuthSuccess = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    void fetchSetupStatus();
    void fetchDashboardData(token);
  };

  const handleLogout = async (allSessions = false) => {
    if (authToken) {
      try {
        await fetch(allSessions ? '/api/auth/logout-all' : '/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // ignore
      }
    }
    setAuthToken(null);
    setAuthUser(null);
    setMetrics(EMPTY_METRICS);
    setRobots([]);
    setActivityColumns([]);
    setAlerts([]);
    void fetchSetupStatus();
  };

  const handleExport = async () => {
    let payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      zone,
      dateRange,
      metrics,
      fleet: robots,
      activityColumns,
      alerts,
    };

    if (authToken) {
      try {
        const params = new URLSearchParams({ zone, dateRange });
        const res = await fetch(`/api/export?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          payload = (await res.json()) as Record<string, unknown>;
        }
      } catch {
        // fall back to current view payload
      }
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wirehouseflow-${zone.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-shell flowos-canvas-bg px-3.5 py-3.5 sm:px-5 md:px-6 md:py-4 flex flex-col select-none">
      {/* Top Navigation & Filters */}
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        zone={zone}
        onZoneChange={setZone}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onExport={() => void handleExport()}
        alerts={alerts}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        authUser={authUser}
        authToken={authToken}
        setupStatus={setupStatus}
        onAuthSuccess={handleAuthSuccess}
        onLogout={handleLogout}
        onDataRefresh={fetchDashboardData}
      />

      {/* Main Responsive Workspace Grid */}
      <main className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_336px] gap-4">
        {/* Left + Center Viewport Column */}
        <div className="relative flex flex-col min-h-0 min-w-0">
          {/* Sub-Header: Title + Viewport Toolbar */}
          <div className="relative z-20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-1 pt-0.5">
            <div className="min-w-0">
              <h1 className="text-[26px] sm:text-[33px] xl:text-[39px] font-light tracking-[-0.028em] text-[#1e201e] leading-[1.08]">
                Warehouse Operations
              </h1>
              <p className="text-[12px] sm:text-[12.5px] font-normal text-[#666963] mt-1">
                Deadlines, tasks, and documents that need your attention
              </p>
            </div>

            {/* 3D Viewport Controls */}
            <div className="flex items-center flex-wrap gap-1.5 sm:pt-1.5 shrink-0">
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

          {/* Mobile Horizontal Navigation Rail (prevents overlapping 3D warehouse on <640px) */}
          <div className="flex sm:hidden justify-start pt-2.5 pb-1 z-20">
            <SideRail
              orientation="horizontal"
              activeSection={activeSection}
              onSelectSection={(sec) => {
                setActiveSection(sec);
                if (sec === 'dashboard') {
                  warehouseRef.current?.resetCamera();
                }
              }}
            />
          </div>

          {/* Interactive 3D Warehouse Floorplan + Floating Desktop Side Rail */}
          <div className="relative h-[340px] sm:h-[430px] md:h-[470px] xl:h-auto xl:flex-1 xl:min-h-[380px] my-2 xl:-mt-3 xl:-mb-7">
            <div className="hidden sm:block absolute left-1 top-[22%] z-20">
              <SideRail
                orientation="vertical"
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
              robots={robots}
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
            <div className="relative z-20 grid grid-cols-1 md:grid-cols-[1.08fr_1fr] gap-3.5 shrink-0 sm:pl-1">
              <TopRobotsCard
                robots={filteredRobots}
                selectedRobotId={selectedRobot?.id ?? null}
                onSelectRobot={setSelectedRobotId}
                isAuthenticated={Boolean(authToken)}
              />
              <RobotActivityCard
                activeMissions={metrics.activeMissions}
                columns={activityColumns}
              />
            </div>
          )}
        </div>

        {/* Right Telemetry & Hero Robot Column (side-by-side on md/lg, stacked column on xl desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 xl:flex xl:flex-col gap-3.5 min-h-0">
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
