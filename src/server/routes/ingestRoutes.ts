import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  fleetAlerts,
  robotActivityColumns,
  robotTelemetryLogs,
  robots,
  zoneMetrics,
} from '../../db/schema.ts';
import { type AuthenticatedRequest, requireIngestAuth } from '../auth.ts';

const ZONES = [
  'Warehouse A: Zone B',
  'Warehouse A: Zone A',
  'Warehouse B: Zone C',
] as const;

const DATE_RANGES = ['Today', 'This Week', 'This Month'] as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const robotIngestItemSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{3,24}$/, 'Robot id must match e.g. AMR-024'),
  zoneName: z.enum(ZONES).default('Warehouse A: Zone B'),
  role: z.string().trim().min(2).max(60).default('Pallet Carrier'),
  efficiency: z.number().int().min(0).max(100),
  completedTasks: z.number().int().min(0).max(100000),
  status: z.enum(['Active', 'Picking', 'Charging', 'Idle']),
  batteryHealth: z.number().int().min(0).max(100),
  taskCompletion: z.number().int().min(0).max(100),
  accentColor: z.enum(['orange', 'green']).default('orange'),
  hasCargo: z.boolean().default(false),
  pathIndex: z.number().int().min(0).max(12).default(0),
  initialProgress: z.number().min(0).max(1).default(0.15),
  speed: z.number().min(0.002).max(0.1).default(0.015),
});

const telemetryPayloadSchema = z.union([
  robotIngestItemSchema,
  z.object({
    records: z.array(robotIngestItemSchema).min(1).max(200),
  }),
]);

const zoneMetricsIngestSchema = z.object({
  zoneName: z.enum(ZONES),
  dateRange: z.enum(DATE_RANGES),
  efficiency: z.number().int().min(0).max(100),
  robots: z.number().int().min(0).max(50000),
  tasks: z.number().int().min(0).max(10000000),
  onTime: z.number().min(0).max(100),
  activeMissions: z.number().int().min(0).max(1000000),
});

const activityColumnItemSchema = z.object({
  zoneName: z.enum(ZONES).default('Warehouse A: Zone B'),
  columnIndex: z.number().int().min(0).max(37),
  day: z.enum(DAYS),
  dots: z.number().int().min(1).max(14),
  dateLabel: z.string().trim().min(2).max(30),
  missions: z.number().int().min(0).max(10000),
  delta: z.string().trim().min(1).max(20),
  highlighted: z.boolean().optional().default(false),
});

const activityPayloadSchema = z.union([
  activityColumnItemSchema,
  z.object({
    columns: z.array(activityColumnItemSchema).min(1).max(38),
  }),
]);

const alertIngestSchema = z.object({
  zoneName: z.enum(ZONES).default('Warehouse A: Zone B'),
  robotId: z.string().trim().max(24).nullable().optional().default(null),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(280),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
});

const snapshotIngestSchema = z.object({
  zoneMetrics: z.array(zoneMetricsIngestSchema).max(12).optional(),
  robots: z.array(robotIngestItemSchema).max(200).optional(),
  activityColumns: z.array(activityColumnItemSchema).max(120).optional(),
  alerts: z.array(alertIngestSchema).max(50).optional(),
});

export const ingestRouter = Router();

ingestRouter.use(requireIngestAuth);

