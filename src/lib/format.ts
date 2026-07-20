export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const formatDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

export const formatDateShort = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const formatTime = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export type ServiceCategory = "masculino" | "feminino" | "noiva" | "manicure" | "maquiagem" | "outro";

export const categoryLabel: Record<ServiceCategory, string> = {
  masculino: "Masculino",
  feminino: "Feminino",
  noiva: "Noiva",
  manicure: "Manicure",
  maquiagem: "Maquiagem",
  outro: "Outro",
};
