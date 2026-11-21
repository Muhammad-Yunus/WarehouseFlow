import type { ActivityColumn, DateRangeOption, RobotUnit, ZoneMetrics, ZoneOption } from '../types/fleet.ts';

export const ZONE_METRICS: Record<ZoneOption, Record<DateRangeOption, ZoneMetrics>> = {
  'Warehouse A: Zone B': {
    Today: {
      efficiency: 90,
      robots: 128,
      tasks: 2156,
      onTime: 96.8,
      activeMissions: 247,
    },
    'This Week': {
      efficiency: 92,
      robots: 128,
      tasks: 14820,
      onTime: 97.4,
      activeMissions: 312,
    },
    'This Month': {
      efficiency: 89,
      robots: 128,
      tasks: 62410,
      onTime: 95.9,
      activeMissions: 284,
    },
  },
  'Warehouse A: Zone A': {
    Today: {
      efficiency: 93,
      robots: 96,
      tasks: 1840,
      onTime: 98.1,
      activeMissions: 194,
    },
    'This Week': {
      efficiency: 91,
      robots: 96,
      tasks: 12190,
      onTime: 96.5,
      activeMissions: 228,
    },
    'This Month': {
      efficiency: 90,
      robots: 96,
      tasks: 51340,
      onTime: 96.2,
      activeMissions: 215,
    },
  },
  'Warehouse B: Zone C': {
    Today: {
      efficiency: 87,
      robots: 112,
      tasks: 1930,
      onTime: 94.6,
      activeMissions: 218,
    },
    'This Week': {
      efficiency: 88,
      robots: 112,
      tasks: 13450,
      onTime: 95.1,
      activeMissions: 241,
    },
    'This Month': {
      efficiency: 88,
      robots: 112,
      tasks: 56280,
      onTime: 94.9,
      activeMissions: 230,
    },
  },
};

export const FLEET_ROBOTS: RobotUnit[] = [
  {
    id: 'AMR-024',
    role: 'Pallet Carrier',
    efficiency: 98,
    completedTasks: 84,
    status: 'Active',
    batteryHealth: 64,
    taskCompletion: 73,
    accentColor: 'orange',
    hasCargo: true,
    pathIndex: 0,
    initialProgress: 0.14,
    speed: 0.015,
  },
  {
    id: 'AMR-017',
    role: 'Free Loader',
    efficiency: 98,
    completedTasks: 79,
    status: 'Picking',
    batteryHealth: 82,
    taskCompletion: 88,
    accentColor: 'green',
    hasCargo: false,
    pathIndex: 1,
    initialProgress: 0.54,
    speed: 0.017,
  },
  {
    id: 'AMR-012',
    role: 'Pallet Carrier',
    efficiency: 95,
    completedTasks: 74,
    status: 'Active',
    batteryHealth: 78,
    taskCompletion: 69,
    accentColor: 'orange',
    hasCargo: true,
    pathIndex: 2,
    initialProgress: 0.38,
    speed: 0.014,
  },
  {
    id: 'AMR-031',
    role: 'Dock Shuttle',
    efficiency: 94,
    completedTasks: 71,
    status: 'Picking',
    batteryHealth: 51,
    taskCompletion: 64,
    accentColor: 'green',
    hasCargo: true,
    pathIndex: 3,
    initialProgress: 0.12,
    speed: 0.016,
  },
  {
    id: 'AMR-008',
    role: 'Free Loader',
    efficiency: 92,
    completedTasks: 68,
    status: 'Active',
    batteryHealth: 91,
    taskCompletion: 82,
    accentColor: 'green',
    hasCargo: false,
    pathIndex: 4,
    initialProgress: 0.36,
    speed: 0.016,
  },
  {
    id: 'AMR-019',
    role: 'Pallet Carrier',
    efficiency: 91,
    completedTasks: 65,
    status: 'Charging',
    batteryHealth: 34,
    taskCompletion: 58,
    accentColor: 'orange',
    hasCargo: false,
    pathIndex: 5,
    initialProgress: 0.72,
    speed: 0.013,
  },
];

