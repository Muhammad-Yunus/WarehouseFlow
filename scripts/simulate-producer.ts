import 'dotenv/config';

type ZoneName = 'Warehouse A: Zone B' | 'Warehouse A: Zone A' | 'Warehouse B: Zone C';
type DateRange = 'Today' | 'This Week' | 'This Month';
type RobotStatus = 'Active' | 'Picking' | 'Charging' | 'Idle';
type DayLabel = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

interface RobotState {
  id: string;
  zoneName: ZoneName;
  role: string;
  efficiency: number;
  completedTasks: number;
  status: RobotStatus;
  batteryHealth: number;
  taskCompletion: number;
  accentColor: 'orange' | 'green';
  hasCargo: boolean;
  pathIndex: number;
  initialProgress: number;
  speed: number;
}

interface ZoneMetricState {
  zoneName: ZoneName;
  dateRange: DateRange;
  efficiency: number;
  robots: number;
  tasks: number;
  onTime: number;
  activeMissions: number;
}

interface ActivityColumnState {
  zoneName: ZoneName;
  columnIndex: number;
  day: DayLabel;
  dots: number;
  dateLabel: string;
  missions: number;
  delta: string;
  highlighted: boolean;
}

const args = process.argv.slice(2);
const hasFlag = (flag: string) => args.includes(flag);
const getArgValue = (prefix: string): string | undefined => {
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

const API_BASE = (
  getArgValue('--url=') ||
  process.env.WIREHOUSEFLOW_API_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const RUN_ONCE = hasFlag('--once');
const SEED_ON_START = hasFlag('--seed') || RUN_ONCE;
const INTERVAL_MS = Number(
  getArgValue('--interval=') || process.env.PRODUCER_INTERVAL_MS || 4000
);

const INITIAL_ZONE_METRICS: ZoneMetricState[] = [
  { zoneName: 'Warehouse A: Zone B', dateRange: 'Today', efficiency: 90, robots: 128, tasks: 2156, onTime: 96.8, activeMissions: 247 },
  { zoneName: 'Warehouse A: Zone B', dateRange: 'This Week', efficiency: 92, robots: 128, tasks: 14820, onTime: 97.4, activeMissions: 312 },
  { zoneName: 'Warehouse A: Zone B', dateRange: 'This Month', efficiency: 89, robots: 128, tasks: 62410, onTime: 95.9, activeMissions: 284 },
  { zoneName: 'Warehouse A: Zone A', dateRange: 'Today', efficiency: 93, robots: 96, tasks: 1840, onTime: 98.1, activeMissions: 194 },
  { zoneName: 'Warehouse A: Zone A', dateRange: 'This Week', efficiency: 91, robots: 96, tasks: 12190, onTime: 96.5, activeMissions: 228 },
  { zoneName: 'Warehouse A: Zone A', dateRange: 'This Month', efficiency: 90, robots: 96, tasks: 51340, onTime: 96.2, activeMissions: 215 },
  { zoneName: 'Warehouse B: Zone C', dateRange: 'Today', efficiency: 87, robots: 112, tasks: 1930, onTime: 94.6, activeMissions: 218 },
  { zoneName: 'Warehouse B: Zone C', dateRange: 'This Week', efficiency: 88, robots: 112, tasks: 13450, onTime: 95.1, activeMissions: 241 },
  { zoneName: 'Warehouse B: Zone C', dateRange: 'This Month', efficiency: 88, robots: 112, tasks: 56280, onTime: 94.9, activeMissions: 230 },
];

const fleetState: RobotState[] = [
  { id: 'AMR-024', zoneName: 'Warehouse A: Zone B', role: 'Pallet Carrier', efficiency: 98, completedTasks: 84, status: 'Active', batteryHealth: 64, taskCompletion: 73, accentColor: 'orange', hasCargo: true, pathIndex: 0, initialProgress: 0.14, speed: 0.015 },
  { id: 'AMR-017', zoneName: 'Warehouse A: Zone B', role: 'Free Loader', efficiency: 98, completedTasks: 79, status: 'Picking', batteryHealth: 82, taskCompletion: 88, accentColor: 'green', hasCargo: false, pathIndex: 1, initialProgress: 0.54, speed: 0.017 },
  { id: 'AMR-012', zoneName: 'Warehouse A: Zone B', role: 'Pallet Carrier', efficiency: 95, completedTasks: 74, status: 'Active', batteryHealth: 78, taskCompletion: 69, accentColor: 'orange', hasCargo: true, pathIndex: 2, initialProgress: 0.38, speed: 0.014 },
  { id: 'AMR-031', zoneName: 'Warehouse A: Zone B', role: 'Dock Shuttle', efficiency: 94, completedTasks: 71, status: 'Picking', batteryHealth: 51, taskCompletion: 64, accentColor: 'green', hasCargo: true, pathIndex: 3, initialProgress: 0.12, speed: 0.016 },
  { id: 'AMR-008', zoneName: 'Warehouse A: Zone B', role: 'Free Loader', efficiency: 92, completedTasks: 68, status: 'Active', batteryHealth: 91, taskCompletion: 82, accentColor: 'green', hasCargo: false, pathIndex: 4, initialProgress: 0.36, speed: 0.016 },
  { id: 'AMR-019', zoneName: 'Warehouse A: Zone B', role: 'Pallet Carrier', efficiency: 91, completedTasks: 65, status: 'Charging', batteryHealth: 34, taskCompletion: 58, accentColor: 'orange', hasCargo: false, pathIndex: 5, initialProgress: 0.72, speed: 0.013 },
];

const BASE_HISTOGRAM: Array<{
  day: DayLabel;
  dots: number;
  dateLabel: string;
  missions: number;
  delta: string;
  highlighted?: boolean;
}> = [
  { day: 'Mon', dots: 2, dateLabel: '20 July', missions: 11, delta: '+1.20%' },
  { day: 'Mon', dots: 3, dateLabel: '20 July', missions: 14, delta: '+1.45%' },
  { day: 'Mon', dots: 6, dateLabel: '20 July', missions: 22, delta: '+2.84%' },
  { day: 'Mon', dots: 4, dateLabel: '20 July', missions: 16, delta: '+1.72%' },
  { day: 'Mon', dots: 3, dateLabel: '20 July', missions: 13, delta: '+1.18%' },
  { day: 'Mon', dots: 2, dateLabel: '20 July', missions: 10, delta: '+0.94%' },
  { day: 'Tue', dots: 4, dateLabel: '21 July', missions: 17, delta: '+2.05%' },
  { day: 'Tue', dots: 2, dateLabel: '21 July', missions: 11, delta: '+1.08%' },
  { day: 'Tue', dots: 2, dateLabel: '21 July', missions: 12, delta: '+1.12%' },
  { day: 'Tue', dots: 2, dateLabel: '21 July', missions: 11, delta: '+0.95%' },
  { day: 'Tue', dots: 2, dateLabel: '21 July', missions: 10, delta: '+0.88%' },
  { day: 'Wed', dots: 3, dateLabel: '22 July', missions: 15, delta: '+1.54%' },
  { day: 'Wed', dots: 2, dateLabel: '22 July', missions: 12, delta: '+1.19%' },
  { day: 'Wed', dots: 2, dateLabel: '22 July', missions: 11, delta: '+1.02%' },
  { day: 'Wed', dots: 2, dateLabel: '22 July', missions: 12, delta: '+1.21%' },
  { day: 'Wed', dots: 4, dateLabel: '22 July', missions: 18, delta: '+2.14%' },
  { day: 'Thu', dots: 6, dateLabel: '23 July', missions: 24, delta: '+3.18%' },
  { day: 'Thu', dots: 9, dateLabel: '23 July', missions: 34, delta: '+5.31%', highlighted: true },
  { day: 'Thu', dots: 6, dateLabel: '23 July', missions: 25, delta: '+3.42%' },
  { day: 'Thu', dots: 5, dateLabel: '23 July', missions: 21, delta: '+2.64%' },
  { day: 'Thu', dots: 5, dateLabel: '23 July', missions: 20, delta: '+2.48%' },
  { day: 'Thu', dots: 4, dateLabel: '23 July', missions: 17, delta: '+1.92%' },
  { day: 'Fri', dots: 2, dateLabel: '24 July', missions: 12, delta: '+1.15%' },
  { day: 'Fri', dots: 2, dateLabel: '24 July', missions: 11, delta: '+1.04%' },
  { day: 'Fri', dots: 2, dateLabel: '24 July', missions: 12, delta: '+1.22%' },
  { day: 'Fri', dots: 3, dateLabel: '24 July', missions: 14, delta: '+1.60%' },
  { day: 'Fri', dots: 4, dateLabel: '24 July', missions: 18, delta: '+2.10%' },
  { day: 'Fri', dots: 2, dateLabel: '24 July', missions: 11, delta: '+0.98%' },
  { day: 'Sat', dots: 2, dateLabel: '25 July', missions: 10, delta: '+0.74%' },
  { day: 'Sat', dots: 2, dateLabel: '25 July', missions: 9, delta: '+0.62%' },
  { day: 'Sat', dots: 2, dateLabel: '25 July', missions: 10, delta: '+0.71%' },
  { day: 'Sat', dots: 2, dateLabel: '25 July', missions: 9, delta: '+0.58%' },
  { day: 'Sat', dots: 1, dateLabel: '25 July', missions: 7, delta: '+0.42%' },
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 6, delta: '+0.35%' },
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 7, delta: '+0.41%' },
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 8, delta: '+0.48%' },
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 7, delta: '+0.39%' },
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 6, delta: '+0.31%' },
];

