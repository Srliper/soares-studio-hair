import { useRouterState } from "@tanstack/react-router";

// Configurable via env vars (client-side, so VITE_ prefix + public bundle).
// Set in .env.local — never commit real customer data to .env (auto-generated).
const DEFAULT_PHONE = "5515998343669";
const DEFAULT_MESSAGE =
  "Olá! Vim pelo site do Studio Soares e gostaria de mais informações.";

// Accept common formats ("+55 15 99834-3669", "(15) 99834-3669", etc.) and
// normalize to digits — wa.me requires digits only, with country code.
function normalizePhone(raw: string | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits || DEFAULT_PHONE;
}

const PHONE = normalizePhone(import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined);
const MESSAGE =
  (import.meta.env.VITE_WHATSAPP_MESSAGE as string | undefined)?.trim() || DEFAULT_MESSAGE;

export function WhatsAppFloat() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Hide on admin/auth surfaces — floating CTA is for the public site.
  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) return null;

  const href = `https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar no WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-8px_rgba(37,211,102,0.6)] ring-1 ring-white/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-16 sm:w-16"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366] opacity-60 animate-ping"
      />
      <svg
        viewBox="0 0 32 32"
        className="relative h-7 w-7 sm:h-8 sm:w-8"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19.11 17.29c-.29-.14-1.7-.84-1.96-.94-.26-.1-.46-.14-.65.14-.19.29-.74.94-.9 1.13-.17.19-.33.22-.62.07-.29-.14-1.21-.45-2.3-1.42-.85-.76-1.42-1.7-1.59-1.98-.17-.29-.02-.44.13-.58.13-.13.29-.34.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.65-1.56-.89-2.14-.23-.56-.47-.48-.65-.49l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.38 0 1.41 1.02 2.77 1.16 2.96.14.19 2.01 3.07 4.87 4.31.68.29 1.21.46 1.63.59.68.22 1.31.19 1.8.12.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33Zm-5.19 7.09h-.01a10.06 10.06 0 0 1-5.13-1.4l-.37-.22-3.81 1 1.02-3.71-.24-.38a10.05 10.05 0 0 1-1.54-5.36c0-5.56 4.53-10.08 10.09-10.08 2.7 0 5.23 1.05 7.14 2.96a10.02 10.02 0 0 1 2.96 7.13c0 5.56-4.53 10.06-10.11 10.06Zm8.59-18.65A11.9 11.9 0 0 0 13.92 2C7.32 2 1.95 7.37 1.95 13.98c0 2.11.55 4.17 1.6 5.99L2 26l6.19-1.62a11.94 11.94 0 0 0 5.72 1.46h.01c6.6 0 11.97-5.37 11.97-11.98 0-3.2-1.25-6.21-3.51-8.47Z" />
      </svg>
    </a>
  );
}