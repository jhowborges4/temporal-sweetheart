# Avaliação técnica: a "versão primor" do app de Vendas & Metas

Você pediu apenas uma **avaliação** (sem mexer no código agora), considerando os quatro pilares:
arquitetura de código, UX/UI premium, funcionalidades novas e confiabilidade dos dados, com persistência
**local por padrão + nuvem opcional**. Este documento descreve o estado atual, o que está maduro, as
dívidas e como seria a versão ideal caso refizesse do zero.

---

## 1. Estado atual (o que já existe e funciona)

- **Entrada só por nome** (`src/routes/index.tsx`), sem login/senha.
- **Painel monolítico** em `src/routes/painel.tsx` com **1.141 linhas** e ~45 KB — um único componente
  concentra registro/edição/remoção de vendas, navegação de mês, KPIs, comparação mês-a-mês, ritmo
  necessário, calendário de vendas, metas/comissão editáveis, simulador de percentual, regra salarial
  (base R$ 2.200 vs. comissão após a 1ª meta), alertas, gráficos (recharts), backup/import JSON,
  backup automático diário e exportação PDF/CSV.
- **Persistência localStorage** (`src/lib/store.ts`): nome, config e vendas, com hook `useLocalState`.
- **Regras de negócio** (`src/lib/metas.ts`): metas `[174.000, 200.000, 220.000, 250.000]`, comissão
  `1,5%`, salário-base `2.200`, dias úteis segunda–sábado, formatação R$.
- **Exportação** (`src/lib/exportar.ts`): CSV e PDF via jspdf/jspdf-autotable.
- **Tema** "escuro industrial" (slate-950 + amber-500) em `src/styles.css`.
- **Biblioteca de UI** completa (shadcn/Radix) já instalada, mas pouco aproveitada no painel.

### O que está maduro / vale preservar numa refatoração
- Regra de negócio bem definida e estável (metas, comissão, salário, dias úteis).
- Decisão de UX: entrar só com o nome é simples e acerta o público.
- Tema visual já escolhido e consistente (não clareia).
- Persistência desacoplada por hooks (`useVendas`, `useConfig`, `useNome`) — bom ponto de extensão.

### Dívidas técnicas e riscos atuais
- `painel.tsx` com 1.141 linhas: estado, cálculo e UI misturados; difícil testar e manter.
- Toda a lógica de cálculo (total do mês, semana, projeção, salário, simulação) mora dentro do
  componente, sem funções puras reutilizáveis nem testes.
- `localStorage` é frágil: perda ao limpar cache, sem versionamento de schema, sem migração, sem
  proteção contra dados corrompidos, e sem conflito entre dispositivos.
- Backup automático depende do navegador baixar um arquivo; não é "restauração real" nem segura dados.
- `date-fns` está instalado mas o código recria cálculos de semana/mês à mão (risco de inconsistência).
- Exportações não refletem a regra salarial nova (base vs. comissão).
- Sem testes automatizados e sem verificação de acessibilidade.

---

## 2. A versão "primor" — visão por pilar

### Pilar A — Arquitetura de código
- **Camada de domínio pura** em `src/lib/domain/`: funções puras tipadas e testáveis para
  `resumoMensal`, `resumoSemanal`, `salario`, `simulacao`, `ritmoNecessario`, `progressoMeta`.
  Sem React, sem localStorage — fáceis de testar com Vitest.
- **Hook por feature**, pequenos: `useVendasDoMes(mesRef)`, `useKpis()`, `useSimulador()`,
  `useConfigMetas()`, cada um em arquivo próprio, substituindo o estado espalhado.
- **Quebrar o painel em componentes** de tela: `HeaderPainel`, `RegistroVenda`,
  `CartaoKpi`, `CartaoMeta`, `CartaoSalario`, `GraficoEvolucao`, `CalendarioVendas`,
  `SimuladorComissao`, `DialogConfigMetas`, `DialogBackup`. O `painel.tsx` vira orquestração.
- **Tipagem forte** do modelo de dados (`Venda`, `Config`, `Resumo`, `Simulacao`) com Zod para
  validar dados lidos de localStorage/import (rejeitar JSON inválido com mensagem clara).
