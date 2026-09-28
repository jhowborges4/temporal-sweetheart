import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const nomeZ = z.string().trim().min(1).max(80);
const vendaZ = z.object({
  id: z.string().max(100),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valor: z.number().min(0).max(1e10),
});
const configZ = z.object({
  metas: z.array(z.number().min(0)).max(20),
  comissao: z.number().min(0).max(1),
  salarioBase: z.number().min(0),
});

export function normalizarNome(n: string) {
  return n.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

async function perfilId(nome: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const chave = normalizarNome(nome);
  const { data: existente } = await supabaseAdmin
    .from("perfis").select("id, config, historico").eq("nome_normalizado", chave).maybeSingle();
  if (existente) return { db: supabaseAdmin, perfil: existente };
  const { data, error } = await supabaseAdmin
    .from("perfis").insert({ nome_normalizado: chave, nome_exibicao: nome.trim() })
    .select("id, config, historico").single();
  if (error) throw new Error("Não foi possível criar o perfil");
  return { db: supabaseAdmin, perfil: data };
}

async function listarVendas(db: any, id: string) {
  const { data } = await db.from("vendas_nome").select("venda_id, data, valor").eq("perfil_id", id);
  return (data ?? []).map((v: any) => ({ id: v.venda_id, data: v.data, valor: Number(v.valor) }));
}

/** Carrega do banco e mescla as vendas locais (nunca apaga; mesmo dia fica o maior valor). */
export const sincronizar = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ nome: nomeZ, vendas: z.array(vendaZ).max(5000), config: configZ.nullable(), historico: z.array(z.any()).max(1000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { db, perfil } = await perfilId(data.nome);
    const nuvem = await listarVendas(db, perfil.id);
    const mapa = new Map<string, { id: string; data: string; valor: number }>();
    for (const v of nuvem) mapa.set(v.data, v);
    const upserts = [];
    for (const v of data.vendas) {
      const atual = mapa.get(v.data);
      if (!atual || v.valor > atual.valor) {
        mapa.set(v.data, v);
        upserts.push({ perfil_id: perfil.id, venda_id: v.id, data: v.data, valor: v.valor });
      }
    }
    if (upserts.length) await db.from("vendas_nome").upsert(upserts, { onConflict: "perfil_id,data" });

    let config = perfil.config as z.infer<typeof configZ> | null;
    let historico = (perfil.historico as unknown[]) ?? [];
    const patch: Record<string, unknown> = {};
    if (!config && data.config) { config = data.config; patch["config"] = config; }
    if (historico.length === 0 && data.historico.length) { historico = data.historico; patch["historico"] = historico; }
    if (Object.keys(patch).length) await db.from("perfis").update(patch as any).eq("id", perfil.id);

    return { vendas: [...mapa.values()], config, historico };
  });

export const salvarVenda = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ nome: nomeZ, venda: vendaZ }).parse(d))
  .handler(async ({ data }) => {
    const { db, perfil } = await perfilId(data.nome);
    await db.from("vendas_nome").upsert(
      { perfil_id: perfil.id, venda_id: data.venda.id, data: data.venda.data, valor: data.venda.valor },
      { onConflict: "perfil_id,data" },
    );
    return { ok: true };
  });

export const removerVenda = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ nome: nomeZ, data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { db, perfil } = await perfilId(data.nome);
    await db.from("vendas_nome").delete().eq("perfil_id", perfil.id).eq("data", data.data);
    return { ok: true };
  });

export const salvarConfig = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ nome: nomeZ, config: configZ.optional(), historico: z.array(z.any()).max(1000).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { db, perfil } = await perfilId(data.nome);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.config) patch["config"] = data.config;
    if (data.historico) patch["historico"] = data.historico;
    await db.from("perfis").update(patch as any).eq("id", perfil.id);
    return { ok: true };
  });
