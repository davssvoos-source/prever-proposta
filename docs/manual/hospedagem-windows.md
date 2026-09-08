# Hospedagem em servidor Windows — o pacote, o instalador e o serviço (R220, U118)

> Para quem vai pôr o Prever para rodar num servidor Windows da empresa
> (Windows Server 2016 ou mais novo), como um serviço, na porta que a casa
> escolher. O banco continua no Supabase — o servidor só serve o sistema.

## O que é, em uma frase

O Prever é um app **TanStack Start** (React com SSR) que o build empacota num
servidor Node (`.output/server/index.mjs`). No Windows ele roda como um
**serviço** ("Prever — Sistema"), embrulhado pelo **WinSW**, escutando na
porta que o instalador gravou em `config.env`. Tudo o que é dado fica no
**Supabase**, como sempre.

## Requisitos do servidor

- Windows Server 2016 ou mais novo (ou Windows 10/11), 64 bits, com .NET
  Framework 4.6.1+ (o Server 2016 já vem com 4.6.2 — é o que o WinSW pede).
- **Node.js 20 LTS** ou mais novo. O instalador baixa e instala em silêncio se
  não encontrar (precisa de internet nesse momento); sem internet, instale o
  MSI do nodejs.org antes.
- Saída para a internet em runtime: o servidor fala com o Supabase
  (`*.supabase.co`, porta 443).
- Uma **porta TCP livre** para o sistema. É ela que o instalador pede: o
  servidor roda vários serviços em portas distintas (R220).
- Um usuário administrador para instalar (o serviço roda como `LocalSystem`;
  se a política da empresa pedir outra conta, é no XML do WinSW —
  `servico\prever-servico.xml`, elemento `<serviceaccount>`).

## O pacote

Na máquina de desenvolvimento, na raiz do repo:

```bash
npm run build:windows
```

Sai em `dist-windows/Prever-<versão>/` (e um `.zip` ao lado):

| Arquivo | O que é |
|---|---|
| `Instalar-Prever.exe` | o instalador (o `instalar.ps1` compilado com pedido de elevação); se o ps2exe não estava instalado na máquina de build, só o `.ps1` vem |
| `instalar.ps1` | o mesmo instalador, em PowerShell — serve igual (botão direito → Executar com o PowerShell, como administrador) |
| `app\` | o build do sistema (preset `node-server` do Nitro): `server\index.mjs` e `public\` |
| `iniciar.mjs` | o ponto de entrada do serviço: lê `config.env` e sobe o servidor |
| `atualizar.ps1` · `desinstalar.ps1` | manutenção |
| `config.padrao.env` | as chaves PÚBLICAS do Supabase (URL e publishable key) — o instalador as copia para o `config.env` |
| `VERSAO.txt` | versão, commit e data do build |

O pacote **nunca** leva segredo: a service role key e a chave da Anthropic são
digitadas no instalador (ou postas no `config.env` depois) e ficam só no
servidor, num arquivo que só administradores leem.

## Instalar

1. Copie a pasta `Prever-<versão>` inteira (ou extraia o `.zip`) para o
   servidor.
2. Execute `Instalar-Prever.exe` como administrador. Abre uma janela com:
   - **Porta** — a porta em que o sistema vai atender (padrão 8080). O
     instalador recusa porta em uso.
   - **Pasta de instalação** — padrão `C:\Prever`.
   - **Endereço do sistema (SITE_URL)** — como as pessoas vão abrir
     (`http://srv-prever:8081`, ou o nome DNS). Vai nos e-mails de convite e
     redefinição de senha.
   - **Chave service role** do Supabase — opcional; só é usada para
     **convidar usuários** pelo sistema (a tela Administrativo). Sem ela, tudo
     o mais funciona.
   - **Chave da Anthropic** — opcional; o assistente de criação rápida da
     Início e o da cobrança.
