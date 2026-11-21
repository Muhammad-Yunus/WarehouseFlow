import { count } from 'drizzle-orm';
import { ACTIVITY_COLUMNS, FLEET_ROBOTS, ZONE_METRICS } from '../data/fleetData.ts';
import type { DateRangeOption, ZoneOption } from '../types/fleet.ts';
import { type Database } from './index.ts';
import {
  fleetAlerts,
  robotActivityColumns,
  robots,
  zoneMetrics,
} from './schema.ts';

const INITIAL_ALERTS = [
  {
    zoneName: 'Warehouse A: Zone B',
    robotId: 'AMR-024',
    title: 'AMR-024 Battery at 64%',
    description: 'Scheduled recharge after Bay 4 drop',
    severity: 'warning',
    acknowledged: false,
  },
  {
    zoneName: 'Warehouse A: Zone B',
    robotId: null,
    title: 'Dock Bay 2 Cleared',
    description: 'Trailer #408 ready for departure',
    severity: 'info',
    acknowledged: false,
  },
  {
    zoneName: 'Warehouse A: Zone A',
    robotId: 'AMR-017',
    title: 'Zone A Picking Surge',
    description: 'AMR-017 reassigned to high-priority lane 3',
    severity: 'info',
    acknowledged: false,
  },
  {
    zoneName: 'Warehouse B: Zone C',
    robotId: 'AMR-019',
    title: 'AMR-019 Charging Active',
    description: 'Dock charger C-02 connected at 34% SoC',
    severity: 'warning',
    acknowledged: false,
  },
];

export async function seedWarehouseDataIfEmpty(db: Database): Promise<void> {
  const [{ value: existingZones }] = await db.select({ value: count() }).from(zoneMetrics);
  if (existingZones === 0) {
    const zoneRows: Array<typeof zoneMetrics.$inferInsert> = [];
    for (const zoneName of Object.keys(ZONE_METRICS) as ZoneOption[]) {
      const ranges = ZONE_METRICS[zoneName];
      for (const dateRange of Object.keys(ranges) as DateRangeOption[]) {
        const m = ranges[dateRange];
        zoneRows.push({
          zoneName,
          dateRange,
          efficiency: m.efficiency,
          robots: m.robots,
          tasks: m.tasks,
          onTime: m.onTime,
          activeMissions: m.activeMissions,
        });
      }
    }
    await db
      .insert(zoneMetrics)
      .values(zoneRows)
      .onConflictDoNothing();
  }

  const [{ value: existingRobots }] = await db.select({ value: count() }).from(robots);
  if (existingRobots === 0) {
    await db
      .insert(robots)
      .values(
        FLEET_ROBOTS.map((r) => ({
          id: r.id,
          zoneName: 'Warehouse A: Zone B',
          role: r.role,
          efficiency: r.efficiency,
          completedTasks: r.completedTasks,
          status: r.status,
          batteryHealth: r.batteryHealth,
          taskCompletion: r.taskCompletion,
          accentColor: r.accentColor,
          hasCargo: r.hasCargo,
          pathIndex: r.pathIndex,
          initialProgress: r.initialProgress,
          speed: r.speed,
        }))
      )
      .onConflictDoNothing();
  }

  const [{ value: existingActivity }] = await db
    .select({ value: count() })
    .from(robotActivityColumns);
  if (existingActivity === 0) {
    const zones: ZoneOption[] = [
      'Warehouse A: Zone B',
      'Warehouse A: Zone A',
      'Warehouse B: Zone C',
    ];
    const activityRows: Array<typeof robotActivityColumns.$inferInsert> = [];
    zones.forEach((zoneName, zoneOffset) => {
      ACTIVITY_COLUMNS.forEach((col) => {
        const scaledMissions =
          zoneOffset === 0
            ? col.missions
            : Math.max(4, Math.round(col.missions * (zoneOffset === 1 ? 0.84 : 0.91)));
        const scaledDots =
          zoneOffset === 0
            ? col.dots
            : Math.max(1, Math.min(14, Math.round(col.dots * (zoneOffset === 1 ? 0.88 : 0.94))));
        activityRows.push({
          zoneName,
          columnIndex: col.id,
          day: col.day,
          dots: scaledDots,
          dateLabel: col.dateLabel,
          missions: scaledMissions,
          delta: col.delta,
          highlighted: Boolean(col.highlighted),
        });
      });
    });
    await db
      .insert(robotActivityColumns)
      .values(activityRows)
      .onConflictDoNothing();
  }

  const [{ value: existingAlerts }] = await db.select({ value: count() }).from(fleetAlerts);
  if (existingAlerts === 0) {
    await db.insert(fleetAlerts).values(INITIAL_ALERTS);
  }
}
