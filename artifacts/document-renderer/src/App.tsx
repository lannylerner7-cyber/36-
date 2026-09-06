import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import micrFontData from './assets/GnuMICR.ttf?inline';
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
  useRemoveBackground,
  useRenderSamplePdf,
  type RoutingLookupResponse,
  type SampleDocumentInput,
} from '@workspace/api-client-react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileDown,
  Info,
  Landmark,
  Loader2,
  MapPin,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
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
    memo: 'VOID — SAMPLE ONLY',
  });
  const [placeInput, setPlaceInput] = useState('');
  const [amountInput, setAmountInput] = useState('0.00');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [routingMessage, setRoutingMessage] = useState('');
  const [pdfMessage, setPdfMessage] = useState('');
  const [logoMessage, setLogoMessage] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(true);

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
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground" data-testid="brand-mark">
              <Landmark size={19} strokeWidth={2.3} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.22em] text-sidebar-foreground/60">Operations / document lab</p>
              <h1 className="text-[15px] font-bold tracking-tight">Deposit slip renderer</h1>
            </div>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-sidebar-foreground/70">
              <span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-red-400' : health.isLoading ? 'bg-amber-300 animate-pulse-line' : 'bg-emerald-400'}`} />
              {health.isLoading ? 'Checking boundary' : health.isError ? 'Boundary unavailable' : 'Boundary online'}
            </div>
            <div className="h-5 w-px bg-sidebar-border" />
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-sidebar-foreground/50">v0.4 / deposit-slip mode</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[minmax(440px,520px)_1fr]">
        <section className="print-hide border-b border-border px-5 py-7 sm:px-8 lg:min-h-[calc(100dvh-73px)] lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
          <div className="mb-8 max-w-md animate-rise-in">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent">
              <span className="h-px w-5 bg-accent" /> Input sheet / 01
            </div>
            <h2 className="text-3xl font-extrabold tracking-[-.045em] text-foreground sm:text-[36px]">Build a deposit slip.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter the details on the left. Your paper preview updates as you type and remains clearly marked for review.</p>
          </div>

          <div className="mb-7 grid grid-cols-2 gap-2">
            <SafetyPill icon={<ShieldCheck size={15} />} label="Account visible" />
            <SafetyPill icon={<ClipboardCheck size={15} />} label="Account protected" />
          </div>

          <button type="button" onClick={() => setIsPreviewMode((current) => !current)} className="mb-7 flex w-full items-center justify-between rounded-md border border-border bg-card/60 px-3 py-2.5 text-left transition hover:bg-muted" data-testid="toggle-preview-mode" aria-pressed={isPreviewMode}>
            <span className="flex items-center gap-2 text-[11px] font-semibold text-foreground">{isPreviewMode ? <Eye size={15} className="text-accent" /> : <EyeOff size={15} className="text-accent" />} Browser preview watermark</span>
            <span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${isPreviewMode ? 'bg-amber-100 text-amber-900' : 'bg-secondary text-secondary-foreground'}`}>{isPreviewMode ? 'On' : 'Off'}</span>
          </button>

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
             <DocumentPreview form={form} isPreviewMode={isPreviewMode} routingLookup={routing.data} />
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <IntegrationPanel data={integrations.data?.places} label="Places / address suggestions" icon={<MapPin size={16} />} loading={integrations.isLoading} />
              <IntegrationPanel data={integrations.data?.routing} label="Routing / bank validation" icon={<Landmark size={16} />} loading={integrations.isLoading} />
              <IntegrationPanel data={integrations.data?.pdf} label="PDF / export boundary" icon={<FileDown size={16} />} loading={integrations.isLoading} />
              <div className="rounded-lg border border-border bg-card/65 p-4">
                <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold"><Sparkles size={15} className="text-accent" /> Readiness notes</span><button type="button" onClick={retryStatus} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="button-refresh-status" aria-label="Refresh readiness status"><RefreshCw size={14} /></button></div>
                {integrations.isError ? <p className="text-xs leading-5 text-destructive" data-testid="status-integration-error">Integration status could not be loaded. Refresh to retry.</p> : <p className="text-xs leading-5 text-muted-foreground">Only configured providers can make external requests. Sample rendering remains visibly marked at every boundary.</p>}
              </div>
            </div>
             <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" /> Print-safe note: account and MICR values remain visible exactly as entered; print mode uses the locally bundled GnuMICR E-13B font. Use only with an authorized deposit-slip workflow.</p>
          </div>
        </section>
      </div>
      <footer className="print-hide border-t border-border bg-card/45 px-5 py-6 sm:px-8 lg:px-10" data-testid="footer-policy">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 text-[10px] leading-5 text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <div className="shrink-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-foreground">Deposit Slip Studio</p>
            <p className="mt-1">Local-first document preparation.</p>
          </div>
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-accent">Use policy</p>
            <p className="mt-1">Use only for authorized deposit-slip workflows. Account and MICR values are shown exactly as entered. External requests happen only through configured provider actions; browser print removes the preview watermark and uses the bundled MICR font.</p>
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

function DocumentPreview({ form, isPreviewMode, routingLookup }: { form: SampleDocumentInput; isPreviewMode: boolean; routingLookup?: RoutingLookupResponse }) {
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

    <div className="absolute left-[7.5%] top-[8.3%] w-[52%] text-[clamp(7px,1.55vw,14px)] leading-[1.12]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-serif text-[1.06em] font-bold tracking-[-.02em]">{bankName}</div>
          <div className="font-semibold">ATTN: MAIL-IN DEPOSITS</div>
          {addressLines.slice(0, 2).map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
          {addressLines.length < 2 && <div>NEW YORK, NY 10116-1234</div>}
        </div>
        {bankLogoUrl && <img src={bankLogoUrl} alt={`${bankName} logo`} className="h-[5.5em] w-[18%] shrink-0 object-contain" data-testid="preview-bank-logo" />}
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

    <div className={`absolute bottom-[6.5%] left-1/2 -translate-x-1/2 font-mono text-[clamp(8px,1.5vw,14px)] tracking-[.1em] micr-line ${isPreviewMode ? 'text-[#777a70]' : 'text-[#161714]'}`} aria-label="MICR E-13B line">
      <span className="screen-micr">{micrValue}</span>
      <span className="print-micr">{micrValue}</span>
    </div>
    <div className="absolute bottom-[3.5%] right-[6.3%] font-mono text-[clamp(5px,1vw,9px)] tracking-[.08em] text-[#8d3d31]">VOID / SAMPLE ONLY</div>
    {isPreviewMode && <div className="preview-watermark pointer-events-none absolute inset-0 flex items-center justify-center" data-preview-watermark><div className="rotate-[-12deg] select-none font-mono text-[clamp(16px,5vw,48px)] font-bold tracking-[.16em] text-[#8d3d31]/[.11]">SAMPLE / VOID</div></div>}
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
