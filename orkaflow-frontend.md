# OrkaFlow Frontend - Guia de Execução

## Configuração

1. Copie o modelo de variáveis e ajuste a URL da API:

```bash
cp .env.example .env
# edite VITE_API_URL (em produção: IP/DNS do servidor do back, ex.: http://IP:8000)
```

2. Instale as dependências: `npm ci`

> `VITE_API_URL` é embutida no build. Se mudar, gere o build novamente.

---

## Produção (recomendado): build + nginx

```bash
npm ci
npm run typecheck   # opcional, mas recomendado
npm run build       # gera a pasta dist/
```

Sirva a pasta `dist` com nginx (SPA: todas as rotas caem no `index.html`):

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/orkaflow-frontend/dist;   # copie o conteúdo de dist/ para cá
    index index.html;

    # index.html e version.json nunca ficam em cache: é por eles que o navegador descobre
    # que saiu versão nova (os arquivos em /assets têm hash no nome e podem ficar em cache).
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    location = /version.json {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Opcional: proxy da API no mesmo domínio.
    # Nesse caso use VITE_API_URL vazio/igual ao domínio do front e rebuild.
    # location /api/ {
    #     proxy_pass http://IP_DO_BACKEND:8000;
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    # }
}
```

Depois de publicar uma nova versão: `npm run build`, copie `dist/` para o diretório do nginx
e recarregue com `sudo nginx -t && sudo systemctl reload nginx`.

### Como o navegador dos usuários pega a versão nova

Ninguém precisa apertar Ctrl+Shift+R. Cada build grava um identificador no bundle e em
`dist/version.json`. O painel compara os dois a cada minuto, ao voltar para a aba e ao trocar
de tela; quando o servidor tem um build diferente, ele recarrega na próxima troca de tela
(para não perder um formulário no meio). Para isso funcionar o `index.html` e o `version.json`
não podem ficar em cache (cabeçalhos acima; no Azure Static Web App isso está no
`public/staticwebapp.config.json`).

---

## Desenvolvimento (alternativa): Vite dev server

```bash
npm run dev -- --host 0.0.0.0   # porta 5173
```

- Local: http://localhost:5173
- Rede: http://IP_DA_MAQUINA:5173

Se precisar rodar o modo dev como serviço (apenas para ambientes de teste), use um
serviço systemd (`/etc/systemd/system/orkaflow-frontend.service`) executando o comando acima
e os comandos usuais:

```bash
sudo systemctl start|stop|restart|status orkaflow-frontend
sudo journalctl -u orkaflow-frontend -f
sudo systemctl daemon-reload      # após editar o arquivo do serviço
sudo systemctl enable orkaflow-frontend
```

O modo dev não é indicado para produção (sem otimização, HMR ativo, mais consumo).

---

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run typecheck` | Checagem de tipos (`tsc -b --noEmit`) |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Serve o `dist/` localmente para conferência |

---

## Rede

Libere a porta usada (80/443 com nginx, ou 5173 no modo dev) no firewall, por exemplo:

```bash
sudo ufw allow 80/tcp
```

O backend precisa aceitar a origem do front (CORS) e estar acessível a partir do navegador
do usuário no endereço configurado em `VITE_API_URL`.

---

## Observações

- O frontend mostra banners de saúde (erros, runners com problema, tasks paradas) e de
  conexão com a API; erros de ações aparecem como toast vermelho.
- Não versione o `.env` (somente `.env.example`).
