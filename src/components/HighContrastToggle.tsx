import { useEffect, useState } from "react";
import { Contrast } from "lucide-react";

const STORAGE_KEY = "high-contrast";

export function HighContrastToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1";
    setOn(saved);
    document.documentElement.classList.toggle("high-contrast", saved);
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle("high-contrast", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Desativar alto contraste" : "Ativar alto contraste"}
      title={on ? "Desativar alto contraste" : "Ativar alto contraste"}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <Contrast className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{on ? "Normal" : "Contraste"}</span>
    </button>
  );
}