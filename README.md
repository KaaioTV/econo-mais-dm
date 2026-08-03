# DirectFlow — automação de DM e comentário do Instagram

Backend + dashboard com **duas automações** rodando no mesmo projeto,
usando a Graph API da Meta:

1. **DirectFlow (DM)** — responde mensagens diretas automaticamente
   com base em palavra-chave (estilo ManyChat).
2. **Comentário → DM privada (estilo CreatorFlow)** — quando alguém
   comenta um post/reels com uma palavra-chave (ex: "eu quero"), o
   sistema manda automaticamente uma DM privada pra essa pessoa.

## O que tem aqui

- `server.js` — servidor Express
- `src/webhook.js` — recebe DMs e comentários (webhook da Meta)
- `src/metaApi.js` — envia respostas (Send API + Private Replies API)
- `src/automation.js` — decide qual regra responder (DM e comentário)
- `src/api.js` — API REST usada pelo dashboard
- `src/db.js` — armazenamento simples em `data/db.json`
- `public/` — dashboard (HTML/CSS/JS puro, sem build)

## 1. Instalar e rodar localmente

```bash
npm install
cp .env.example .env
# edite o .env com seus valores (passo 3)
npm start
```

O dashboard abre em `http://localhost:3000`.

## 2. Criar o App na Meta

1. Acesse [developers.facebook.com](https://developers.facebook.com) e crie um App do tipo **Business**.
2. Adicione o produto **Instagram**.
3. Conecte a conta do Instagram Business/Creator.
4. Cadastre essa conta como **Instagram Tester** em **App roles → Roles**
   e aceite o convite pelo próprio app do Instagram.
5. Na tela **API Setup**, gere o token de acesso (seção "2. Generate access tokens").
6. Cole esse token em `META_PAGE_ACCESS_TOKEN` no `.env`, e o ID da conta em `META_IG_ACCOUNT_ID`.

## 3. Configurar o Webhook

Use um túnel local (ex: [ngrok](https://ngrok.com)) ou já direto a URL da Render.

Na tela **API Setup → "3. Configure webhooks"**:
- **Callback URL:** `https://SUA-URL/webhook`
- **Verify token:** o mesmo valor de `META_VERIFY_TOKEN` no `.env`
- **Importante:** deixe **desligado** o toggle "Attach a client certificate to Webhook requests" — esse servidor não usa certificado cliente.
- Na lista de **Webhook fields**, ative:
  - `messages` (obrigatório pro DirectFlow de DM)
  - `comments` (obrigatório pra automação de comentário)

## 4. Inscrever a conta do Instagram no webhook

Depois de configurar o webhook, é preciso **vincular a conta específica**
a ele (isso não é automático só por marcar os campos acima). No Graph API
Explorer, com o token da página/Instagram selecionado:

- Método: **POST**
- Endpoint: `{SEU_IG_ACCOUNT_ID}/subscribed_apps?subscribed_fields=messages,comments`
- Resposta esperada: `{ "success": true }`

## 5. Permitir acesso de apps às mensagens (direto no Instagram)

No app do Instagram, na conta conectada:
**Configurações → Ferramentas de mensagem → Controles de mensagem →
"Permitir acesso às mensagens"** — deixe **ativado**. Sem isso, nenhum
app externo recebe aviso de DM, mesmo com tudo certo na Meta for Developers.

## 6. Testar

**DM:** manda uma mensagem de teste pra sua conta. Se for a primeira vez
dessa pessoa, ela cai em "Solicitações" — aceite manualmente, e a
**próxima** mensagem dela é que dispara o webhook de verdade.

**Comentário:** comenta num post/reels com uma das palavras-chave
cadastradas (ex: "eu quero"). A DM privada deve chegar em segundos.
Acompanhe os logs do servidor — cada evento recebido é logado por
completo (`Webhook recebido: {...}`), o que ajuda a diagnosticar
qualquer problema de configuração do lado da Meta.

## 7. Configurar automações

- **Aba "Automações de DM"** — regras de boas-vindas, palavra-chave e
  resposta padrão pra mensagens diretas.
- **Aba "Automações de comentário"** — regras de palavra-chave que
  disparam DM privada quando alguém comenta. Edite a resposta para
  trocar `COLE-SEU-LINK-AQUI` pelo link real que você quer enviar.

## 8. Deploy (produção)

Suba este projeto em qualquer serviço com Node.js (Render, Railway,
Fly.io, VPS, etc), configure as mesmas variáveis de ambiente do `.env`,
e troque a Callback URL do webhook para a URL pública do serviço.

**Free tier (Render):** o plano gratuito "dorme" depois de 15 min sem
uso. Configure um ping externo (ex: [cron-job.org](https://cron-job.org),
a cada 10-15 min na URL do serviço) pra manter ele sempre acordado e
evitar atraso nas respostas automáticas.

## Limitações importantes

- **Private reply em comentário:** só pode ser enviada 1x por
  comentário, e só dentro de um prazo de alguns dias após o comentário
  (regra da própria Meta).
- **`data/db.json`:** em serviços com disco efêmero (como a Render free
  sem "Persistent Disk"), esse arquivo pode ser resetado a cada novo
  deploy. Pra produção séria, trocar por um banco de dados real
  (Postgres/SQLite com volume persistente).
- Hoje `/api` não tem autenticação — adicione antes de expor
  publicamente por muito tempo.

