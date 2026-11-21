export type RobotStatus = 'Active' | 'Picking' | 'Charging' | 'Idle';

export type NavSection = 'dashboard' | 'inventory' | 'telemetry' | 'controls' | 'alerts';

export type DateRangeOption = 'Today' | 'This Week' | 'This Month';

export type ZoneOption =
  | 'Warehouse A: Zone B'
  | 'Warehouse A: Zone A'
  | 'Warehouse B: Zone C';

export interface RobotUnit {
  id: string;
  role: string;
  efficiency: number;
  completedTasks: number;
  status: RobotStatus;
  batteryHealth: number;
  taskCompletion: number;
  accentColor: 'orange' | 'green';
  hasCargo: boolean;
  /** World-space position offset or path index in 3D warehouse */
  pathIndex: number;
  initialProgress: number;
  speed: number;
}

export interface ActivityColumn {
  id: number;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  dots: number; // 1 to 14 vertical dots
  dateLabel: string;
  missions: number;
  delta: string;
  highlighted?: boolean;
}

export interface ZoneMetrics {
  efficiency: number;
  robots: number;
  tasks: number;
  onTime: number;
  activeMissions: number;
}

export interface FleetAlert {
  id: number;
  zoneName: string;
  robotId: string | null;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical' | string;
  acknowledged: boolean;
  createdAt: string;
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  jobTitle: string;
  role: UserRole;
}

export interface AuthSetupStatus {
  dbConfigured: boolean;
  dbConnected: boolean;
  needsBootstrap: boolean;
  hasPasscodeEnv: boolean;
  authRequired?: boolean;
  allowPublicRegistration?: boolean;
  userCount?: number;
  error?: string;
}

export interface ApiKeySummary {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string;
  lastUsedAt: string | null;
  revoked: boolean;
  createdAt: string;
}

