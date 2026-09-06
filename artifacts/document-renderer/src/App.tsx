import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type KeyboardEvent, type ReactNode, type SetStateAction } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import micrFontData from './assets/GnuMICR.ttf?inline';
import { ErrorBoundary } from '@/components/error-boundary';
import { DepSlipMark } from '@/components/depslip-mark';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  getGetIntegrationStatusQueryKey,
  getGetAdminOverviewQueryKey,
  getGetAdminPaymentSettingsQueryKey,
  getGetAdminSessionQueryKey,
  getGetUserSessionQueryKey,
  getListAdminOrdersQueryKey,
  getListAdminUsersQueryKey,
  getListPayeesQueryKey,
  getListPlansQueryKey,
  getHealthCheckQueryKey,
  useAutocompletePlace,
  useAdminLogin,
  useAdminLogout,
  useCreateAdminToken,
  useCreateOrder,
  useCreatePayee,
  useDeletePayee,
  useDeleteUserAccount,
  useGetAdminOverview,
  useGetAdminPaymentSettings,
  useGetAdminSession,
  useGetIntegrationStatus,
  useGetUserSession,
  useListAdminOrders,
  useListAdminUsers,
  useListPayees,
  useListPlans,
  useHealthCheck,
  useLookupRoutingNumber,
  useLookupOrder,
  useRecordDocumentUsage,
  useRevealAdminToken,
  useRevokeAdminToken,
  useRemoveBackground,
  useRenderSamplePdf,
  useTokenLogin,
  useTokenLogout,
  useUpdateAdminOrderStatus,
  useUpdateAdminPaymentSettings,
  useUpdateAdminUserStatus,
  type RoutingLookupResponse,
  type SampleDocumentInput,
  type AdminUser,
  type Order,
  type PaymentSettings,
} from '@workspace/api-client-react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bitcoin,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  FileDown,
  Info,
  Landmark,
  Loader2,
  LogOut,
  MapPin,
  PackageSearch,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function removeLogoBackgroundLocally(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context || canvas.width === 0 || canvas.height === 0) {
        reject(new Error('Could not prepare the logo image.'));
        return;
      }

      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imageData;
      const corners = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
      ];
      const background = corners.reduce(
        (sum, [x, y]) => {
          const offset = (y * width + x) * 4;
          return [sum[0] + data[offset], sum[1] + data[offset + 1], sum[2] + data[offset + 2]];
        },
        [0, 0, 0],
      ).map((channel) => channel / corners.length);
      const tolerance = 58;
      const visited = new Uint8Array(width * height);
      const queue: number[] = [];

      const isBackground = (pixelIndex: number) => {
        const offset = pixelIndex * 4;
        const distance = Math.sqrt(
          (data[offset] - background[0]) ** 2 +
          (data[offset + 1] - background[1]) ** 2 +
          (data[offset + 2] - background[2]) ** 2,
        );
        return data[offset + 3] > 0 && distance <= tolerance;
      };

      const enqueue = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const pixelIndex = y * width + x;
        if (visited[pixelIndex] || !isBackground(pixelIndex)) return;
        visited[pixelIndex] = 1;
        queue.push(pixelIndex);
      };

      for (let x = 0; x < width; x += 1) {
        enqueue(x, 0);
        enqueue(x, height - 1);
      }
      for (let y = 1; y < height - 1; y += 1) {
        enqueue(0, y);
        enqueue(width - 1, y);
      }

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const pixelIndex = queue[cursor];
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        data[pixelIndex * 4 + 3] = 0;
        enqueue(x - 1, y);
        enqueue(x + 1, y);
        enqueue(x, y - 1);
        enqueue(x, y + 1);
      }

      context.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Could not read the logo image.'));
    image.src = dataUrl;
  });
}

function BrandBar({ admin = false, onLogout }: { admin?: boolean; onLogout?: () => void }) {
  return (
    <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-sidebar-primary/15 text-sidebar-primary ring-1 ring-sidebar-primary/30"><DepSlipMark compact /></div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.24em] text-sidebar-foreground/55">{admin ? 'Operator console' : 'Document preparation'}</p>
            <h1 className="mt-0.5 text-[20px] font-semibold tracking-[-.04em]" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>DepSlip</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[10px] uppercase tracking-[.14em] text-sidebar-foreground/60 sm:inline">{admin ? 'Restricted surface' : 'Authorized workspace'}</span>
          {onLogout && <button type="button" onClick={onLogout} className="flex items-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-xs font-semibold transition hover:bg-sidebar-foreground/10" data-testid={admin ? 'button-admin-logout' : 'button-customer-logout'}><LogOut size={14} /> Sign out</button>}
        </div>
      </div>
    </header>
  );
}