ingestRouter.post('/telemetry', async (req: AuthenticatedRequest, res) => {
  const parsed = telemetryPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid telemetry ingest payload', details: parsed.error.flatten() });
    return;
  }

  const items = 'records' in parsed.data ? parsed.data.records : [parsed.data];
  const db = req.db!;
  const source = req.ingestPrincipal!.label;

  try {
    const result = await db.transaction(async (tx) => {
      const upsertedIds: string[] = [];
      let alertsCreated = 0;

      for (const item of items) {
        await tx
          .insert(robots)
          .values({
            id: item.id,
            zoneName: item.zoneName,
            role: item.role,
            efficiency: item.efficiency,
            completedTasks: item.completedTasks,
            status: item.status,
            batteryHealth: item.batteryHealth,
            taskCompletion: item.taskCompletion,
            accentColor: item.accentColor,
            hasCargo: item.hasCargo,
            pathIndex: item.pathIndex,
            initialProgress: item.initialProgress,
            speed: item.speed,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: robots.id,
            set: {
              zoneName: sql`excluded.zone_name`,
              role: sql`excluded.role`,
              efficiency: sql`excluded.efficiency`,
              completedTasks: sql`excluded.completed_tasks`,
              status: sql`excluded.status`,
              batteryHealth: sql`excluded.battery_health`,
              taskCompletion: sql`excluded.task_completion`,
              accentColor: sql`excluded.accent_color`,
              hasCargo: sql`excluded.has_cargo`,
              pathIndex: sql`excluded.path_index`,
              initialProgress: sql`excluded.initial_progress`,
              speed: sql`excluded.speed`,
              updatedAt: new Date(),
            },
          });

        await tx.insert(robotTelemetryLogs).values({
          robotId: item.id,
          zoneName: item.zoneName,
          status: item.status,
          efficiency: item.efficiency,
          batteryHealth: item.batteryHealth,
          taskCompletion: item.taskCompletion,
          completedTasks: item.completedTasks,
          hasCargo: item.hasCargo,
          source,
        });

        if (item.batteryHealth <= 25) {
          await tx.insert(fleetAlerts).values({
            zoneName: item.zoneName,
            robotId: item.id,
            title: `${item.id} Low Battery (${item.batteryHealth}%)`,
            description: `Ingested telemetry reported critical SoC in ${item.zoneName}`,
            severity: item.batteryHealth <= 15 ? 'critical' : 'warning',
            acknowledged: false,
          });
          alertsCreated++;
        }

        upsertedIds.push(item.id);
      }

      return { upsertedIds, alertsCreated };
    });

    res.status(201).json({
      ok: true,
      ingestedCount: result.upsertedIds.length,
      robotIds: result.upsertedIds,
      alertsCreated: result.alertsCreated,
      ingestedBy: source,
    });
  } catch (err) {
    console.error('Telemetry ingest error:', err);
    res.status(500).json({ error: 'Failed to ingest telemetry records' });
  }
});

ingestRouter.post('/zone-metrics', async (req: AuthenticatedRequest, res) => {
  const parsed = zoneMetricsIngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid zone metrics payload', details: parsed.error.flatten() });
    return;
  }

  const db = req.db!;
  const m = parsed.data;

  try {
    const [saved] = await db
      .insert(zoneMetrics)
      .values({
        zoneName: m.zoneName,
        dateRange: m.dateRange,
        efficiency: m.efficiency,
        robots: m.robots,
        tasks: m.tasks,
        onTime: m.onTime,
        activeMissions: m.activeMissions,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [zoneMetrics.zoneName, zoneMetrics.dateRange],
        set: {
          efficiency: sql`excluded.efficiency`,
          robots: sql`excluded.robots`,
          tasks: sql`excluded.tasks`,
          onTime: sql`excluded.on_time`,
          activeMissions: sql`excluded.active_missions`,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json({ ok: true, zoneMetric: saved });
  } catch (err) {
    console.error('Zone metrics ingest error:', err);
    res.status(500).json({ error: 'Failed to ingest zone metrics' });
  }
});

ingestRouter.post('/activity', async (req: AuthenticatedRequest, res) => {
  const parsed = activityPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid activity column payload', details: parsed.error.flatten() });
    return;
  }

  const items = 'columns' in parsed.data ? parsed.data.columns : [parsed.data];
  const db = req.db!;

  try {
    await db.transaction(async (tx) => {
      for (const col of items) {
        await tx
          .insert(robotActivityColumns)
          .values({
            zoneName: col.zoneName,
            columnIndex: col.columnIndex,
            day: col.day,
            dots: col.dots,
            dateLabel: col.dateLabel,
            missions: col.missions,
            delta: col.delta,
            highlighted: Boolean(col.highlighted),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [robotActivityColumns.zoneName, robotActivityColumns.columnIndex],
            set: {
              day: sql`excluded.day`,
              dots: sql`excluded.dots`,
              dateLabel: sql`excluded.date_label`,
              missions: sql`excluded.missions`,
              delta: sql`excluded.delta`,
              highlighted: sql`excluded.highlighted`,
              updatedAt: new Date(),
            },
          });
      }
    });

    res.status(201).json({ ok: true, upsertedColumns: items.length });
  } catch (err) {
    console.error('Activity ingest error:', err);
    res.status(500).json({ error: 'Failed to ingest activity histogram data' });
  }
});

ingestRouter.post('/alerts', async (req: AuthenticatedRequest, res) => {
  const parsed = alertIngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid alert payload', details: parsed.error.flatten() });
    return;
  }

  const db = req.db!;
  const a = parsed.data;

  try {
    const [created] = await db
      .insert(fleetAlerts)
      .values({
        zoneName: a.zoneName,
        robotId: a.robotId ?? null,
        title: a.title,
        description: a.description,
        severity: a.severity,
        acknowledged: false,
      })
      .returning();

    res.status(201).json({ ok: true, alert: created });
  } catch (err) {
    console.error('Alert ingest error:', err);
    res.status(500).json({ error: 'Failed to ingest fleet alert' });
  }
});

