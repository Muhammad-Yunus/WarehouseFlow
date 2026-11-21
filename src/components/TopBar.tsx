import { Bell, Check, ChevronDown, Copy, KeyRound, LogOut, Search, Send, Share } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  ApiKeySummary,
  AuthSetupStatus,
  AuthUser,
  DateRangeOption,
  FleetAlert,
  ZoneOption,
} from '../types/fleet';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  zone: ZoneOption;
  onZoneChange: (z: ZoneOption) => void;
  dateRange: DateRangeOption;
  onDateRangeChange: (d: DateRangeOption) => void;
  onExport: () => void;
  alerts: FleetAlert[];
  onAcknowledgeAlert: (id: number) => Promise<void>;
  authUser: AuthUser | null;
  authToken: string | null;
  setupStatus: AuthSetupStatus | null;
  onAuthSuccess: (token: string, user: AuthUser) => void;
  onLogout: (allSessions?: boolean) => Promise<void>;
  onDataRefresh: () => Promise<void>;
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
  alerts,
  onAcknowledgeAlert,
  authUser,
  authToken,
  setupStatus,
  onAuthSuccess,
  onLogout,
  onDataRefresh,
}: TopBarProps) {
  const [zoneOpen, setZoneOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [authTab, setAuthTab] = useState<'login' | 'register' | 'passcode'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [fullName, setFullName] = useState('Lorenzo Ruiz');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [newKeyName, setNewKeyName] = useState('AMR Edge Gateway');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [ingestFeedback, setIngestFeedback] = useState<string | null>(null);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'operator' | 'viewer' | 'admin'>('operator');
  const [userProvisionMsg, setUserProvisionMsg] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const unreadCount = alerts.filter((a) => !a.acknowledged).length;
  const isAdmin = authUser?.role === 'admin';
  const canMutate = authUser?.role === 'admin' || authUser?.role === 'operator';

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

  useEffect(() => {
    if (setupStatus?.hasPasscodeEnv && (setupStatus.userCount ?? 0) === 0 && !authUser) {
      setAuthTab('passcode');
    }
  }, [setupStatus?.hasPasscodeEnv, setupStatus?.userCount, authUser]);

  useEffect(() => {
    if (!profileOpen || !authToken || !isAdmin) return;
    fetch('/api/auth/api-keys', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.keys) setApiKeys(data.keys);
      })
      .catch(() => {});
  }, [profileOpen, authToken, isAdmin]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      const isBootstrap = Boolean(setupStatus?.needsBootstrap);
      const endpoint = isBootstrap
        ? '/api/auth/bootstrap'
        : authTab === 'register'
          ? '/api/auth/register'
          : '/api/auth/login';

      const body = isBootstrap
        ? { email, password, fullName: fullName.trim() || 'Lorenzo Ruiz', jobTitle: 'Fleet Manager' }
        : authTab === 'passcode'
          ? { passcode }
          : authTab === 'register'
            ? { email, password, fullName: fullName.trim() || 'Fleet Viewer', jobTitle: 'Fleet Viewer' }
            : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }
      setPassword('');
      setPasscode('');
      onAuthSuccess(data.token, data.user);
      await onDataRefresh();
    } catch {
      setAuthError('Unable to reach authentication server');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !isAdmin) return;
    setUserProvisionMsg(null);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          fullName: newUserName,
          password: newUserPassword,
          role: newUserRole,
          jobTitle:
            newUserRole === 'admin'
              ? 'Fleet Manager'
              : newUserRole === 'operator'
                ? 'Fleet Operator'
                : 'Fleet Viewer',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Failed to create user');
        return;
      }
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setUserProvisionMsg(`Created ${data.user.role}: ${data.user.email}`);
    } catch {
      setAuthError('Failed to create user account');
    }
  };

  const handleCreateApiKey = async () => {
    if (!authToken) return;
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: newKeyName.trim() || 'Edge Ingest Key' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Failed to generate API key');
        return;
      }
      setRevealedKey(data.apiKey);
      setApiKeys((prev) => [data.key, ...prev]);
    } catch {
      setAuthError('Failed to create API key');
    }
  };

  const handleRevokeKey = async (id: number) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/auth/api-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setApiKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)));
      }
    } catch {
      // ignore
    }
  };

  const handleSendSampleTelemetry = async () => {
    if (!authToken) return;
    setIngestFeedback(null);
    try {
      const nextBattery = Math.floor(58 + Math.random() * 28);
      const nextCompletion = Math.floor(68 + Math.random() * 25);
      const res = await fetch('/api/ingest/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          id: 'AMR-024',
          zoneName: zone,
          role: 'Pallet Carrier',
          efficiency: 98,
          completedTasks: 85,
          status: 'Active',
          batteryHealth: nextBattery,
          taskCompletion: nextCompletion,
          accentColor: 'orange',
          hasCargo: true,
          pathIndex: 0,
          initialProgress: 0.14,
          speed: 0.015,
        }),
      });
      if (res.ok) {
        setIngestFeedback(`Ingested AMR-024 (${nextBattery}% SoC)`);
        await onDataRefresh();
      } else {
        const data = await res.json();
        setIngestFeedback(data.error || 'Ingest failed');
      }
    } catch {
      setIngestFeedback('Ingest request error');
    }
  };

  return (
    <header className="relative z-30 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-1 pt-0.5 pb-3">
      {/* Brand Lockup */}
      <div className="flex items-center gap-2.5 shrink-0 pl-1 order-1">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          {/* 6-petal WirehouseFlow radial geometric mark */}
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
          WirehouseFlow
        </span>
      </div>

      {/* Right Cluster: Notifications + User Profile */}
      <div className="flex items-center gap-2 shrink-0 order-2 xl:order-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setZoneOpen(false);
              setDateOpen(false);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
            className="glass-surface hover:bg-white/85 relative flex items-center justify-center w-[40px] h-[40px] rounded-full text-[#373a36] cursor-pointer transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-[10px] right-[11px] w-1.5 h-1.5 rounded-full bg-[#f05a36]" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-76 rounded-2xl bg-white/95 border border-white shadow-[0_14px_34px_rgba(20,24,18,0.12)] p-3 z-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold text-[#1f2120]">Fleet Alerts</p>
                <span className="text-[10.5px] text-[#787b75]">{unreadCount} active</span>
              </div>
              <div className="space-y-2 text-[12px] max-h-60 overflow-y-auto">
                {alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-2 rounded-xl flex items-start justify-between gap-2 ${
                      alert.acknowledged ? 'bg-[#f5f5f2] opacity-65' : 'bg-[#faf8f4]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[#232524] truncate">{alert.title}</p>
                      <p className="text-[#787b75] text-[11px]">{alert.description}</p>
                    </div>
                    {canMutate && !alert.acknowledged && (
                      <button
                        type="button"
                        onClick={() => void onAcknowledgeAlert(alert.id)}
                        className="shrink-0 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#e3e2dc] text-[#3a3d38] hover:bg-[#f0efe9] cursor-pointer"
                      >
                        Ack
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill + Auth / Ingest Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotifOpen(false);
              setZoneOpen(false);
              setDateOpen(false);
            }}
            className="glass-surface hover:bg-white/85 flex items-center gap-2.5 rounded-full pl-1.5 pr-3 h-[42px] cursor-pointer transition-colors text-left"
          >
            <div className="w-[32px] h-[32px] rounded-full overflow-hidden bg-[#f28c45] shrink-0 border border-white/70">
              <svg viewBox="0 0 64 64" className="w-full h-full" aria-label="Lorenzo Ruiz avatar">
                <defs>
                  <linearGradient id="avatarBg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#d8e0dc" />
                    <stop offset="100%" stopColor="#b7c2bd" />
                  </linearGradient>
                </defs>
                <rect width="64" height="64" fill="url(#avatarBg)" />
                <path d="M10 64 C12 48, 22 44, 32 44 C42 44, 52 48, 54 64 Z" fill="#e8612b" />
                <path d="M25 45 L32 56 L39 45 Z" fill="#f7f5f0" />
                <rect x="27" y="36" width="10" height="10" rx="4" fill="#d9a17e" />
                <ellipse cx="32" cy="27" rx="11.5" ry="13.5" fill="#e5b08e" />
                <path
                  d="M20 25 C20 14, 28 11, 34 12 C41 13, 44 18, 44 25 C42 20, 38 18, 32 18 C25 18, 22 21, 20 25 Z"
                  fill="#2d2622"
                />
                <rect x="22.5" y="23.5" width="8" height="6" rx="2" fill="none" stroke="#2c2927" strokeWidth="1.4" />
                <rect x="33.5" y="23.5" width="8" height="6" rx="2" fill="none" stroke="#2c2927" strokeWidth="1.4" />
                <line x1="30.5" y1="26" x2="33.5" y2="26" stroke="#2c2927" strokeWidth="1.3" />
                <circle cx="26.5" cy="26.5" r="1.2" fill="#231f1d" />
                <circle cx="37.5" cy="26.5" r="1.2" fill="#231f1d" />
                <path d="M28.5 33 Q32 35.5 35.5 33" fill="none" stroke="#9b6248" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="hidden sm:block leading-tight pr-0.5">
              <div className="text-[12px] font-semibold text-[#212422] whitespace-nowrap">
                {authUser?.fullName ?? 'Lorenzo Ruiz'}
              </div>
              <div className="text-[10.5px] text-[#757872] whitespace-nowrap">
                {authUser ? `${authUser.jobTitle} · ${authUser.role}` : 'Sign in required'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#5e625c] shrink-0" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-[320px] rounded-2xl bg-white/95 border border-white shadow-[0_18px_42px_rgba(20,24,18,0.15)] p-3.5 z-50 text-[#212422] max-h-[82vh] overflow-y-auto">
              {!setupStatus?.dbConnected ? (
                <div className="text-[12px] space-y-1.5">
                  <div className="font-semibold text-[#1f2120]">PostgreSQL Connection Pending</div>
                  <p className="text-[#666963] text-[11.5px] leading-relaxed">
                    Configure <code className="px-1 py-0.5 bg-[#f4f2ec] rounded">PGHOST</code>,{' '}
                    <code className="px-1 py-0.5 bg-[#f4f2ec] rounded">PGUSER</code>, and{' '}
                    <code className="px-1 py-0.5 bg-[#f4f2ec] rounded">PGPASSWORD</code> in Settings
                    Secrets to activate live authentication and database ingestion.
                  </p>
                  {setupStatus?.error && (
                    <p className="text-[11px] text-[#c75035] bg-[#faf3f0] px-2 py-1.5 rounded-lg break-words">
                      {setupStatus.error}
                    </p>
                  )}
                </div>
              ) : authUser ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#ecece7]">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold truncate">{authUser.fullName}</div>
                      <div className="text-[11px] text-[#757872] truncate">
                        {authUser.email} · <span className="uppercase">{authUser.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void onLogout(false)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f5f5f2] hover:bg-[#ecece7] text-[11px] font-medium cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Sign out</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void onLogout(true)}
                        title="Revoke all active sessions"
                        className="px-2 py-1 rounded-full bg-[#f5f5f2] hover:bg-[#ecece7] text-[10.5px] text-[#666963] cursor-pointer"
                      >
                        All
                      </button>
                    </div>
                  </div>

                  {isAdmin ? (
                    <>
                      {/* Quick Live Telemetry Ingest Verification (Admin only) */}
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => void handleSendSampleTelemetry()}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#f05a36] hover:bg-[#de4c29] text-white text-[12px] font-medium cursor-pointer transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Ingest Live Telemetry Pulse</span>
                        </button>
                        {ingestFeedback && (
                          <p className="text-[11px] text-[#358a4b] text-center">{ingestFeedback}</p>
                        )}
                      </div>

                      {/* Ingest API Keys (Admin only) */}
                      <div className="pt-2 border-t border-[#ecece7] space-y-2">
                        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#2b2e2b]">
                          <KeyRound className="w-3.5 h-3.5 text-[#f05a36]" />
                          <span>Ingest API Keys</span>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="Key label"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#f5f5f2] text-[11.5px] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void handleCreateApiKey()}
                            className="px-2.5 py-1.5 rounded-lg bg-[#212422] text-white text-[11px] font-medium cursor-pointer shrink-0"
                          >
                            Create
                          </button>
                        </div>

                        {revealedKey && (
                          <div className="p-2 rounded-xl bg-[#faf8f4] border border-[#e7e4dc] space-y-1">
                            <div className="text-[10.5px] text-[#666963]">
                              Copy now (shown once) for <code className="font-mono">X-API-Key</code>:
                            </div>
                            <div className="flex items-center gap-1.5">
                              <code className="text-[10.5px] font-mono truncate flex-1">{revealedKey}</code>
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(revealedKey);
                                  setCopiedKey(true);
                                  setTimeout(() => setCopiedKey(false), 1500);
                                }}
                                className="p-1 rounded bg-white border border-[#e3e2dc] cursor-pointer"
                                title="Copy API key"
                              >
                                {copiedKey ? (
                                  <Check className="w-3 h-3 text-[#358a4b]" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {apiKeys
                            .filter((k) => !k.revoked)
                            .map((k) => (
                              <div
                                key={k.id}
                                className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-[#f7f6f2]"
                              >
                                <span className="truncate">
                                  {k.name} <span className="text-[#8a8d87]">({k.keyPrefix}…)</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void handleRevokeKey(k.id)}
                                  className="text-[#c75035] hover:underline ml-2 shrink-0 cursor-pointer"
                                >
                                  Revoke
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Admin User Provisioning */}
                      <form
                        onSubmit={(e) => void handleProvisionUser(e)}
                        className="pt-2 border-t border-[#ecece7] space-y-1.5"
                      >
                        <div className="text-[11.5px] font-semibold text-[#2b2e2b]">
                          Provision Team Account
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            required
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder="Full name"
                            className="px-2.5 py-1 rounded-lg bg-[#f5f5f2] text-[11px] focus:outline-none"
                          />
                          <select
                            value={newUserRole}
                            onChange={(e) =>
                              setNewUserRole(e.target.value as 'operator' | 'viewer' | 'admin')
                            }
                            className="px-2 py-1 rounded-lg bg-[#f5f5f2] text-[11px] focus:outline-none"
                          >
                            <option value="operator">Operator</option>
                            <option value="viewer">Viewer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <input
                          type="email"
                          required
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="Email address"
                          className="w-full px-2.5 py-1 rounded-lg bg-[#f5f5f2] text-[11px] focus:outline-none"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            placeholder="Password (min 8 chars)"
                            className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-[#f5f5f2] text-[11px] focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 rounded-lg bg-[#212422] text-white text-[11px] font-medium cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>
                        {userProvisionMsg && (
                          <p className="text-[10.5px] text-[#358a4b]">{userProvisionMsg}</p>
                        )}
                        {authError && <p className="text-[10.5px] text-[#c75035]">{authError}</p>}
                      </form>
                    </>
                  ) : (
                    <p className="text-[11px] text-[#666963] leading-relaxed">
                      Signed in with <span className="font-semibold">{authUser.role}</span> permissions.
                      {canMutate
                        ? ' You can acknowledge fleet alerts and update robot status.'
                        : ' Read-only telemetry & export access enabled.'}
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={(e) => void handleAuthSubmit(e)} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold">
                      {setupStatus.needsBootstrap
                        ? 'Claim Initial Admin Account'
                        : authTab === 'passcode'
                          ? 'Admin Passcode Sign In'
                          : authTab === 'register'
                            ? 'Create Viewer Account'
                            : 'Operator Sign In'}
                    </span>
                    {!setupStatus.needsBootstrap && (
                      <div className="flex items-center gap-2 text-[11px]">
                        {setupStatus.hasPasscodeEnv && (
                          <button
                            type="button"
                            onClick={() => {
                              setAuthTab((t) => (t === 'passcode' ? 'login' : 'passcode'));
                              setAuthError(null);
                            }}
                            className="text-[#f05a36] font-medium cursor-pointer"
                          >
                            {authTab === 'passcode' ? 'Email Login' : 'Passcode'}
                          </button>
                        )}
                        {setupStatus.allowPublicRegistration && (
                          <button
                            type="button"
                            onClick={() => {
                              setAuthTab((t) => (t === 'register' ? 'login' : 'register'));
                              setAuthError(null);
                            }}
                            className="text-[#5e625c] font-medium cursor-pointer"
                          >
                            {authTab === 'register' ? 'Sign In' : 'Register'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {authTab === 'passcode' && !setupStatus.needsBootstrap ? (
                    <input
                      type="password"
                      required
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter ADMIN_PASSCODE"
                      className="w-full px-3 py-1.5 rounded-xl bg-[#f5f5f2] text-[12px] focus:outline-none"
                    />
                  ) : (
                    <>
                      {(setupStatus.needsBootstrap || authTab === 'register') && (
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Full Name"
                          className="w-full px-3 py-1.5 rounded-xl bg-[#f5f5f2] text-[12px] focus:outline-none"
                        />
                      )}

                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full px-3 py-1.5 rounded-xl bg-[#f5f5f2] text-[12px] focus:outline-none"
                      />

                      <input
                        type="password"
                        required
                        minLength={setupStatus.needsBootstrap || authTab === 'register' ? 8 : 1}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          setupStatus.needsBootstrap || authTab === 'register'
                            ? 'Password (min 8 chars)'
                            : 'Password'
                        }
                        className="w-full px-3 py-1.5 rounded-xl bg-[#f5f5f2] text-[12px] focus:outline-none"
                      />
                    </>
                  )}

                  {authError && <p className="text-[11px] text-[#c75035]">{authError}</p>}

                  <button
                    type="submit"
                    disabled={authBusy}
                    className="w-full py-2 rounded-xl bg-[#f05a36] hover:bg-[#de4c29] text-white text-[12px] font-medium cursor-pointer disabled:opacity-60 transition-colors"
                  >
                    {authBusy
                      ? 'Authenticating...'
                      : setupStatus.needsBootstrap
                        ? 'Claim Admin & Sign In'
                        : authTab === 'register'
                          ? 'Register'
                          : 'Sign In'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center Filter Controls Cluster */}
      <div className="order-3 xl:order-2 w-full xl:w-auto xl:flex-1 flex flex-wrap items-center justify-start sm:justify-center gap-2 xl:max-w-[740px]">
        {/* Search Input Pill */}
        <div className="glass-surface flex items-center justify-between gap-2 rounded-full pl-3.5 pr-1.5 h-[40px] w-full sm:w-auto sm:flex-1 sm:min-w-[220px] sm:max-w-[300px]">
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
            className="hidden sm:inline-flex shrink-0 bg-white/90 hover:bg-white text-[#2f322f] text-[11.5px] font-medium px-3 py-1 rounded-full border border-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] whitespace-nowrap cursor-pointer transition-colors"
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
              setProfileOpen(false);
            }}
            className="glass-surface hover:bg-white/85 flex items-center gap-2 rounded-full px-3.5 sm:px-4 h-[40px] text-[12px] sm:text-[12.5px] text-[#282b28] whitespace-nowrap cursor-pointer transition-colors"
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
              setProfileOpen(false);
            }}
            className="glass-surface hover:bg-white/85 flex items-center gap-2 rounded-full px-3.5 sm:px-4 h-[40px] text-[12px] sm:text-[12.5px] text-[#282b28] whitespace-nowrap cursor-pointer transition-colors"
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
          className="glass-surface hover:bg-white/85 flex items-center gap-2 rounded-full px-3.5 sm:px-4 h-[40px] text-[12px] sm:text-[12.5px] font-medium text-[#212422] whitespace-nowrap cursor-pointer transition-colors"
        >
          <span>Export</span>
          <Share className="w-3.5 h-3.5 text-[#4a4d48]" />
        </button>
      </div>
    </header>
  );
}