function CustomerHome() {
  const session = useGetUserSession({ query: { queryKey: getGetUserSessionQueryKey(), retry: false } });
  const tokenLogin = useTokenLogin();
  const tokenLogout = useTokenLogout();
  const lookupOrder = useLookupOrder();
  const [token, setToken] = useState('');
  const [active, setActive] = useState<'welcome' | 'orders' | 'payees'>('welcome');
  const [message, setMessage] = useState('');
  const [lookup, setLookup] = useState({ orderNumber: '', email: '' });
  const [lookupResult, setLookupResult] = useState<Order | null>(null);
  if (session.isLoading) {
    return <main className="min-h-[100dvh] bg-background"><BrandBar /><div className="mx-auto max-w-xl px-5 py-24"><div className="h-3 w-32 animate-pulse rounded bg-muted" /><div className="mt-5 h-12 w-3/4 animate-pulse rounded bg-muted" /><div className="mt-4 h-4 w-full animate-pulse rounded bg-muted" /><div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-muted" /></div></main>;
  }

  const login = (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    tokenLogin.mutate({ data: { token: token.trim() } }, {
      onSuccess: () => {
        setMessage('Access confirmed. Your preparation desk is ready.');
        session.refetch();
      },
      onError: () => setMessage('That access token could not be verified. Check the characters and try again.'),
    });
  };

  const findOrder = (event: FormEvent) => {
    event.preventDefault();
    setLookupResult(null);
    lookupOrder.mutate({ data: lookup }, { onSuccess: (order) => setLookupResult(order), onError: () => setMessage('We could not find an order with those details.') });
  };

  if (session.data?.authenticated) {
    return <CustomerDesk user={session.data.user} active={active} setActive={setActive} onLogout={() => tokenLogout.mutate(undefined, { onSuccess: () => session.refetch() })} />;
  }

  return (
    <main className="min-h-[100dvh] bg-background">
      <BrandBar />
      <section className="relative overflow-hidden border-b border-border bg-[hsl(211_34%_19%)] text-sidebar-foreground">
        <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full border-[40px] border-sidebar-primary/10" />
        <div className="absolute bottom-[-12rem] left-[48%] h-96 w-96 rounded-full border border-sidebar-primary/20" />
        <div className="relative mx-auto grid max-w-[1480px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_420px] lg:px-16 lg:py-24">
          <div className="max-w-3xl animate-rise-in">
            <div className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-sidebar-primary"><span className="h-px w-7 bg-sidebar-primary" /> Issued access only</div>
            <h2 className="max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-.06em] sm:text-7xl">Make the paper<br /><span className="text-sidebar-primary">match the intent.</span></h2>
            <p className="mt-7 max-w-xl text-base leading-7 text-sidebar-foreground/65">DepSlip is the quiet, exacting desk for preparing authorized deposit slips. Bring your issued token, then work from a live paper preview that stays honest to the final print.</p>
            <div className="mt-10 flex flex-wrap gap-3 text-[11px] font-mono uppercase tracking-[.12em] text-sidebar-foreground/65">
              <span className="rounded-full border border-sidebar-border px-3 py-2">Print-first</span><span className="rounded-full border border-sidebar-border px-3 py-2">Token protected</span><span className="rounded-full border border-sidebar-border px-3 py-2">MICR aware</span>
            </div>
          </div>
          <form onSubmit={login} className="rounded-2xl border border-sidebar-foreground/15 bg-sidebar-foreground/[.06] p-6 shadow-2xl backdrop-blur-sm sm:p-7" data-testid="form-token-login">
            <div className="mb-7 flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-sidebar-primary">01 / Access desk</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.035em]">Enter your issued token</h3></div><ShieldCheck className="text-sidebar-primary" size={21} /></div>
            <label className="block"><span className="mb-2 block text-[11px] font-semibold text-sidebar-foreground/60">Access token</span><input autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste the token from your issue notice" className="h-12 w-full rounded-lg border border-sidebar-foreground/15 bg-sidebar/60 px-3 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/35 focus:border-sidebar-primary focus:outline-none" data-testid="input-customer-token" /></label>
            <button type="submit" disabled={tokenLogin.isPending || token.trim().length < 16} className="mt-4 flex h-12 w-full items-center justify-between rounded-lg bg-sidebar-primary px-4 text-sm font-bold text-sidebar-primary-foreground transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-token-login"><span>{tokenLogin.isPending ? 'Verifying access…' : 'Open preparation desk'}</span>{tokenLogin.isPending ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={17} />}</button>
            {message && <p className="mt-4 flex gap-2 text-xs leading-5 text-sidebar-primary" data-testid="status-token-login"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{message}</p>}
            <p className="mt-6 border-t border-sidebar-foreground/10 pt-4 text-[11px] leading-5 text-sidebar-foreground/45">Tokens are issued by the DepSlip operator. There is no public account registration and no reusable password.</p>
          </form>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1480px] gap-5 px-5 py-12 sm:px-8 lg:grid-cols-[1.2fr_.8fr] lg:px-16 lg:py-16">
        <div className="rounded-2xl border border-border bg-card p-7 sm:p-9">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">02 / Order tracking</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-.05em]">Already requested access?</h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Look up a manual payment request using the order number and the email used at checkout.</p>
          <form onSubmit={findOrder} className="mt-7 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input autoComplete="off" value={lookup.orderNumber} onChange={(event) => setLookup({ ...lookup, orderNumber: event.target.value })} placeholder="Order number" className="h-11 rounded-lg border border-input bg-background px-3 text-sm" data-testid="input-order-number" />
            <input autoComplete="email" type="email" value={lookup.email} onChange={(event) => setLookup({ ...lookup, email: event.target.value })} placeholder="Email address" className="h-11 rounded-lg border border-input bg-background px-3 text-sm" data-testid="input-order-email" />
            <button type="submit" className="h-11 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90" data-testid="button-lookup-order">Find order</button>
          </form>
          {lookupResult && <div className="mt-5 flex items-center justify-between rounded-lg bg-secondary px-4 py-3 text-sm" data-testid="status-order-lookup"><span className="font-semibold">{lookupResult.orderNumber} · {lookupResult.planId}</span><span className="font-mono text-[10px] uppercase tracking-wider">{lookupResult.status}</span></div>}
          {message && !session.data?.authenticated && <p className="mt-4 text-xs text-destructive" data-testid="status-order-error">{message}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-[hsl(175_18%_86%)] p-7 sm:p-9">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-secondary-foreground">A careful boundary</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-.04em]">No card details collected here.</h3>
          <p className="mt-3 text-sm leading-6 text-secondary-foreground/75">Card orders are terminal/manual payment requests. Bitcoin instructions, when configured, are shared by the operator after your request.</p>
          <div className="mt-7 flex items-center gap-3 border-t border-secondary-foreground/15 pt-5 text-xs font-semibold text-secondary-foreground"><ShieldCheck size={17} /> Authorized workflows only</div>
        </div>
      </section>
      <footer className="border-t border-border px-5 py-8 text-center font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">DepSlip · document preparation with a paper conscience</footer>
    </main>
  );
}

