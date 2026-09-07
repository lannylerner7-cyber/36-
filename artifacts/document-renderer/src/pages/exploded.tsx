import { useEffect, useMemo, useState, type FormEvent } from 'react';
import depslipLogo from '../assets/brand/depslip-logo.svg';
import {
  ArrowLeft,
  ArrowRight,
  Bitcoin,
  Check,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Ruler,
  ShieldCheck,
} from 'lucide-react';
import {
  getGetBitcoinPaymentSettingsQueryKey,
  getListPlansQueryKey,
  useCreateOrder,
  useGetBitcoinPaymentSettings,
  useListPlans,
  type Plan,
  type CreateOrderInputPlanId,
} from '@workspace/api-client-react';
import { Link } from 'wouter';

type PaymentMethod = 'card_manual' | 'bitcoin';

const planNotes: Record<CreateOrderInputPlanId, { eyebrow: string; accent: string; detail: string }> = {
  starter: {
    eyebrow: 'For a clean first run',
    accent: 'The considered beginning.',
    detail: 'A compact allowance for straightforward deposit work and a single repeatable design.',
  },
  pro: {
    eyebrow: 'For the working desk',
    accent: 'The daily instrument.',
    detail: 'More room for recurring documents, multiple layouts, and a faster preparation rhythm.',
  },
  enterprise: {
    eyebrow: 'For an operating team',
    accent: 'The full measure.',
    detail: 'A generous document allowance and unlimited design capacity for a shared workflow.',
  },
};

const fallbackOrder = {
  name: '',
  email: '',
  billingAddress: '',
  paymentMethod: 'card_manual' as PaymentMethod,
  acceptedPaymentTerms: false,
};

function formatPrice(plan: Plan) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: plan.currency || 'USD',
    minimumFractionDigits: 2,
  }).format(plan.priceCents / 100);
}

function PlanMark({ planId }: { planId: CreateOrderInputPlanId }) {
  if (planId === 'starter') {
    return (
      <svg viewBox="0 0 92 58" aria-hidden="true" className="h-14 w-24 text-accent">
        <path d="M9 44h74M17 36h58M26 28h40M35 20h22M46 12v32" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 43 46 11l32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 4" />
      </svg>
    );
  }
  if (planId === 'pro') {
    return (
      <svg viewBox="0 0 92 58" aria-hidden="true" className="h-14 w-24 text-accent">
        <path d="M12 47V11h68v36M12 25h68M34 11v36M58 11v36" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M18 18h10M40 18h10M64 18h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="46" cy="36" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 92 58" aria-hidden="true" className="h-14 w-24 text-accent">
      <path d="M10 45 30 25l13 12 22-24 17 16" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 45h72M10 45V10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M30 25v20M43 37v8M65 13v32" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      <circle cx="30" cy="25" r="3" fill="currentColor" />
      <circle cx="43" cy="37" r="3" fill="currentColor" />
      <circle cx="65" cy="13" r="3" fill="currentColor" />
    </svg>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const note = planNotes[plan.id];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex min-h-[356px] flex-col overflow-hidden rounded-[4px] border text-left transition duration-300 hover:-translate-y-1 ${
        selected
          ? 'border-accent bg-[hsl(45_32%_98%)] shadow-[10px_14px_0_hsl(32_69%_49%/.14),0_18px_34px_rgba(22,48,63,.12)]'
          : 'border-border bg-card/75 hover:border-accent/65 hover:shadow-[0_15px_28px_rgba(22,48,63,.09)]'
      }`}
      data-testid={`card-exploded-plan-${plan.id}`}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between border-b border-border/80 px-5 py-4">
        <span className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Package / 0{plan.id === 'starter' ? 1 : plan.id === 'pro' ? 2 : 3}</span>
        <span className={`mt-0.5 h-3 w-3 rounded-full border ${selected ? 'border-accent bg-accent' : 'border-muted-foreground/50'}`} />
      </div>
      <div className="flex flex-1 flex-col px-5 py-5">
        <PlanMark planId={plan.id} />
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[.17em] text-accent">{note.eyebrow}</p>
        <h3 className="mt-2 text-[30px] font-semibold tracking-[-.06em]">{plan.name}</h3>
        <p className="mt-2 max-w-[270px] text-sm leading-5 text-muted-foreground">{plan.description || note.detail}</p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border/75 pt-5">
          <div>
            <p className="text-2xl font-semibold tracking-[-.05em]">{formatPrice(plan)}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">{plan.billing === 'monthly' ? 'billed monthly' : 'one-time issue'}</p>
          </div>
          <span className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${selected ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground group-hover:border-accent group-hover:text-accent'}`}>
            <ArrowRight size={15} />
          </span>
        </div>
      </div>
      <div className={`h-1 transition ${selected ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/40'}`} />
    </button>
  );
}

