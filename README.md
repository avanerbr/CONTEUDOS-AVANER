# Central de Conteúdos AVANER — Método AVANER

Build `2026.10.14-metodo-3`. Abre no **Calendário**: cada peça mostra o próximo passo (aprovar, gravar, editar, publicar ou o que falta para destravar). Painel interno da campanha do Método AVANER. Contém:

- 30 Reels: 24 prioritários e 6 reservas.
- 16 temas extras.
- 14 anúncios.
- Calendário, lotes, pendências e resultados.

A central antiga das campanhas Yamaha continua intacta em `campanhas-yamaha.html` (link no rodapé). O README antigo está em `README-yamaha.md`.

## Arquivos

| Arquivo | Situação | Para que serve |
|---|---|---|
| `index.html` | **ALTERADO** | Página da nova central |
| `README.md` | **ALTERADO** | Este arquivo |
| `campanhas-yamaha.html` | NOVO | Cópia da `index.html` antiga, com link de volta. Usa os `central-v4.*` sem alteração |
| `README-yamaha.md` | NOVO | Cópia do README antigo |
| `metodo/app.js` | NOVO | Lógica da central |
| `metodo/metodo.css` | NOVO | Visual |
| `metodo/dados-base.js` | NOVO | Campanha, fases, formatos, lotes, pendências, temas extras e histórico |
| `metodo/dados-reels-1.js`, `-2.js`, `-3.js` | NOVOS | Reels M01 a M30 |
| `metodo/dados-anuncios.js` | NOVO | Anúncios AN01 a AN14 |
| `supabase/metodo-schema.sql` | NOVO | Tabelas, login, permissões e regras de bloqueio no banco |
| `supabase/metodo-regras.sql` | NOVO | Lista de peças e dependências usada pelo banco. É gerada automaticamente |
| `supabase/legado-seguranca-opcional.sql` | NOVO | **Não rodar nesta etapa** (tabelas Yamaha) |
| `ferramentas/gerar-regras.js` | NOVO | Gera o `metodo-regras.sql` a partir dos roteiros |
| `RELATORIO-ENTREGA.md` | NOVO | O que mudou e o que foi testado |
| `BLOQUEIOS.md` | NOVO | Peças bloqueadas e o que falta para liberar cada uma |

**Nenhum arquivo foi apagado.** Os demais arquivos antigos continuam idênticos byte a byte:

- `app.js`, `data.js`, `data-trucks.js`, `style.css`
- `central-v3.*`, `central-v4.*`
- `supabase-config.js`, `supabase/schema.sql`

---

## Instalação, na ordem

Faça na ordem abaixo. O passo 3 (Coolify) protege os roteiros. Não divulgue o endereço antes de concluí-lo.

### 1. Supabase

Você vai usar o SQL Editor e a tela Authentication do mesmo projeto da central antiga.

1. **Estrutura.** No **SQL Editor**, cole todo o `supabase/metodo-schema.sql` e clique em *Run*. Deve terminar sem erro. Pode rodar de novo sem problema.
2. **Regras.** Cole todo o `supabase/metodo-regras.sql` e rode.
   - A conferência no fim do arquivo deve mostrar **44 peças, 72 dependências e 20 pendências**.
   - Sem esse arquivo, o banco recusa qualquer marcação de etapa. É de propósito: se a regra não estiver instalada, a etapa fica travada.
3. **Cadastro aberto.** Em **Authentication > Sign In / Providers**, desmarque *Allow new users to sign up*.
4. **Equipe.** Em **Authentication > Users > Add user > Create new user**, crie Michael, Jamille e Guilherme com e-mail, senha forte e *Auto Confirm User* marcado.
5. **Liberação.** Rode a seção 8 do `metodo-schema.sql` com os e-mails reais, em minúsculas.
   - `pode_aprovar = true` só para quem libera pendências e autoriza versão segura. Recomendado: só o Michael.
6. **Conferência.** Rode as consultas da seção 9. O resultado esperado:
   - 12 políticas `metodo_*`
   - os 3 e-mails
   - 44 peças
7. **Não rode** o `supabase/schema.sql` antigo nem o `legado-seguranca-opcional.sql`. As tabelas Yamaha ficam como estão.

### 2. GitHub (GitHub Desktop)

1. Copie para a pasta do repositório todo o conteúdo do ZIP, mantendo as pastas `metodo/`, `supabase/` e `ferramentas/`.
2. Aceite substituir `index.html` e `README.md`.
3. No GitHub Desktop deve aparecer:
   - 2 arquivos alterados: `index.html` e `README.md`
   - os arquivos novos da tabela acima
   - **nenhum arquivo apagado**
4. Faça o commit e o push. **Ainda não divulgue o endereço.**

### 3. Coolify: proteger o site inteiro

**Por que é obrigatório.** O login da central protege o banco (status, pendências, resultados). Os textos dos roteiros, anúncios e pendências, porém, estão nos arquivos `metodo/*.js`. Sem proteção no servidor, qualquer pessoa com o endereço abre, por exemplo, `https://SEU-DOMINIO/metodo/dados-reels-1.js` e lê tudo. Esconder botões não resolve isso. Quem precisa pedir senha é o servidor, antes de entregar qualquer arquivo.

Ative a autenticação básica (usuário e senha do navegador) na aplicação, cobrindo todo o domínio:

- `index.html` e a pasta `metodo/`
- `campanhas-yamaha.html`
- `supabase-config.js` e os demais arquivos

**Opção A: pela tela do Coolify, se a sua versão tiver.**