ingestRouter.post('/snapshot', async (req: AuthenticatedRequest, res) => {
  const parsed = snapshotIngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid snapshot payload', details: parsed.error.flatten() });
    return;
  }

  const db = req.db!;
  const source = req.ingestPrincipal!.label;
  const data = parsed.data;

  try {
    const summary = await db.transaction(async (tx) => {
      let zonesCount = 0;
      let robotsCount = 0;
      let activityCount = 0;
      let alertsCount = 0;

      if (data.zoneMetrics) {
        for (const m of data.zoneMetrics) {
          await tx
            .insert(zoneMetrics)
            .values({
              zoneName: m.zoneName,
              dateRange: m.dateRange,
              efficiency: m.efficiency,
              robots: m.robots,
              tasks: m.tasks,
              onTime: m.onTime,
              activeMissions: m.activeMissions,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [zoneMetrics.zoneName, zoneMetrics.dateRange],
              set: {
                efficiency: sql`excluded.efficiency`,
                robots: sql`excluded.robots`,
                tasks: sql`excluded.tasks`,
                onTime: sql`excluded.on_time`,
                activeMissions: sql`excluded.active_missions`,
                updatedAt: new Date(),
              },
            });
          zonesCount++;
        }
      }

      if (data.robots) {
        for (const item of data.robots) {
          await tx
            .insert(robots)
            .values({
              id: item.id,
              zoneName: item.zoneName,
              role: item.role,
              efficiency: item.efficiency,
              completedTasks: item.completedTasks,
              status: item.status,
              batteryHealth: item.batteryHealth,
              taskCompletion: item.taskCompletion,
              accentColor: item.accentColor,
              hasCargo: item.hasCargo,
              pathIndex: item.pathIndex,
              initialProgress: item.initialProgress,
              speed: item.speed,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: robots.id,
              set: {
                zoneName: sql`excluded.zone_name`,
                role: sql`excluded.role`,
                efficiency: sql`excluded.efficiency`,
                completedTasks: sql`excluded.completed_tasks`,
                status: sql`excluded.status`,
                batteryHealth: sql`excluded.battery_health`,
                taskCompletion: sql`excluded.task_completion`,
                accentColor: sql`excluded.accent_color`,
                hasCargo: sql`excluded.has_cargo`,
                pathIndex: sql`excluded.path_index`,
                initialProgress: sql`excluded.initial_progress`,
                speed: sql`excluded.speed`,
                updatedAt: new Date(),
              },
            });

          await tx.insert(robotTelemetryLogs).values({
            robotId: item.id,
            zoneName: item.zoneName,
            status: item.status,
            efficiency: item.efficiency,
            batteryHealth: item.batteryHealth,
            taskCompletion: item.taskCompletion,
            completedTasks: item.completedTasks,
            hasCargo: item.hasCargo,
            source,
          });
          robotsCount++;
        }
      }

      if (data.activityColumns) {
        for (const col of data.activityColumns) {
          await tx
            .insert(robotActivityColumns)
            .values({
              zoneName: col.zoneName,
              columnIndex: col.columnIndex,
              day: col.day,
              dots: col.dots,
              dateLabel: col.dateLabel,
              missions: col.missions,
              delta: col.delta,
              highlighted: Boolean(col.highlighted),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [robotActivityColumns.zoneName, robotActivityColumns.columnIndex],
              set: {
                day: sql`excluded.day`,
                dots: sql`excluded.dots`,
                dateLabel: sql`excluded.date_label`,
                missions: sql`excluded.missions`,
                delta: sql`excluded.delta`,
                highlighted: sql`excluded.highlighted`,
                updatedAt: new Date(),
              },
            });
          activityCount++;
        }
      }

      if (data.alerts) {
        for (const a of data.alerts) {
          await tx.insert(fleetAlerts).values({
            zoneName: a.zoneName,
            robotId: a.robotId ?? null,
            title: a.title,
            description: a.description,
            severity: a.severity,
            acknowledged: false,
          });
          alertsCount++;
        }
      }

      return { zonesCount, robotsCount, activityCount, alertsCount };
    });

    res.status(201).json({ ok: true, ingestedBy: source, ...summary });
  } catch (err) {
    console.error('Snapshot ingest error:', err);
    res.status(500).json({ error: 'Failed to ingest warehouse snapshot' });
  }
});
