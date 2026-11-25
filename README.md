# MyLife — PWA offline com assistente de IA no aparelho

App estático (sem backend). Funciona sem internet, com dados salvos no próprio aparelho.
A nuvem (Supabase) é **opcional**, só para sincronizar entre aparelhos.

```
index.html           → o app inteiro
ai/engine.js         → assistente local (regras): responde sobre seus dados e registra gastos/tarefas
ai/llm.js            → IA generativa opcional que roda no aparelho (WebLLM + WebGPU)
sw.js / manifest.json→ PWA (instalação + funcionamento offline)
supabase-schema.sql  → só se quiser sincronização na nuvem
```

## 1. Publicar (precisa ser HTTPS)
Qualquer hospedagem estática serve. Na Vercel: `npm i -g vercel`, depois `vercel` dentro desta pasta.
(Netlify, Cloudflare Pages e GitHub Pages também funcionam. Não precisa de variáveis de ambiente.)

## 2. Instalar no iPhone
1. Abra o endereço no **Safari**, **com internet**, e deixe carregar por alguns segundos.
2. Compartilhar → **Adicionar à Tela de Início**.
3. Abra pelo ícone. Toque em **Continuar sem conta**. Pronto: já funciona offline.

## 3. Assistente
**Assistente local (sempre ativo, instantâneo, offline):** "qual meu saldo?", "gastos por categoria",
"tarefas atrasadas", "assinaturas", "patrimônio", "gastei 12,50 em café", "recebi 800 de freelance",
"nova tarefa: ligar para o banco". Os números vêm direto dos seus dados (nunca inventados).

**IA generativa no aparelho (opcional):** em *Assistente IA* toque **Ativar IA no aparelho**.
Faça isso no Wi-Fi: baixa uma vez a biblioteca + o modelo Qwen2.5-0.5B (centenas de MB) e
guarda no aparelho. Depois funciona em modo avião. Requer **iOS 26+ (WebGPU)**; sem isso o
botão não aparece e o assistente local continua funcionando. Ela só entra em ação quando as
regras locais não entendem a pergunta. É um modelo pequeno: bom para conversa e resumos,
não para cálculos — por isso os números sempre vêm do assistente local.

## 4. Sincronização na nuvem (opcional)
Crie um projeto no Supabase, rode `supabase-schema.sql` e cole URL e anon key em `index.html`
(`SUPABASE_URL` / `SUPABASE_ANON_KEY`). Sem isso o app roda só local. Em caso de conflito vale
a versão mais recente (última gravação); evite editar em dois aparelhos ao mesmo tempo offline.

## Notas
- Dados ficam no `localStorage` do app instalado. Apps na Tela de Início não sofrem a limpeza de
  7 dias do Safari, mas **apagar o app apaga os dados**: use a nuvem como backup se importar.
- Ao mudar arquivos, aumente `CACHE = "mylife-v2"` em `sw.js` para forçar atualização.
