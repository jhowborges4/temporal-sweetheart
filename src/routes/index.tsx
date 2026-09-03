import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle de Vendas e Metas | Materiais de Construção" },
      {
        name: "description",
        content:
          "Registre suas vendas diárias, acompanhe as metas do dia, semana e mês e calcule sua comissão de 1,5%.",
      },
      { property: "og:title", content: "Controle de Vendas e Metas" },
      {
        property: "og:description",
        content: "Vendas diárias, metas e comissão de 1,5% em um só painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
});
