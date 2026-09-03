import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brl } from "./metas";

export type Linha = { rotulo: string; valor: number };

export type Resumo = {
  nome: string;
  mesRotulo: string;
  diario: Linha[];
  semanal: Linha[];
  mensal: Linha[];
  totalMes: number;
  comissaoPct: number;
  comissao: number;
  metas: { meta: number; falta: number; atingida: boolean; comissao: number }[];
};

function baixar(conteudo: string, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarCSV(r: Resumo) {
  const linhas: string[][] = [
    ["Vendedor", r.nome],
    ["Período", r.mesRotulo],
    [],
    ["Resumo diário", "Valor"],
    ...r.diario.map((l) => [l.rotulo, l.valor.toFixed(2)]),
    [],
    ["Resumo semanal", "Valor"],
    ...r.semanal.map((l) => [l.rotulo, l.valor.toFixed(2)]),
    [],
    ["Resumo mensal", "Valor"],
    ...r.mensal.map((l) => [l.rotulo, l.valor.toFixed(2)]),
    [],
    ["Meta", "Falta", "Status", "Comissão estimada"],
    ...r.metas.map((m) => [
      m.meta.toFixed(2),
      m.falta.toFixed(2),
      m.atingida ? "Atingida" : "Em andamento",
      m.comissao.toFixed(2),
    ]),
    [],
    ["Total do mês", r.totalMes.toFixed(2)],
    [`Comissão (${(r.comissaoPct * 100).toFixed(2)}%)`, r.comissao.toFixed(2)],
  ];

  const csv = linhas
    .map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  baixar("\uFEFF" + csv, `resumo-vendas-${r.mesRotulo}.csv`, "text/csv;charset=utf-8");
}

export function exportarPDF(r: Resumo) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Resumo de Vendas e Metas", 14, 18);
  doc.setFontSize(10);
  doc.text(`Vendedor: ${r.nome || "-"}`, 14, 26);
  doc.text(`Período: ${r.mesRotulo}`, 14, 32);
  doc.text(
    `Total do mês: ${brl(r.totalMes)}  ·  Comissão (${(r.comissaoPct * 100).toFixed(2)}%): ${brl(r.comissao)}`,
    14,
    38,
  );

  let y = 46;
  const bloco = (titulo: string, linhas: Linha[]) => {
    autoTable(doc, {
      startY: y,
      head: [[titulo, "Valor"]],
      body: linhas.map((l) => [l.rotulo, brl(l.valor)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  };

  bloco("Resumo diário", r.diario);
  bloco("Resumo semanal", r.semanal);
  bloco("Resumo mensal", r.mensal);

  autoTable(doc, {
    startY: y,
    head: [["Meta", "Falta", "Status", "Comissão estimada"]],
    body: r.metas.map((m) => [
      brl(m.meta),
      m.atingida ? "-" : brl(m.falta),
      m.atingida ? "Atingida" : "Em andamento",
      brl(m.comissao),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(`resumo-vendas-${r.mesRotulo}.pdf`);
}
