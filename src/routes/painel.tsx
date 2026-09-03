import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { brl, diasUteisDaSemana, diasUteisDoMes, intervaloSemana, iso } from "@/lib/metas";
import { CONFIG_PADRAO, useConfig, useNome, useVendas, type Venda } from "@/lib/store";
import { exportarCSV, exportarPDF, type Resumo } from "@/lib/exportar";

export const Route = createFileRoute("/painel")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel de Vendas, Metas e Gráficos" },
      {
        name: "description",
        content:
          "Registre vendas do dia, edite metas e comissão, veja gráficos de evolução e exporte em PDF ou CSV.",
      },
      { property: "og:title", content: "Painel de Vendas, Metas e Gráficos" },
      {
        property: "og:description",
        content: "Vendas diárias, metas editáveis, gráficos de evolução e exportação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

const nomeMes = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function Painel() {
  const navigate = useNavigate();
  const [nome, setNome, nomePronto] = useNome();
  const [config, setConfig] = useConfig();
  const [vendas, setVendas] = useVendas();

  const hoje = new Date();
  const [data, setData] = useState(iso(hoje));
  const [valor, setValor] = useState("");
  const [rascunho, setRascunho] = useState<{ metas: string[]; comissao: string } | null>(null);

  useEffect(() => {
    if (nomePronto && !nome.trim()) navigate({ to: "/" });
  }, [nomePronto, nome, navigate]);

  const primeiroDia = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const ultimoDia = iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));

  const metas = [...config.metas].sort((a, b) => a - b);
  const comissaoPct = config.comissao;

  const doMes = useMemo(
    () =>
      vendas
        .filter((v) => v.data >= primeiroDia && v.data <= ultimoDia)
        .sort((a, b) => (a.data < b.data ? 1 : -1)),
    [vendas, primeiroDia, ultimoDia],
  );

  const totalMes = doMes.reduce((s, v) => s + v.valor, 0);
  const { inicio, fim } = intervaloSemana(hoje);
  const totalSemana = doMes
    .filter((v) => v.data >= iso(inicio) && v.data <= iso(fim))
    .reduce((s, v) => s + v.valor, 0);
  const totalHoje = doMes.find((v) => v.data === iso(hoje))?.valor ?? 0;

  const proxima = metas.find((m) => totalMes < m) ?? metas[metas.length - 1] ?? 0;
  const diasMes = diasUteisDoMes(hoje.getFullYear(), hoje.getMonth());
  const metaDia = diasMes > 0 ? proxima / diasMes : 0;
  const metaSemana = metaDia * diasUteisDaSemana(hoje);
  const comissao = totalMes * comissaoPct;

  // Alertas ao atingir metas
  const atingidasRef = useRef<number[] | null>(null);
  useEffect(() => {
    const atingidas = metas.filter((m) => totalMes >= m);
    if (atingidasRef.current === null) {
      atingidasRef.current = atingidas;
      return;
    }
    const novas = atingidas.filter((m) => !atingidasRef.current!.includes(m));
    atingidasRef.current = atingidas;
    novas.forEach((m) => {
      const i = metas.indexOf(m) + 1;
      toast.success(`🎉 Meta ${i} atingida: ${brl(m)}!`, {
        description: `Comissão do mês agora: ${brl(totalMes * comissaoPct)}`,
      });
    });
  }, [totalMes, comissaoPct, metas]);

  // Dados dos gráficos
  const diasDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const dadosDiarios = useMemo(() => {
    let acum = 0;
    const out: { dia: string; venda: number; acumulado: number; ideal: number }[] = [];
    let uteis = 0;
    for (let d = 1; d <= diasDoMes; d++) {
      const dt = new Date(hoje.getFullYear(), hoje.getMonth(), d);
      const key = iso(dt);
      const venda = doMes.find((v) => v.data === key)?.valor ?? 0;
      acum += venda;
      if (dt.getDay() !== 0) uteis++;
      out.push({
        dia: String(d).padStart(2, "0"),
        venda,
        acumulado: acum,
        ideal: Math.round(metaDia * uteis),
      });
    }
    return out;
  }, [doMes, diasDoMes, metaDia, hoje]);

  const dadosMensais = useMemo(() => {
    const mapa = new Map<string, number>();
    vendas.forEach((v) => {
      const k = v.data.slice(0, 7);
      mapa.set(k, (mapa.get(k) ?? 0) + v.valor);
    });
    return [...mapa.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-12)
      .map(([k, total]) => ({
        mes: `${k.slice(5)}/${k.slice(2, 4)}`,
        total,
        comissao: Math.round(total * comissaoPct),
      }));
  }, [vendas, comissaoPct]);

  // Tendência: projeção do mês pelo ritmo dos dias úteis já passados
  const uteisPassados = useMemo(() => {
    let n = 0;
    for (let d = 1; d <= hoje.getDate(); d++) {
      if (new Date(hoje.getFullYear(), hoje.getMonth(), d).getDay() !== 0) n++;
    }
    return n;
  }, [hoje]);
  const projecao = uteisPassados > 0 ? (totalMes / uteisPassados) * diasMes : 0;

  function salvarVenda(e: React.FormEvent) {
    e.preventDefault();
    const numero = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(numero) || numero < 0) {
      toast.error("Valor inválido");
      return;
    }
    const existente = vendas.find((v) => v.data === data);
    const novas: Venda[] = existente
      ? vendas.map((v) => (v.data === data ? { ...v, valor: numero } : v))
      : [...vendas, { id: crypto.randomUUID(), data, valor: numero }];
    setVendas(novas);
    setValor("");
    toast.success("Venda registrada!");
  }

  function excluir(id: string) {
    setVendas(vendas.filter((v) => v.id !== id));
    toast.success("Registro removido. Comissão recalculada.");
  }

  function montarResumo(): Resumo {
    const semanas = new Map<string, number>();
    doMes.forEach((v) => {
      const d = new Date(`${v.data}T12:00:00`);
      const { inicio: i, fim: f } = intervaloSemana(d);
      const k = `${i.getDate()}/${i.getMonth() + 1} a ${f.getDate()}/${f.getMonth() + 1}`;
      semanas.set(k, (semanas.get(k) ?? 0) + v.valor);
    });
    return {
      nome,
      mesRotulo: nomeMes(hoje),
      diario: [...doMes]
        .sort((a, b) => (a.data < b.data ? -1 : 1))
        .map((v) => ({ rotulo: v.data.split("-").reverse().join("/"), valor: v.valor })),
      semanal: [...semanas.entries()].map(([rotulo, valor]) => ({ rotulo, valor })),
      mensal: dadosMensais.map((m) => ({ rotulo: m.mes, valor: m.total })),
      totalMes,
      comissaoPct,
      comissao,
      metas: metas.map((m) => ({
        meta: m,
        falta: Math.max(0, m - totalMes),
        atingida: totalMes >= m,
        comissao: m * comissaoPct,
      })),
    };
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Olá, {nome || "vendedor"}</h1>
            <p className="text-sm text-muted-foreground">
              Materiais de construção · Jaguariúna
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportarCSV(montarResumo())}>
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarPDF(montarResumo())}>
              Exportar PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNome("");
                navigate({ to: "/" });
              }}
            >
              Trocar nome
            </Button>
          </div>
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
                Comissão ({(comissaoPct * 100).toFixed(2).replace(".", ",")}%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{brl(comissao)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Projeção do mês: {brl(projecao)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançar venda do dia</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={salvarVenda}>
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
              <Button type="submit">Salvar</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Metas e comissão</CardTitle>
            {rascunho ? null : (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setRascunho({
                    metas: metas.map((m) => String(m)),
                    comissao: String(comissaoPct * 100).replace(".", ","),
                  })
                }
              >
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {rascunho ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {rascunho.metas.map((m, i) => (
                    <div key={i} className="space-y-2">
                      <Label htmlFor={`meta-${i}`}>Meta {i + 1} (R$)</Label>
                      <Input
                        id={`meta-${i}`}
                        inputMode="decimal"
                        value={m}
                        onChange={(e) => {
                          const copia = [...rascunho.metas];
                          copia[i] = e.target.value;
                          setRascunho({ ...rascunho, metas: copia });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="max-w-xs space-y-2">
                  <Label htmlFor="pct">Comissão (%)</Label>
                  <Input
                    id="pct"
                    inputMode="decimal"
                    value={rascunho.comissao}
                    onChange={(e) => setRascunho({ ...rascunho, comissao: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const num = (s: string) =>
                        Number(s.replace(/\./g, "").replace(",", ".")) || 0;
                      const novasMetas = rascunho.metas.map(num).filter((n) => n > 0);
                      const pct = num(rascunho.comissao) / 100;
                      if (novasMetas.length === 0 || !Number.isFinite(pct) || pct <= 0) {
                        toast.error("Preencha metas e comissão válidas.");
                        return;
                      }
                      setConfig({ metas: novasMetas.sort((a, b) => a - b), comissao: pct });
                      setRascunho(null);
                      toast.success("Metas e comissão atualizadas!");
                    }}
                  >
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRascunho(null)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setConfig(CONFIG_PADRAO);
                      setRascunho(null);
                      toast.success("Valores padrão restaurados.");
                    }}
                  >
                    Restaurar padrão
                  </Button>
                </div>
              </div>
            ) : (
              metas.map((m, i) => {
                const pct = Math.min(100, (totalMes / m) * 100);
                const batida = totalMes >= m;
                return (
                  <div key={m} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className={batida ? "font-semibold text-primary" : ""}>
                        Meta {i + 1} · {brl(m)} {batida ? "✔" : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {batida
                          ? `Comissão ${brl(m * comissaoPct)}`
                          : `Faltam ${brl(m - totalMes)}`}
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução diária ({nomeMes(hoje)})</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosDiarios}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend />
                <Bar dataKey="venda" name="Venda do dia" fill="hsl(var(--primary))" />
                <ReferenceLine
                  y={metaDia}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="4 4"
                  label={{ value: "Meta/dia", fontSize: 10, position: "right" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acumulado x meta (tendência)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosDiarios}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="acumulado"
                  name="Acumulado"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  name="Ritmo ideal"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              No ritmo atual, o mês deve fechar em {brl(projecao)} —{" "}
              {projecao >= proxima
                ? `acima da meta de ${brl(proxima)}.`
                : `faltando ${brl(proxima - projecao)} para a meta de ${brl(proxima)}.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução mensal</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {dadosMensais.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend />
                  <Bar dataKey="total" name="Vendas do mês" fill="hsl(var(--primary))" />
                  {metas.map((m) => (
                    <ReferenceLine
                      key={m}
                      y={m}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançamentos do mês</CardTitle>
          </CardHeader>
          <CardContent>
            {doMes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {doMes.map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm">
                      {new Date(`${v.data}T12:00:00`).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        weekday: "short",
                      })}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{brl(v.valor)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setData(v.data);
                          setValor(String(v.valor).replace(".", ","));
                        }}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluir(v.id)}>
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

function Indicador({ titulo, valor, meta }: { titulo: string; valor: number; meta: number }) {
  const pct = meta > 0 ? Math.min(100, (valor / meta) * 100) : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{brl(valor)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Meta {brl(meta)} · {valor >= meta ? "atingida ✔" : `faltam ${brl(meta - valor)}`}
        </p>
        <Progress className="mt-3" value={pct} />
      </CardContent>
    </Card>
  );
}
