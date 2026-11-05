# Mesada da Lili — v1.1.0

App de mesada (PWA) para iPad (filhos) e iPhone (pai). HTML/CSS/JS puro, **sem build**.

## Rodar localmente
```bash
cd app
python3 -m http.server 8080
# abrir http://localhost:8080
```
(Precisa de um servidor: o service worker e a criptografia da senha não funcionam via `file://`.)

No iPad/iPhone (Safari): Compartilhar → **Adicionar à Tela de Início**.

## Estrutura
| Arquivo | O que faz |
|---|---|
| `index.html` | Casca do app, carrega os scripts em ordem |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA (instalação + offline) |
| `css/app.css` | Todo o visual (responsivo iPad paisagem/retrato e iPhone) |
| `js/version.js` | `APP_VERSION` + CHANGELOG bilíngue (tela Novidades) |
| `js/i18n.js` | Dicionário PT-BR/EN, formatação de dinheiro e datas |
| `js/logic.js` | Regras de negócio puras (centavos inteiros): divisão, tarefas, emergência, banco, objetivos, medalhas |
| `js/missions.js` | 8 missões da Lili (lições + quiz) |
| `js/lili.js` | Coruja Lili em SVG inline |
| `js/store.js` | **Único** ponto de persistência (localStorage = cache local-first) + export/import; carimba `updatedAt` por entidade |
| `js/sync-core.js` | Núcleo puro da sincronização: formato na nuvem, merge de 3 vias, histórico por id, fotos |
| `js/sync.js` | Controlador da sincronização (conta da família, tempo real, offline, status) |
| `js/firebase-config.js` | Config pública do app Web Firebase (`mesada-lili`) |
| `js/adapters/firestore-adapter.js` | Transporte Firebase Auth + Firestore (SDK v12.6.0 carregado do gstatic sob demanda) |
| `firestore.rules` | Regras de segurança do Firestore (colar no console) |
| `js/ui.js` | Modais, toasts, confete, contagem animada, redução de fotos, hash |
| `js/app.js` | Telas e ações |
| `tests/` | `logic.test.js`, `sync.test.js`, `i18n_check.js` (Node); `e2e.py`, `e2e_sync.py` (Playwright + Chromium, nuvem simulada); `mock-adapter.js`; `live_smoke.py` (opcional, Firebase real, não cria nada); `make_icons.py` |
| `screenshots/` | Capturas geradas pelo e2e |

## Regras principais
- Valores em centavos. Dízimo sempre 10% (arredondado); sobra de centavos vai para o último pote.
- Mesada a pagar = mesada × (tarefas padrão feitas ÷ previstas no mês). O pai pode editar o valor antes de pagar.
- Emergência: meta = 3 × mesada; o que passar da meta vai para o Banco do Papai.
- Banco: conta com liquidez diária recebe juros no dia 1º de cada mês sobre o saldo daquele momento (compostos). Aplicações travadas rendem por mês cheio completado, com a taxa do dia da aplicação; resgate antes do prazo devolve só o valor aplicado.
- Missões: uma nova por semana desde a criação do perfil (o pai pode liberar todas). Medalha com ≥2 acertos (prata) e 3 acertos (ouro).
- Trocar tipo Simples ↔ Completo preserva o total (Guardar→Objetivos, Gastar→Livre; e no sentido inverso Emergência+Objetivos+Banco→Guardar, Livre→Gastar, aplicações resgatadas sem multa).

## Testes
```bash
node tests/logic.test.js
node tests/sync.test.js        # merge + dois aparelhos contra nuvem falsa
node tests/i18n_check.js
pip install playwright && python3 tests/e2e.py && python3 tests/e2e_sync.py   # usa /usr/bin/chromium
python3 tests/live_smoke.py    # opcional: Firebase real, sem criar contas
```

## Sincronização na nuvem (v1.1)
- **Uma conta da família** (Firebase Auth, e-mail/senha). Área do pai → "Sincronizar / Sync": *Criar conta da família* no primeiro aparelho; *Entrar* nos outros (iPad das crianças, iPhone do pai).
- **Local-first**: o localStorage continua sendo a fonte local; sem conta, nenhuma chamada de rede (nem o SDK é baixado). Offline, as mudanças ficam marcadas e sobem quando a conexão volta.
- **Firestore** (`southamerica-east1`):
  - `families/{uid}` → `{ v, data: JSON(ajustes gerais + ordem dos filhos), by, appVersion, updatedAt }`
  - `families/{uid}/children/{childId}` → `{ data: JSON(filho sem histórico; fotos como "cloudphoto:<id>") }`
  - `families/{uid}/history/{childId}_{AAAA-MM}` → `{ childId, month, entries: { [id]: JSON } }` (só acrescenta, `set` com merge)
  - `families/{uid}/photos/{id}` → `{ data: dataURL, createdAt }` (id = hash do conteúdo)
- **Conflitos** (merge de 3 vias, base = última versão da nuvem que o aparelho conhece, dentro de uma transação): saldos somam as diferenças; listas por id (apagar vence); demais campos "último a gravar vence" pelo `updatedAt` da entidade; histórico é união por id; juros do mesmo mês contam uma vez.
- Ficam **só no aparelho**: idioma da tela inicial/área do pai e "última versão vista".
- **Regras**: publicar `firestore.rules` no console do Firebase (Firestore → Regras).
- **Senha do pai esquecida**: "Esqueci a senha do pai" na tela de senha → confirma a senha da conta da família → nova senha (vale em todos os aparelhos). Senha da conta: link por e-mail (`sendPasswordResetEmail`).

## Lançar nova versão
1. `js/version.js`: `APP_VERSION` + entrada no topo do `CHANGELOG`.
2. `CHANGELOG.md`.
3. `sw.js`: `CACHE_NAME`.
4. `git commit` + `git tag vX.Y.Z`.
