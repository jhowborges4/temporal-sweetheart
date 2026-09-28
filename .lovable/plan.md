# Salvar na nuvem com login só pelo nome

## O que muda para você
- Você entra digitando **apenas seu nome**, como hoje. Não tem senha nem e-mail.
- Suas vendas, metas, comissão, salário-base e o histórico de mudanças ficam **salvos na nuvem**. Assim, ao abrir em outro celular ou computador com o mesmo nome, aparecem os mesmos dados.
- **Nenhum registro antigo é apagado.** No primeiro acesso depois da mudança, tudo o que está salvo hoje neste aparelho é enviado para a nuvem e juntado ao que já estiver lá. Se o mesmo dia existir nos dois lugares, fica o maior valor, para não perder nenhuma venda.
- Os dados deste aparelho continuam guardados como cópia de segurança. O backup e a importação por arquivo continuam funcionando.
- Tela, cores e regras continuam iguais: metas de 174k, 200k, 220k e 250k, comissão de 1,5%, salário-base de R$ 2.200 e dias úteis de segunda a sábado.

## Aviso importante
Como o login é só pelo nome, quem digitar exatamente o mesmo nome verá e poderá alterar os mesmos dados. Letras maiúsculas e acentos serão ignorados: "João" e "joao" contam como o mesmo nome. Se um dia você quiser mais proteção, dá para acrescentar um PIN de 4 dígitos.

## Detalhes técnicos
- Nova tabela `perfis` (id, nome_normalizado único, nome_exibicao, config jsonb, created_at) e `vendas_nome` (perfil_id, data, valor, única por perfil_id+data), e `config_historico` (perfil_id, jsonb, quando). RLS ativada, sem policies para anon/authenticated. O acesso é feito só por server functions (`createServerFn`), que usam o client admin carregado dentro do handler e validam as entradas com Zod.
- Server functions: `entrarPorNome`, `listarDados`, `salvarVenda` (upsert), `removerVenda`, `salvarConfig` (grava também uma linha no histórico) e `mesclarLocal`, que faz o upsert dos dados de localStorage usando GREATEST(valor).
- `src/lib/store.ts`: os hooks passam a usar React Query com as server functions. Toda alteração também é gravada em localStorage como cache para uso offline. `cv:nome` guarda o nome normalizado. Uma flag `cv:migrado:<nome>` evita repetir a migração.
- A tabela antiga `vendas_diarias` (do login por e-mail) fica intacta.
- Verificação: typecheck, build e Playwright. O teste entra com um nome, lança uma venda, limpa o localStorage, entra de novo e confere que a venda voltou.
