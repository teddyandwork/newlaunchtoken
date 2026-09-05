import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Blocks,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  Filter,
  Gauge,
  Globe2,
  Layers3,
  Loader2,
  LockKeyhole,
  Menu,
  Pause,
  Play,
  Radio,
  Radar,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey,
  getGetEventsQueryKey,
  getGetProvidersQueryKey,
  getGetSettingsQueryKey,
  getGetTokensQueryKey,
  getHealthCheckQueryKey,
  type DashboardSummary,
  type HealthStatus,
  type ProviderStatus,
  type RadarSettings,
  type Token,
  type TokenEvent,
  useGetDashboardSummary,
  useGetEvents,
  useGetProviders,
  useGetSettings,
  useGetTokens,
  useHealthCheck,
  useSendTelegramTest,
  useUpdateSettings,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

const chainColors: Record<string, string> = {
  ethereum: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  base: 'bg-sky-50 text-sky-700 border-sky-100',
  solana: 'bg-violet-50 text-violet-700 border-violet-100',
  arbitrum: 'bg-blue-50 text-blue-700 border-blue-100',
  polygon: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
  bsc: 'bg-amber-50 text-amber-700 border-amber-100',
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatNumber(value?: number | null) {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatMoney(value?: number | null) {
  if (value === undefined || value === null) return '—';
  if (value < 0.01) return `$${value.toFixed(5)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  return `$${formatNumber(value)}`;
}

function formatTime(value?: string | null) {
  if (!value) return 'No event recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function formatRelative(value?: string | null) {
  if (!value) return 'Awaiting first event';
  const elapsed = Date.now() - new Date(value).getTime();
  if (Number.isNaN(elapsed)) return 'Unknown age';
  const seconds = Math.max(0, Math.floor(elapsed / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function shortAddress(address?: string | null) {
  if (!address) return 'Address unavailable';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status?: string) {
  if (status === 'connected' || status === 'ok' || status === 'discovered' || status === 'posted') return 'good';
  if (status === 'starting' || status === 'rate_limited' || status === 'degraded' || status === 'enriched' || status === 'skipped_no_telegram' || status === 'skipped_invalid_telegram') return 'warn';
  if (status === 'disabled') return 'muted';
  return 'bad';
}

function StatusDot({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold" data-testid={label ? `status-${label}` : `status-${status}`}>
      <span className={cn(
        'h-2 w-2 rounded-full',
        tone === 'good' && 'bg-lime-500 animate-pulse-soft',
        tone === 'warn' && 'bg-amber-400',
        tone === 'bad' && 'bg-rose-500',
        tone === 'muted' && 'bg-slate-300',
      )} />
      <span className={cn(
        tone === 'good' && 'text-emerald-700',
        tone === 'warn' && 'text-amber-700',
        tone === 'bad' && 'text-rose-700',
        tone === 'muted' && 'text-slate-500',
      )}>{titleCase(status)}</span>
    </span>
  );
}

function Panel({ children, className, title, eyebrow, action }: {
  children: ReactNode;
  className?: string;
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border border-card-border bg-card shadow-panel', className)}>
      {(title || eyebrow || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            {eyebrow && <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-primary">{eyebrow}</div>}
            {title && <h2 className="mt-1 text-sm font-extrabold tracking-tight text-card-foreground">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} data-testid="loading-skeleton" />;
}

function ErrorState({ message = 'The radar could not read this signal.', retry }: { message?: string; retry?: () => void }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 px-6 text-center" data-testid="state-error">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600"><TriangleAlert size={18} /></div>
      <div>
        <p className="text-sm font-bold text-foreground">{message}</p>
        <p className="mt-1 text-xs text-muted-foreground">No substitute data is being shown.</p>
      </div>
      {retry && (
        <button type="button" onClick={retry} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary" data-testid="button-retry">
          <RotateCcw size={13} /> Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({ title, detail, icon: Icon = Radio }: { title: string; detail: string; icon?: typeof Radio }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center px-6 text-center" data-testid="state-empty">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-primary/35 bg-primary/5 text-primary"><Icon size={19} /></div>
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, accent = 'cyan', loading }: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  accent?: 'cyan' | 'lime' | 'amber' | 'coral';
  loading?: boolean;
}) {
  const colors = {
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    lime: 'bg-lime-50 text-lime-700 border-lime-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    coral: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  return (
    <div className="rounded-xl border border-card-border bg-card p-4 shadow-panel transition duration-300 hover:-translate-y-0.5 hover:shadow-lg" data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', colors[accent])}><Icon size={15} /></span>
      </div>
      {loading ? <Skeleton className="mt-4 h-8 w-20" /> : <div className="mt-3 font-mono text-2xl font-medium tracking-tight text-card-foreground">{value}</div>}
      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-slate-950 shadow-[0_0_0_4px_rgba(190,220,60,0.1)]">
        <Radar size={19} strokeWidth={2.5} />
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-slate-950" />
      </div>
      <div>
        <div className="text-sm font-extrabold tracking-tight text-sidebar-foreground">Token Radar</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/50">Operations console</div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { href: '/', label: 'Live radar', icon: Radio },
    { href: '/providers', label: 'Providers', icon: Blocks },
    { href: '/settings', label: 'Settings', icon: SlidersHorizontal },
  ];
  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="px-2"><BrandMark /></div>
        <div className="mt-10 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/40">Monitor</div>
        <nav className="mt-3 space-y-1" aria-label="Primary navigation">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold transition',
                  active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
                )}
                data-testid={`link-${label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <span className="flex items-center gap-3"><Icon size={16} /><span>{label}</span></span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
            <div className="flex items-center gap-2 text-xs font-bold"><span className="h-2 w-2 rounded-full bg-lime-400 animate-pulse-soft" /> Live polling</div>
            <p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/50">Signals update automatically. Unsupported feeds stay visible and marked.</p>
          </div>
          <div className="mt-5 flex items-center justify-between px-2 font-mono text-[9px] uppercase tracking-wider text-sidebar-foreground/35"><span>Radar v0.1</span><span>UTC</span></div>
        </div>
      </aside>
      {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation" />}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:px-7 lg:px-9">
          <button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-navigation"><Menu size={20} /></button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="font-mono text-[10px] uppercase tracking-[0.15em]">Network pulse</span><span className="h-1.5 w-1.5 rounded-full bg-lime-500" /><span>Listening across configured feeds</span></div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground md:flex"><Clock3 size={13} /> All times UTC</div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck size={16} /></div>
          </div>
        </header>
        <main className="radar-grid min-h-[calc(100dvh-4rem)] px-4 py-6 sm:px-7 lg:px-9 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="animate-rise">
        <div className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> {eyebrow}</div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
      {action && <div className="animate-rise">{action}</div>}
    </div>
  );
}

function HealthStrip({ health, loading }: { health?: HealthStatus; loading?: boolean }) {
  const items = [
    { label: 'Core', status: health?.status ?? 'starting', value: health ? `${Math.round(health.uptime / 3600)}h uptime` : 'Checking' },
    { label: 'Database', status: health?.database ?? 'starting', value: health?.database === 'connected' ? 'Writable' : 'Checking' },
    { label: 'Telegram', status: health?.telegram ?? 'starting', value: health?.telegram === 'connected' ? 'Delivery ready' : health?.telegram === 'unconfigured' ? 'Not configured' : 'Disconnected' },
  ];
  return (
    <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="health-strip">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between rounded-lg border border-card-border bg-card/90 px-3.5 py-3 shadow-panel">
          <div className="flex items-center gap-2.5"><StatusDot status={item.status} label={`health-${item.label.toLowerCase()}`} /><span className="text-xs text-muted-foreground">{item.label}</span></div>
          <span className="font-mono text-[10px] text-muted-foreground">{loading ? '...' : item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ProviderPills({ providers }: { providers?: ProviderStatus[] }) {
  if (!providers?.length) return <span className="text-xs text-muted-foreground">No providers configured</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {providers.map((provider) => (
        <span key={provider.id} className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold" data-testid={`provider-pill-${provider.id}`}>
          <StatusDot status={provider.status} />
          {provider.displayName}
        </span>
      ))}
    </div>
  );
}

function EventsPanel({ events, loading, error, retry }: { events?: TokenEvent[]; loading: boolean; error: boolean; retry: () => void }) {
  return (
    <Panel eyebrow="Signal stream" title="Recent discovery activity" action={<span className="font-mono text-[10px] text-muted-foreground">{events?.length ?? 0} visible</span>}>
      {loading ? (
        <div className="space-y-4 p-5">{[1, 2, 3, 4].map((n) => <div key={n} className="flex gap-3"><Skeleton className="mt-1 h-2 w-2 rounded-full" /><div className="flex-1"><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-2 h-2 w-1/3" /></div></div>)}</div>
      ) : error ? <ErrorState retry={retry} /> : !events?.length ? <EmptyState icon={Activity} title="No events in the stream" detail="The timeline will fill as configured providers emit discoverable signals." /> : (
        <div className="divide-y divide-border/70" data-testid="event-list">
          {events.slice(0, 8).map((event) => (
            <div key={event.id} className="flex gap-3 px-5 py-3.5 transition hover:bg-muted/45" data-testid={`event-row-${event.id}`}>
              <div className={cn('mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md', statusTone(event.type) === 'good' ? 'bg-lime-50 text-lime-700' : statusTone(event.type) === 'warn' ? 'bg-amber-50 text-amber-700' : statusTone(event.type) === 'bad' ? 'bg-rose-50 text-rose-700' : 'bg-muted text-muted-foreground')}>
                {event.type === 'posted' ? <Send size={12} /> : event.type === 'provider_error' ? <TriangleAlert size={12} /> : event.type === 'duplicate' ? <Layers3 size={12} /> : <Zap size={12} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="truncate text-xs font-bold text-foreground">{event.message}</p><span className="font-mono text-[10px] text-muted-foreground">{formatRelative(event.occurredAt)}</span></div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground"><span className="font-mono uppercase">{event.source}</span><span className="h-0.5 w-0.5 rounded-full bg-border" /><span>{titleCase(event.type)}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function TokenRow({ token }: { token: Token }) {
  return (
    <div className="grid grid-cols-[minmax(170px,1.5fr)_80px_minmax(90px,1fr)_minmax(90px,1fr)_82px] items-center gap-3 border-b border-border/70 px-5 py-3.5 last:border-0 hover:bg-muted/35" data-testid={`token-row-${token.id}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted font-mono text-[10px] font-bold text-muted-foreground">
          {token.logoUrl ? <img src={token.logoUrl} alt="" className="h-full w-full object-cover" /> : (token.symbol ?? token.name ?? '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0"><div className="truncate text-xs font-extrabold text-foreground">{token.name || 'Unnamed token'} <span className="font-mono text-[10px] text-muted-foreground">{token.symbol ? `$${token.symbol}` : ''}</span></div><div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{shortAddress(token.address)}</div></div>
      </div>
      <span className={cn('w-fit rounded border px-1.5 py-1 text-[10px] font-bold uppercase', chainColors[token.chain.toLowerCase()] || 'border-border bg-muted text-muted-foreground')}>{token.chain}</span>
      <div><div className="font-mono text-xs text-foreground">{formatMoney(token.liquidityUsd)}</div><div className="mt-0.5 text-[10px] text-muted-foreground">liquidity</div></div>
      <div><div className="font-mono text-xs text-foreground">{formatMoney(token.volume5mUsd)}</div><div className="mt-0.5 text-[10px] text-muted-foreground">5m volume</div></div>
      <div className="text-right"><div className="font-mono text-[10px] text-muted-foreground">{formatRelative(token.detectedAt)}</div><div className={cn('mt-1 text-[10px] font-bold', token.posted ? 'text-emerald-700' : 'text-amber-700')}>{token.posted ? 'Posted' : token.telegramValid ? 'Not posted' : 'No valid Telegram'}</div></div>
    </div>
  );
}

function TokensPanel({ tokens, loading, error, retry }: { tokens?: Token[]; loading: boolean; error: boolean; retry: () => void }) {
  return (
    <Panel eyebrow="Latest signal" title="Newly discoverable tokens" action={<span className="font-mono text-[10px] text-muted-foreground">Newest first</span>}>
      <div className="hidden grid-cols-[minmax(170px,1.5fr)_80px_minmax(90px,1fr)_minmax(90px,1fr)_82px] gap-3 border-b border-border bg-muted/45 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground md:grid"><span>Token</span><span>Chain</span><span>Liquidity</span><span>Volume 5m</span><span className="text-right">Detected</span></div>
      {loading ? <div className="space-y-3 p-5">{[1, 2, 3].map((n) => <div key={n} className="flex gap-3"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 flex-1" /></div>)}</div> : error ? <ErrorState retry={retry} /> : !tokens?.length ? <EmptyState icon={Layers3} title="No tokens discovered yet" detail="A truthful empty state: no provider has delivered a token signal to this radar." /> : <div className="overflow-x-auto"><div className="min-w-[680px]">{tokens.slice(0, 10).map((token) => <TokenRow key={token.id} token={token} />)}</div></div>}
    </Panel>
  );
}

function Home() {
  const queryClientInstance = useQueryClient();
  const healthQuery = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 15000 } });
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 20000 } });
  const providersQuery = useGetProviders({ query: { queryKey: getGetProvidersQueryKey(), refetchInterval: 20000 } });
  const tokensQuery = useGetTokens({ limit: 12 }, { query: { queryKey: getGetTokensQueryKey({ limit: 12 }), refetchInterval: 20000 } });
  const eventsQuery = useGetEvents({ limit: 12 }, { query: { queryKey: getGetEventsQueryKey({ limit: 12 }), refetchInterval: 15000 } });
  const summary = summaryQuery.data as DashboardSummary | undefined;
  const refresh = () => {
    void queryClientInstance.invalidateQueries();
  };
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Live radar / overview"
        title="Find the next signal."
        detail="A focused readout of discovery volume, feed health, duplicate suppression, and delivery readiness across your configured chains."
        action={<button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-foreground shadow-panel transition hover:border-primary hover:text-primary" data-testid="button-refresh-radar"><RefreshCw size={14} /> Refresh radar</button>}
      />
      <HealthStrip health={healthQuery.data} loading={healthQuery.isLoading} />
      {healthQuery.isError && <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800" data-testid="status-health-error">Health endpoint unavailable. Individual panels below remain honest about their own status.</div>}
      <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
        <MetricCard label="Tokens discovered" value={formatNumber(summary?.tokensDiscovered)} detail="All-time accepted signals" icon={Layers3} loading={summaryQuery.isLoading} />
        <MetricCard label="Valid Telegram" value={formatNumber(summary?.tokensWithValidTelegram)} detail="Provider-supplied links" icon={CheckCircle2} loading={summaryQuery.isLoading} />
        <MetricCard label="Alerts posted" value={formatNumber(summary?.alertsPosted)} detail="Delivered to Telegram" icon={Send} accent="lime" loading={summaryQuery.isLoading} />
        <MetricCard label="Skipped / no Telegram" value={formatNumber(summary?.skippedNoTelegram)} detail="Rejected before queue" icon={LockKeyhole} accent="amber" loading={summaryQuery.isLoading} />
        <MetricCard label="Skipped / invalid Telegram" value={formatNumber(summary?.skippedInvalidTelegram)} detail="Rejected at validation" icon={TriangleAlert} accent="coral" loading={summaryQuery.isLoading} />
        <MetricCard label="Duplicates ignored" value={formatNumber(summary?.duplicatesIgnored)} detail="Suppressed before delivery" icon={Filter} accent="amber" loading={summaryQuery.isLoading} />
        <MetricCard label="Events / 24h" value={formatNumber(summary?.eventsLast24h)} detail={`${summary?.activeProviders ?? '—'} of ${summary?.totalProviders ?? '—'} providers active`} icon={Activity} accent="coral" loading={summaryQuery.isLoading} />
      </div>
      {summaryQuery.isError ? <Panel className="mb-7"><ErrorState retry={() => void summaryQuery.refetch()} message="Dashboard totals are temporarily unavailable." /></Panel> : (
        <div className="mb-7 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <Panel eyebrow="Coverage" title="Provider pulse" action={<Link href="/providers" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline" data-testid="link-view-providers">View all <ChevronRight size={13} /></Link>}>
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between"><div className="text-2xl font-extrabold tracking-tight text-foreground">{summary?.activeProviders ?? '—'}<span className="text-base font-medium text-muted-foreground"> / {summary?.totalProviders ?? '—'}</span></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">active providers</span></div>
              <ProviderPills providers={providersQuery.data} />
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-[11px]"><span className="text-muted-foreground">Last event</span><span className="font-mono font-medium text-foreground">{formatRelative(summary?.lastEventAt || healthQuery.data?.lastEventAt)}</span></div>
            </div>
          </Panel>
          <Panel eyebrow="Chain mix" title="Top chains">
            {!summary?.topChains?.length ? <EmptyState icon={Globe2} title="No chain mix yet" detail="Chain distribution appears after the first accepted discovery." /> : (
              <div className="space-y-4 p-5" data-testid="top-chains">
                {summary.topChains.slice(0, 4).map((chain, index) => {
                  const total = summary.topChains?.reduce((sum, item) => sum + item.count, 0) || 1;
                  const width = Math.max(4, Math.round((chain.count / total) * 100));
                  return <div key={chain.chain} data-testid={`chain-stat-${chain.chain}`}><div className="mb-1.5 flex justify-between text-xs"><span className="font-bold capitalize">{chain.chain}</span><span className="font-mono text-muted-foreground">{formatNumber(chain.count)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', index === 0 ? 'bg-primary' : index === 1 ? 'bg-cyan-300' : index === 2 ? 'bg-lime-400' : 'bg-amber-300')} style={{ width: `${width}%` }} /></div></div>;
                })}
              </div>
            )}
          </Panel>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[.86fr_1.14fr]">
        <EventsPanel events={eventsQuery.data} loading={eventsQuery.isLoading} error={eventsQuery.isError} retry={() => void eventsQuery.refetch()} />
        <TokensPanel tokens={tokensQuery.data} loading={tokensQuery.isLoading} error={tokensQuery.isError} retry={() => void tokensQuery.refetch()} />
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  const disabled = provider.status === 'disabled' || provider.mode === 'disabled';
  return (
    <article className={cn('rounded-xl border bg-card p-5 shadow-panel transition duration-300 hover:-translate-y-0.5', disabled ? 'border-dashed border-amber-200 bg-amber-50/35' : 'border-card-border')} data-testid={`provider-card-${provider.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3"><div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', disabled ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary')}><Server size={19} /></div><div><h3 className="text-sm font-extrabold text-foreground">{provider.displayName}</h3><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{provider.id}</p></div></div>
        <StatusDot status={provider.status} label={`provider-${provider.id}`} />
      </div>
      <p className="mt-4 min-h-[42px] text-xs leading-5 text-muted-foreground">{provider.description || 'No capability description provided by this provider.'}</p>
      {disabled && <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-900"><CircleHelp size={14} className="mt-0.5 shrink-0" /><span>This feed is disabled. The radar will not pretend it is receiving events.</span></div>}
      {provider.error && <div className="mt-4 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] leading-4 text-rose-800"><TriangleAlert size={14} className="mt-0.5 shrink-0" /><span>{provider.error}</span></div>}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="rounded border border-border bg-muted px-2 py-1 font-mono text-[10px] uppercase">{provider.mode}</span>
        {provider.chains.map((chain) => <span key={chain} className="rounded border border-border px-2 py-1 text-[10px] font-semibold capitalize text-muted-foreground">{chain}</span>)}
      </div>
      <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground"><span>{formatNumber(provider.eventsSeen)} events seen</span><span className="font-mono">{formatRelative(provider.lastEventAt)}</span></div>
    </article>
  );
}

function ProvidersPage() {
  const providersQuery = useGetProviders({ query: { queryKey: getGetProvidersQueryKey(), refetchInterval: 20000 } });
  const healthQuery = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 15000 } });
  const providers = providersQuery.data;
  const active = providers?.filter((provider) => provider.status === 'connected').length ?? 0;
  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader eyebrow="Signal sources / capabilities" title="Know what is actually connected." detail="Every configured feed is represented here, including disabled or degraded providers. Capability gaps stay visible instead of becoming phantom coverage." action={<div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs font-bold shadow-panel"><Gauge size={14} className="text-primary" /> {active} active now</div>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Configured" value={providers?.length ?? '—'} detail="Provider records" icon={Blocks} loading={providersQuery.isLoading} />
        <MetricCard label="Connected" value={active} detail="Accepting events" icon={CheckCircle2} accent="lime" loading={providersQuery.isLoading} />
        <MetricCard label="Disabled" value={providers?.filter((provider) => provider.status === 'disabled').length ?? '—'} detail="Intentionally offline" icon={LockKeyhole} accent="amber" loading={providersQuery.isLoading} />
        <MetricCard label="Core status" value={healthQuery.data?.status === 'ok' ? 'Nominal' : healthQuery.data?.status ? 'Degraded' : '—'} detail="Health endpoint" icon={Activity} accent="coral" loading={healthQuery.isLoading} />
      </div>
      <Panel eyebrow="Provider registry" title="Capability and status">
        {providersQuery.isLoading ? <div className="grid gap-4 p-5 md:grid-cols-2">{[1, 2, 3, 4].map((n) => <div key={n} className="rounded-xl border border-border p-5"><Skeleton className="h-8 w-2/3" /><Skeleton className="mt-4 h-10 w-full" /><Skeleton className="mt-5 h-6 w-full" /></div>)}</div> : providersQuery.isError ? <ErrorState message="Provider registry could not be read." retry={() => void providersQuery.refetch()} /> : !providers?.length ? <EmptyState icon={Server} title="No providers configured" detail="This console has no provider records yet. No coverage is being implied." /> : <div className="grid gap-4 p-5 md:grid-cols-2">{providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}</div>}
      </Panel>
    </div>
  );
}

function Toggle({ checked, onChange, label, detail, testId }: { checked: boolean; onChange: (checked: boolean) => void; label: string; detail: string; testId: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-background px-3.5 py-3 transition hover:border-primary/50">
      <span><span className="block text-xs font-bold text-foreground">{label}</span><span className="mt-1 block text-[11px] text-muted-foreground">{detail}</span></span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-slate-200')}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" data-testid={testId} /><span className={cn('absolute top-1 h-4 w-4 rounded-full bg-card shadow-sm transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} /></span>
    </label>
  );
}

function NumberField({ label, value, onChange, placeholder, suffix, testId }: { label: string; value?: number | null; onChange: (value: number | null) => void; placeholder: string; suffix: string; testId: string }) {
  return (
    <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-foreground">{label}</span><div className="flex overflow-hidden rounded-md border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10"><input type="number" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs outline-none" data-testid={testId} /><span className="border-l border-border bg-muted px-2.5 py-2 font-mono text-[10px] text-muted-foreground">{suffix}</span></div></label>
  );
}

function SettingsPage() {
  const settingsQuery = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const providersQuery = useGetProviders({ query: { queryKey: getGetProvidersQueryKey() } });
  const updateSettings = useUpdateSettings();
  const telegramTest = useSendTelegramTest();
  const [draft, setDraft] = useState<RadarSettings | null>(null);
  const [telegramMessage, setTelegramMessage] = useState<string | null>(null);
  useEffect(() => {
    if (settingsQuery.data && !draft) setDraft(settingsQuery.data);
  }, [settingsQuery.data, draft]);
  const setField = <K extends keyof RadarSettings>(key: K, value: RadarSettings[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);
  const toggleListValue = (key: 'selectedChains' | 'selectedProviders', value: string) => {
    if (!draft) return;
    const current = draft[key];
    setField(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    updateSettings.mutate({ data: {
      paused: draft.paused,
      filterMode: draft.filterMode,
      minLiquidityUsd: draft.minLiquidityUsd,
      maxMarketCapUsd: draft.maxMarketCapUsd,
      minVolumeUsd: draft.minVolumeUsd,
      maxTokenAgeMinutes: draft.maxTokenAgeMinutes,
      minTransactions: draft.minTransactions,
      selectedChains: draft.selectedChains,
      selectedProviders: draft.selectedProviders,
    } }, {
      onSuccess: (next) => {
        setDraft(next);
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
    });
  };
  const sendTest = () => {
    setTelegramMessage(null);
    telegramTest.mutate(undefined, { onSuccess: (result) => setTelegramMessage(result.message) });
  };
  if (settingsQuery.isLoading) return <div className="mx-auto max-w-[1100px]"><PageHeader eyebrow="Control plane / settings" title="Tune the radar." detail="Loading saved configuration and delivery state." /><div className="grid gap-5 md:grid-cols-2">{[1, 2].map((n) => <Skeleton key={n} className="h-72 rounded-xl" />)}</div></div>;
  if (settingsQuery.isError || !draft) return <div className="mx-auto max-w-[1100px]"><PageHeader eyebrow="Control plane / settings" title="Tune the radar." detail="Configuration is only shown when it can be read from the API." /><Panel><ErrorState message="Settings are unavailable right now." retry={() => void settingsQuery.refetch()} /></Panel></div>;
  const chains = Array.from(new Set((providersQuery.data || []).flatMap((provider) => provider.chains)));
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader eyebrow="Control plane / settings" title="Tune the radar." detail="Pause discovery, define optional filters, and verify Telegram delivery without masking configuration gaps." action={<button type="submit" form="settings-form" disabled={updateSettings.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground shadow-sm transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60" data-testid="button-save-settings">{updateSettings.isPending && <Loader2 size={14} className="animate-spin" />} {updateSettings.isPending ? 'Saving' : 'Save changes'}</button>} />
      <form id="settings-form" onSubmit={save} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <Panel eyebrow="Radar state" title="Operating mode">
            <div className="space-y-3 p-5">
              <Toggle checked={!draft.paused} onChange={(checked) => setField('paused', !checked)} label={draft.paused ? 'Radar paused' : 'Radar listening'} detail={draft.paused ? 'No new signals will enter the pipeline.' : 'Configured providers can emit new signals.'} testId="input-radar-listening" />
              <Toggle checked={draft.filterMode} onChange={(checked) => setField('filterMode', checked)} label="Optional filters" detail="Apply thresholds before a signal is eligible for delivery." testId="input-filter-mode" />
              <div className={cn('mt-4 rounded-lg border px-3.5 py-3 text-[11px] leading-5', draft.paused ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-lime-200 bg-lime-50 text-emerald-900')} data-testid="status-radar-mode">{draft.paused ? <Pause size={13} className="mr-1 inline" /> : <Play size={13} className="mr-1 inline" />}{draft.paused ? 'Paused intentionally. This state is reported to operators.' : 'Listening. New eligible tokens can be posted when Telegram is configured.'}</div>
            </div>
          </Panel>
          <Panel eyebrow="Delivery path" title="Telegram setup">
            <div className="p-5">
              <div className={cn('flex items-center gap-3 rounded-lg border p-3.5', draft.telegramConfigured ? 'border-lime-200 bg-lime-50/70' : 'border-amber-200 bg-amber-50/70')} data-testid="status-telegram-setup">
                {draft.telegramConfigured ? <CheckCircle2 className="text-emerald-700" size={19} /> : <AlertTriangle className="text-amber-700" size={19} />}
                <div><div className="text-xs font-extrabold">{draft.telegramConfigured ? 'Telegram configured' : 'Telegram not configured'}</div><div className="mt-1 text-[11px] text-muted-foreground">{draft.telegramConfigured ? 'A test message can be sent safely.' : 'No delivery claim will be made until credentials exist.'}</div></div>
              </div>
              <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50/70 px-3.5 py-3 text-[11px] leading-5 text-cyan-950" data-testid="status-telegram-requirement">
                <span className="font-bold">Telegram-link gate:</span>{' '}
                {draft.requireTelegram ? 'Required before every token alert.' : 'Disabled by REQUIRE_TELEGRAM=false.'}
              </div>
              <button type="button" disabled={!draft.telegramConfigured || telegramTest.isPending} onClick={sendTest} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-send-telegram-test">{telegramTest.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}{telegramTest.isPending ? 'Sending test' : 'Send Telegram test'}</button>
              {telegramMessage && <div className="mt-3 rounded-md bg-muted px-3 py-2 text-[11px] text-foreground" data-testid="status-telegram-test">{telegramMessage}</div>}
              {telegramTest.isError && <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-[11px] text-rose-800" data-testid="status-telegram-test-error">Telegram test failed. Check the server configuration.</div>}
            </div>
          </Panel>
        </div>
        <Panel eyebrow="Eligibility rules" title="Optional signal filters">
          <div className={cn('grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3', !draft.filterMode && 'opacity-55')} aria-disabled={!draft.filterMode}>
            <NumberField label="Minimum liquidity" value={draft.minLiquidityUsd} onChange={(value) => setField('minLiquidityUsd', value)} placeholder="No minimum" suffix="USD" testId="input-min-liquidity" />
            <NumberField label="Maximum market cap" value={draft.maxMarketCapUsd} onChange={(value) => setField('maxMarketCapUsd', value)} placeholder="No maximum" suffix="USD" testId="input-max-market-cap" />
            <NumberField label="Minimum volume" value={draft.minVolumeUsd} onChange={(value) => setField('minVolumeUsd', value)} placeholder="No minimum" suffix="USD" testId="input-min-volume" />
            <NumberField label="Maximum token age" value={draft.maxTokenAgeMinutes} onChange={(value) => setField('maxTokenAgeMinutes', value)} placeholder="Any age" suffix="MIN" testId="input-max-token-age" />
            <NumberField label="Minimum transactions" value={draft.minTransactions} onChange={(value) => setField('minTransactions', value)} placeholder="No minimum" suffix="TX" testId="input-min-transactions" />
          </div>
        </Panel>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel eyebrow="Scope" title="Selected chains">
            <div className="flex flex-wrap gap-2 p-5">{chains.length ? chains.map((chain) => {
              const selected = draft.selectedChains.includes(chain);
              return <button type="button" key={chain} onClick={() => toggleListValue('selectedChains', chain)} className={cn('rounded-md border px-3 py-2 text-xs font-bold capitalize transition', selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/50')} data-testid={`button-chain-${chain}`}>{selected && <Check size={12} className="mr-1 inline" />}{chain}</button>;
            }) : <p className="text-xs text-muted-foreground">No provider chains are currently advertised.</p>}</div>
          </Panel>
          <Panel eyebrow="Scope" title="Selected providers">
            <div className="space-y-2 p-5">{providersQuery.data?.length ? providersQuery.data.map((provider) => {
              const selected = draft.selectedProviders.includes(provider.id);
              return <button type="button" key={provider.id} onClick={() => toggleListValue('selectedProviders', provider.id)} className={cn('flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-xs font-bold transition', selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/50')} data-testid={`button-provider-${provider.id}`}><span className="flex items-center gap-2"><span className={cn('h-1.5 w-1.5 rounded-full', provider.status === 'connected' ? 'bg-lime-500' : 'bg-slate-300')} />{provider.displayName}</span>{selected && <Check size={14} />}</button>;
            }) : <p className="text-xs text-muted-foreground">No provider records are available.</p>}</div>
          </Panel>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-[11px] text-muted-foreground shadow-panel"><span className="flex items-center gap-2"><Database size={14} className={draft.databaseConfigured ? 'text-emerald-600' : 'text-amber-600'} /> Database {draft.databaseConfigured ? 'connected' : 'not configured'}</span><span>Changes apply to the next eligible signal.</span></div>
      </form>
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
      <Shell>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/providers" component={ProvidersPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;