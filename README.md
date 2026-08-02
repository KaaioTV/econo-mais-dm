# DirectFlow — automação de DM do Instagram

Backend + dashboard para responder automaticamente mensagens diretas do
Instagram, no estilo do ManyChat, usando a Graph API da Meta.

## O que tem aqui

- `server.js` — servidor Express
- `src/webhook.js` — recebe as DMs (webhook da Meta)
- `src/metaApi.js` — envia respostas (Send API)
- `src/automation.js` — decide qual regra responder
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
2. Adicione o produto **Instagram** (Instagram API with Instagram Login, ou
   via Página do Facebook conectada, dependendo do tipo de conta).
3. Conecte a conta do Instagram Business/Creator que vai receber as DMs.
4. Em **Configurações do App → Básico**, anote o *App ID* e *App Secret* (não
   usados neste projeto diretamente, mas necessários se depois você quiser
   fazer login OAuth em vez de token manual).
5. Gere um **token de acesso de página** com os escopos:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `pages_messaging`

   Isso pode ser feito no Graph API Explorer *do seu próprio App* (não reaproveite
   tokens gerados soltos em conversas ou tutoriais) ou, para produção, via fluxo
   OAuth com login da página.
6. Cole esse token em `META_PAGE_ACCESS_TOKEN` no `.env`.

## 3. Configurar o Webhook

A Meta precisa conseguir chamar sua URL pela internet — localmente, use um
túnel como [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

Isso te dá uma URL tipo `https://abcd1234.ngrok-free.app`.

No painel do App (**Produtos → Webhooks → Instagram**):

- **Callback URL:** `https://SEU-TUNEL/webhook`
- **Verify Token:** o mesmo valor que você colocou em `META_VERIFY_TOKEN` no `.env`
- **Campos de assinatura:** marque `messages`

Ao salvar, a Meta chama seu `GET /webhook` para validar — o servidor já
responde isso automaticamente em `src/webhook.js`.

## 4. Testar

Envie uma DM de teste para a conta do Instagram conectada. O evento deve
chegar em `POST /webhook`, e você verá:

- a conversa aparecendo na aba **Conversas** do dashboard
- a resposta automática de boas-vindas sendo enviada de volta no Instagram

## 5. Configurar automações

Na aba **Automações** do dashboard dá pra criar regras de três tipos:

- **Boas-vindas** — dispara só na primeira mensagem de um novo contato
- **Palavra-chave** — dispara quando o texto recebido contém algum dos termos
  cadastrados (ex: "preço", "valor", "quanto custa")
- **Padrão** — dispara quando nenhuma outra regra combina

A ordem de prioridade é: boas-vindas → palavra-chave → padrão.

## 6. Deploy (produção)

Para rodar 24/7 sem depender do seu computador ligado, suba este projeto em
qualquer serviço com Node.js (Render, Railway, Fly.io, VPS, etc), configure
as mesmas variáveis de ambiente do `.env`, e troque a Callback URL do
webhook para a URL pública do serviço escolhido.

## Próximos passos sugeridos

- Trocar `data/db.json` por um banco de verdade (Postgres/SQLite) se o
  volume de conversas crescer.
- Adicionar fluxos com múltiplas etapas (ex: pergunta → aguarda resposta →
  próxima pergunta), hoje o motor só responde 1 mensagem por vez.
- Adicionar autenticação no próprio dashboard antes de colocar em produção
  pública, já que hoje `/api` não tem nenhuma proteção.
- Registrar métricas de conversão (quantos contatos viraram lead/venda).
