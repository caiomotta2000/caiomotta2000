/* Versão do app + Novidades (CHANGELOG bilíngue).
 * Ao lançar uma nova versão: atualize APP_VERSION, adicione uma entrada no topo de CHANGELOG,
 * atualize CHANGELOG.md, mude CACHE_NAME em sw.js e crie a tag git (ex.: v1.1.0). */
(function (g) {
  g.APP_VERSION = '1.2.0';
  g.CHANGELOG = [
    {
      version: '1.2.0',
      date: '2026-11-04',
      pt: [
        'Agora você vê suas tarefas! ✅ Na tela inicial aparece "Minhas tarefas", com estrelinhas para cada vez que o papai marcou uma tarefa feita.',
        'Mostra quanto da mesada você já garantiu e as tarefas extras para ganhar mais.'
      ],
      en: [
        'Now you can see your chores! ✅ The home screen shows "My chores", with a star for each time Dad marked a chore as done.',
        'It shows how much of your allowance you have earned so far, and the extra chores to earn more.'
      ]
    },
    {
      version: '1.1.0',
      date: '2026-11-02',
      pt: [
        'Sincronização na nuvem! ☁️ Na Área do pai, em "Sincronizar / Sync", crie a conta da família (e-mail e senha) e entre com ela no iPad das crianças e no celular do pai.',
        'Tudo que muda num aparelho aparece no outro em segundos.',
        'Continua funcionando sem internet: as mudanças ficam guardadas e sobem quando a conexão voltar. Se os dois aparelhos mexerem ao mesmo tempo, nada se perde (saques, pagamentos e lançamentos dos dois lados valem).',
        'Fotos dos objetivos também sincronizam.',
        'Ícone de nuvem no topo mostra se está sincronizado, sem internet ou com erro.',
        'Esqueceu a senha do pai? Agora dá para criar uma nova usando a senha da conta da família. E a senha da conta pode ser trocada por um link no e-mail.'
      ],
      en: [
        'Cloud sync! ☁️ In the Parent area, under "Sincronizar / Sync", create the family account (email and password) and sign in with it on the kids\' iPad and on Dad\'s phone.',
        'Anything that changes on one device shows up on the other within seconds.',
        'It still works offline: changes are saved and upload when the connection is back. If both devices change things at the same time, nothing is lost (withdrawals, payments and entries from both sides count).',
        'Goal photos sync too.',
        'A cloud icon at the top shows whether it is synced, offline or has an error.',
        'Forgot the parent password? You can now set a new one using the family account password. And the account password can be changed through an email link.'
      ]
    },
    {
      version: '1.0.0',
      date: '2026-11-02',
      pt: [
        'Primeira versão do app de mesada! 🎉',
        'Perfis para cada filho com avatar, PIN opcional e idioma próprio (Português/English).',
        'Dois tipos de app: Simples (Dízimo, Guardar, Gastar) e Completo (Dízimo, Emergência, Banco do Papai, Objetivos, Livre).',
        'Área do pai com senha: mesada, porcentagens, tarefas padrão e extras, pagamento com divisão automática nos potes e histórico completo.',
        'Banco do Papai com liquidez diária e aplicações travadas de 3 e 6 meses, juros compostos mensais e gráfico de projeção.',
        'Objetivos com foto, valor, prazo, barra de progresso e comemoração.',
        'Reserva de emergência com meta de 3 mesadas.',
        'Missões semanais da coruja Lili com quiz e medalhas.',
        'Backup em arquivo (exportar/importar) e funciona offline como app na tela inicial.'
      ],
      en: [
        'First version of the allowance app! 🎉',
        'A profile for each child with avatar, optional PIN and their own language (Português/English).',
        'Two app types: Simple (Tithe, Save, Spend) and Complete (Tithe, Emergency, Daddy\'s Bank, Goals, Free).',
        'Password-protected parent area: allowance, percentages, standard and extra chores, payments split automatically into pots, and full history.',
        'Daddy\'s Bank with daily liquidity and 3- and 6-month locked deposits, monthly compound interest and a projection chart.',
        'Goals with photo, amount, deadline, progress bar and celebration.',
        'Emergency fund with a goal of 3 allowances.',
        'Weekly missions with Lili the owl, quizzes and medals.',
        'File backup (export/import) and works offline as a home-screen app.'
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