- **Camada de persistência abstraída** (`src/lib/storage/`): uma interface `Repository` com duas
  implementações — `LocalRepository` (localStorage hoje) e `CloudRepository` (nuvem opcional).
  O resto do app não sabe onde os dados vivem.

### Pilar B — UX/UI premium
- **Layout responsivo de verdade**: o app é usado no celular (viewport 390px hoje). Reorganizar para
  mobile-first com seções em tabs (`Hoje`, `Mês`, `Evolução`, `Config`), removendo a rolagem infinita
  de cards empilhados.
- **Navegação por abas/bottom-nav** em vez de um card gigante, com `Tabs`/`Sheet` já disponíveis.
- **Microinterações**: animar entrada de novos registros, contador animado do total do mês,
  feedback de meta atingida (confete/toast), estados vazios ilustrados.
- **Consistência visual**: padronizar espaçamentos e uso dos tokens do tema (já dark), eliminar
  duplicação de estilos.
- **Acessibilidade**: labels associados, foco visível, contraste, navegação por teclado nos diálogos,
  `aria-live` para alertas de meta e recálculo de comissão.
- **Confirmações com desfazer** (toast "removido — desfazer") já parcialmente existe; padronizar.

### Pilar C — Funcionalidades novas
- **Nuvem opcional** (sincronização entre dispositivos): manter entrada por nome, mas com um
  "perfil" + código de acesso leve opcional para sincronizar; dados seguem locais por padrão.
- **Categorias de venda** (ex.: cimento, acabamento, ferragens) para entender o mix que gera a meta.
- **Metas por período** (dia/semana/mês) já existem como derivadas; permitir configurar alvos
  personalizados por semana e feriados.
- **Notificações/lembretes** diários de registro e alerta ao se aproximar de uma meta (PWA).
- **PWA instalável** (manifest + service worker) para abrir como app no celular, com ícone próprio.
- **Visão de ano/consolidado** e comparação entre vendedores (se multi-perfil) opcional.

### Pilar D — Confiabilidade dos dados
- **Versionamento de schema** (`cv:version`) e migrações automáticas ao ler dados antigos.
- **Validação Zod** ao ler/importar: JSON inválido nunca quebra o app — fallback e mensagem.
- **Backup mais robusto**: opção de exportar/importar manual + backup automático local persistente
  (e na nuvem, se habilitada), com histórico versionado e "restaurar para data X".
- **Detecção de duplicidade** (mesma data) já há unique, mas padronizar edição por dia sem risco.
- **Recuperação de desastre**: auto-save contínuo + ponto de restauração mensal.
- **Validações de entrada**: valor não-negativo, data dentro de limites, comissão dentro de faixa.

---

## 3. Estrutura de pastas proposta (referência)

```text
src/
  lib/
    domain/        # funções puras de negócio (testáveis)
    storage/       # interface Repository + Local/Cloud
    metas.ts       # constantes e helpers de data (com date-fns)
  hooks/           # useKpis, useSimulador, useVendasDoMes...
  components/
    painel/        # HeaderPainel, CartaoKpi, CartaoMeta, Simulador...
  routes/
    index.tsx      # entrada por nome
    painel.tsx     # orquestração leve das seções
```

---

## 4. Recomendação de caminho (sem mexer agora)

Esta é apenas uma **avaliação** — nenhuma linha de código será alterada até você aprovar. Se quiser
avançar, a ordem de maior retorno seria:

1. Extrair a lógica de cálculo para funções puras + primeiros testes (maior ganho de confiança).
2. Quebrar `painel.tsx` em componentes e hooks por feature.
3. Mobile-first com tabs e acessibilidade.
4. Versionamento/validação de dados + backup robusto.
5. Nuvem opcional e PWA.

> Observação: o erro `src/lib/utils.ts(8,7): Type 'number' is not assignable to type 'string'`
> continua **ausente** do arquivo atual (`utils.ts` tem só o helper `cn` com 6 linhas); trata-se de
> cache de editor/TS obsoleto.
