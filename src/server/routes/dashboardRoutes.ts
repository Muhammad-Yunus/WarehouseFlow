import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { extractDbErrorMessage, testDatabaseConnection } from '../../db/index.ts';
import {
  fleetAlerts,
  robotActivityColumns,
  robotTelemetryLogs,
  robots,
  zoneMetrics,
} from '../../db/schema.ts';
import {
  type AuthenticatedRequest,
  requireReadAuth,
  requireRole,
  requireUserAuth,
} from '../auth.ts';

const ZONES = [
  'Warehouse A: Zone B',
  'Warehouse A: Zone A',
  'Warehouse B: Zone C',
] as const;

const DATE_RANGES = ['Today', 'This Week', 'This Month'] as const;

const dashboardQuerySchema = z.object({
  zone: z.enum(ZONES).default('Warehouse A: Zone B'),
  dateRange: z.enum(DATE_RANGES).default('Today'),
});

const patchRobotStatusSchema = z.object({
  status: z.enum(['Active', 'Picking', 'Charging', 'Idle']).optional(),
  hasCargo: z.boolean().optional(),
  batteryHealth: z.number().int().min(0).max(100).optional(),
  taskCompletion: z.number().int().min(0).max(100).optional(),
  zoneName: z.enum(ZONES).optional(),
});

const EMPTY_METRICS = {
  efficiency: 0,
  robots: 0,
  tasks: 0,
  onTime: 0,
  activeMissions: 0,
};

export const dashboardRouter = Router();

dashboardRouter.get('/health', async (_req, res) => {
  const dbHealth = await testDatabaseConnection();
  res.json({
    ok: true,
    service: 'wirehouseflow-api',
    database: dbHealth,
    timestamp: new Date().toISOString(),
  });
});

dashboardRouter.get('/dashboard', requireReadAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = dashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid zone or dateRange query parameter' });
    return;
  }

  const { zone, dateRange } = parsed.data;
  const db = req.db!;

  try {
    const [metricRows, robotRows, activityRows, alertRows] = await Promise.all([
      db
        .select()
        .from(zoneMetrics)
        .where(and(eq(zoneMetrics.zoneName, zone), eq(zoneMetrics.dateRange, dateRange)))
        .limit(1),
      db
        .select()
        .from(robots)
        .orderBy(desc(robots.efficiency), desc(robots.completedTasks), asc(robots.id)),
      db
        .select()
        .from(robotActivityColumns)
        .where(eq(robotActivityColumns.zoneName, zone))
        .orderBy(asc(robotActivityColumns.columnIndex)),
      db
        .select()
        .from(fleetAlerts)
        .orderBy(asc(fleetAlerts.acknowledged), desc(fleetAlerts.createdAt))
        .limit(12),
    ]);

    res.json({
      dataSource: 'postgresql',
      zone,
      dateRange,
      metrics: metricRows[0]
        ? {
            efficiency: metricRows[0].efficiency,
            robots: metricRows[0].robots,
            tasks: metricRows[0].tasks,
            onTime: metricRows[0].onTime,
            activeMissions: metricRows[0].activeMissions,
          }
        : EMPTY_METRICS,
      robots: robotRows.map((r) => ({
        id: r.id,
        role: r.role,
        efficiency: r.efficiency,
        completedTasks: r.completedTasks,
        status: r.status,
        batteryHealth: r.batteryHealth,
        taskCompletion: r.taskCompletion,
        accentColor: r.accentColor === 'green' ? 'green' : 'orange',
        hasCargo: r.hasCargo,
        pathIndex: r.pathIndex,
        initialProgress: r.initialProgress,
        speed: r.speed,
        zoneName: r.zoneName,
      })),
      activityColumns: activityRows.map((col) => ({
        id: col.columnIndex,
        day: col.day,
        dots: col.dots,
        dateLabel: col.dateLabel,
        missions: col.missions,
        delta: col.delta,
        highlighted: col.highlighted,
      })),
      alerts: alertRows,
    });
  } catch (err) {
    const { message, isConnectionError } = extractDbErrorMessage(err);
    if (isConnectionError) {
      console.warn('Dashboard PostgreSQL connection unavailable:', message);
      res.status(503).json({ error: `PostgreSQL unavailable: ${message}` });
      return;
    }
    console.error('Dashboard query error:', message);
    res.status(500).json({ error: 'Failed to load warehouse dashboard data from PostgreSQL' });
  }
});

dashboardRouter.get('/robots', requireReadAuth, async (req: AuthenticatedRequest, res) => {
  const db = req.db!;

  try {
    const rows = await db
      .select()
      .from(robots)
      .orderBy(desc(robots.efficiency), asc(robots.id));
    res.json({ dataSource: 'postgresql', robots: rows });
  } catch (err) {
    const { message, isConnectionError } = extractDbErrorMessage(err);
    res.status(isConnectionError ? 503 : 500).json({
      error: isConnectionError ? `PostgreSQL unavailable: ${message}` : 'Failed to fetch fleet robots',
    });
  }
});

