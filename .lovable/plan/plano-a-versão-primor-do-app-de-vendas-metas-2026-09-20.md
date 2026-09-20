# Plano: a "versão primor" do app de Vendas & Metas

Reconstruir o app atual com a qualidade ideal, em fases, **sem perder nenhuma funcionalidade**
existente e mantendo as regras já definidas: pt-BR, moeda R$, entrada só por nome, tema escuro
industrial (slate-950 + amber-500), metas padrão 174k/200k/220k/250k, comissão 1,5%,
salário-base R$ 2.200, dias úteis segunda–sábado.

---

## Fase 1 — Fundação: lógica de negócio pura e testada

Hoje todos os cálculos vivem dentro do componente do painel. Vou extraí-los:

- Criar `src/lib/domain/` com funções puras e tipadas: `resumoMensal`, `resumoSemanal`,
  `salarioDoMes` (regra base vs. comissão após a 1ª meta), `simulacaoComissao`,
  `ritmoNecessario`, `progressoMeta`, `estimativaDataMeta`.
- Usar `date-fns` (já instalado) para cálculos de semana/mês, eliminando código manual de datas.
- Testes automatizados com Vitest cobrindo as regras salariais e de metas (incluindo casos de
  mês sem vendas, exatamente na meta, acima da meta).

## Fase 2 — Quebrar o painel gigante

O `painel.tsx` tem 1.141 linhas misturando estado, cálculo e tela. Vou dividir em:

- Hooks por recurso: `useVendasDoMes`, `useKpis`, `useSimulador`, `useConfigMetas`.
- Componentes de tela: `HeaderPainel`, `RegistroVenda`, `CartaoKpi`, `CartaoMeta`,
  `CartaoSalario` (com o resumo de cálculo do salário), `GraficoProgresso`, `GraficoEvolucao`,
  `CalendarioVendas`, `SimuladorComissao`, `DialogBackup`.
- O `painel.tsx` passa a ser só orquestração — mais fácil de manter e evoluir.

## Fase 3 — Experiência de uso premium (mobile-first)

O app é usado no celular (390px). Hoje é uma rolagem longa de cartões empilhados:

- Reorganizar em abas: **Hoje** (registro do dia + meta do dia), **Mês** (KPIs, progresso,
  salário), **Evolução** (gráficos e comparações), **Ajustes** (atalho para configurações).
- Microinterações: contador animado do total do mês, animação ao registrar venda, toast com
  "desfazer" ao remover (já existe parcialmente — padronizar), feedback visual ao bater meta.
- Acessibilidade: rótulos nos campos, foco visível, contraste, navegação por teclado,
  avisos de meta anunciados para leitores de tela.
- Manter o tema escuro industrial exatamente como está.

## Fase 4 — Confiabilidade dos dados

O localStorage hoje é frágil (limpar cache = perder tudo). Vou endurecer:

- **Versionamento de dados**: marca de versão no armazenamento local, com migração automática
  de dados antigos.
- **Validação ao ler/importar** (Zod): arquivo de backup inválido nunca quebra o app — mostra
  mensagem clara e mantém os dados atuais.
- **Backup mais robusto**: manter exportação/importação manual e o backup automático diário,
  e adicionar ponto de restauração mensal com histórico ("restaurar para data X").
- Validações de entrada: valor não negativo, data coerente, comissão dentro de faixa.
- Atualizar exportações PDF/CSV para refletir a regra salarial (base vs. comissão).

## Fase 5 — Extras de produto (ao final, se aprovados)

- **PWA instalável**: ícone próprio, abre como app no celular, funciona offline.
- **Categorias de venda** (opcional; ex.: cimento, acabamento) para entender o mix — **só
  implemento se você confirmar que quer**, pois muda a tela de registro.
- Nuvem opcional para sincronizar entre dispositivos — **fica fora deste plano**; posso
  planejar separadamente depois, mantendo os dados locais como padrão.

---

## Detalhes técnicos

- Estrutura final: `src/lib/domain/` (cálculos puros), `src/hooks/` (hooks por recurso),
  `src/components/painel/` (componentes de tela), rotas `index`, `painel`, `configuracoes`.
- Nenhum dado existente será perdido: a migração de versão preserva vendas, config e histórico.
- Cada fase será entregue funcionando; o app nunca fica quebrado entre fases.
- Testes: `bunx vitest run` para o domínio; verificação de tipos e build a cada fase.

## Ordem de entrega

1. Fase 1 (domínio + testes) → 2. Fase 2 (componentização) → 3. Fase 3 (abas mobile + polish)
→ 4. Fase 4 (dados confiáveis) → 5. Fase 5 (PWA; categorias somente se você aprovar).
