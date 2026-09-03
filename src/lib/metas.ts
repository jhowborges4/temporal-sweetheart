export const METAS = [174000, 200000, 220000, 250000];
export const COMISSAO = 0.015;
export const SALARIO_BASE = 2200;

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Dias úteis (segunda a sábado) de um mês. */
export function diasUteisDoMes(ano: number, mes: number) {
  let total = 0;
  const dias = new Date(ano, mes + 1, 0).getDate();
  for (let d = 1; d <= dias; d++) {
    if (new Date(ano, mes, d).getDay() !== 0) total++;
  }
  return total;
}

/** Dias úteis (segunda a sábado) da semana atual dentro do mês. */
export function diasUteisDaSemana(ref: Date) {
  const inicio = new Date(ref);
  inicio.setDate(ref.getDate() - ((ref.getDay() + 6) % 7)); // segunda
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    if (d.getDay() !== 0) total++;
  }
  return total;
}

export function intervaloSemana(ref: Date) {
  const inicio = new Date(ref);
  inicio.setDate(ref.getDate() - ((ref.getDay() + 6) % 7));
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  return { inicio, fim };
}

export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