dashboardRouter.get('/robots/:id', requireReadAuth, async (req: AuthenticatedRequest, res) => {
  const robotId = req.params.id;
  const db = req.db!;

  try {
    const [robot] = await db.select().from(robots).where(eq(robots.id, robotId)).limit(1);
    if (!robot) {
      res.status(404).json({ error: 'Robot not found' });
      return;
    }

    const telemetryLogs = await db
      .select()
      .from(robotTelemetryLogs)
      .where(eq(robotTelemetryLogs.robotId, robotId))
      .orderBy(desc(robotTelemetryLogs.recordedAt))
      .limit(25);

    res.json({ dataSource: 'postgresql', robot, telemetryLogs });
  } catch (err) {
    const { message, isConnectionError } = extractDbErrorMessage(err);
    res.status(isConnectionError ? 503 : 500).json({
      error: isConnectionError ? `PostgreSQL unavailable: ${message}` : 'Failed to inspect robot',
    });
  }
});

dashboardRouter.patch(
  '/robots/:id/status',
  requireUserAuth,
  requireRole('admin', 'operator'),
  async (req: AuthenticatedRequest, res) => {
  const parsed = patchRobotStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status update payload', details: parsed.error.flatten() });
    return;
  }

  const db = req.db!;
  const robotId = req.params.id;

  try {
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(robots).where(eq(robots.id, robotId)).limit(1);
      if (!existing) return null;

      const nextValues = {
        status: parsed.data.status ?? existing.status,
        hasCargo: parsed.data.hasCargo ?? existing.hasCargo,
        batteryHealth: parsed.data.batteryHealth ?? existing.batteryHealth,
        taskCompletion: parsed.data.taskCompletion ?? existing.taskCompletion,
        zoneName: parsed.data.zoneName ?? existing.zoneName,
        updatedAt: new Date(),
      };

      const [saved] = await tx
        .update(robots)
        .set(nextValues)
        .where(eq(robots.id, robotId))
        .returning();

      await tx.insert(robotTelemetryLogs).values({
        robotId: saved.id,
        zoneName: saved.zoneName,
        status: saved.status,
        efficiency: saved.efficiency,
        batteryHealth: saved.batteryHealth,
        taskCompletion: saved.taskCompletion,
        completedTasks: saved.completedTasks,
        hasCargo: saved.hasCargo,
        source: `operator:${req.authUser!.email}`,
      });

      return saved;
    });

    if (!updated) {
      res.status(404).json({ error: 'Robot not found' });
      return;
    }

    res.json({ robot: updated });
  } catch (err) {
    console.error('Update robot status error:', err);
    res.status(500).json({ error: 'Failed to update robot status' });
  }
});

dashboardRouter.patch(
  '/alerts/:id/acknowledge',
  requireUserAuth,
  requireRole('admin', 'operator'),
  async (req: AuthenticatedRequest, res) => {
    const alertId = Number(req.params.id);
    if (!Number.isInteger(alertId) || alertId <= 0) {
      res.status(400).json({ error: 'Invalid alert id' });
      return;
    }

    const db = req.db!;
    try {
      const [updated] = await db
        .update(fleetAlerts)
        .set({ acknowledged: true })
        .where(eq(fleetAlerts.id, alertId))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }
      res.json({ alert: updated });
    } catch (err) {
      console.error('Acknowledge alert error:', err);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  }
);

dashboardRouter.get('/export', requireUserAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = dashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid export query parameters' });
    return;
  }

  const db = req.db!;
  const { zone, dateRange } = parsed.data;

  try {
    const [metricRows, robotRows, activityRows, alertRows] = await Promise.all([
      db
        .select()
        .from(zoneMetrics)
        .where(and(eq(zoneMetrics.zoneName, zone), eq(zoneMetrics.dateRange, dateRange)))
        .limit(1),
      db.select().from(robots).orderBy(desc(robots.efficiency), asc(robots.id)),
      db
        .select()
        .from(robotActivityColumns)
        .where(eq(robotActivityColumns.zoneName, zone))
        .orderBy(asc(robotActivityColumns.columnIndex)),
      db.select().from(fleetAlerts).orderBy(desc(fleetAlerts.createdAt)).limit(50),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      exportedBy: req.authUser!.email,
      zone,
      dateRange,
      metrics: metricRows[0] ?? null,
      fleet: robotRows,
      activityColumns: activityRows,
      alerts: alertRows,
    });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export PostgreSQL snapshot' });
  }
});
