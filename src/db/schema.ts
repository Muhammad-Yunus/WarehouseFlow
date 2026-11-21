import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const zoneMetrics = pgTable(
  'zone_metrics',
  {
    id: serial('id').primaryKey(),
    zoneName: text('zone_name').notNull(),
    dateRange: text('date_range').notNull(),
    efficiency: integer('efficiency').notNull(),
    robots: integer('robots').notNull(),
    tasks: integer('tasks').notNull(),
    onTime: real('on_time').notNull(),
    activeMissions: integer('active_missions').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('zone_metrics_zone_date_idx').on(table.zoneName, table.dateRange),
  ]
);

export const robots = pgTable('robots', {
  id: text('id').primaryKey(),
  zoneName: text('zone_name').notNull().default('Warehouse A: Zone B'),
  role: text('role').notNull(),
  efficiency: integer('efficiency').notNull(),
  completedTasks: integer('completed_tasks').notNull(),
  status: text('status').notNull().default('Active'),
  batteryHealth: integer('battery_health').notNull(),
  taskCompletion: integer('task_completion').notNull(),
  accentColor: text('accent_color').notNull().default('orange'),
  hasCargo: boolean('has_cargo').notNull().default(false),
  pathIndex: integer('path_index').notNull().default(0),
  initialProgress: real('initial_progress').notNull().default(0),
  speed: real('speed').notNull().default(0.015),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const robotActivityColumns = pgTable(
  'robot_activity_columns',
  {
    id: serial('id').primaryKey(),
    zoneName: text('zone_name').notNull().default('Warehouse A: Zone B'),
    columnIndex: integer('column_index').notNull(),
    day: text('day').notNull(),
    dots: integer('dots').notNull(),
    dateLabel: text('date_label').notNull(),
    missions: integer('missions').notNull(),
    delta: text('delta').notNull(),
    highlighted: boolean('highlighted').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('activity_zone_col_idx').on(table.zoneName, table.columnIndex),
  ]
);

export const fleetAlerts = pgTable('fleet_alerts', {
  id: serial('id').primaryKey(),
  zoneName: text('zone_name').notNull().default('Warehouse A: Zone B'),
  robotId: text('robot_id').references(() => robots.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull().default('info'),
  acknowledged: boolean('acknowledged').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const robotTelemetryLogs = pgTable('robot_telemetry_logs', {
  id: serial('id').primaryKey(),
  robotId: text('robot_id')
    .notNull()
    .references(() => robots.id, { onDelete: 'cascade' }),
  zoneName: text('zone_name').notNull(),
  status: text('status').notNull(),
  efficiency: integer('efficiency').notNull(),
  batteryHealth: integer('battery_health').notNull(),
  taskCompletion: integer('task_completion').notNull(),
  completedTasks: integer('completed_tasks').notNull(),
  hasCargo: boolean('has_cargo').notNull().default(false),
  source: text('source').notNull().default('api-ingest'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  jobTitle: text('job_title').notNull().default('Fleet Manager'),
  role: text('role').notNull().default('operator'),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const authSessions = pgTable('auth_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  scopes: text('scopes').notNull().default('ingest:write,fleet:read'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
