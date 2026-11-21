import { Bell, ChevronDown, Search, Share } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DateRangeOption, ZoneOption } from '../types/fleet';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  zone: ZoneOption;
  onZoneChange: (z: ZoneOption) => void;
  dateRange: DateRangeOption;
  onDateRangeChange: (d: DateRangeOption) => void;
  onExport: () => void;
}

const ZONES: ZoneOption[] = [
  'Warehouse A: Zone B',
  'Warehouse A: Zone A',
  'Warehouse B: Zone C',
];

const DATES: DateRangeOption[] = ['Today', 'This Week', 'This Month'];

export function TopBar({
  searchQuery,
  onSearchChange,
  zone,
  onZoneChange,
  dateRange,
  onDateRangeChange,
  onExport,
}: TopBarProps) {
  const [zoneOpen, setZoneOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'Space') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="relative z-30 flex items-center justify-between gap-4 px-1 pt-0.5 pb-3">
      {/* Brand Lockup */}
      <div className="flex items-center gap-2.5 shrink-0 pl-1">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          {/* 6-petal Flowos radial geometric mark */}
          <rect x="10.4" y="2" width="3.2" height="6.8" rx="1.6" fill="#F05A36" />
          <rect
            x="10.4"
            y="2"
            width="3.2"
            height="6.8"
            rx="1.6"
            fill="#F05A36"
            transform="rotate(60 12 12)"
          />
          <rect
            x="10.4"
            y="2"
            width="3.2"
            height="6.8"
            rx="1.6"
            fill="#F05A36"
            transform="rotate(120 12 12)"
          />
          <rect
            x="10.4"
            y="2"
            width="3.2"
            height="6.8"
            rx="1.6"
            fill="#F05A36"
            transform="rotate(180 12 12)"
          />
          <rect
            x="10.4"
            y="2"
            width="3.2"
            height="6.8"
            rx="1.6"
            fill="#F05A36"
            transform="rotate(240 12 12)"
          />
          <rect
            x="10.4"
            y="2"
            width="3.2"
            height="6.8"
            rx="1.6"
            fill="#F05A36"
            transform="rotate(300 12 12)"
          />
        </svg>
        <span className="text-[18.5px] font-semibold tracking-[-0.02em] text-[#212422] whitespace-nowrap">
          Flowos
        </span>
      </div>

      {/* Center Filter Controls Cluster */}
      <div className="flex items-center gap-2.5 flex-1 justify-center max-w-[780px]">
        {/* Search Input Pill */}
        <div className="glass-surface flex items-center justify-between gap-2 rounded-full pl-3.5 pr-1.5 h-[40px] w-full max-w-[310px]">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search className="w-4 h-4 text-[#7c7f78] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search robots, orders..."
              className="w-full bg-transparent text-[12.5px] text-[#212422] placeholder-[#7c7f78] focus:outline-none truncate"
            />
          </div>
          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            className="shrink-0 bg-white/90 hover:bg-white text-[#2f322f] text-[11.5px] font-medium px-3 py-1 rounded-full border border-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] whitespace-nowrap cursor-pointer transition-colors"
          >
            ⌘ + Space
          </button>
        </div>

        {/* Warehouse Zone Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setZoneOpen((v) => !v);
              setDateOpen(false);
              setNotifOpen(false);
            }}
            className="glass-surface hover:bg-white/85 flex items-center gap-2 rounded-full px-4 h-[40px] text-[12.5px] text-[#282b28] whitespace-nowrap cursor-pointer transition-colors"
          >
            <span>
              <span className="text-[#5e625c]">{zone.split(':')[0]}:</span>{' '}
              <span className="font-medium text-[#212422]">{zone.split(':')[1]?.trim()}</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#5e625c]" />
          </button>
          {zoneOpen && (
            <div className="absolute left-0 mt-2 w-52 rounded-2xl bg-white/95 border border-white shadow-[0_14px_34px_rgba(20,24,18,0.12)] p-1.5 z-50">
              {ZONES.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    onZoneChange(z);
                    setZoneOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                    z === zone
                      ? 'bg-[#f4f1ea] text-[#1f2120] font-medium'
                      : 'text-[#4f524c] hover:bg-[#f7f6f2]'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setDateOpen((v) => !v);
              setZoneOpen(false);
              setNotifOpen(false);
            }}
            className="glass-surface hover:bg-white/85 flex items-center gap-2 rounded-full px-4 h-[40px] text-[12.5px] text-[#282b28] whitespace-nowrap cursor-pointer transition-colors"
          >
            <span>
              <span className="text-[#5e625c]">Date:</span>{' '}
              <span className="font-medium text-[#212422]">{dateRange}</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#5e625c]" />
          </button>
          {dateOpen && (
            <div className="absolute left-0 mt-2 w-40 rounded-2xl bg-white/95 border border-white shadow-[0_14px_34px_rgba(20,24,18,0.12)] p-1.5 z-50">
              {DATES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    onDateRangeChange(d);
                    setDateOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                    d === dateRange
                      ? 'bg-[#f4f1ea] text-[#1f2120] font-medium'
                      : 'text-[#4f524c] hover:bg-[#f7f6f2]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Button */}
        <button
          type="button"
          onClick={onExport}
          className="glass-surface hover:bg-white/85 flex items-center gap-2 rounded-full px-4 h-[40px] text-[12.5px] font-medium text-[#212422] whitespace-nowrap cursor-pointer transition-colors"
        >
          <span>Export</span>
          <Share className="w-3.5 h-3.5 text-[#4a4d48]" />
        </button>
      </div>

      {/* Right Cluster: Notifications + User Profile */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setZoneOpen(false);
              setDateOpen(false);
            }}
            aria-label="Notifications"
            className="glass-surface hover:bg-white/85 relative flex items-center justify-center w-[40px] h-[40px] rounded-full text-[#373a36] cursor-pointer transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-[10px] right-[11px] w-1.5 h-1.5 rounded-full bg-[#f05a36]" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white/95 border border-white shadow-[0_14px_34px_rgba(20,24,18,0.12)] p-3 z-50">
              <p className="text-[12px] font-semibold text-[#1f2120] mb-2">Fleet Alerts</p>
              <div className="space-y-2 text-[12px]">
                <div className="p-2 rounded-xl bg-[#faf8f4]">
                  <p className="font-medium text-[#232524]">AMR-024 Battery at 64%</p>
                  <p className="text-[#787b75] text-[11px]">Scheduled recharge after Bay 4 drop</p>
                </div>
                <div className="p-2 rounded-xl bg-[#faf8f4]">
                  <p className="font-medium text-[#232524]">Dock Bay 2 Cleared</p>
                  <p className="text-[#787b75] text-[11px]">Trailer #408 ready for departure</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="glass-surface flex items-center gap-2.5 rounded-full pl-1.5 pr-3.5 h-[42px]">
          {/* Realistic illustrated portrait avatar matching Lorenzo Ruiz in orange jacket */}
          <div className="w-[32px] h-[32px] rounded-full overflow-hidden bg-[#f28c45] shrink-0 border border-white/70">
            <svg viewBox="0 0 64 64" className="w-full h-full" aria-label="Lorenzo Ruiz avatar">
              <defs>
                <linearGradient id="avatarBg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#d8e0dc" />
                  <stop offset="100%" stopColor="#b7c2bd" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" fill="url(#avatarBg)" />
              {/* Orange collar jacket */}
              <path d="M10 64 C12 48, 22 44, 32 44 C42 44, 52 48, 54 64 Z" fill="#e8612b" />
              <path d="M25 45 L32 56 L39 45 Z" fill="#f7f5f0" />
              {/* Neck */}
              <rect x="27" y="36" width="10" height="10" rx="4" fill="#d9a17e" />
              {/* Head */}
              <ellipse cx="32" cy="27" rx="11.5" ry="13.5" fill="#e5b08e" />
              {/* Hair */}
              <path
                d="M20 25 C20 14, 28 11, 34 12 C41 13, 44 18, 44 25 C42 20, 38 18, 32 18 C25 18, 22 21, 20 25 Z"
                fill="#2d2622"
              />
              {/* Glasses */}
              <rect x="22.5" y="23.5" width="8" height="6" rx="2" fill="none" stroke="#2c2927" strokeWidth="1.4" />
              <rect x="33.5" y="23.5" width="8" height="6" rx="2" fill="none" stroke="#2c2927" strokeWidth="1.4" />
              <line x1="30.5" y1="26" x2="33.5" y2="26" stroke="#2c2927" strokeWidth="1.3" />
              {/* Eyes & Smile */}
              <circle cx="26.5" cy="26.5" r="1.2" fill="#231f1d" />
              <circle cx="37.5" cy="26.5" r="1.2" fill="#231f1d" />
              <path d="M28.5 33 Q32 35.5 35.5 33" fill="none" stroke="#9b6248" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="leading-tight pr-1">
            <div className="text-[12px] font-semibold text-[#212422] whitespace-nowrap">
              Lorenzo Ruiz
            </div>
            <div className="text-[10.5px] text-[#757872] whitespace-nowrap">
              Fleet Manager
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[#5e625c] shrink-0" />
        </div>
      </div>
    </header>
  );
}
