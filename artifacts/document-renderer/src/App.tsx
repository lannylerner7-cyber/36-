import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  getGetIntegrationStatusQueryKey,
  getHealthCheckQueryKey,
  useAutocompletePlace,
  useGetIntegrationStatus,
  useHealthCheck,
  useLookupRoutingNumber,
  useRenderSamplePdf,
  type SampleDocumentInput,
} from '@workspace/api-client-react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  Info,
  Landmark,
  Loader2,
  MapPin,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SampleDocumentInput>({
    payeeName: 'Northwind Operations',
    bankAddress: '',
    accountNumber: '000000000000',
    routingNumber: '',
    checkNumber: '10427',
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    memo: 'VOID — SAMPLE ONLY',
  });
  const [placeInput, setPlaceInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [routingMessage, setRoutingMessage] = useState('');
  const [pdfMessage, setPdfMessage] = useState('');

  const integrations = useGetIntegrationStatus();
  const health = useHealthCheck();
  const autocomplete = useAutocompletePlace();
  const routing = useLookupRoutingNumber();
  const pdf = useRenderSamplePdf();
  const suggestions = autocomplete.data?.suggestions ?? [];
  const accountMasked = useMemo(() => {
    const value = form.accountNumber.replace(/\s/g, '');
    return value ? `•••• ${value.slice(-4).padStart(4, '•')}` : '•••• ••••';
  }, [form.accountNumber]);

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

  const retryStatus = () => {
    queryClient.invalidateQueries({ queryKey: getGetIntegrationStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getHealthCheckQueryKey() });
  };

  return (
    <main className="min-h-[100dvh] bg-background">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground" data-testid="brand-mark">
              <Landmark size={19} strokeWidth={2.3} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.22em] text-sidebar-foreground/60">Operations / document lab</p>
              <h1 className="text-[15px] font-bold tracking-tight">Sample document renderer</h1>
            </div>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-sidebar-foreground/70">
              <span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-red-400' : health.isLoading ? 'bg-amber-300 animate-pulse-line' : 'bg-emerald-400'}`} />
              {health.isLoading ? 'Checking boundary' : health.isError ? 'Boundary unavailable' : 'Boundary online'}
            </div>
            <div className="h-5 w-px bg-sidebar-border" />
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-sidebar-foreground/50">v0.4 / safe mode</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[minmax(440px,520px)_1fr]">
        <section className="print-hide border-b border-border px-5 py-7 sm:px-8 lg:min-h-[calc(100dvh-73px)] lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
          <div className="mb-8 max-w-md animate-rise-in">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent">
              <span className="h-px w-5 bg-accent" /> Input sheet / 01
            </div>
            <h2 className="text-3xl font-extrabold tracking-[-.045em] text-foreground sm:text-[36px]">Prepare a safe sample.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Shape the fields on the left. The paper artifact on the right updates in place and stays permanently marked for non-production use.</p>
          </div>

          <div className="mb-7 grid grid-cols-2 gap-2">
            <SafetyPill icon={<ShieldCheck size={15} />} label="Account masked" />
            <SafetyPill icon={<ClipboardCheck size={15} />} label="No MICR output" />
          </div>

          <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
            <FieldGroup label="Recipient & bank" number="A">
              <TextField id="payeeName" label="Payee name" value={form.payeeName} onChange={(value) => setField('payeeName', value)} placeholder="Northwind Operations" required />
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
            </FieldGroup>

            <FieldGroup label="Document details" number="B">
              <div className="grid grid-cols-2 gap-3">
                 <TextField id="checkNumber" label="Check number" value={form.checkNumber} onChange={(value) => setField('checkNumber', value)} placeholder="10427" required />
                 <TextField id="date" label="Date" value={form.date} onChange={(value) => setField('date', value)} type="date" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <TextField id="accountNumber" label="Account number" value={form.accountNumber} onChange={(value) => setField('accountNumber', value.replace(/\D/g, '').slice(0, 30))} placeholder="Digits only" inputMode="numeric" helper="Stored in memory only; preview is masked." required />
                 <TextField id="amount" label="Amount" value={form.amount === null ? '' : String(form.amount)} onChange={(value) => setField('amount', value === '' ? null : Number(value))} placeholder="0.00" inputMode="decimal" min="0" step="0.01" required />
              </div>
               <TextField id="memo" label="Memo" value={form.memo} onChange={(value) => setField('memo', value)} placeholder="VOID — SAMPLE ONLY" required />
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

         <section className="paper-grid print-surface min-w-0 bg-[hsl(40_22%_91%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto max-w-[760px]">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent"><span className="h-px w-5 bg-accent" /> Output sheet / 02</div>
                <h2 className="text-2xl font-extrabold tracking-[-.04em]">Physical preview</h2>
                <p className="mt-1 text-xs text-muted-foreground">Live representation · US letter placement · 6 × 2.75 in artifact</p>
              </div>
              <div className="rounded-md border border-border bg-card/80 px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[.13em] text-muted-foreground">
                <span className="block text-foreground">100% safe mode</span>
                <span className="mt-1 block">No production negotiability</span>
              </div>
            </div>
             <DocumentPreview form={form} maskedAccount={accountMasked} />
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <IntegrationPanel data={integrations.data?.places} label="Places / address suggestions" icon={<MapPin size={16} />} loading={integrations.isLoading} />
              <IntegrationPanel data={integrations.data?.routing} label="Routing / bank validation" icon={<Landmark size={16} />} loading={integrations.isLoading} />
              <IntegrationPanel data={integrations.data?.pdf} label="PDF / export boundary" icon={<FileDown size={16} />} loading={integrations.isLoading} />
              <div className="rounded-lg border border-border bg-card/65 p-4">
                <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold"><Sparkles size={15} className="text-accent" /> Readiness notes</span><button type="button" onClick={retryStatus} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="button-refresh-status" aria-label="Refresh readiness status"><RefreshCw size={14} /></button></div>
                {integrations.isError ? <p className="text-xs leading-5 text-destructive" data-testid="status-integration-error">Integration status could not be loaded. Refresh to retry.</p> : <p className="text-xs leading-5 text-muted-foreground">Only configured providers can make external requests. Sample rendering remains visibly marked at every boundary.</p>}
              </div>
            </div>
            <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" /> Print-safe note: this preview intentionally omits MICR encoding and keeps account data masked. It is designed for review, QA, and integration testing only.</p>
          </div>
        </section>
      </div>
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

function DocumentPreview({ form, maskedAccount }: { form: SampleDocumentInput; maskedAccount: string }) {
  return <div className="relative mx-auto w-full max-w-[720px] overflow-hidden rounded-[3px] border border-[#cbc6b9] bg-[#f8f5eb] p-[3.7%] text-[#292b31] document-shadow" style={{ aspectRatio: '6 / 2.75' }} data-testid="preview-document">
    <div className="pointer-events-none absolute inset-[2.5%] border border-[#d8d2c3]" />
    <div className="absolute left-[4.5%] top-[10%] font-mono text-[clamp(7px,1.3vw,12px)] font-medium tracking-[.15em]">SAMPLE FINANCIAL INSTRUMENT</div>
    <div className="absolute right-[5%] top-[8%] text-right font-mono text-[clamp(7px,1.3vw,12px)]"><div>NO. {form.checkNumber || '——'}</div><div className="mt-1 border-t border-[#77736b] pt-1 text-[.78em]">{form.date || 'DATE ———'}</div></div>
    <div className="absolute left-[4.5%] top-[27%] max-w-[35%] text-[clamp(7px,1.45vw,13px)] leading-tight"><div className="mb-1 font-mono text-[.65em] uppercase tracking-wider text-[#77736b]">Pay to the order of</div><div className="border-b border-[#77736b] pb-1 font-semibold">{form.payeeName || 'Payee name'}</div></div>
    <div className="absolute right-[5%] top-[27%] w-[28%] text-right text-[clamp(8px,1.75vw,16px)] font-semibold"><span className="mr-1 text-[.7em]">$</span>{form.amount === null || Number.isNaN(form.amount) ? '—' : form.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div className="absolute left-[4.5%] top-[49%] max-w-[45%] border-t border-[#77736b] pt-1 text-[clamp(6px,1.2vw,11px)] leading-tight"><div className="font-semibold">{form.bankAddress || 'Bank address will appear here'}</div><div className="mt-1 font-mono text-[.74em] text-[#77736b]">ROUTING {form.routingNumber ? `${form.routingNumber.slice(0, 3)} ••••••` : '•••••••••'}</div></div>
    <div className="absolute right-[5%] top-[49%] text-right font-mono text-[clamp(6px,1.2vw,11px)]"><div className="text-[#77736b]">ACCOUNT</div><div className="mt-1 font-semibold">{maskedAccount}</div></div>
    <div className="absolute bottom-[14%] left-[4.5%] max-w-[48%] border-t border-[#77736b] pt-1 text-[clamp(6px,1.15vw,10px)]"><span className="mr-1 font-mono text-[.78em] text-[#77736b]">MEMO</span>{form.memo || '—'}</div>
    <div className="absolute bottom-[8%] right-[5%] flex items-center gap-1.5 font-mono text-[clamp(6px,1.1vw,10px)] text-[#a4422e]"><span className="h-1.5 w-1.5 rounded-full bg-[#a4422e]" />VOID / SAMPLE ONLY</div>
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="rotate-[-12deg] select-none font-mono text-[clamp(16px,5vw,48px)] font-bold tracking-[.16em] text-[#a4422e]/[.12]">VOID</div></div>
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
        <Route path="/" component={Home} />
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