function CustomerDesk({ user, active, setActive, onLogout }: { user: { name: string; email: string; slipsUsed: number; slipLimit: number; status: string }; active: 'welcome' | 'orders' | 'payees'; setActive: (value: 'welcome' | 'orders' | 'payees') => void; onLogout: () => void }) {
  const plans = useListPlans({ query: { queryKey: getListPlansQueryKey() } });
  const payees = useListPayees({ query: { queryKey: getListPayeesQueryKey() } });
  const queryClient = useQueryClient();
  const createPayee = useCreatePayee();
  const deletePayee = useDeletePayee();
  const createOrder = useCreateOrder();
  const recordUsage = useRecordDocumentUsage();
  const deleteAccount = useDeleteUserAccount();
  const [order, setOrder] = useState({ planId: 'starter', paymentMethod: 'card_manual' as 'card_manual' | 'bitcoin', acceptedPaymentTerms: false });
  const [newPayee, setNewPayee] = useState({ name: '', address: '', bankName: '', bankAddress: '', routingNumber: '', accountNumber: '', bankLogoUrl: null as string | null });
  const [notice, setNotice] = useState('');
  const currentPlan = plans.data?.find((plan) => plan.id === order.planId);

  const refreshPayees = () => queryClient.invalidateQueries({ queryKey: getListPayeesQueryKey() });
  return (
    <main className="min-h-[100dvh] bg-background">
      <BrandBar onLogout={onLogout} />
      <div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12">
        <div className="mb-8 flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end">
          <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">Customer desk / {user.status}</p><h2 className="mt-2 text-4xl font-semibold tracking-[-.06em]">Good to see you, {user.name.split(' ')[0]}<span className="text-accent">.</span></h2><p className="mt-2 text-sm text-muted-foreground">{user.email} · {Math.max(user.slipLimit - user.slipsUsed, 0)} prepared slips remaining</p></div>
          <div className="flex gap-2 rounded-lg border border-border bg-card p-1"><button type="button" onClick={() => setActive('welcome')} className={`rounded-md px-3 py-2 text-xs font-bold ${active === 'welcome' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="tab-workspace">Workspace</button><button type="button" onClick={() => setActive('orders')} className={`rounded-md px-3 py-2 text-xs font-bold ${active === 'orders' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="tab-orders">Plans & orders</button><button type="button" onClick={() => setActive('payees')} className={`rounded-md px-3 py-2 text-xs font-bold ${active === 'payees' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="tab-payees">Saved payees</button></div>
        </div>
        {active === 'welcome' && <div className="mb-7 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-border bg-card p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Slip allowance</p><p className="mt-3 text-3xl font-semibold tracking-[-.05em]">{user.slipsUsed}<span className="text-base text-muted-foreground"> / {user.slipLimit}</span></p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min((user.slipsUsed / Math.max(user.slipLimit, 1)) * 100, 100)}%` }} /></div></div><div className="rounded-xl border border-border bg-card p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Saved payees</p><p className="mt-3 text-3xl font-semibold tracking-[-.05em]">{payees.isLoading ? '—' : payees.data?.length ?? 0}</p><button type="button" onClick={() => setActive('payees')} className="mt-3 text-xs font-bold text-accent hover:underline" data-testid="button-manage-payees">Manage payees <ArrowRight className="ml-1 inline" size={13} /></button></div><div className="rounded-xl border border-accent/25 bg-accent/10 p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-accent">Print boundary</p><p className="mt-3 text-sm font-semibold leading-5">Every action stays tied to this issued access.</p><button type="button" onClick={() => recordUsage.mutate({ data: { kind: 'browser_print' } }, { onSuccess: () => setNotice('Browser print recorded for this workspace.') })} className="mt-3 text-xs font-bold text-accent hover:underline" data-testid="button-record-browser-print">{recordUsage.isPending ? 'Recording…' : 'Record browser print'}</button></div></div>}
         {active === 'welcome' && <Home />}
         {active === 'welcome' && <section className="mt-7 rounded-2xl border border-destructive/20 bg-destructive/[.04] p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-destructive">Account boundary</p><div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h3 className="text-xl font-semibold tracking-[-.04em]">Deactivate this workspace</h3><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Your access token will be revoked and this account will be marked deleted. Existing payment and audit records are retained for compliance.</p></div><button type="button" onClick={() => { if (window.confirm('Deactivate this workspace? Your token will stop working immediately.')) deleteAccount.mutate(undefined, { onSuccess: onLogout, onError: () => setNotice('The account could not be deactivated. Please try again.') }); }} disabled={deleteAccount.isPending} className="shrink-0 rounded-lg border border-destructive/30 px-4 py-3 text-sm font-bold text-destructive transition hover:bg-destructive/10 disabled:opacity-50" data-testid="button-delete-account">{deleteAccount.isPending ? 'Deactivating…' : 'Deactivate account'}</button></div>{notice && <p className="mt-3 text-xs font-semibold text-destructive" data-testid="status-account-action">{notice}</p>}</section>}
        {active === 'orders' && <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">Request access capacity</p><h3 className="mt-2 text-3xl font-semibold tracking-[-.05em]">Choose a plan</h3><div className="mt-6 grid gap-3">{plans.isLoading ? [1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />) : plans.data?.map((plan) => <button type="button" key={plan.id} onClick={() => setOrder({ ...order, planId: plan.id })} className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${order.planId === plan.id ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'}`} data-testid={`card-plan-${plan.id}`}><span><span className="block font-semibold">{plan.name}</span><span className="mt-1 block text-xs text-muted-foreground">{plan.description} · {plan.slipLimit} slips</span></span><span className="font-mono text-sm font-semibold">${(plan.priceCents / 100).toFixed(2)}</span></button>)}</div></div>
          <div className="rounded-2xl border border-border bg-[hsl(175_18%_86%)] p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-secondary-foreground">Payment request</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.04em]">{currentPlan?.name ?? 'Selected plan'}</h3><p className="mt-2 text-sm leading-6 text-secondary-foreground/75">Select how the operator should confirm your order. Card means a terminal/manual payment request; no card credentials are entered here.</p><div className="mt-6 grid gap-2"><button type="button" onClick={() => setOrder({ ...order, paymentMethod: 'card_manual' })} className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm font-semibold ${order.paymentMethod === 'card_manual' ? 'border-primary bg-card' : 'border-secondary-foreground/20'}`} data-testid="button-payment-card"><CreditCard size={17} /> Terminal / manual card request</button><button type="button" onClick={() => setOrder({ ...order, paymentMethod: 'bitcoin' })} className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm font-semibold ${order.paymentMethod === 'bitcoin' ? 'border-primary bg-card' : 'border-secondary-foreground/20'}`} data-testid="button-payment-bitcoin"><Bitcoin size={17} /> Bitcoin request</button></div><label className="mt-5 flex gap-2 text-xs leading-5 text-secondary-foreground"><input type="checkbox" checked={order.acceptedPaymentTerms} onChange={(event) => setOrder({ ...order, acceptedPaymentTerms: event.target.checked })} data-testid="input-accept-terms" /> I understand this creates a payment request for operator review.</label><button type="button" disabled={!order.acceptedPaymentTerms || createOrder.isPending || !currentPlan} onClick={() => createOrder.mutate({ data: { ...order, name: user.name, email: user.email, planId: order.planId as 'starter' | 'pro' | 'enterprise' } }, { onSuccess: (result) => setNotice(`Request ${result.orderNumber} is now ${result.status}.`), onError: () => setNotice('The payment request could not be created.') })} className="mt-6 flex h-12 w-full items-center justify-between rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-45" data-testid="button-create-order"><span>{createOrder.isPending ? 'Submitting request…' : 'Submit payment request'}</span>{createOrder.isPending ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}</button>{notice && <p className="mt-4 text-xs font-semibold text-secondary-foreground" data-testid="status-customer-action">{notice}</p>}</div>
        </section>}
        {active === 'payees' && <section className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><div className="rounded-2xl border border-border bg-card p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">Reusable details</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Save a payee</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Keep authorized recipient details close without changing the live document until you choose them.</p><div className="mt-5 space-y-2">{[['name','Name'],['address','Address'],['bankName','Bank name'],['bankAddress','Bank address'],['routingNumber','9-digit routing'],['accountNumber','Account number']].map(([key, label]) => <input key={key} value={newPayee[key as keyof typeof newPayee] as string} onChange={(event) => setNewPayee({ ...newPayee, [key]: event.target.value })} placeholder={label} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid={`input-payee-${key}`} />)}<button type="button" onClick={() => createPayee.mutate({ data: newPayee }, { onSuccess: () => { setNewPayee({ name: '', address: '', bankName: '', bankAddress: '', routingNumber: '', accountNumber: '', bankLogoUrl: null }); refreshPayees(); setNotice('Payee saved.'); }, onError: () => setNotice('Payee could not be saved. Check the routing number.') })} disabled={createPayee.isPending} className="mt-2 h-11 w-full rounded-lg bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-create-payee">{createPayee.isPending ? 'Saving…' : 'Save payee'}</button></div></div><div className="rounded-2xl border border-border bg-card p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">Your library</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Saved payees</h3></div><span className="rounded-full bg-secondary px-3 py-1 font-mono text-[10px]">{payees.data?.length ?? 0} records</span></div>{payees.isLoading ? <div className="mt-6 space-y-3"><div className="h-16 animate-pulse rounded-lg bg-muted" /><div className="h-16 animate-pulse rounded-lg bg-muted" /></div> : payees.isError ? <p className="mt-6 text-sm text-destructive">Payees could not be loaded. Refresh the desk to try again.</p> : payees.data?.length ? <div className="mt-6 space-y-2">{payees.data.map((payee) => <div key={payee.id} className="flex items-center justify-between rounded-lg border border-border p-4" data-testid={`row-payee-${payee.id}`}><div><p className="text-sm font-semibold">{payee.name}</p><p className="mt-1 text-xs text-muted-foreground">{payee.bankName} · {payee.routingNumber}</p></div><button type="button" onClick={() => deletePayee.mutate({ payeeId: payee.id }, { onSuccess: refreshPayees })} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${payee.name}`} data-testid={`button-delete-payee-${payee.id}`}><Trash2 size={15} /></button></div>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm font-semibold">No saved payees yet.</p><p className="mt-2 text-xs text-muted-foreground">The first one you save will appear here for future slips.</p></div>}</div></section>}
      </div>
    </main>
  );
}

function AdminPage() {
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey(), retry: false } });
  const login = useAdminLogin();
  const logout = useAdminLogout();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  if (session.isLoading) return <main className="min-h-[100dvh] bg-[hsl(211_34%_19%)]"><BrandBar /><div className="mx-auto max-w-xl px-5 py-24"><div className="h-3 w-32 animate-pulse rounded bg-sidebar-foreground/10" /><div className="mt-5 h-12 w-3/4 animate-pulse rounded bg-sidebar-foreground/10" /></div></main>;
  if (!session.data?.authenticated) return <AdminLogin credentials={credentials} setCredentials={setCredentials} login={login} onSuccess={() => session.refetch()} />;
  return <AdminConsole onLogout={() => logout.mutate(undefined, { onSuccess: () => session.refetch() })} />;
}

function AdminLogin({ credentials, setCredentials, login, onSuccess }: { credentials: { username: string; password: string }; setCredentials: (value: { username: string; password: string }) => void; login: ReturnType<typeof useAdminLogin>; onSuccess: () => void }) {
  const [error, setError] = useState('');
  return <main className="min-h-[100dvh] bg-[hsl(211_34%_19%)] text-sidebar-foreground"><BrandBar /><div className="mx-auto flex max-w-[620px] flex-col items-center px-5 py-20 text-center"><div className="mb-8 rounded-2xl border border-sidebar-foreground/10 bg-sidebar-foreground/[.05] p-4 text-sidebar-primary"><ShieldCheck size={28} /></div><p className="font-mono text-[10px] uppercase tracking-[.22em] text-sidebar-primary">Operator access / restricted</p><h2 className="mt-3 text-5xl font-semibold tracking-[-.06em]">A clear view of the desk.</h2><p className="mt-4 max-w-md text-sm leading-6 text-sidebar-foreground/60">Manage issued access, payment requests, and the audit trail without touching customer credentials.</p><form onSubmit={(event) => { event.preventDefault(); setError(''); login.mutate({ data: credentials }, { onSuccess, onError: () => setError('Sign-in was not accepted. Check your operator credentials.') }); }} className="mt-10 w-full rounded-2xl border border-sidebar-foreground/10 bg-sidebar-foreground/[.05] p-6 text-left sm:p-8" data-testid="form-admin-login"><label className="block text-xs font-semibold text-sidebar-foreground/60">Username<input autoComplete="username" value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} className="mt-2 h-12 w-full rounded-lg border border-sidebar-foreground/15 bg-sidebar/50 px-3 text-sm text-sidebar-foreground focus:border-sidebar-primary focus:outline-none" data-testid="input-admin-username" /></label><label className="mt-4 block text-xs font-semibold text-sidebar-foreground/60">Password<input autoComplete="current-password" type="password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} className="mt-2 h-12 w-full rounded-lg border border-sidebar-foreground/15 bg-sidebar/50 px-3 text-sm text-sidebar-foreground focus:border-sidebar-primary focus:outline-none" data-testid="input-admin-password" /></label><button type="submit" disabled={login.isPending} className="mt-6 flex h-12 w-full items-center justify-between rounded-lg bg-sidebar-primary px-4 text-sm font-bold text-sidebar-primary-foreground disabled:opacity-50" data-testid="button-admin-login"><span>{login.isPending ? 'Authenticating…' : 'Enter operator console'}</span>{login.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}</button>{error && <p className="mt-4 text-xs text-red-300" data-testid="status-admin-login">{error}</p>}</form></div></main>;
}

function AdminConsole({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'overview' | 'users' | 'orders' | 'settings'>('overview');
  const queryClient = useQueryClient();
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey() } });
  const users = useListAdminUsers({ query: { queryKey: getListAdminUsersQueryKey() } });
  const orders = useListAdminOrders({ query: { queryKey: getListAdminOrdersQueryKey() } });
  const settings = useGetAdminPaymentSettings({ query: { queryKey: getGetAdminPaymentSettingsQueryKey() } });
  const updateUser = useUpdateAdminUserStatus();
  const reveal = useRevealAdminToken();
  const revoke = useRevokeAdminToken();
  const updateOrder = useUpdateAdminOrderStatus();
  const createToken = useCreateAdminToken();
  const saveSettings = useUpdateAdminPaymentSettings();
  const [tokenForm, setTokenForm] = useState({ name: '', email: '', planId: 'starter' as 'starter' | 'pro' | 'enterprise' });
  const [payment, setPayment] = useState<PaymentSettings>({ bitcoinWallet: '', bitcoinQrUrl: null, bitcoinInstructions: '' });
  const [issued, setIssued] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [settingsReady, setSettingsReady] = useState(false);
  const metric = useMemo(() => overview.data ? [{ label: 'Total users', value: overview.data.totalUsers, icon: <Users size={17} /> }, { label: 'Active users', value: overview.data.activeUsers, icon: <ShieldCheck size={17} /> }, { label: 'Pending orders', value: overview.data.pendingOrders, icon: <PackageSearch size={17} /> }, { label: 'Print records', value: overview.data.totalPdfPrints + overview.data.totalBrowserPrints, icon: <BarChart3 size={17} /> }] : [], [overview.data]);
  useEffect(() => {
    if (settings.data && !settingsReady) {
      setPayment(settings.data);
      setSettingsReady(true);
    }
  }, [settings.data, settingsReady]);
  const refresh = () => { queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }); queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey() }); };
  return <main className="min-h-[100dvh] bg-background"><BrandBar admin onLogout={onLogout} /><div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12"><div className="flex flex-col gap-6 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">Operator console / live ledger</p><h2 className="mt-2 text-4xl font-semibold tracking-[-.06em]">The desk, in full.</h2><p className="mt-2 text-sm text-muted-foreground">A calm record of access, capacity, payment, and print activity.</p></div><nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">{[['overview','Overview'],['users','Access tokens'],['orders','Orders'],['settings','Bitcoin settings']].map(([value,label]) => <button type="button" key={value} onClick={() => setTab(value as typeof tab)} className={`rounded-md px-3 py-2 text-xs font-bold ${tab === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`tab-admin-${value}`}>{label}</button>)}</nav></div>
    {tab === 'overview' && <section className="animate-rise-in"><div className="grid gap-3 py-7 sm:grid-cols-2 lg:grid-cols-4">{overview.isLoading ? [1,2,3,4].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-muted" />) : metric.map((item) => <div key={item.label} className="rounded-xl border border-border bg-card p-5" data-testid={`metric-${item.label.toLowerCase().replaceAll(' ','-')}`}><div className="flex items-center justify-between text-accent"><span className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">{item.label}</span>{item.icon}</div><p className="mt-4 text-4xl font-semibold tracking-[-.06em]">{item.value}</p></div>)}</div><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Order health</p><h3 className="mt-2 text-xl font-semibold">Payment requests at a glance</h3></div><button type="button" onClick={refresh} className="rounded-md p-2 text-muted-foreground hover:bg-muted" data-testid="button-refresh-admin"><RefreshCw size={15} /></button></div><div className="mt-6 grid grid-cols-3 gap-2 text-center">{[['Pending',overview.data?.pendingOrders ?? 0,'text-accent'],['Successful',overview.data?.successfulOrders ?? 0,'text-emerald-700'],['Failed',overview.data?.failedOrders ?? 0,'text-destructive']].map(([label,value,color]) => <div key={label} className="rounded-lg bg-muted/60 p-4"><p className={`text-2xl font-semibold ${color}`}>{value}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p></div>)}</div></div><div className="rounded-2xl border border-accent/25 bg-accent/10 p-6"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Audit posture</p><h3 className="mt-2 text-xl font-semibold">Every state has a reason.</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Tokens can be revealed or revoked, users can be restricted, and order status changes remain visible in the operator workflow.</p></div></div></section>}
    {tab === 'users' && <AdminUsers users={users.data ?? []} tokenForm={tokenForm} setTokenForm={setTokenForm} createToken={createToken} issued={issued} setIssued={setIssued} revealed={revealed} reveal={reveal} setRevealed={setRevealed} revoke={revoke} updateUser={updateUser} onRefresh={refresh} />}
    {tab === 'orders' && <AdminOrders orders={orders.data ?? []} updateOrder={updateOrder} onRefresh={refresh} />}
    {tab === 'settings' && <AdminSettings payment={payment} setPayment={setPayment} saveSettings={saveSettings} />}
  </div></main>;
}

function AdminUsers({ users, tokenForm, setTokenForm, createToken, issued, setIssued, revealed, setRevealed, reveal, revoke, updateUser, onRefresh }: { users: AdminUser[]; tokenForm: { name: string; email: string; planId: 'starter' | 'pro' | 'enterprise' }; setTokenForm: (value: { name: string; email: string; planId: 'starter' | 'pro' | 'enterprise' }) => void; createToken: ReturnType<typeof useCreateAdminToken>; issued: string; setIssued: (value: string) => void; revealed: Record<string, string>; setRevealed: Dispatch<SetStateAction<Record<string, string>>>; reveal: ReturnType<typeof useRevealAdminToken>; revoke: ReturnType<typeof useRevokeAdminToken>; updateUser: ReturnType<typeof useUpdateAdminUserStatus>; onRefresh: () => void }) {
  return <section className="grid gap-6 py-7 lg:grid-cols-[360px_1fr]"><div className="rounded-2xl border border-border bg-card p-6"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Issue access</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Create a customer token</h3><div className="mt-5 space-y-2"><input value={tokenForm.name} onChange={(event) => setTokenForm({ ...tokenForm, name: event.target.value })} placeholder="Customer name" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid="input-new-user-name" /><input type="email" value={tokenForm.email} onChange={(event) => setTokenForm({ ...tokenForm, email: event.target.value })} placeholder="Email address" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid="input-new-user-email" /><select value={tokenForm.planId} onChange={(event) => setTokenForm({ ...tokenForm, planId: event.target.value as typeof tokenForm.planId })} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid="select-new-user-plan"><option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select><button type="button" onClick={() => createToken.mutate({ data: tokenForm }, { onSuccess: (result) => { setIssued(result.token); onRefresh(); } })} disabled={createToken.isPending || !tokenForm.name || !tokenForm.email} className="mt-2 flex h-11 w-full items-center justify-between rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-45" data-testid="button-create-token"><span>{createToken.isPending ? 'Issuing…' : 'Issue token'}</span>{createToken.isPending ? <Loader2 className="animate-spin" size={15} /> : <ArrowRight size={15} />}</button></div>{issued && <div className="mt-5 rounded-lg border border-accent/30 bg-accent/10 p-4" data-testid="status-issued-token"><p className="font-mono text-[9px] uppercase tracking-wider text-accent">Reveal once / copy now</p><p className="mt-2 break-all font-mono text-xs">{issued}</p><button type="button" onClick={() => navigator.clipboard?.writeText(issued)} className="mt-3 flex items-center gap-2 text-xs font-bold text-accent" data-testid="button-copy-issued-token"><Copy size={14} /> Copy token</button></div>}</div><div className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Issued accounts</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Access ledger</h3></div><span className="rounded-full bg-secondary px-3 py-1 font-mono text-[10px]">{users.length} users</span></div>{users.length ? <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-border font-mono text-[9px] uppercase tracking-wider text-muted-foreground"><th className="pb-3">Customer</th><th className="pb-3">Usage</th><th className="pb-3">Token</th><th className="pb-3">Status</th><th className="pb-3 text-right">Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-border/70 last:border-0" data-testid={`row-admin-user-${user.id}`}><td className="py-4"><p className="font-semibold">{user.name}</p><p className="mt-1 text-xs text-muted-foreground">{user.email}</p></td><td className="py-4 font-mono text-xs">{user.slipsUsed} / {user.slipLimit}</td><td className="py-4">{revealed[user.tokenId] ? <span className="font-mono text-[10px]">{revealed[user.tokenId]}</span> : <button type="button" onClick={() => reveal.mutate({ tokenId: user.tokenId }, { onSuccess: (result) => setRevealed((current) => ({ ...current, [user.tokenId]: result.token })) })} className="flex items-center gap-1 text-xs font-bold text-accent" data-testid={`button-reveal-token-${user.tokenId}`}>{reveal.isPending ? <Loader2 size={13} className="animate-spin" /> : <Eye size={14} />} Reveal</button>}</td><td className="py-4"><span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${user.status === 'active' ? 'bg-secondary text-secondary-foreground' : 'bg-destructive/10 text-destructive'}`}>{user.status}</span></td><td className="py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => updateUser.mutate({ userId: user.id, data: { status: user.status === 'active' ? 'restricted' : 'active' } }, { onSuccess: onRefresh })} className="rounded-md border border-border px-2 py-1.5 text-[10px] font-bold hover:bg-muted" data-testid={`button-toggle-user-${user.id}`}>{user.status === 'active' ? 'Restrict' : 'Activate'}</button>{user.tokenStatus === 'active' && <button type="button" onClick={() => revoke.mutate({ tokenId: user.tokenId }, { onSuccess: onRefresh })} className="rounded-md p-2 text-destructive hover:bg-destructive/10" aria-label="Revoke token" data-testid={`button-revoke-token-${user.tokenId}`}><EyeOff size={14} /></button>}</div></td></tr>)}</tbody></table></div> : <div className="mt-7 rounded-xl border border-dashed border-border p-12 text-center"><Users className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-semibold">No issued users yet.</p><p className="mt-2 text-xs text-muted-foreground">A newly issued token will become the first row in this ledger.</p></div>}</div></section>;
}

function AdminOrders({ orders, updateOrder, onRefresh }: { orders: Order[]; updateOrder: ReturnType<typeof useUpdateAdminOrderStatus>; onRefresh: () => void }) {
  return <section className="py-7"><div className="rounded-2xl border border-border bg-card p-6"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Payment requests</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Order ledger</h3>{orders.length ? <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border font-mono text-[9px] uppercase tracking-wider text-muted-foreground"><th className="pb-3">Order</th><th className="pb-3">Customer</th><th className="pb-3">Method</th><th className="pb-3">Amount</th><th className="pb-3">Status</th><th className="pb-3 text-right">Update</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-border/70 last:border-0" data-testid={`row-admin-order-${order.id}`}><td className="py-4"><p className="font-mono text-xs font-semibold">{order.orderNumber}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p></td><td className="py-4"><p className="font-semibold">{order.name}</p><p className="mt-1 text-xs text-muted-foreground">{order.email}</p></td><td className="py-4 text-xs">{order.paymentMethod === 'card_manual' ? 'Terminal / manual' : 'Bitcoin'}</td><td className="py-4 font-mono text-xs">${(order.amountCents / 100).toFixed(2)} {order.currency}</td><td className="py-4"><span className="rounded-full bg-muted px-2 py-1 font-mono text-[9px] uppercase tracking-wider">{order.status}</span></td><td className="py-4 text-right"><select value={order.status} onChange={(event) => updateOrder.mutate({ orderId: order.id, data: { status: event.target.value as 'pending' | 'successful' | 'failed' } }, { onSuccess: onRefresh })} className="h-8 rounded-md border border-input bg-background px-2 text-xs" data-testid={`select-order-status-${order.id}`}><option value="pending">Pending</option><option value="successful">Successful</option><option value="failed">Failed</option></select></td></tr>)}</tbody></table></div> : <div className="mt-7 rounded-xl border border-dashed border-border p-12 text-center"><PackageSearch className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-semibold">No payment requests.</p><p className="mt-2 text-xs text-muted-foreground">Orders created from the customer desk will settle here.</p></div>}</div></section>;
}

function AdminSettings({ payment, setPayment, saveSettings }: { payment: PaymentSettings; setPayment: (value: PaymentSettings) => void; saveSettings: ReturnType<typeof useUpdateAdminPaymentSettings> }) {
  const [notice, setNotice] = useState('');
  return <section className="grid gap-6 py-7 lg:grid-cols-[1fr_360px]"><div className="rounded-2xl border border-border bg-card p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Bitcoin settlement</p><h3 className="mt-2 text-3xl font-semibold tracking-[-.05em]">What customers should see.</h3><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Keep wallet instructions explicit and reviewable. These settings are surfaced to operators while handling Bitcoin requests.</p><label className="mt-7 block text-xs font-bold text-muted-foreground">Wallet address<input value={payment.bitcoinWallet} onChange={(event) => setPayment({ ...payment, bitcoinWallet: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm" placeholder="Configured wallet address" data-testid="input-bitcoin-wallet" /></label><label className="mt-4 block text-xs font-bold text-muted-foreground">QR image URL <span className="font-normal">(optional)</span><input value={payment.bitcoinQrUrl ?? ''} onChange={(event) => setPayment({ ...payment, bitcoinQrUrl: event.target.value || null })} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" placeholder="https://…" data-testid="input-bitcoin-qr" /></label><label className="mt-4 block text-xs font-bold text-muted-foreground">Instructions<textarea value={payment.bitcoinInstructions} onChange={(event) => setPayment({ ...payment, bitcoinInstructions: event.target.value })} className="mt-2 min-h-32 w-full rounded-lg border border-input bg-background px-3 py-3 text-sm leading-6" placeholder="Tell the customer what to include with a payment request." data-testid="input-bitcoin-instructions" /></label><button type="button" onClick={() => saveSettings.mutate({ data: payment }, { onSuccess: () => setNotice('Bitcoin settings saved.'), onError: () => setNotice('Settings could not be saved.') })} disabled={saveSettings.isPending} className="mt-5 h-11 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-payment-settings">{saveSettings.isPending ? 'Saving…' : 'Save settings'}</button>{notice && <p className="mt-3 text-xs font-semibold text-accent" data-testid="status-payment-settings">{notice}</p>}</div><div className="rounded-2xl border border-accent/25 bg-accent/10 p-6"><Bitcoin className="text-accent" size={22} /><h3 className="mt-4 text-xl font-semibold">Configuration check</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{payment.bitcoinWallet ? 'A wallet is configured. Review the address carefully before accepting a request.' : 'No wallet address is configured yet. Bitcoin requests should remain pending until one is supplied.'}</p>{payment.bitcoinQrUrl && <img src={payment.bitcoinQrUrl} alt="Configured Bitcoin payment QR" className="mt-6 aspect-square w-40 rounded-lg border border-border bg-card object-contain p-2" data-testid="img-bitcoin-qr" />}</div></section>;
}

function Home() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SampleDocumentInput>({
    payeeName: 'Northwind Operations',
    payeeAddress: '',
    payorName: '',
    payorAddress: '',
    bankName: '',
    bankAddress: '',
    bankLogoDataUrl: null,
    accountNumber: '000000000000',
    routingNumber: '',
    checkNumber: '10427',
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    memo: '',
  });
  const [placeInput, setPlaceInput] = useState('');
  const [amountInput, setAmountInput] = useState('0.00');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [routingMessage, setRoutingMessage] = useState('');
  const [pdfMessage, setPdfMessage] = useState('');
  const [logoMessage, setLogoMessage] = useState('');

  const integrations = useGetIntegrationStatus();
  const health = useHealthCheck();
  const autocomplete = useAutocompletePlace();
  const routing = useLookupRoutingNumber();
  const pdf = useRenderSamplePdf();
  const removeBackground = useRemoveBackground();
  const suggestions = autocomplete.data?.suggestions ?? [];
  const setField = <K extends keyof SampleDocumentInput>(key: K, value: SampleDocumentInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const searchPlaces = () => {
    const input = placeInput.trim();
    if (input.length < 3) return;
    autocomplete.mutate({ data: { input } });
    setShowSuggestions(true);
  };

  const validateRouting = () => {
    if (!/^\d{9}$/.test(form.routingNumber)) {
      setRoutingMessage('Enter exactly 9 digits to validate this routing number.');
      return;
    }
    setRoutingMessage('');
    routing.mutate({ data: { routingNumber: form.routingNumber } }, {
      onSuccess: (result) => {
        setRoutingMessage(result.message);
        if (result.bankAddress) setField('bankAddress', result.bankAddress);
      },
      onError: () => setRoutingMessage('Routing lookup could not be completed. Try again.'),
    });
  };

  const renderPdf = () => {
    setPdfMessage('');
    pdf.mutate({ data: form }, {
      onSuccess: (result) => setPdfMessage(result.message),
      onError: () => setPdfMessage('The PDF boundary returned an error. Nothing was exported.'),
    });
  };

  const handleLogoUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setLogoMessage('');
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') return;
      setField('bankLogoDataUrl', reader.result);
      removeBackground.mutate(
        { data: { imageDataUrl: reader.result } },
        {
          onSuccess: (result) => {
            setField('bankLogoDataUrl', result.imageDataUrl);
            setLogoMessage('Background removed.');
          },
          onError: () => {
            void removeLogoBackgroundLocally(reader.result as string)
              .then((cleanedLogo) => {
                setField('bankLogoDataUrl', cleanedLogo);
                setLogoMessage('Used the local background remover.');
              })
              .catch(() => setLogoMessage('Background removal unavailable; the original logo was kept.'));
          },
        },
      );
    });
    reader.readAsDataURL(file);
  };

  const handleAmountChange = (value: string) => {
    const normalized = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    const decimalIndex = normalized.indexOf('.');
    const currencyValue = decimalIndex === -1 ? normalized : normalized.slice(0, decimalIndex + 3);
    setAmountInput(currencyValue);
    if (currencyValue === '' || currencyValue === '.') {
      setField('amount', null);
      return;
    }
    setField('amount', Number(currencyValue));
  };

  const retryStatus = () => {
    queryClient.invalidateQueries({ queryKey: getGetIntegrationStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getHealthCheckQueryKey() });
  };

  return (
    <main className="min-h-[100dvh] bg-background">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-sidebar-primary/15 text-sidebar-primary ring-1 ring-sidebar-primary/30" data-testid="brand-mark">
              <DepSlipMark compact />
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.24em] text-sidebar-foreground/55">Document preparation</p>
              <h1 className="mt-0.5 text-[20px] font-semibold tracking-[-.04em]" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>DepSlip</h1>
            </div>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-sidebar-foreground/70">
              <span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-red-400' : health.isLoading ? 'bg-amber-300 animate-pulse-line' : 'bg-sidebar-primary'}`} />
              {health.isLoading ? 'Checking boundary' : health.isError ? 'Boundary unavailable' : 'Boundary online'}
            </div>
            <div className="h-5 w-px bg-sidebar-border" />
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-sidebar-foreground/50">Local-first / v0.4</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[minmax(440px,520px)_1fr]">
        <section className="print-hide border-b border-border/80 bg-background/65 px-5 py-7 sm:px-8 lg:min-h-[calc(100dvh-73px)] lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
          <div className="mb-8 max-w-md animate-rise-in">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent">
              <span className="h-px w-5 bg-accent" /> Input sheet / 01
            </div>
            <h2 className="text-3xl font-extrabold tracking-[-.045em] text-foreground sm:text-[36px]">Build a deposit slip<span className="text-accent">.</span></h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">A careful workspace for getting the details right. Enter the source information; the paper preview keeps pace on the right.</p>
          </div>

          <div className="mb-7 grid grid-cols-2 gap-2">
            <SafetyPill icon={<ShieldCheck size={15} />} label="Account visible" />
            <SafetyPill icon={<ClipboardCheck size={15} />} label="Account protected" />
          </div>

          <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
            <FieldGroup label="Recipient & bank" number="A">
              <TextField id="payeeName" label="Payee name" value={form.payeeName} onChange={(value) => setField('payeeName', value)} placeholder="Northwind Operations" required />
               <TextField id="payeeAddress" label="Payee address" value={form.payeeAddress ?? ''} onChange={(value) => setField('payeeAddress', value)} placeholder="Street, city, state, ZIP" />
              <TextField id="bankName" label="Payee bank name" value={form.bankName ?? ''} onChange={(value) => setField('bankName', value)} placeholder="Your bank name" required />
              <div>
                <span className="mb-1.5 block text-[11px] font-bold text-muted-foreground">Payee bank logo</span>
                <div className="flex items-center gap-3">
                  <label htmlFor="bankLogo" className="flex h-10 flex-1 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground shadow-sm transition hover:border-muted-foreground/50">
                    <Upload size={15} className="text-accent" />
                     <span className="truncate">{removeBackground.isPending ? 'Removing background…' : form.bankLogoDataUrl ? 'Logo uploaded' : 'Upload an image'}</span>
                    <input id="bankLogo" type="file" accept="image/*" className="sr-only" onChange={(event) => handleLogoUpload(event.target.files?.[0])} data-testid="input-bank-logo" />
                  </label>
                  {form.bankLogoDataUrl && <button type="button" className="text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setField('bankLogoDataUrl', null)}>Remove</button>}
                </div>
                {logoMessage && <p className="mt-1 text-[10px] leading-4 text-amber-800">{logoMessage}</p>}
              </div>
              <div className="relative">
                <TextField id="bankAddress" label="Bank address" value={placeInput || form.bankAddress} onChange={(value) => { setPlaceInput(value); setField('bankAddress', value); }} placeholder="Begin typing a physical address" onFocus={() => setShowSuggestions(true)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); searchPlaces(); } }} required />
                <button type="button" onClick={searchPlaces} disabled={placeInput.trim().length < 3 || autocomplete.isPending} className="absolute right-2 top-[27px] flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30" data-testid="button-search-address" aria-label="Search address suggestions">
                  {autocomplete.isPending ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                </button>
                {showSuggestions && (suggestions.length > 0 || autocomplete.isPending || autocomplete.isError) && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-md" data-testid="list-address-suggestions">
                    {autocomplete.isPending && <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin" /> Searching physical addresses…</div>}
                    {autocomplete.isError && <div className="flex items-center gap-2 p-3 text-xs text-destructive"><AlertCircle size={13} /> Address service unavailable.</div>}
                    {suggestions.map((suggestion) => (
                      <button type="button" key={suggestion.id} onClick={() => { setField('bankAddress', suggestion.description); setPlaceInput(suggestion.description); setShowSuggestions(false); }} className="flex w-full items-start gap-2 border-b border-border px-3 py-3 text-left text-xs text-foreground transition last:border-0 hover:bg-secondary" data-testid={`suggestion-address-${suggestion.id}`}>
                        <MapPin size={14} className="mt-0.5 shrink-0 text-accent" /> {suggestion.description}
                      </button>
                    ))}
                    {!autocomplete.isPending && !autocomplete.isError && suggestions.length === 0 && <div className="p-3 text-xs text-muted-foreground">No physical matches yet.</div>}
                  </div>
                )}
              </div>
              <p className="flex items-start gap-2 text-[10px] leading-4 text-muted-foreground"><Info size={13} className="mt-0.5 shrink-0 text-accent" />Ask the payee for the physical bank address—or mail-in deposit lockbox address—accurately so the document reaches the correct department.</p>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <TextField id="routingNumber" label="Routing number" value={form.routingNumber} onChange={(value) => setField('routingNumber', value.replace(/\D/g, '').slice(0, 9))} placeholder="9 digits" inputMode="numeric" />
                <button type="button" onClick={validateRouting} disabled={routing.isPending} className="mt-[25px] flex h-10 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-xs font-bold text-secondary-foreground transition hover:bg-secondary/70 disabled:opacity-50" data-testid="button-validate-routing">
                  {routing.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Validate
                </button>
              </div>
              {routingMessage && <div className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${routing.data?.valid ? 'bg-secondary text-secondary-foreground' : 'bg-amber-50 text-amber-900'}`} data-testid="status-routing-message"><Info size={14} className="mt-0.5 shrink-0" /> {routingMessage}</div>}
              {routing.data?.lookupStatus === 'found' && <div className="rounded-md border border-border bg-card/70 px-3 py-2.5 text-xs" data-testid="routing-directory-result">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-foreground">{routing.data.bankName}</p>{routing.data.bankAddress && <p className="mt-1 leading-4 text-muted-foreground">{routing.data.bankAddress}</p>}</div>{routing.data.bankLogoUrl && <img src={routing.data.bankLogoUrl} alt="" className="h-8 w-8 rounded object-contain" />}</div>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">{routing.data.source ?? 'Local directory'} · {routing.data.rails.join(' + ') || 'routing'}</p>
              </div>}
            </FieldGroup>

            <FieldGroup label="Payor details" number="B">
              <TextField id="payorName" label="Payor name" value={form.payorName ?? ''} onChange={(value) => setField('payorName', value)} placeholder="Person or business name" />
              <TextField id="payorAddress" label="Payor address" value={form.payorAddress ?? ''} onChange={(value) => setField('payorAddress', value)} placeholder="Street, city, state, ZIP" />
            </FieldGroup>

             <FieldGroup label="Document details" number="C">
              <div className="grid grid-cols-2 gap-3">
                 <TextField id="checkNumber" label="Check number" value={form.checkNumber} onChange={(value) => setField('checkNumber', value)} placeholder="10427" required />
                 <TextField id="date" label="Date" value={form.date} onChange={(value) => setField('date', value)} type="date" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <TextField id="accountNumber" label="Account number" value={form.accountNumber} onChange={(value) => setField('accountNumber', value.replace(/\D/g, '').slice(0, 30))} placeholder="Digits only" inputMode="numeric" helper="Stored in memory only; preview matches the entered value." required />
                   <TextField id="amount" label="Amount" value={amountInput} onChange={handleAmountChange} placeholder="0.00" inputMode="decimal" required />
              </div>
               <TextField id="memo" label="Memo" value={form.memo} onChange={(value) => setField('memo', value)} placeholder="Add a memo or reference" required />
            </FieldGroup>

             <div className="border-t border-border pt-5">
               <button type="button" onClick={() => window.print()} className="mb-3 flex w-full items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-left text-foreground transition hover:bg-muted" data-testid="button-print-document">
                 <span className="flex items-center gap-3"><Printer size={17} /><span><span className="block text-sm font-bold">Print in browser</span><span className="mt-0.5 block text-[11px] text-muted-foreground">Uses the exact paper dimensions in print mode</span></span></span>
                 <ArrowRight size={17} />
               </button>
              <button type="button" onClick={renderPdf} disabled={pdf.isPending || !integrations.data?.pdf.configured} className="group flex w-full items-center justify-between rounded-md bg-primary px-4 py-3.5 text-left text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-render-pdf">
                <span className="flex items-center gap-3"><FileDown size={17} /><span><span className="block text-sm font-bold">{pdf.isPending ? 'Checking PDF boundary…' : 'Render safe sample PDF'}</span><span className="mt-0.5 block text-[11px] text-primary-foreground/60">Export remains unavailable until PDF is configured</span></span></span>
                {pdf.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={17} className="transition group-hover:translate-x-1" />}
              </button>
              {pdfMessage && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" data-testid="status-pdf-message"><Check size={14} className="text-emerald-700" /> {pdfMessage}</p>}
            </div>
          </form>
        </section>

          <section className="paper-grid print-surface min-w-0 bg-[hsl(198_24%_90%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto max-w-[960px]">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent"><span className="h-px w-5 bg-accent" /> Output sheet / 02</div>
                 <h2 className="text-2xl font-extrabold tracking-[-.04em]">Physical preview</h2>
                 <p className="mt-1 text-xs text-muted-foreground">Live representation · US letter placement · 8 × 4.5 in artifact</p>
              </div>
              <div className="rounded-md border border-border bg-card/80 px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[.13em] text-muted-foreground">
                <span className="block text-foreground">100% safe mode</span>
                <span className="mt-1 block">No production negotiability</span>
              </div>
            </div>
              <DocumentPreview form={form} routingLookup={routing.data} />
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <IntegrationPanel data={integrations.data?.places} label="Places / address suggestions" icon={<MapPin size={16} />} loading={integrations.isLoading} />
              <IntegrationPanel data={integrations.data?.routing} label="Routing / bank validation" icon={<Landmark size={16} />} loading={integrations.isLoading} />
              <IntegrationPanel data={integrations.data?.pdf} label="PDF / export boundary" icon={<FileDown size={16} />} loading={integrations.isLoading} />
              <div className="rounded-lg border border-border bg-card/65 p-4">
                <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold"><Sparkles size={15} className="text-accent" /> Readiness notes</span><button type="button" onClick={retryStatus} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="button-refresh-status" aria-label="Refresh readiness status"><RefreshCw size={14} /></button></div>
                {integrations.isError ? <p className="text-xs leading-5 text-destructive" data-testid="status-integration-error">Integration status could not be loaded. Refresh to retry.</p> : <p className="text-xs leading-5 text-muted-foreground">Only configured providers can make external requests. The local preview remains available at every boundary.</p>}
              </div>
            </div>
             <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" /> Print-safe note: account and MICR values remain visible exactly as entered; print mode uses the locally bundled GnuMICR E-13B font. Use only with an authorized deposit-slip workflow.</p>
          </div>
        </section>
      </div>
      <footer className="print-hide border-t border-border/80 bg-sidebar px-5 py-7 text-sidebar-foreground sm:px-8 lg:px-10" data-testid="footer-policy">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 text-[10px] leading-5 text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <div className="flex shrink-0 items-start gap-3 text-sidebar-foreground">
            <DepSlipMark compact className="text-sidebar-primary" />
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[.2em]">DepSlip</p>
              <p className="mt-1 text-sidebar-foreground/55">Local-first document preparation.</p>
            </div>
          </div>
          <div className="max-w-3xl border-l border-sidebar-border pl-4 sm:pl-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-sidebar-primary">Use policy</p>
            <p className="mt-1 text-sidebar-foreground/60">Use only for authorized deposit-slip workflows. Account and MICR values are shown exactly as entered. External requests happen only through configured provider actions; browser print uses the bundled MICR font.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SafetyPill({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-[11px] font-semibold text-muted-foreground"><span className="text-accent">{icon}</span>{label}</div>;
}

function FieldGroup({ label, number, children }: { label: string; number: string; children: ReactNode }) {
  return <fieldset className="space-y-3"><legend className="mb-3 flex w-full items-center gap-3 text-xs font-extrabold uppercase tracking-[.12em] text-foreground"><span className="flex h-6 w-6 items-center justify-center rounded bg-primary font-mono text-[10px] text-primary-foreground">{number}</span>{label}<span className="h-px flex-1 bg-border" /></legend>{children}</fieldset>;
}

function TextField({ id, label, value, onChange, placeholder, type = 'text', helper, inputMode, onFocus, onKeyDown, required, min, step }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; helper?: string; inputMode?: 'text' | 'numeric' | 'decimal'; onFocus?: () => void; onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void; required?: boolean; min?: string; step?: string }) {
  return <label className="block" htmlFor={id}><span className="mb-1.5 block text-[11px] font-bold text-muted-foreground">{label}{required && <span className="ml-1 text-accent" aria-hidden="true">*</span>}</span><input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} onFocus={onFocus} onKeyDown={onKeyDown} placeholder={placeholder} inputMode={inputMode} required={required} min={min} step={step} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/55 hover:border-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15" data-testid={`input-${id}`} />{helper && <span className="mt-1 block font-mono text-[9px] leading-4 text-muted-foreground">{helper}</span>}</label>;
}

function DocumentPreview({ form, routingLookup }: { form: SampleDocumentInput; routingLookup?: RoutingLookupResponse }) {
  const routingNumber = form.routingNumber || '000000000';
  const accountNumber = form.accountNumber || '000000000000';
  const checkNumber = form.checkNumber || '00000';
  const micrValue = `A${routingNumber}A ${accountNumber}C D`;
  const amountLabel = form.amount === null || Number.isNaN(form.amount)
    ? '—'
    : form.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const addressLines = (form.bankAddress || routingLookup?.bankAddress || 'PO BOX 12345, NEW YORK, NY 10116-1234')
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean);
  const bankName = form.bankName || routingLookup?.bankName || 'PAYEE BANK NAME';
  const bankLogoUrl = form.bankLogoDataUrl || routingLookup?.bankLogoUrl;
  const payeeAddressLines = (form.payeeAddress || 'PAYEE ADDRESS').split(',').map((line) => line.trim()).filter(Boolean);
  const payorAddressLines = (form.payorAddress || 'PAYOR ADDRESS').split(',').map((line) => line.trim()).filter(Boolean);

  return <div className="relative mx-auto w-full max-w-[960px] overflow-hidden rounded-[2px] border border-[#b8b8ae] bg-[#f6f6ed] text-[#161714] document-shadow document-slip" style={{ aspectRatio: '8 / 4.5' }} data-testid="preview-document">
    <style>{`@font-face { font-family: "GnuMICR"; src: url("${micrFontData}") format("truetype"); font-weight: normal; font-style: normal; }`}</style>
    <div className="pointer-events-none absolute inset-[2.6%] border border-[#d0d0c7]" />
    <div className="pointer-events-none absolute right-0 top-0 h-full w-[1.6%] perforation-edge" />

    <div className={`absolute left-[7.5%] top-[8.3%] w-[52%] text-[clamp(7px,1.55vw,14px)] leading-[1.12] ${bankLogoUrl ? 'pl-[18%]' : ''}`}>
      {bankLogoUrl && <img src={bankLogoUrl} alt={`${bankName} logo`} className="absolute left-0 top-0 h-[5.5em] w-[15%] object-contain" data-testid="preview-bank-logo" />}
      <div>
        <div className="font-serif text-[1.06em] font-bold tracking-[-.02em]">{bankName}</div>
        <div className="font-semibold">ATTN: MAIL-IN DEPOSITS</div>
        {addressLines.slice(0, 2).map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
        {addressLines.length < 2 && <div>NEW YORK, NY 10116-1234</div>}
      </div>
    </div>

    <div className="absolute right-[6.3%] top-[7.5%] w-[34%] border border-[#282a25] bg-[#f8f8f0] text-[clamp(6px,1.22vw,11px)] leading-none">
      <div className="grid grid-cols-[38%_62%] border-b border-[#282a25]"><span className="border-r border-[#282a25] px-[6%] py-[5%] font-semibold">DATE:</span><span className="px-[5%] py-[5%]">{form.date || '—'}</span></div>
      <div className="grid grid-cols-[38%_62%] border-b border-[#282a25]"><span className="border-r border-[#282a25] px-[6%] py-[5%] font-semibold">ROUTING NUMBER:</span><span className="px-[5%] py-[5%]">{form.routingNumber || '—'}</span></div>
      <div className="grid grid-cols-[38%_62%]"><span className="border-r border-[#282a25] px-[6%] py-[5%] font-semibold">DDA ACCOUNT NUMBER:</span><span className="px-[5%] py-[5%]">{accountNumber}</span></div>
    </div>

      <div className="absolute left-[7.5%] top-[38%] h-[51%] w-[62%] border border-[#282a25] bg-[#f8f8f0] text-[clamp(7px,1.42vw,13px)] leading-[1.05]">
        <div className="absolute inset-x-0 top-0 h-[30%] border-b border-[#282a25] px-[2.2%] py-[1.7%]">
          <div className="text-[.78em] font-semibold">REFERENCE / NOTE:</div>
          <div className="mt-[1.4%] break-words">{form.memo || '—'}</div>
        </div>
        <div className="absolute inset-x-0 top-[30%] grid h-[21%] grid-cols-[31%_31%_38%] border-b border-[#282a25]">
          <div className="border-r border-[#282a25] px-[2.2%] py-[2.5%]"><div className="text-[.78em] font-semibold">CHECK NUMBER:</div><div className="mt-[3%]">{checkNumber}</div></div>
          <div className="border-r border-[#282a25] px-[2.2%] py-[2.5%]"><div className="text-[.78em] font-semibold">CHECK DATE:</div><div className="mt-[3%]">{form.date || '—'}</div></div>
          <div className="px-[2.2%] py-[2.5%]"><div className="text-[.78em] font-semibold">CHECK AMOUNT:</div><div className="mt-[3%]"><span className="mr-[8%]">$</span>{amountLabel}</div></div>
        </div>
        <div className="absolute inset-x-0 top-[51%] grid h-[49%] grid-cols-[.9fr_1.1fr] border-t border-[#282a25]">
          <div className="border-r border-[#282a25] px-[3.5%] py-[3%]">
            <div className="text-[.78em] font-semibold">PAYEE:</div>
            <div className="mt-[3%] font-semibold uppercase">{form.payeeName || 'PAYEE NAME'}</div>
            {payeeAddressLines.slice(0, 2).map((line, index) => <div key={`${line}-${index}`} className="uppercase">{line}</div>)}
          </div>
          <div className="px-[3.5%] py-[3%] text-[.86em] leading-[1.12]">
            <div className="font-semibold">PAYOR:</div>
            <div className="mt-[2%] uppercase">{form.payorName || 'PAYOR NAME'}</div>
            {payorAddressLines.slice(0, 2).map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
          </div>
        </div>
      </div>

      <div className="absolute right-[6.3%] top-[55%] w-[20%] border border-[#282a25] bg-[#f8f8f0] text-[clamp(7px,1.35vw,12px)] leading-none">
      <div className="border-b border-[#282a25] px-[6%] py-[7%] font-semibold">TOTAL DEPOSIT</div>
      <div className="px-[6%] py-[10%]"><span className="mr-[14%]">$</span>{amountLabel}</div>
    </div>

    <div className="absolute bottom-[6.5%] left-1/2 -translate-x-1/2 font-mono text-[clamp(8px,1.5vw,14px)] tracking-[.1em] text-[#161714] micr-line" aria-label="MICR E-13B line">
      <span className="screen-micr">{micrValue}</span>
      <span className="print-micr">{micrValue}</span>
    </div>
  </div>;
}

function IntegrationPanel({ data, label, icon, loading }: { data?: { configured: boolean; provider: string; message: string }; label: string; icon: ReactNode; loading: boolean }) {
  if (loading) return <div className="h-[104px] animate-pulse rounded-lg border border-border bg-card/60 p-4"><div className="h-3 w-2/5 rounded bg-muted" /><div className="mt-4 h-2 w-4/5 rounded bg-muted" /></div>;
  const configured = data?.configured;
  return <div className="rounded-lg border border-border bg-card/65 p-4" data-testid={`status-integration-${label.split(' ')[0].toLowerCase()}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2 text-xs font-bold">{icon}{label}</div><span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${configured ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>{configured ? 'Ready' : 'Not configured'}</span></div><p className="mt-3 text-[11px] leading-4 text-muted-foreground">{data?.message ?? 'Waiting for readiness check…'}</p>{data?.provider && <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">Provider · {data.provider}</p>}</div>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={CustomerHome} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
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
