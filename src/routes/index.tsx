import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNome } from "@/lib/store";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Controle de Vendas e Metas | Materiais de Construção" },
      {
        name: "description",
        content:
          "Entre apenas com seu nome e acompanhe vendas diárias, metas, gráficos e comissão.",
      },
      { property: "og:title", content: "Controle de Vendas e Metas" },
      {
        property: "og:description",
        content: "Vendas diárias, metas, gráficos e comissão em um só painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Entrada,
});

function Entrada() {
  const navigate = useNavigate();
  const [nome, setNome] = useNome();
  const [texto, setTexto] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md bg-card/60">
        <CardHeader>
          <CardTitle className="text-2xl">
            Controle de Vendas <span className="text-primary">.</span>
          </CardTitle>
          <CardDescription>Materiais de construção · Jaguariúna</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const v = texto.trim() || nome.trim();
              if (!v) return;
              setNome(v);
              navigate({ to: "/painel" });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="nome">Seu nome</Label>
              <Input
                id="nome"
                required
                placeholder="Ex: João"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            <Button className="w-full" type="submit">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