// 38 dot-matrix columns across Mon - Sun matching the exact silhouette & Thursday peak in the reference
const RAW_COLUMN_HEIGHTS: Array<{
  day: ActivityColumn['day'];
  dots: number;
  dateLabel: string;
  missions: number;
  delta: string;
  highlighted?: boolean;
}> = [
  // Mon (6 cols)
  { day: 'Mon', dots: 2, dateLabel: '20 July', missions: 11, delta: '+1.20%' },
  { day: 'Mon', dots: 3, dateLabel: '20 July', missions: 14, delta: '+1.45%' },
  { day: 'Mon', dots: 6, dateLabel: '20 July', missions: 22, delta: '+2.84%' },
  { day: 'Mon', dots: 4, dateLabel: '20 July', missions: 16, delta: '+1.72%' },
  { day: 'Mon', dots: 3, dateLabel: '20 July', missions: 13, delta: '+1.18%' },
  { day: 'Mon', dots: 2, dateLabel: '20 July', missions: 10, delta: '+0.94%' },
  // Tue (5 cols)
  { day: 'Tue', dots: 4, dateLabel: '21 July', missions: 17, delta: '+2.05%' },
  { day: 'Tue', dots: 2, dateLabel: '21 July', missions: 11, delta: '+1.08%' },
  { day: 'Tue', dots: 2, dateLabel: '21 July', missions: 12, delta: '+1.12%' },
  { day: 'Tue', dots: 2, dateLabel: '21 July', missions: 11, delta: '+0.95%' },
  { day: 'Tue', dots: 2, dateLabel: '21 July', missions: 10, delta: '+0.88%' },
  // Wed (5 cols)
  { day: 'Wed', dots: 3, dateLabel: '22 July', missions: 15, delta: '+1.54%' },
  { day: 'Wed', dots: 2, dateLabel: '22 July', missions: 12, delta: '+1.19%' },
  { day: 'Wed', dots: 2, dateLabel: '22 July', missions: 11, delta: '+1.02%' },
  { day: 'Wed', dots: 2, dateLabel: '22 July', missions: 12, delta: '+1.21%' },
  { day: 'Wed', dots: 4, dateLabel: '22 July', missions: 18, delta: '+2.14%' },
  // Thu (6 cols - Coral Peak!)
  { day: 'Thu', dots: 6, dateLabel: '23 July', missions: 24, delta: '+3.18%' },
  { day: 'Thu', dots: 9, dateLabel: '23 July', missions: 34, delta: '+5.31%', highlighted: true },
  { day: 'Thu', dots: 6, dateLabel: '23 July', missions: 25, delta: '+3.42%' },
  { day: 'Thu', dots: 5, dateLabel: '23 July', missions: 21, delta: '+2.64%' },
  { day: 'Thu', dots: 5, dateLabel: '23 July', missions: 20, delta: '+2.48%' },
  { day: 'Thu', dots: 4, dateLabel: '23 July', missions: 17, delta: '+1.92%' },
  // Fri (6 cols)
  { day: 'Fri', dots: 2, dateLabel: '24 July', missions: 12, delta: '+1.15%' },
  { day: 'Fri', dots: 2, dateLabel: '24 July', missions: 11, delta: '+1.04%' },
  { day: 'Fri', dots: 2, dateLabel: '24 July', missions: 12, delta: '+1.22%' },
  { day: 'Fri', dots: 3, dateLabel: '24 July', missions: 14, delta: '+1.60%' },
  { day: 'Fri', dots: 4, dateLabel: '24 July', missions: 18, delta: '+2.10%' },
  { day: 'Fri', dots: 2, dateLabel: '24 July', missions: 11, delta: '+0.98%' },
  // Sat (5 cols)
  { day: 'Sat', dots: 2, dateLabel: '25 July', missions: 10, delta: '+0.74%' },
  { day: 'Sat', dots: 2, dateLabel: '25 July', missions: 9, delta: '+0.62%' },
  { day: 'Sat', dots: 2, dateLabel: '25 July', missions: 10, delta: '+0.71%' },
  { day: 'Sat', dots: 2, dateLabel: '25 July', missions: 9, delta: '+0.58%' },
  { day: 'Sat', dots: 1, dateLabel: '25 July', missions: 7, delta: '+0.42%' },
  // Sun (5 cols)
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 6, delta: '+0.35%' },
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 7, delta: '+0.41%' },
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 8, delta: '+0.48%' },
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 7, delta: '+0.39%' },
  { day: 'Sun', dots: 1, dateLabel: '26 July', missions: 6, delta: '+0.31%' },
];

export const ACTIVITY_COLUMNS: ActivityColumn[] = RAW_COLUMN_HEIGHTS.map((col, idx) => ({
  id: idx,
  ...col,
}));
