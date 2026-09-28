import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { removerVenda, salvarConfig, salvarVenda, sincronizar } from "./nuvem.functions";

export type Venda = { id: string; data: string; valor: number };
export type Config = { metas: number[]; comissao: number; salarioBase: number };
export type MudancaConfig = {
  id: string;
  quando: string;
  metas: number[];
  comissao: number;
  salarioBase: number;
  descricao: string;
};

const K_NOME = "cv:nome";
const K_CONFIG = "cv:config";
const K_VENDAS = "cv:vendas";
const K_HISTORICO = "cv:config-historico";

export const CONFIG_PADRAO: Config = {
  metas: [174000, 200000, 220000, 250000],
  comissao: 0.015,
  salarioBase: 2200,
};

function ler<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalState<T>(key: string, inicial: T) {
  const [valor, setValor] = useState<T>(inicial);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setValor(ler<T>(key, inicial));
    setPronto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const atualizar = useCallback(
    (novo: T) => {
      setValor(novo);
      try {
        window.localStorage.setItem(key, JSON.stringify(novo));
      } catch {
        /* ignora */
      }
    },
    [key],
  );

  return [valor, atualizar, pronto] as const;
}

export function useNome() {
  return useLocalState<string>(K_NOME, "");
}

// ---------- Sincronização com a nuvem ----------
type Sync = { vendas: Venda[]; config: Config | null; historico: MudancaConfig[] };
const syncs = new Map<string, Promise<Sync | null>>();

function sincronizarUmaVez(): Promise<Sync | null> {
  const nome = lerNome().trim();
  if (!nome) return Promise.resolve(null);
  const chave = nome.toLowerCase();
  let p = syncs.get(chave);
  if (!p) {
    p = sincronizar({
      data: {
        nome,
        vendas: ler<Venda[]>(K_VENDAS, []).filter((v) => v && v.data && Number.isFinite(v.valor)),
        config: ler<Config | null>(K_CONFIG, null),
        historico: ler<MudancaConfig[]>(K_HISTORICO, []),
      },
    })
      .then((r) => r as Sync)
      .catch((e) => {
        console.error("Falha ao sincronizar com a nuvem", e);
        syncs.delete(chave);
        return null;
      });
    syncs.set(chave, p);
  }
  return p;
}

function avisarErro(e: unknown) {
  console.error("Falha ao salvar na nuvem", e);
  toast.error("Não foi possível salvar na nuvem. Os dados ficaram salvos neste aparelho.");
}

export function useConfig() {
  const [valor, atualizarLocal, pronto] = useLocalState<Config>(K_CONFIG, CONFIG_PADRAO);
  useEffect(() => {
    if (!pronto) return;
    sincronizarUmaVez().then((r) => {
      if (r?.config) atualizarLocal(r.config);
    });
  }, [pronto, atualizarLocal]);
  const atualizar = useCallback(
    (novo: Config) => {
      atualizarLocal(novo);
      const nome = lerNome().trim();
      if (nome) salvarConfig({ data: { nome, config: novo } }).catch(avisarErro);
    },
    [atualizarLocal],
  );
  const completo: Config = {
    metas: valor.metas?.length ? valor.metas : CONFIG_PADRAO.metas,
    comissao: valor.comissao ?? CONFIG_PADRAO.comissao,
    salarioBase: valor.salarioBase ?? CONFIG_PADRAO.salarioBase,
  };
  return [completo, atualizar, pronto] as const;
}

export function useHistoricoConfig() {
  const [valor, atualizarLocal, pronto] = useLocalState<MudancaConfig[]>(K_HISTORICO, []);
  useEffect(() => {
    if (!pronto) return;
    sincronizarUmaVez().then((r) => {
      if (r && r.historico.length) atualizarLocal(r.historico);
    });
  }, [pronto, atualizarLocal]);
  const atualizar = useCallback(
    (novo: MudancaConfig[]) => {
      atualizarLocal(novo);
      const nome = lerNome().trim();
      if (nome) salvarConfig({ data: { nome, historico: novo } }).catch(avisarErro);
    },
    [atualizarLocal],
  );
  return [valor, atualizar, pronto] as const;
}

export function useVendas() {
  const [valor, atualizarLocal, pronto] = useLocalState<Venda[]>(K_VENDAS, []);
  const anterior = useRef<Venda[]>([]);
  anterior.current = valor;
  useEffect(() => {
    if (!pronto) return;
    sincronizarUmaVez().then((r) => {
      if (r) atualizarLocal(r.vendas);
    });
  }, [pronto, atualizarLocal]);
  const atualizar = useCallback(
    (novo: Venda[]) => {
      const antes = anterior.current;
      atualizarLocal(novo);
      const nome = lerNome().trim();
      if (!nome) return;
      const porData = new Map(antes.map((v) => [v.data, v]));
      const novasDatas = new Set(novo.map((v) => v.data));
      for (const v of novo) {
        const a = porData.get(v.data);
        if (!a || a.valor !== v.valor || a.id !== v.id)
          salvarVenda({ data: { nome, venda: v } }).catch(avisarErro);
      }
      for (const a of antes)
        if (!novasDatas.has(a.data))
          removerVenda({ data: { nome, data: a.data } }).catch(avisarErro);
    },
    [atualizarLocal],
  );
  return [valor, atualizar, pronto] as const;
}

export function lerNome() {
  return ler<string>(K_NOME, "");
}
