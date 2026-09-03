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
import { toast } from "sonner";
import { brl, diasUteisDaSemana, diasUteisDoMes, intervaloSemana, iso } from "@/lib/metas";
import {
  CONFIG_PADRAO,
  useConfig,
  useLocalState,
  useNome,
  useVendas,
  type Venda,
} from "@/lib/store";

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
  const [mesRef, setMesRef] = useState(
    () => new Date(hoje.getFullYear(), hoje.getMonth(), 1),
  );
  const [data, setData] = useState(iso(hoje));
  const [valor, setValor] = useState("");
  const [rascunho, setRascunho] = useState<{ metas: string[]; comissao: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [pctSim, setPctSim] = useState("");
  const [autoBackup, setAutoBackup, autoPronto] = useLocalState<{
    ativo: boolean;
    ultimo: string;
  }>("cv:autobackup", { ativo: true, ultimo: "" });


  useEffect(() => {
    if (nomePronto && !nome.trim()) navigate({ to: "/" });
  }, [nomePronto, nome, navigate]);

  const ano = mesRef.getFullYear();
  const mes = mesRef.getMonth();
  const primeiroDia = iso(new Date(ano, mes, 1));
  const ultimoDia = iso(new Date(ano, mes + 1, 0));
  const ehMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth();

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

  // Mês anterior (comparação)
  const antIni = iso(new Date(ano, mes - 1, 1));
  const antFim = iso(new Date(ano, mes, 0));
  const totalMesAnterior = useMemo(
    () =>
      vendas
        .filter((v) => v.data >= antIni && v.data <= antFim)
        .reduce((s, v) => s + v.valor, 0),
    [vendas, antIni, antFim],
  );
  const variacaoMes =
    totalMesAnterior > 0 ? ((totalMes - totalMesAnterior) / totalMesAnterior) * 100 : null;

  const { inicio, fim } = intervaloSemana(hoje);
  const totalSemana = ehMesAtual
    ? doMes
        .filter((v) => v.data >= iso(inicio) && v.data <= iso(fim))
        .reduce((s, v) => s + v.valor, 0)
    : 0;
  const totalHoje = ehMesAtual ? (doMes.find((v) => v.data === iso(hoje))?.valor ?? 0) : 0;

  const melhorDia = doMes.reduce<Venda | null>(
    (m, v) => (m === null || v.valor > m.valor ? v : m),
    null,
  );

  const proxima = metas.find((m) => totalMes < m) ?? metas[metas.length - 1] ?? 0;
  const diasMes = diasUteisDoMes(ano, mes);
  const metaDia = diasMes > 0 ? proxima / diasMes : 0;
  const metaSemana = metaDia * diasUteisDaSemana(hoje);
  const comissao = totalMes * comissaoPct;

  // Ritmo necessário: dias úteis restantes a partir de hoje (ou do mês todo, se futuro)
  const diasRestantes = useMemo(() => {
    const base = ehMesAtual ? hoje : new Date(ano, mes, 1);
    if (base.getTime() > new Date(ano, mes + 1, 0).getTime()) return 0;
    let n = 0;
    for (let d = base.getDate(); d <= new Date(ano, mes + 1, 0).getDate(); d++) {
      if (new Date(ano, mes, d).getDay() !== 0) n++;
    }
    return n;
  }, [ano, mes, ehMesAtual]);
  const faltaProxima = Math.max(0, proxima - totalMes);
  const ritmoNecessario = diasRestantes > 0 ? faltaProxima / diasRestantes : 0;

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
  const diasDoMes = new Date(ano, mes + 1, 0).getDate();
  const dadosDiarios = useMemo(() => {
    let acum = 0;
    const out: { dia: string; venda: number; acumulado: number; ideal: number }[] = [];
    let uteis = 0;
    for (let d = 1; d <= diasDoMes; d++) {
      const dt = new Date(ano, mes, d);
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
  }, [doMes, diasDoMes, metaDia, ano, mes]);

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

  // Calendário do mês (semanas começando na segunda)
  const calendario = useMemo(() => {
    const semanas: ({ dia: number; iso: string; valor: number; util: boolean } | null)[][] = [];
    let semana: ({ dia: number; iso: string; valor: number; util: boolean } | null)[] = [];
    const primeiroSem = (new Date(ano, mes, 1).getDay() + 6) % 7; // 0 = segunda
    for (let i = 0; i < primeiroSem; i++) semana.push(null);
    for (let d = 1; d <= diasDoMes; d++) {
      const dt = new Date(ano, mes, d);
      const key = iso(dt);
      semana.push({
        dia: d,
        iso: key,
        valor: doMes.find((v) => v.data === key)?.valor ?? 0,
        util: dt.getDay() !== 0,
      });
      if (semana.length === 7) {
        semanas.push(semana);
        semana = [];
      }
    }
    if (semana.length > 0) {
      while (semana.length < 7) semana.push(null);
      semanas.push(semana);
    }
    return semanas;
  }, [ano, mes, diasDoMes, doMes]);

  // Projeção do mês pelo ritmo dos dias úteis já passados
  const uteisPassados = useMemo(() => {
    const limite = ehMesAtual ? hoje.getDate() : diasDoMes;
    let n = 0;
    for (let d = 1; d <= limite; d++) {
      if (new Date(ano, mes, d).getDay() !== 0) n++;
    }
    return n;
  }, [ano, mes, ehMesAtual, diasDoMes]);
  const projecao =
    ehMesAtual && uteisPassados > 0 ? (totalMes / uteisPassados) * diasMes : totalMes;

  // Simulador de percentual de comissão
  const pctSimNum = useMemo(() => {
    const n = Number(pctSim.replace(",", "."));
    return Number.isFinite(n) && pctSim.trim() !== "" ? Math.max(0, n) / 100 : comissaoPct;
  }, [pctSim, comissaoPct]);

  const simulacao = useMemo(() => {
    const linhas = dadosMensais.map((m) => ({
      mes: m.mes,
      total: m.total,
      atual: m.total * comissaoPct,
      sim: m.total * pctSimNum,
      dif: m.total * (pctSimNum - comissaoPct),
    }));
    const totalAtual = linhas.reduce((s, l) => s + l.atual, 0);
    const totalSim = linhas.reduce((s, l) => s + l.sim, 0);
    return { linhas, totalAtual, totalSim, diferenca: totalSim - totalAtual };
  }, [dadosMensais, comissaoPct, pctSimNum]);


  function navegarMes(delta: number) {
    setMesRef(new Date(ano, mes + delta, 1));
  }

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
    toast.success("Venda registrada! Comissão recalculada.");
  }

  // snapshot simples para o "desfazer"
  const vendasRef = useRef(vendas);
  vendasRef.current = vendas;

  function excluir(id: string) {
    const removida = vendas.find((v) => v.id === id);
    if (!removida) return;
    setVendas(vendas.filter((v) => v.id !== id));
    toast.success("Registro removido. Comissão recalculada.", {
      action: {
        label: "Desfazer",
        onClick: () => setVendas([...vendasRef.current, removida]),
      },
    });
  }

  function baixarBackup(automatico = false) {
    const blob = new Blob(
      [JSON.stringify({ nome, config, vendas, gerado: new Date().toISOString() }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-vendas-${automatico ? "auto-" : ""}${iso(hoje)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(automatico ? "Backup automático do dia salvo!" : "Backup baixado!");
  }

  // Backup automático: uma vez por dia, quando houver dados
  const autoRef = useRef(false);
  useEffect(() => {
    if (!autoPronto || autoRef.current) return;
    if (!autoBackup.ativo || vendas.length === 0) return;
    const hojeIso = iso(new Date());
    if (autoBackup.ultimo === hojeIso) return;
    autoRef.current = true;
    baixarBackup(true);
    setAutoBackup({ ativo: true, ultimo: hojeIso });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPronto, autoBackup, vendas]);


  function importarBackup(arquivo: File | undefined) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const dados = JSON.parse(String(leitor.result)) as {
          nome?: string;
          config?: { metas: number[]; comissao: number };
          vendas?: Venda[];
        };
        if (!Array.isArray(dados.vendas)) throw new Error("inválido");
        setVendas(dados.vendas);
        if (dados.config?.metas?.length) setConfig(dados.config);
        toast.success("Backup restaurado!");
      } catch {
        toast.error("Arquivo de backup inválido.");
      }
    };
    leitor.readAsText(arquivo);
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
      mesRotulo: nomeMes(mesRef),
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
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Painel de Vendas <span className="text-primary">.</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Olá, {nome || "vendedor"} · Materiais de construção · Jaguariúna
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportarCSV(montarResumo())}>
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarPDF(montarResumo())}>
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => baixarBackup()}>
              Backup
            </Button>
            <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
              Importar
            </Button>
            <Button
              variant={autoBackup.ativo ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setAutoBackup({ ...autoBackup, ativo: !autoBackup.ativo })
              }
              title={
                autoBackup.ultimo
                  ? `Último backup automático: ${autoBackup.ultimo.split("-").reverse().join("/")}`
                  : "Nenhum backup automático ainda"
              }
            >
              Auto-backup {autoBackup.ativo ? "ON" : "OFF"}
            </Button>

            <input
              ref={importRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                importarBackup(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
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

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Seletor de mês */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navegarMes(-1)}>
            ‹
          </Button>
          <span className="min-w-48 text-center text-sm font-semibold tracking-widest text-foreground uppercase">
            {nomeMes(mesRef)}
          </span>
          <Button variant="outline" size="sm" onClick={() => navegarMes(1)}>
            ›
          </Button>
          {!ehMesAtual && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => setMesRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
            >
              Voltar ao mês atual
            </Button>
          )}
        </div>

        {/* Indicadores */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ehMesAtual ? (
            <>
              <Indicador titulo="Hoje" valor={totalHoje} meta={metaDia} />
              <Indicador titulo="Semana" valor={totalSemana} meta={metaSemana} />
            </>
          ) : (
            <>
              <Card className="bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    Melhor dia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{brl(melhorDia?.valor ?? 0)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {melhorDia
                      ? new Date(`${melhorDia.data}T12:00:00`).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          weekday: "short",
                        })
                      : "Sem vendas"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    Dias com venda
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{doMes.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    de {diasMes} dias úteis
                  </p>
                </CardContent>
              </Card>
            </>
          )}
          <Card className="bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{brl(totalMes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Meta {brl(proxima)} · {totalMes >= proxima ? "atingida ✔" : `faltam ${brl(proxima - totalMes)}`}
              </p>
              {variacaoMes !== null && (
                <p
                  className={`mt-1 text-xs font-semibold ${
                    variacaoMes >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {variacaoMes >= 0 ? "▲" : "▼"} {Math.abs(variacaoMes).toFixed(1).replace(".", ",")}%
                  vs mês anterior ({brl(totalMesAnterior)})
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-primary/40 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest text-primary uppercase">
                Comissão ({(comissaoPct * 100).toFixed(2).replace(".", ",")}%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{brl(comissao)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ehMesAtual ? `Projeção do mês: ${brl(projecao)}` : "Valor final do mês"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Formulário + Metas */}
        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 bg-card/60 lg:col-span-4">
            <CardHeader>
              <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
                Lançar venda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={salvarVenda}>
                <div className="space-y-2">
                  <Label htmlFor="data" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Data
                  </Label>
                  <Input
                    id="data"
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Total vendido (R$)
                  </Label>
                  <Input
                    id="valor"
                    inputMode="decimal"
                    placeholder="Ex: 4500,00"
                    className="font-mono"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full font-bold tracking-widest uppercase">
                  Registrar venda
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="col-span-12 bg-card/60 lg:col-span-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
                Metas do mês
              </CardTitle>
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
            <CardContent className="space-y-5">
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
                <>
                  {metas.map((m, i) => {
                    const pct = Math.min(100, (totalMes / m) * 100);
                    const batida = totalMes >= m;
                    return (
                      <div key={m} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className={batida ? "font-semibold text-primary" : "text-foreground"}>
                            Meta {i + 1} · {brl(m)} {batida ? "✔" : ""}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {batida ? `Comissão ${brl(m * comissaoPct)}` : `Faltam ${brl(m - totalMes)}`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {faltaProxima > 0 && diasRestantes > 0 && (
                    <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                      Para bater a meta de {brl(proxima)}, você precisa vender{" "}
                      <span className="font-bold text-primary">{brl(ritmoNecessario)}</span> por
                      dia útil — restam {diasRestantes} dias úteis no mês.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendário */}
        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
              Calendário de vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendario.flat().map((cel, i) =>
                cel === null ? (
                  <div key={`v-${i}`} />
                ) : (
                  <button
                    key={cel.iso}
                    type="button"
                    onClick={() => {
                      setData(cel.iso);
                      setValor(cel.valor > 0 ? String(cel.valor).replace(".", ",") : "");
                    }}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-md border p-1 text-xs transition-colors ${
                      cel.valor > 0
                        ? "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25"
                        : cel.util
                          ? "border-border bg-secondary/50 text-muted-foreground hover:border-primary/40"
                          : "border-transparent text-muted-foreground/40"
                    } ${cel.iso === iso(hoje) ? "ring-1 ring-primary" : ""}`}
                  >
                    <span className="font-semibold">{cel.dia}</span>
                    {cel.valor > 0 && (
                      <span className="font-mono text-[9px]">
                        {`${Math.round(cel.valor / 100) / 10}k`.replace(".", ",")}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Toque em um dia para lançar ou editar a venda dele.
            </p>
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
                Evolução diária
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosDiarios}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="venda" name="Venda do dia" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                  <ReferenceLine
                    y={metaDia}
                    stroke="var(--chart-4)"
                    strokeDasharray="4 4"
                    label={{ value: "Meta/dia", fontSize: 10, position: "right", fill: "var(--chart-4)" }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
                Acumulado x meta (tendência)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosDiarios}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="acumulado"
                    name="Acumulado"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    name="Ritmo ideal"
                    stroke="var(--chart-2)"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              {ehMesAtual && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No ritmo atual, o mês deve fechar em {brl(projecao)} —{" "}
                  {projecao >= proxima
                    ? `acima da meta de ${brl(proxima)}.`
                    : `faltando ${brl(proxima - projecao)} para a meta de ${brl(proxima)}.`}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
              Evolução mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {dadosMensais.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" name="Vendas do mês" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                  {metas.map((m) => (
                    <ReferenceLine
                      key={m}
                      y={m}
                      stroke="var(--chart-2)"
                      strokeDasharray="4 4"
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Simulador de comissão */}
        <Card className="border-primary/30 bg-card/60">
          <CardHeader>
            <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
              Simulador de comissão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <Label className="text-xs">Percentual simulado (%)</Label>
                <Input
                  inputMode="decimal"
                  value={pctSim}
                  placeholder={String(comissaoPct * 100).replace(".", ",")}
                  onChange={(e) => setPctSim(e.target.value)}
                />
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={pctSimNum * 100}
                onChange={(e) => setPctSim(e.target.value.replace(".", ","))}
                className="h-2 min-w-48 flex-1 cursor-pointer accent-[var(--primary)]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPctSim("")}
              >
                Zerar simulação
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setConfig({ ...config, comissao: pctSimNum });
                  setPctSim("");
                  toast.success(
                    `Comissão atualizada para ${(pctSimNum * 100).toFixed(2).replace(".", ",")}%`,
                  );
                }}
              >
                Aplicar de verdade
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] tracking-widest text-muted-foreground uppercase">
                  Mês atual ({nomeMes(mesRef)})
                </p>
                <p className="text-xl font-bold">{brl(totalMes * pctSimNum)}</p>
                <p
                  className={`text-xs ${totalMes * pctSimNum >= comissao ? "text-primary" : "text-destructive"}`}
                >
                  {totalMes * pctSimNum >= comissao ? "+" : "−"}
                  {brl(Math.abs(totalMes * pctSimNum - comissao))} vs {brl(comissao)} atual
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] tracking-widest text-muted-foreground uppercase">
                  Total simulado (12 meses)
                </p>
                <p className="text-xl font-bold">{brl(simulacao.totalSim)}</p>
                <p className="text-xs text-muted-foreground">
                  Atual: {brl(simulacao.totalAtual)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] tracking-widest text-muted-foreground uppercase">
                  Diferença acumulada
                </p>
                <p
                  className={`text-xl font-bold ${simulacao.diferenca >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  {simulacao.diferenca >= 0 ? "+" : "−"}
                  {brl(Math.abs(simulacao.diferenca))}
                </p>
                <p className="text-xs text-muted-foreground">
                  Em {(pctSimNum * 100).toFixed(2).replace(".", ",")}% sobre as vendas
                </p>
              </div>
            </div>

            {simulacao.linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem meses registrados ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] tracking-widest text-muted-foreground uppercase">
                      <th className="py-2">Mês</th>
                      <th className="py-2 text-right">Vendas</th>
                      <th className="py-2 text-right">
                        Comissão {(comissaoPct * 100).toFixed(2).replace(".", ",")}%
                      </th>
                      <th className="py-2 text-right">
                        Simulada {(pctSimNum * 100).toFixed(2).replace(".", ",")}%
                      </th>
                      <th className="py-2 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {simulacao.linhas.map((l) => (
                      <tr key={l.mes}>
                        <td className="py-2 font-sans">{l.mes}</td>
                        <td className="py-2 text-right">{brl(l.total)}</td>
                        <td className="py-2 text-right">{brl(l.atual)}</td>
                        <td className="py-2 text-right font-semibold">{brl(l.sim)}</td>
                        <td
                          className={`py-2 text-right ${l.dif >= 0 ? "text-primary" : "text-destructive"}`}
                        >
                          {l.dif >= 0 ? "+" : "−"}
                          {brl(Math.abs(l.dif))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60">

          <CardHeader>
            <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
              Lançamentos de {nomeMes(mesRef)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {doMes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda registrada neste mês.</p>
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
                      <span className="font-mono font-medium">{brl(v.valor)}</span>
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
    <Card className="bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{brl(valor)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Meta {brl(meta)} · {valor >= meta ? "atingida ✔" : `faltam ${brl(meta - valor)}`}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