3. Instalar. O instalador: confere/instala o Node, copia o build para
   `<pasta>\app`, grava `<pasta>\config.env`, registra o serviço
   `PreverSistema` ("Prever — Sistema": automático, reinicia sozinho se cair,
   logs rotativos em `<pasta>\servico\`), libera a porta no Firewall do
   Windows e espera o sistema responder em `http://localhost:<porta>/`.

Por script (sem janela), para instalação automatizada:

```powershell
.\instalar.ps1 -Porta 8081 -Pasta "D:\Prever" -SiteUrl "http://srv-prever:8081" -SemInterface
```

## Depois de instalar — o Supabase precisa saber o endereço novo

Isto NÃO é SQL: é uma configuração do painel do Supabase, em **supabase.com**
(a Lovable é quem constrói e hospeda o site; o Supabase é onde moram o banco e
o login — o SQL Editor da Lovable é só uma janela para esse banco). Entre em
supabase.com com a conta da empresa, abra o projeto `jtyautqmftpwzinvhfck` e vá
em **Authentication → URL Configuration**:

- **Site URL** = o endereço do sistema (o mesmo SITE_URL);
- **Redirect URLs** += `http://<servidor>:<porta>/**`.

Sem isso, o link do e-mail de convite e o de "esqueci minha senha" voltam para
o endereço antigo (o da Lovable). Os dois endereços podem ficar na lista ao
mesmo tempo enquanto a Lovable estiver ligada.

## Onde fica cada coisa no servidor

```
C:\Prever\
  app\                       o build (trocado a cada atualização)
  config.env                 PORT, HOST, SITE_URL, chaves — só administradores leem
  iniciar.mjs                o serviço roda "node iniciar.mjs"
  servico\prever-servico.exe o WinSW
  servico\prever-servico.xml a definição do serviço (id, executável, logs, reinício)
  servico\*.out.log / *.err.log  os logs do sistema (rotação a 10 MB, 8 arquivos)
  atualizar.ps1 · desinstalar.ps1
```

Mudar a porta, a URL ou uma chave depois: edite o `config.env` e reinicie o
serviço (`Restart-Service PreverSistema`). Ou rode o instalador de novo — ele
atualiza no lugar e preserva as chaves que já estavam gravadas.

## Atualizar para uma versão nova

0. **Rode antes a migration que a versão exige** (SQL Editor) — está na
   entrada da versão em `docs/VERSOES.md` (a v0.0.2 exige a U119). O pacote
   não toca no banco, e o app sem a migration se defende, mas fica incompleto.
1. Gere o pacote novo (`npm run build:windows`) e leve a pasta ao servidor.
2. Na pasta de instalação, `.\atualizar.ps1 -Pacote "C:\Downloads\Prever-0.0.2"`
   (ou rode o `atualizar.ps1` de dentro do pacote novo: ele acha a `app\` ao
   lado). Ele para o serviço, troca a `app\`, preserva o `config.env` e sobe.
3. Migrations continuam sendo do Davi, à mão, no SQL Editor — o pacote não
   toca no banco.

## Desinstalar

`.\desinstalar.ps1` para e remove o serviço e a regra do firewall. Com
`-ApagarPasta` remove também a pasta (as chaves vão junto). O banco não é
tocado.

## Problemas comuns

- **"A porta N já está em uso"** — outro serviço escuta nela. Escolha outra;
  o sistema não tem porta fixa.
- **O serviço sobe e cai** — `servico\prever-servico.err.log`. As causas
  típicas: Node antigo (precisa 20+; `node --version`), `config.env` sem
  `SUPABASE_URL` (o instalador copia do `config.padrao.env` — confira que a
  pasta do pacote estava inteira), ou a `app\` incompleta.
- **Convite não sai / "Acesso negado" ao convidar** — falta a
  `SUPABASE_SERVICE_ROLE_KEY` no `config.env`, ou a conta não é admin.
- **O link do e-mail leva para o endereço errado** — a URL Configuration do
  Supabase (acima) e o `SITE_URL` do `config.env`.
- **HTTPS** — o serviço fala HTTP na porta interna. Para HTTPS, ponha um
  proxy reverso na frente (IIS com ARR/URL Rewrite, ou Caddy/nginx) apontando
  para `http://localhost:<porta>`, e use o endereço do proxy como SITE_URL.

## Como isto se relaciona com a Lovable

Nada muda no repositório para a Lovable: o `vite build` normal continua saindo
para Cloudflare e o push em `main` continua publicando lá. O pacote Windows é
**outro alvo do mesmo código** (`NITRO_PRESET=node-server`). Os dois podem
coexistir apontando para o mesmo Supabase; quando a casa decidir desligar a
Lovable, a ordem está em `ONBOARDING.md` §6 — e o passo 1 de lá (conferir que
o projeto Supabase é da empresa) vale ser feito antes de qualquer coisa.
