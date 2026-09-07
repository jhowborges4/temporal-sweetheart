import { useCallback, useEffect, useState } from "react";

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
export function useConfig() {
  const [valor, atualizar, pronto] = useLocalState<Config>(K_CONFIG, CONFIG_PADRAO);
  const completo: Config = {
    metas: valor.metas?.length ? valor.metas : CONFIG_PADRAO.metas,
    comissao: valor.comissao ?? CONFIG_PADRAO.comissao,
    salarioBase: valor.salarioBase ?? CONFIG_PADRAO.salarioBase,
  };
  return [completo, atualizar, pronto] as const;
}
export function useHistoricoConfig() {
  return useLocalState<MudancaConfig[]>(K_HISTORICO, []);
}
export function useVendas() {
  return useLocalState<Venda[]>(K_VENDAS, []);
}

export function lerNome() {
  return ler<string>(K_NOME, "");
}