function buildActivityColumns(): ActivityColumnState[] {
  const zones: ZoneName[] = [
    'Warehouse A: Zone B',
    'Warehouse A: Zone A',
    'Warehouse B: Zone C',
  ];
  const rows: ActivityColumnState[] = [];
  zones.forEach((zoneName, zoneIdx) => {
    BASE_HISTOGRAM.forEach((col, columnIndex) => {
      const missions =
        zoneIdx === 0
          ? col.missions
          : Math.max(4, Math.round(col.missions * (zoneIdx === 1 ? 0.84 : 0.91)));
      const dots =
        zoneIdx === 0
          ? col.dots
          : Math.max(1, Math.min(14, Math.round(col.dots * (zoneIdx === 1 ? 0.88 : 0.94))));
      rows.push({
        zoneName,
        columnIndex,
        day: col.day,
        dots,
        dateLabel: col.dateLabel,
        missions,
        delta: col.delta,
        highlighted: Boolean(col.highlighted),
      });
    });
  });
  return rows;
}

const INITIAL_ALERTS = [
  {
    zoneName: 'Warehouse A: Zone B' as ZoneName,
    robotId: 'AMR-024',
    title: 'AMR-024 Battery at 64%',
    description: 'Scheduled recharge after Bay 4 drop',
    severity: 'warning' as const,
  },
  {
    zoneName: 'Warehouse A: Zone B' as ZoneName,
    robotId: null,
    title: 'Dock Bay 2 Cleared',
    description: 'Trailer #408 ready for departure',
    severity: 'info' as const,
  },
];

