# Changelog / Novidades

Formato: [SemVer](https://semver.org/lang/pt-BR/). A tela "Novidades" do app lê `js/version.js`.

## v1.1.0 — 2026-11-02

**PT-BR**
- Sincronização na nuvem (Firebase, plano gratuito): conta da família com e-mail e senha, criada na Área do pai → "Sincronizar / Sync"; o mesmo login no iPad das crianças e no iPhone do pai.
- Atualização em tempo real entre os aparelhos (onSnapshot).
- Local-first: o localStorage continua sendo o cache; o app funciona offline e sem conta. O SDK do Firebase só é baixado (CDN gstatic, v12.6.0) quando a sincronização está ligada.
- Conflitos sem perda: merge de 3 vias por entidade — saldos somam as diferenças dos dois aparelhos, listas mesclam por id, histórico só acrescenta (por id), demais campos "último a gravar vence" com `updatedAt`. Juros do mesmo mês creditados em dois aparelhos contam uma vez.
- Firestore: `families/{uid}` (ajustes), `children/{id}` (cada filho, sem histórico), `history/{filho}_{AAAA-MM}` (histórico por mês), `photos/{id}` (fotos dos objetivos) — nenhum documento passa de 1 MB.
- Primeiro login com dados nos dois lados: pergunta se usa a nuvem (padrão) ou substitui pela do aparelho; cópia de segurança local guardada.
- Status da sincronização na Área do pai e ícone de nuvem no topo.
- Link de redefinição de senha da conta da família; "Esqueci a senha do pai" usando a senha da conta da família.
- Regras do Firestore em `firestore.rules`.
- Testes: `tests/sync.test.js` (merge + dois aparelhos com nuvem falsa) e e2e de sincronização com nuvem simulada.

**EN**
- Cloud sync (Firebase, free plan): one family account (email + password), created in Parent area → "Sincronizar / Sync"; same login on the kids' iPad and Dad's iPhone.
- Real-time updates between devices (onSnapshot).
- Local-first: localStorage stays the cache; the app works offline and without an account. The Firebase SDK is only downloaded (gstatic CDN, v12.6.0) when sync is on.
- Lossless conflicts: per-entity 3-way merge — balances add both devices' deltas, lists merge by id, history is append-only (by id), other fields last-write-wins with `updatedAt`. Interest for the same month credited on two devices counts once.
- Firestore: `families/{uid}` (settings), `children/{id}` (each child, no history), `history/{child}_{YYYY-MM}` (monthly history), `photos/{id}` (goal photos) — no document exceeds 1 MB.
- First sign-in with data on both sides asks whether to use the cloud (default) or replace it with this device's data; a local safety copy is kept.
- Sync status in the Parent area and a cloud icon in the header.
- Family account password-reset link; "Forgot the parent password" using the family account password.
- Firestore security rules in `firestore.rules`.
- Tests: `tests/sync.test.js` (merge + two devices against a fake cloud) and a sync e2e against a mocked cloud.

## v1.0.0 — 2026-11-02

**PT-BR**
- Primeira versão do app de mesada.
- Perfis por filho (nome, avatar, cor, PIN opcional, idioma próprio PT/EN).
- Tipos de app: Simples (Dízimo 10%, Guardar, Gastar) e Completo (Dízimo 10%, Emergência, Banco do Papai, Objetivos, Livre — padrão 10/10/30/30/20).
- Área do pai com senha: mesada e porcentagens por filho, tarefas padrão (reduzem a mesada proporcionalmente se não feitas) e extras (renda extra com a mesma divisão), pagamento com divisão automática, ajuste de saldos, histórico completo, taxas do banco.
- Banco do Papai: liquidez diária 1% a.m., travado 3 meses 2% a.m., travado 6 meses 2,5% a.m., juros compostos mensais, resgate antecipado perde os juros, gráfico de projeção.
- Reserva de emergência com meta de 3 mesadas; ao completar, a parte dela vai para o Banco do Papai.
- Objetivos com foto, valor, prazo, barra de progresso e comemoração.
- 8 missões semanais da coruja Lili com quiz de 3 perguntas e medalhas.
- Backup JSON (exportar/importar); PWA offline.

**EN**
- First release of the allowance app.
- Per-child profiles (name, avatar, color, optional PIN, own PT/EN language).
- App types: Simple (Tithe 10%, Save, Spend) and Complete (Tithe 10%, Emergency, Daddy's Bank, Goals, Free — default 10/10/30/30/20).
- Password-protected parent area: per-child allowance and split, standard chores (missed ones reduce the allowance proportionally) and extra chores (extra income, same split), automatic split on payment, balance adjustment, full history, bank rates.
- Daddy's Bank: daily liquidity 1%/month, locked 3 months 2%/month, locked 6 months 2.5%/month, monthly compounding, early withdrawal forfeits interest, projection chart.
- Emergency fund goal of 3 allowances; once full, its share goes to Daddy's Bank.
- Goals with photo, amount, deadline, progress bar and celebration.
- 8 weekly missions with Lili the owl, 3-question quizzes and medals.
- JSON backup (export/import); offline PWA.
