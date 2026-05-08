import { useEffect, useState } from "react";
import { REGIONS, getRegion, setRegion, type Region } from "@/lib/regions";
import { Check, Globe, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export function RegionPicker({ onChange }: { onChange?: (r: Region) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [region, setLocal] = useState<Region>(REGIONS[0]);
  const [q, setQ] = useState("");

  useEffect(() => { setLocal(getRegion()); }, []);

  const pick = (r: Region) => {
    setRegion(r.code);
    setLocal(r);
    onChange?.(r);
    setOpen(false);
  };

  const filtered = REGIONS.filter(r =>
    r.name.toLowerCase().includes(q.toLowerCase()) ||
    r.code.toLowerCase().includes(q.toLowerCase()) ||
    r.currency.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-secondary transition"
        aria-label="Change region"
      >
        <span className="text-base leading-none">{region.flag}</span>
        <span className="font-display font-bold">{region.code}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{region.currency}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <h2 className="font-display font-bold">{t("region.title")}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="size-8 grid place-items-center rounded-full hover:bg-secondary">
                <X className="size-4" />
              </button>
            </header>

            <div className="p-3 border-b border-border">
              <label className="flex items-center gap-2 rounded-xl bg-input border border-border px-3 py-2">
                <Search className="size-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder={t("region.search")}
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </label>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("region.help")}
              </p>
            </div>

            <ul className="max-h-[55vh] overflow-y-auto py-1">
              {filtered.map(r => {
                const active = r.code === region.code;
                return (
                  <li key={r.code}>
                    <button
                      onClick={() => pick(r)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary ${active ? "bg-primary/10" : ""}`}
                    >
                      <span className="text-2xl leading-none">{r.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {r.currency} · {r.markets.slice(0, 3).join(" · ")}
                        </p>
                      </div>
                      {active && <Check className="size-4 text-primary shrink-0" />}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t("region.none")}</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
