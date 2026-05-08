import { useState } from "react";
import { LANGUAGES, getLang, setLang, useT, type Language } from "@/lib/i18n";
import { Check, Languages, Search, X } from "lucide-react";

export function LanguagePicker() {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const pick = (l: Language) => { setLang(l.code); setOpen(false); };
  const filtered = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(q.toLowerCase()) ||
    l.native.toLowerCase().includes(q.toLowerCase()) ||
    l.code.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-secondary transition"
        aria-label="Change language"
      >
        <Languages className="size-3.5" />
        <span className="font-display font-bold uppercase">{lang.code}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Languages className="size-4 text-primary" />
                <h2 className="font-display font-bold">{t("lang.title")}</h2>
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
                  placeholder={t("lang.search")}
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </label>
            </div>

            <ul className="max-h-[55vh] overflow-y-auto py-1">
              {filtered.map(l => {
                const active = l.code === getLang().code;
                return (
                  <li key={l.code}>
                    <button
                      onClick={() => pick(l)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary ${active ? "bg-primary/10" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" dir={l.rtl ? "rtl" : "ltr"}>{l.native}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{l.name} · {l.code.toUpperCase()}</p>
                      </div>
                      {active && <Check className="size-4 text-primary shrink-0" />}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t("lang.none")}</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
