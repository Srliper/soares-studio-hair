# Deploy no Vercel — Studio Soares

O projeto está pronto para deploy no Vercel. Já foi criado `vercel.json`
configurando o preset Nitro correto (`vercel`), então é só importar o
repositório e adicionar as variáveis de ambiente.

## 1. Importar o repositório

1. Acesse https://vercel.com/new
2. Selecione o repositório **Srliper/soares-studio-hair**
3. Framework Preset: **Other** (o `vercel.json` cuida do resto)
4. Build Command, Install Command e Output: **deixe como está** (lidos do `vercel.json`)

## 2. Variáveis de ambiente

Adicione em **Settings → Environment Variables** (Production, Preview e Development):

### Backend (Lovable Cloud / Supabase)
Copie os valores atuais do seu `.env` na Lovable:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_PROJECT_ID
```

### Server-only (obrigatórias para admin/webhooks)
```
SUPABASE_SERVICE_ROLE_KEY   # chave service_role do backend
LOVABLE_API_KEY             # necessária para o chat IA e conectores
```

> ⚠️ A `SUPABASE_SERVICE_ROLE_KEY` **não sai** do painel Lovable Cloud automaticamente.
> Se você não tem acesso a ela (Lovable Cloud gerenciada), o deploy funciona
> para o site público, mas funções administrativas que dependem dela vão falhar.
> Nesse caso, mantenha o backend rodando via Lovable e use Vercel só para o front.

### Frontend público
```
VITE_WHATSAPP_NUMBER=+55 15 99834-3669
VITE_WHATSAPP_MESSAGE=Olá! Vim pelo site do Studio Soares e gostaria de mais informações.
```

### Webhooks (se estiver usando n8n)
```
N8N_WEBHOOK_URL
N8N_WEBHOOK_SECRET
```

## 3. Domínio

Depois do primeiro deploy, em **Settings → Domains** aponte
`studiosoares.com.br` (ou o domínio escolhido) e siga as instruções de DNS.

## 4. Sincronizar Google/Supabase Auth

No painel Supabase → Authentication → URL Configuration, adicione o novo domínio
Vercel na lista de **Redirect URLs** para o OAuth do Google continuar funcionando.

## 5. Deploy

Clique em **Deploy**. Cada `git push` no `main` do GitHub dispara um novo deploy
automaticamente (a sincronização Lovable ↔ GitHub já está ativa).

---

**Alternativa mais simples:** publicar direto pelo botão *Publish* da Lovable
(gera `*.lovable.app` grátis, sem precisar mexer em variáveis). Vercel só compensa
se você quer o pipeline próprio ou features específicas da plataforma.