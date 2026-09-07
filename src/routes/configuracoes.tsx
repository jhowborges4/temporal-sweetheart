import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/metas";
import {
  CONFIG_PADRAO,
  useConfig,
  useHistoricoConfig,
  useNome,
  type Config,
  type MudancaConfig,
} from "@/lib/store";

export const Route = createFileRoute("/configuracoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configurar Metas, Salário-base e Comissão" },
      {
        name: "description",
        content:
          "Ajuste as metas mensais, o salário-base e o percentual de comissão, com histórico de todas as mudanças.",
      },
      { property: "og:title", content: "Configurar Metas, Salário-base e Comissão" },
      {
        property: "og:description",
        content: "Metas mensais, salário-base e comissão editáveis, com histórico de alterações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Configuracoes,
});

const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const txt = (n: number) => String(n).replace(".", ",");

function Configuracoes() {
  const navigate = useNavigate();
  const [nome, , nomePronto] = useNome();
  const [config, setConfig, configPronto] = useConfig();
  const [historico, setHistorico] = useHistoricoConfig();

  const [metas, setMetas] = useState<string[]>([]);
  const [comissao, setComissao] = useState("");
  const [salarioBase, setSalarioBase] = useState("");

  useEffect(() => {
    if (nomePronto && !nome.trim()) navigate({ to: "/" });
  }, [nomePronto, nome, navigate]);

  useEffect(() => {
    if (!configPronto) return;
    setMetas(config.metas.map((m) => txt(m)));
    setComissao(txt(config.comissao * 100));
    setSalarioBase(txt(config.salarioBase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configPronto]);

  function registrar(novo: Config, descricao: string) {
    const item: MudancaConfig = {
      id: crypto.randomUUID(),
      quando: new Date().toISOString(),
      metas: novo.metas,
      comissao: novo.comissao,
      salarioBase: novo.salarioBase,
      descricao,
    };
    setHistorico([item, ...historico].slice(0, 50));
  }

  function salvar() {
    const novasMetas = metas.map(num).filter((n) => n > 0).sort((a, b) => a - b);
    const pct = num(comissao) / 100;
    const base = num(salarioBase);
    if (novasMetas.length === 0) {
      toast.error("Informe pelo menos uma meta válida.");
      return;
    }
    if (!(pct > 0)) {
      toast.error("Informe um percentual de comissão válido.");
      return;
    }
    if (!(base > 0)) {
      toast.error("Informe um salário-base válido.");
      return;
    }
    const novo: Config = { metas: novasMetas, comissao: pct, salarioBase: base };
    const mudancas: string[] = [];
    if (JSON.stringify(novo.metas) !== JSON.stringify([...config.metas].sort((a, b) => a - b)))
      mudancas.push("metas");
    if (novo.comissao !== config.comissao) mudancas.push("comissão");
    if (novo.salarioBase !== config.salarioBase) mudancas.push("salário-base");
    setConfig(novo);
    registrar(novo, mudancas.length ? `Alterou ${mudancas.join(", ")}` : "Salvou sem alterações");
    toast.success("Configurações salvas!");
  }

  function restaurar() {
    setConfig(CONFIG_PADRAO);
    setMetas(CONFIG_PADRAO.metas.map((m) => txt(m)));
    setComissao(txt(CONFIG_PADRAO.comissao * 100));
    setSalarioBase(txt(CONFIG_PADRAO.salarioBase));
    registrar(CONFIG_PADRAO, "Restaurou os valores padrão");
    toast.success("Valores padrão restaurados.");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Configurações <span className="text-primary">.</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Metas, salário-base e comissão · alterações ficam registradas
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/painel" })}>
            Voltar ao painel
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
              Metas mensais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metas.map((m, i) => (
                <div key={i} className="space-y-2">
                  <Label htmlFor={`meta-${i}`}>Meta {i + 1} (R$)</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`meta-${i}`}
                      inputMode="decimal"
                      className="font-mono"
                      value={m}
                      onChange={(e) => {
                        const copia = [...metas];
                        copia[i] = e.target.value;
                        setMetas(copia);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMetas(metas.filter((_, j) => j !== i))}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setMetas([...metas, ""])}>
              + Adicionar meta
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
              Salário-base e comissão
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="base">Salário-base (R$)</Label>
              <Input
                id="base"
                inputMode="decimal"
                className="font-mono"
                value={salarioBase}
                onChange={(e) => setSalarioBase(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Pago quando a primeira meta do mês não for atingida.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pct">Comissão (%)</Label>
              <Input
                id="pct"
                inputMode="decimal"
                className="font-mono"
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Aplicada sobre as vendas do mês a partir da meta batida.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button className="font-bold tracking-widest uppercase" onClick={salvar}>
                Salvar
              </Button>
              <Button variant="ghost" onClick={restaurar}>
                Restaurar padrão
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="border-l-2 border-primary pl-3 text-sm font-bold tracking-widest uppercase">
              Histórico de mudanças
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
            ) : (
              <ul className="space-y-3">
                {historico.map((h) => (
                  <li key={h.id} className="border-l-2 border-primary/40 pl-3">
                    <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      {new Date(h.quando).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-sm text-foreground">{h.descricao}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      Metas: {h.metas.map((m) => brl(m)).join(" · ")} | Base: {brl(h.salarioBase)} |
                      Comissão: {(h.comissao * 100).toFixed(2).replace(".", ",")}%
                    </p>
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