1. Abra a aplicação e procure *HTTP Basic Authentication* ou *Basic Auth* em **Configuration > General** ou **Advanced**.
2. Ative, defina um usuário (ex.: `avaner`) e uma senha forte, diferente das senhas do Supabase.
3. Salve e clique em **Redeploy**.

**Opção B: por labels do Traefik, se a opção A não existir.**

1. Gere o código da senha no Mac, no Terminal:
   ```
   htpasswd -nbB avaner 'SUA-SENHA-FORTE'
   ```
   O resultado tem o formato `avaner:$2y$05$...`.
2. Na aplicação, abra **Configuration > General > Container Labels**. Se os labels estiverem em modo somente leitura, desligue *Readonly labels*.
3. Adicione esta linha, colando o resultado do passo 1 e **trocando cada `$` por `$$`**:
   ```
   traefik.http.middlewares.avaner-auth.basicauth.users=avaner:$$2y$$05$$...
   ```
4. Encontre a linha que termina em `.middlewares=` do roteador **https** (algo como `traefik.http.routers.https-0-xxxx.middlewares=gzip`). Acrescente `,avaner-auth` ao final dela:
   ```
   traefik.http.routers.https-0-xxxx.middlewares=gzip,avaner-auth
   ```
5. Salve e clique em **Redeploy**.

**Como conferir, nas duas opções.** Abra uma janela anônima e teste estes endereços:

1. `https://SEU-DOMINIO/` deve pedir usuário e senha antes de mostrar qualquer coisa.
2. `https://SEU-DOMINIO/metodo/dados-reels-1.js` também deve pedir senha. Se abrir o texto do roteiro, a proteção **não** está ativa.
3. `https://SEU-DOMINIO/campanhas-yamaha.html` também deve pedir senha.
4. Depois de digitar a senha, a central carrega normalmente. O login do Supabase continua funcionando, porque ele fala direto com o servidor do Supabase.

### 4. Primeiro acesso: confirmar que todos usam os mesmos dados

1. **Build.** No rodapé deve aparecer `build 2026.10.14-metodo-3 · 30 Reels · 14 anúncios · 16 temas extras`.
2. **Login.** Michael e Jamille clicam em **Entrar**, cada um com o próprio e-mail.
   - A faixa fica verde: "Sincronizado com o banco · e-mail · tempo real ativo".
   - No Michael aparece também "(aprovador)".
3. **Tempo real.** A Jamille abre o M14 e marca **Aprovado**. Em até alguns segundos, sem recarregar, a mesma marcação aparece na tela do Michael.
4. **Banco.** No Supabase, em **Table Editor > metodo_execucao**, a linha M14 deve ter `updated_by` com o e-mail da Jamille.
5. **Bloqueio no banco.** A Jamille abre o M04 (bloqueado por N1 e N2) e confere:
   - o botão Aprovado está travado
   - a caixa "versão segura" está desabilitada, porque ela não é aprovadora
6. **Fila antiga.** Se aparecer o aviso "alterações feitas neste navegador fora desta conta", confira os códigos listados. Depois escolha **Enviar** ou **Descartar**. Enviar nunca sobrescreve o que outra pessoa alterou depois.

Se o passo 3 falhar, me mande um print da faixa do topo das duas telas.

---

## Como a central se comporta

**Sem login**

- Dá para ler tudo e usar o teleprompter e o guia.
- Não dá para marcar status. Assim ninguém trabalha achando que está sincronizado.

**Logado e liberado**

- Cada alteração vai ao banco com a versão em que foi baseada.
- Se outra pessoa alterou a mesma peça depois, nada é sobrescrito. A central mostra o que está no banco e avisa quem alterou e quando.

**Sem conexão, logado**

- As alterações ficam na fila deste navegador, mesmo se a página for recarregada.
- Vão sozinhas quando a conexão volta, com a mesma checagem de versão.

**Banco indisponível** (biblioteca do Supabase não carregou)

- As alterações ficam na fila deste navegador.
- Só vão para o banco depois que alguém entrar e clicar em **Enviar**.

**Regras de bloqueio**

| Nível | O que impede |
|---|---|
| Bloqueio | aprovar, gravar, editar e publicar |
| Trava publicação | só publicar |
| Atenção | nada (só aviso) |

Valem na tela e **no banco**: um gatilho no Supabase recusa a gravação mesmo se alguém tentar pela API ou alterar o JavaScript.

**Aprovador** (`pode_aprovar`)

- Só o aprovador libera pendências, autoriza a versão segura (M04, M06, M13, M25) e altera o registro de uma pendência já liberada.
- Qualquer membro pode reabrir uma pendência e escrever observações.
- Para liberar, o registro escrito é obrigatório.

**Regras desatualizadas.** Se o banco estiver com regras diferentes das da página, a faixa avisa para rodar o `metodo-regras.sql`.

## Como editar um roteiro

1. Altere o texto em `metodo/dados-*.js`.
2. Aumente a `versao` da peça. Se ela já foi gravada, a central avisa "Roteiro mudou depois da gravação".
3. Registre a mudança em `historico`, no fim do `metodo/dados-base.js`.
4. Troque o `build` em `dados-base.js` e os `?v=` do `index.html`.
5. **Se mudou alguma dependência (`deps`), pendência ou versão segura:**
   - rode `node ferramentas/gerar-regras.js`, ou peça para eu gerar
   - rode o novo `supabase/metodo-regras.sql` no Supabase

   Regras antigas não são apagadas, ficam marcadas como inativas.