async function resolveAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.WIREHOUSEFLOW_API_KEY?.trim();
  if (apiKey) {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    };
  }

  const passcode = process.env.PRODUCER_PASSCODE?.trim();
  if (passcode) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = (await res.json()) as { token?: string; error?: string };
    if (!res.ok || !data.token) {
      throw new Error(`Passcode login failed: ${data.error || res.statusText}`);
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    };
  }

  const email = process.env.PRODUCER_EMAIL?.trim();
  const password = process.env.PRODUCER_PASSWORD;
  if (email && password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { token?: string; error?: string };
    if (!res.ok || !data.token) {
      throw new Error(`Operator login failed: ${data.error || res.statusText}`);
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    };
  }

  throw new Error(
    'Missing producer credentials. Set WIREHOUSEFLOW_API_KEY, PRODUCER_PASSCODE, or PRODUCER_EMAIL + PRODUCER_PASSWORD.'
  );
}

async function postIngest(
  path: string,
  headers: Record<string, string>,
  payload: unknown
): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

function advanceSimulationTick(tickCount: number) {
  const updatedRobots: RobotState[] = [];

  for (const robot of fleetState) {
    if (robot.status === 'Charging') {
      robot.batteryHealth = Math.min(100, robot.batteryHealth + 6);
      if (robot.batteryHealth >= 92) {
        robot.status = 'Active';
        robot.hasCargo = true;
      }
    } else {
      robot.batteryHealth = Math.max(18, robot.batteryHealth - (tickCount % 2 === 0 ? 1 : 0));
      if (robot.batteryHealth <= 24) {
        robot.status = 'Charging';
        robot.hasCargo = false;
      } else {
        robot.taskCompletion = Math.min(99, (robot.taskCompletion + 3) % 100 || 52);
        if (tickCount % 3 === 0) {
          robot.completedTasks += 1;
          robot.hasCargo = !robot.hasCargo;
          robot.status = robot.hasCargo ? 'Active' : 'Picking';
        }
      }
    }

    robot.efficiency = Math.min(
      99,
      Math.max(88, robot.efficiency + (tickCount % 2 === 0 ? 1 : -1))
    );
    updatedRobots.push({ ...robot });
  }

  const todayMetric = INITIAL_ZONE_METRICS[0];
  todayMetric.tasks += 2;
  todayMetric.activeMissions = 242 + ((tickCount * 3) % 18);
  todayMetric.efficiency = 89 + (tickCount % 4);
  todayMetric.onTime = Number((96.2 + (tickCount % 8) * 0.2).toFixed(1));

  return { updatedRobots, todayMetric };
}

