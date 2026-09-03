import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  COMISSAO,
  METAS,
  brl,
  diasUteisDaSemana,
  diasUteisDoMes,
  intervaloSemana,
  iso,
} from "@/lib/metas";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel de Vendas e Metas | Loja de Materiais" },
      {
        name: "description",
        content:
          "Registre suas vendas do dia e acompanhe metas diárias, semanais, mensais e a comissão de 1,5%.",
      },
      { property: "og:title", content: "Painel de Vendas e Metas" },
      {
        property: "og:description",
        content: "Vendas diárias, metas e comissão de 1,5% em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

type Venda = { id: string; data: string; valor: number };

function Painel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const hoje = new Date();
  const primeiroDia = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const ultimoDia = iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));

  const [data, setData] = useState(iso(hoje));
  const [valor, setValor] = useState("");

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas", primeiroDia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas_diarias")
        .select("id, data, valor")
        .gte("data", primeiroDia)
        .lte("data", ultimoDia)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((v) => ({ ...v, valor: Number(v.valor) })) as Venda[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const numero = Number(valor.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(numero) || numero < 0) throw new Error("Valor inválido");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("vendas_diarias")
        .upsert(
          { user_id: userData.user!.id, data, valor: numero },
          { onConflict: "user_id,data" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      setValor("");
      qc.invalidateQueries({ queryKey: ["vendas"] });
      toast.success("Venda registrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendas_diarias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendas"] }),
  });

  const totalMes = vendas.reduce((s, v) => s + v.valor, 0);
  const { inicio, fim } = intervaloSemana(hoje);
  const totalSemana = vendas
    .filter((v) => v.data >= iso(inicio) && v.data <= iso(fim))
    .reduce((s, v) => s + v.valor, 0);
  const totalHoje = vendas.find((v) => v.data === iso(hoje))?.valor ?? 0;

  const proxima = METAS.find((m) => totalMes < m) ?? METAS[METAS.length - 1];
  const diasMes = diasUteisDoMes(hoje.getFullYear(), hoje.getMonth());
  const metaDia = proxima / diasMes;
  const metaSemana = metaDia * diasUteisDaSemana(hoje);
  const comissao = totalMes * COMISSAO;

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Controle de Vendas</h1>
            <p className="text-sm text-muted-foreground">
              Materiais de construção · Jaguariúna
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={sair}>
            Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador titulo="Hoje" valor={totalHoje} meta={metaDia} />
          <Indicador titulo="Semana" valor={totalSemana} meta={metaSemana} />
          <Indicador titulo="Mês" valor={totalMes} meta={proxima} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Comissão (1,5%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{brl(comissao)}</p>
              <p className="mt-1 text-xs text-muted-foreground">sobre o mês atual</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançar venda do dia</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                salvar.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="valor">Total vendido (R$)</Label>
                <Input
                  id="valor"
                  inputMode="decimal"
                  placeholder="Ex: 4500,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={salvar.isPending}>
                Salvar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">As 4 metas do mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {METAS.map((m, i) => {
              const pct = Math.min(100, (totalMes / m) * 100);
              const batida = totalMes >= m;
              return (
                <div key={m} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className={batida ? "font-semibold text-primary" : ""}>
                      Meta {i + 1} · {brl(m)} {batida ? "✔" : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {batida ? `Comissão ${brl(m * COMISSAO)}` : `Faltam ${brl(m - totalMes)}`}
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançamentos do mês</CardTitle>
          </CardHeader>
          <CardContent>
            {vendas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {vendas.map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm">
                      {new Date(`${v.data}T12:00:00`).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        weekday: "short",
                      })}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{brl(v.valor)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => excluir.mutate(v.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Indicador({
  titulo,
  valor,
  meta,
}: {
  titulo: string;
  valor: number;
  meta: number;
}) {
  const pct = meta > 0 ? Math.min(100, (valor / meta) * 100) : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{brl(valor)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Meta {brl(meta)}</p>
        <Progress className="mt-3" value={pct} />
      </CardContent>
    </Card>
  );
}