function OrderForm({
  selectedPlan,
  onPlanChange,
}: {
  selectedPlan?: Plan;
  onPlanChange: () => void;
}) {
  const [form, setForm] = useState(fallbackOrder);
  const [submittedOrder, setSubmittedOrder] = useState<{ orderNumber: string; status: string } | null>(null);
  const createOrder = useCreateOrder();
  const bitcoinSettings = useGetBitcoinPaymentSettings({
    query: {
      queryKey: getGetBitcoinPaymentSettingsQueryKey(),
      enabled: form.paymentMethod === 'bitcoin',
    },
  });

  const setField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPlan) return;
    setSubmittedOrder(null);
    createOrder.mutate(
      {
        data: {
          ...form,
          planId: selectedPlan.id,
        },
      },
      {
        onSuccess: (order) => setSubmittedOrder({ orderNumber: order.orderNumber, status: order.status }),
      },
    );
  };

  if (submittedOrder) {
    return (
      <section id="order-form" className="scroll-mt-8 rounded-[4px] border border-accent/45 bg-[hsl(175_18%_86%)] p-6 sm:p-9" data-testid="panel-order-success">
        <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground"><Check size={20} /></div>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[.2em] text-secondary-foreground">Request received / {submittedOrder.status}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-.06em]">Your order is on the desk.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-secondary-foreground/75">Keep this reference nearby. An operator will confirm the payment request and issue your protected workspace.</p>
          </div>
          <div className="min-w-[210px] border-l border-secondary-foreground/20 pl-5">
            <p className="font-mono text-[9px] uppercase tracking-[.18em] text-secondary-foreground/65">Order reference</p>
            <p className="mt-2 break-all font-mono text-xl font-semibold tracking-[-.03em] text-secondary-foreground">{submittedOrder.orderNumber}</p>
            <Link href="/" className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-secondary-foreground hover:underline"><ArrowLeft size={13} /> Return to access desk</Link>
          </div>
        </div>
        {form.paymentMethod === 'bitcoin' && bitcoinSettings.data && (
          <div className="mt-8 border-t border-secondary-foreground/15 pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-secondary-foreground">Bitcoin settlement instructions</p>
            <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-secondary-foreground/80">{bitcoinSettings.data.bitcoinInstructions}</p>
            <p className="mt-4 break-all rounded-[3px] border border-secondary-foreground/20 bg-background/60 p-3 font-mono text-xs text-secondary-foreground">{bitcoinSettings.data.bitcoinWallet}</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <form id="order-form" onSubmit={submit} className="scroll-mt-8 rounded-[4px] border border-border bg-card p-6 sm:p-9" data-testid="form-public-order">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">02 / Issue request</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.06em]">Put the plan on paper.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">A few exact details are all we need. No account is created here; your operator-reviewed request becomes the start of your protected workspace.</p>
        </div>
        {selectedPlan && (
          <button type="button" onClick={onPlanChange} className="flex items-center gap-2 self-start rounded-full border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground hover:border-accent hover:text-accent sm:self-auto">
            {selectedPlan.name} · {formatPrice(selectedPlan)} <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-bold">
              Your name
              <span className="relative mt-2 block"><input required maxLength={120} value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="Full name" className="h-12 w-full rounded-[3px] border border-input bg-background pl-10 pr-3 text-sm" data-testid="input-exploded-name" /><FileCheck2 size={16} className="absolute left-3 top-3.5 text-muted-foreground" /></span>
            </label>
            <label className="block text-xs font-bold">
              Work email
              <span className="relative mt-2 block"><input required type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} placeholder="you@company.com" className="h-12 w-full rounded-[3px] border border-input bg-background pl-10 pr-3 text-sm" data-testid="input-exploded-email" /><Mail size={16} className="absolute left-3 top-3.5 text-muted-foreground" /></span>
            </label>
          </div>
          <label className="block text-xs font-bold">
            Billing address
            <span className="relative mt-2 block"><input required maxLength={320} value={form.billingAddress} onChange={(event) => setField('billingAddress', event.target.value)} placeholder="Street, city, state, ZIP" className="h-12 w-full rounded-[3px] border border-input bg-background pl-10 pr-3 text-sm" data-testid="input-exploded-address" /><MapPin size={16} className="absolute left-3 top-3.5 text-muted-foreground" /></span>
          </label>
          <div>
            <p className="text-xs font-bold">Payment request method</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setField('paymentMethod', 'card_manual')} className={`flex min-h-[72px] items-center gap-3 rounded-[3px] border p-3 text-left transition ${form.paymentMethod === 'card_manual' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-accent'}`} data-testid="button-exploded-payment-card">
                <CreditCard size={18} /><span><span className="block text-sm font-bold">Terminal / manual</span><span className={`mt-1 block text-[10px] ${form.paymentMethod === 'card_manual' ? 'text-primary-foreground/65' : 'text-muted-foreground'}`}>Operator confirms the request</span></span>
              </button>
              <button type="button" onClick={() => setField('paymentMethod', 'bitcoin')} className={`flex min-h-[72px] items-center gap-3 rounded-[3px] border p-3 text-left transition ${form.paymentMethod === 'bitcoin' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-accent'}`} data-testid="button-exploded-payment-bitcoin">
                <Bitcoin size={18} /><span><span className="block text-sm font-bold">Bitcoin</span><span className={`mt-1 block text-[10px] ${form.paymentMethod === 'bitcoin' ? 'text-primary-foreground/65' : 'text-muted-foreground'}`}>Wallet details after request</span></span>
              </button>
            </div>
            {form.paymentMethod === 'bitcoin' && bitcoinSettings.isLoading && <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Reading settlement notes…</p>}
            {form.paymentMethod === 'bitcoin' && bitcoinSettings.isError && <p className="mt-3 text-xs text-destructive">Bitcoin settlement notes are unavailable. You can still submit the request for operator review.</p>}
          </div>
          <label className="flex gap-3 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            <input required type="checkbox" checked={form.acceptedPaymentTerms} onChange={(event) => setField('acceptedPaymentTerms', event.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--accent))]" data-testid="input-exploded-terms" />
            <span>I understand this submits a payment request for operator review. Card details are never entered into DepSlip.</span>
          </label>
          {createOrder.isError && <p className="text-xs font-semibold text-destructive">The request could not be submitted. Check the details and try again.</p>}
        </div>

        <aside className="paper-grid relative overflow-hidden rounded-[3px] border border-border bg-[hsl(45_32%_98%)] p-5">
          <div className="absolute right-0 top-0 h-14 w-14 border-b border-l border-border/80" />
          <p className="font-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">Request summary</p>
          <div className="mt-7 border-y border-foreground/15 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Selected capacity</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-.05em]">{selectedPlan?.slipLimit ?? '—'} slips</p>
            <p className="mt-1 text-xs text-muted-foreground">{selectedPlan?.designLimit === -1 ? 'Unlimited designs' : `${selectedPlan?.designLimit ?? '—'} design${selectedPlan?.designLimit === 1 ? '' : 's'}`}</p>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Due at request</span>
            <span className="text-xl font-semibold">{selectedPlan ? formatPrice(selectedPlan) : '—'}</span>
          </div>
          <button type="submit" disabled={!selectedPlan || createOrder.isPending} className="mt-7 flex h-12 w-full items-center justify-between rounded-[3px] bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-exploded-submit">
            <span>{createOrder.isPending ? 'Submitting request…' : 'Submit payment request'}</span>
            {createOrder.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          </button>
          <p className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-muted-foreground"><LockKeyhole size={13} className="mt-0.5 shrink-0 text-accent" /> Protected handoff. Your request is reviewed before access is issued.</p>
        </aside>
      </div>
    </form>
  );
}

export default function ExplodedPage() {
  const plans = useListPlans({ query: { queryKey: getListPlansQueryKey() } });
  const planFromUrl = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const value = new URLSearchParams(window.location.search).get('plan');
    return value === 'starter' || value === 'pro' || value === 'enterprise' ? value : undefined;
  }, []);
  const [selectedId, setSelectedId] = useState<CreateOrderInputPlanId | undefined>(planFromUrl);
  const selectedPlan = plans.data?.find((plan) => plan.id === selectedId);

  useEffect(() => {
    if (!selectedId && plans.data?.length) setSelectedId(plans.data[0].id);
  }, [plans.data, selectedId]);

  const selectPlan = (plan: Plan) => {
    setSelectedId(plan.id);
    window.setTimeout(() => document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3.5" data-testid="link-exploded-home">
            <img src={depslipLogo} alt="DepSlip" className="h-10 w-auto" />
            <span className="hidden border-l border-sidebar-border pl-3 font-mono text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/55 sm:inline">Plan desk</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-sidebar-foreground/70 hover:text-sidebar-primary"><ArrowLeft size={14} /> Access desk</Link>
        </div>
      </header>

      <section className="relative border-b border-border bg-[hsl(211_34%_19%)] text-sidebar-foreground">
        <div className="pointer-events-none absolute -right-20 top-[-7rem] h-[28rem] w-[28rem] rounded-full border border-sidebar-primary/20" />
        <div className="pointer-events-none absolute right-14 top-[-2rem] h-[18rem] w-[18rem] rounded-full border-[22px] border-sidebar-primary/10" />
        <div className="relative mx-auto grid max-w-[1480px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_350px] lg:px-12 lg:py-24">
          <div className="animate-rise-in">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-sidebar-primary"><span className="h-px w-8 bg-sidebar-primary" /> The plan desk / 01</div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[.95] tracking-[-.075em] sm:text-7xl lg:text-[92px]">Make room for<br /><span className="text-sidebar-primary">the right work.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-sidebar-foreground/65">Choose a measured document allowance, then send a precise request to the DepSlip operator. Every package is built around the final sheet—not a feature checklist.</p>
          </div>
          <div className="self-end border-l border-sidebar-foreground/15 pl-5 lg:mb-1">
            <Ruler size={20} className="text-sidebar-primary" />
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[.18em] text-sidebar-primary">Exact by design</p>
            <p className="mt-2 text-sm leading-6 text-sidebar-foreground/60">Print-aware preparation, token-protected access, and an operator in the loop when it matters.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1480px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <section aria-labelledby="plans-heading">
          <div className="flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">01 / Choose capacity</p>
              <h2 id="plans-heading" className="mt-2 text-3xl font-semibold tracking-[-.06em] sm:text-4xl">Three ways to make the sheet.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">Select a package to reveal its allowance and carry it directly into the request form.</p>
          </div>
          {plans.isLoading && <div className="mt-7 grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-[356px] animate-pulse rounded-[4px] border border-border bg-muted/65" />)}</div>}
          {plans.isError && <div className="mt-7 border border-destructive/30 bg-destructive/[.05] p-6 text-sm text-destructive">Packages could not be read. Refresh the page to try again.</div>}
          {plans.data && <div className="mt-7 grid gap-4 md:grid-cols-3">{plans.data.map((plan) => <PlanCard key={plan.id} plan={plan} selected={plan.id === selectedId} onSelect={() => selectPlan(plan)} />)}</div>}
        </section>

        <div className="my-12 grid gap-5 border-y border-border py-8 sm:grid-cols-3">
          <div className="flex gap-3"><ShieldCheck size={18} className="mt-0.5 text-accent" /><div><p className="text-sm font-semibold">Token-protected workspace</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Access is issued after an operator confirms the request.</p></div></div>
          <div className="flex gap-3"><FileCheck2 size={18} className="mt-0.5 text-accent" /><div><p className="text-sm font-semibold">Print-ready by default</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your allowance is for documents that hold up on paper.</p></div></div>
          <div className="flex gap-3"><CheckCircle2 size={18} className="mt-0.5 text-accent" /><div><p className="text-sm font-semibold">Human-reviewed handoff</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A clear request, a clear reference, no silent checkout.</p></div></div>
        </div>

        <OrderForm selectedPlan={selectedPlan} onPlanChange={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
      </div>

      <footer className="border-t border-border px-5 py-8 text-center font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">DepSlip · a paper conscience for digital preparation</footer>
    </main>
  );
}