async function main(): Promise<void> {
  console.log(`[Producer] Connecting to WirehouseFlow API at ${API_BASE}...`);
  const headers = await resolveAuthHeaders();
  console.log('[Producer] Authenticated successfully.');

  if (SEED_ON_START) {
    console.log('[Producer] Pushing baseline warehouse snapshot via POST /api/ingest/snapshot...');
    const res = await postIngest('/api/ingest/snapshot', headers, {
      zoneMetrics: INITIAL_ZONE_METRICS,
      robots: fleetState,
      activityColumns: buildActivityColumns(),
      alerts: INITIAL_ALERTS,
    });
    console.log('[Producer] Snapshot ingested:', res);
  }

  if (RUN_ONCE) {
    console.log('[Producer] --once flag active, exiting cleanly.');
    return;
  }

  let tick = 1;
  console.log(`[Producer] Streaming live telemetry every ${INTERVAL_MS}ms (Ctrl+C to stop)...`);

  const runTick = async () => {
    try {
      const { updatedRobots, todayMetric } = advanceSimulationTick(tick);

      const telemetryRes = await postIngest('/api/ingest/telemetry', headers, {
        records: updatedRobots,
      });
      await postIngest('/api/ingest/zone-metrics', headers, todayMetric);

      const thuPeakMissions = 31 + (tick % 6);
      await postIngest('/api/ingest/activity', headers, {
        zoneName: 'Warehouse A: Zone B',
        columnIndex: 17,
        day: 'Thu',
        dots: Math.min(12, Math.max(7, Math.round(thuPeakMissions / 3.6))),
        dateLabel: '23 July',
        missions: thuPeakMissions,
        delta: `+${(4.5 + (tick % 5) * 0.25).toFixed(2)}%`,
        highlighted: true,
      });

      if (tick % 6 === 0) {
        await postIngest('/api/ingest/alerts', headers, {
          zoneName: 'Warehouse A: Zone B',
          robotId: 'AMR-017',
          title: `Lane 3 Pallet Batch #${410 + tick}`,
          description: 'Completed dock transfer within target SLA',
          severity: 'info',
        });
      }

      console.log(
        `[Producer][Tick ${tick}] Telemetry synced:`,
        JSON.stringify(telemetryRes)
      );
      tick++;
    } catch (err) {
      console.error(
        '[Producer] Tick ingest error:',
        err instanceof Error ? err.message : err
      );
    }
  };

  await runTick();
  const timer = setInterval(() => {
    void runTick();
  }, INTERVAL_MS);

  const shutdown = () => {
    clearInterval(timer);
    console.log('\n[Producer] Stopped.');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Producer] Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
