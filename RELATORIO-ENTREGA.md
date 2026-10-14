# Relatório de entrega — revisão final (build `2026.10.14-metodo-2`)

Esta revisão responde aos 5 pontos da análise do ChatGPT. Nenhum roteiro editorial foi alterado e nenhuma tabela Yamaha foi tocada. Nada foi executado no Supabase real nem publicado no Coolify.

## O que mudou nesta revisão

### 1. Proteção dos roteiros

- **Confirmado:** a pasta `metodo/` inteira precisa ficar protegida no servidor.
  - Os textos dos roteiros, anúncios e pendências estão em `metodo/dados-*.js`, que hoje abrem direto pelo endereço.
  - O login do Supabase protege o banco, não esses arquivos.
- O README agora traz o passo a passo da autenticação básica no Coolify para o domínio inteiro, de dois jeitos:
  - pela tela do Coolify;
  - por labels do Traefik.
- Também traz o teste de conferência: abrir `/metodo/dados-reels-1.js` numa janela anônima tem que pedir senha.
- Essa etapa entrou como obrigatória antes de divulgar o endereço.

### 2. Bloqueios no banco

- As regras agora valem **no Supabase**, por gatilho (`metodo_valida_execucao`). Não dependem mais só do navegador.
- **O banco recusa:**
  - avançar etapa de peça com pendência de bloqueio aberta;
  - publicar com pendência de publicação aberta;
  - etapas fora de ordem;
  - tema do banco editorial (sem roteiro) em produção.
- **Se as regras não estiverem instaladas, o banco trava tudo.** O arquivo `metodo-regras.sql` é gerado a partir dos próprios roteiros por `ferramentas/gerar-regras.js`, para não haver duas fontes divergentes.
- **A central confere as regras do banco.** Se estiverem diferentes das da página, avisa para rodar o `metodo-regras.sql`.
- **Nova coluna `pode_aprovar`.** O aprovador é o único que:
  - libera pendências, sempre com registro escrito obrigatório;
  - autoriza a versão segura (M04, M06, M13, M25), só nas peças que têm essa versão;
  - altera o registro de uma pendência já liberada.
- Qualquer membro pode reabrir pendências e escrever observações.

### 3. Sincronização real

- **Sem login, com o banco disponível:** a central fica só leitura para status. O teleprompter e o guia continuam funcionando. Assim ninguém trabalha achando que está sincronizado.
- **Checagem de versão em cada gravação:**
  - cada alteração guarda a versão do banco em que foi baseada;
  - se outra pessoa alterou depois, **nada é sobrescrito**;
  - a tela volta ao que está no banco e mostra quem alterou e quando;
  - o aviso aparece na faixa e na ficha aberta.
- **Sem conexão (logado):** as alterações ficam na fila, sobrevivem a recarregar a página e vão sozinhas quando a conexão volta, com a mesma checagem.
- **Fila feita sem login ou por outra conta no mesmo navegador:** nunca vai sozinha. A central lista os códigos e pergunta se deve enviar ou descartar.
- **Recusa do banco:** a tela desfaz a alteração e mostra o motivo.
- **Desligado o reenvio automático da biblioteca do Supabase.** A fila própria controla os reenvios.

### 4. Campanhas Yamaha

- Nada alterado.
- O `legado-seguranca-opcional.sql` continua no ZIP, marcado "NÃO RODE NESTA ETAPA".

### 5. Entrega

- README com o passo a passo na ordem: Supabase → GitHub → Coolify → primeiro acesso. O primeiro acesso inclui a conferência de que Michael e Jamille veem os mesmos dados.

## Arquivos desta versão

- **Alterados:** `index.html` e `README.md` (como na versão anterior).
- **Novos em relação ao repositório:** os da versão anterior, mais `supabase/metodo-regras.sql` e `ferramentas/gerar-regras.js`.
- **Apagados:** nenhum. Os arquivos antigos foram conferidos byte a byte.

## Testes feitos

**Navegador: 136 verificações, 136 aprovadas** (Playwright + Chromium).

| Grupo | Verificações |
|---|---|
| Uso local | 80 |
| Celular emulado | 15 |
| Banco | 33 |
| Página Yamaha | 8 |

Os 33 testes de banco usaram a biblioteca real `supabase-js 2.117.2` contra um Supabase simulado e cobriram:

- fila sem login enviada só com confirmação;
- só leitura sem login;
- aprovador e não aprovador;
- tempo real entre computador e celular;
- conflito em registro novo e em registro existente, sem sobrescrever a nota da Jamille;
- perda de conexão, recarga da página e reenvio automático;
- recusa do banco desfeita na tela;
- regras desatualizadas avisadas;
- e-mail fora da lista.

**SQL testado num PostgreSQL 16 real**, imitando os papéis do Supabase.

- Os 3 arquivos rodaram duas vezes sem erro.
- As 15 recusas esperadas aconteceram:
  - anônimo
  - alterar regras
  - etapa fora de ordem
  - M04 bloqueado
  - versão segura sem aprovador
  - publicar M18 com D1 aberta
  - tema extra
  - liberar sem ser aprovador
  - pendência desconhecida
  - liberar sem registro
  - versão segura em peça sem ela
  - alterar registro liberado
  - M17 bloqueado por P1
  - apagar
  - banco sem regras
- Os casos permitidos funcionaram: aprovador liberando e autorizando versão segura, e a Jamille publicando o M18 depois de D1 liberada.
- A atualização condicionada à versão não sobrescreveu uma edição mais nova.

## O que continua sem teste (depende do ambiente real)

- Supabase real e o servidor de tempo real deles. O primeiro acesso do README é o teste definitivo.
- A autenticação básica no Coolify. A conferência está no README.
- Celulares reais (Safari e Chrome).

## Bloqueios de conteúdo

Sem mudança: 6 peças liberadas, 3 com atenção, 11 com trava de publicação e 24 bloqueadas. Veja o `BLOQUEIOS.md`.

**Prioridade:**

1. D1, até 25/10.
2. N1, N2 e E1, até 30/10.
