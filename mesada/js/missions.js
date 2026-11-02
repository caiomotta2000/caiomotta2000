/* Missões semanais da Lili: lições curtas + quiz de 3 perguntas (bilíngue).
 * Uma missão nova libera a cada semana desde a criação do perfil (o pai pode liberar todas).
 * answer = índice da opção correta. {name} = nome da criança. */
(function (g) {
  'use strict';
  g.MISSIONS = [
    {
      id: 'needs-wants', emoji: '🛒', color: '#ff7043',
      title: { pt: 'Necessidade x Desejo', en: 'Needs vs Wants' },
      slides: [
        { pt: '{name}, algumas coisas a gente PRECISA para viver bem: comida, água, roupa, remédio, escola.', en: '{name}, some things we NEED to live well: food, water, clothes, medicine, school.' },
        { pt: 'Outras coisas a gente DESEJA: um brinquedo novo, um doce, um jogo. Desejar é normal e gostoso!', en: 'Other things we WANT: a new toy, candy, a game. Wanting things is normal and fun!' },
        { pt: 'O segredo é cuidar primeiro das necessidades e depois escolher com calma os desejos. Pergunte sempre: "eu preciso ou eu quero?"', en: 'The secret is to take care of needs first, then calmly choose your wants. Always ask: "do I need it or do I want it?"' }
      ],
      quiz: [
        { q: { pt: 'Qual destes é uma NECESSIDADE?', en: 'Which of these is a NEED?' }, options: { pt: ['Figurinhas', 'Comida', 'Videogame'], en: ['Stickers', 'Food', 'Video game'] }, answer: 1 },
        { q: { pt: 'Um sorvete no fim de semana é...', en: 'An ice cream on the weekend is...' }, options: { pt: ['Um desejo', 'Uma necessidade', 'Um imposto'], en: ['A want', 'A need', 'A tax'] }, answer: 0 },
        { q: { pt: 'O que fazer primeiro com o dinheiro?', en: 'What should come first with money?' }, options: { pt: ['Comprar o brinquedo da moda', 'Cuidar do que é necessário', 'Gastar tudo logo'], en: ['Buy the trendy toy', 'Take care of what is needed', 'Spend it all right away'] }, answer: 1 }
      ]
    },
    {
      id: 'generosity', emoji: '💛', color: '#ffb300',
      title: { pt: 'Generosidade e Dízimo', en: 'Generosity and Tithe' },
      slides: [
        { pt: 'Tudo o que temos é um presente de Deus, {name}. Por isso separamos a primeira parte: 10% para o dízimo.', en: 'Everything we have is a gift from God, {name}. That is why we set aside the first part: 10% for the tithe.' },
        { pt: 'De cada R$ 10, R$ 1 vai para o dízimo. A gente separa ANTES de gastar, com alegria, e não o que sobra.', en: 'Out of every R$ 10, R$ 1 goes to the tithe. We set it aside BEFORE spending, cheerfully, not just what is left over.' },
        { pt: 'Ser generoso também é ajudar quem precisa, dividir o lanche, doar brinquedos. Quem dá com alegria fica com o coração cheio!', en: 'Being generous is also helping people in need, sharing your snack, donating toys. Cheerful givers have full hearts!' }
      ],
      quiz: [
        { q: { pt: 'Quanto da mesada vai para o dízimo?', en: 'How much of the allowance goes to the tithe?' }, options: { pt: ['10%', '50%', 'O que sobrar'], en: ['10%', '50%', 'Whatever is left'] }, answer: 0 },
        { q: { pt: 'Se você ganhar R$ 20, o dízimo é...', en: 'If you get R$ 20, the tithe is...' }, options: { pt: ['R$ 1', 'R$ 2', 'R$ 10'], en: ['R$ 1', 'R$ 2', 'R$ 10'] }, answer: 1 },
        { q: { pt: 'Qual é uma atitude generosa?', en: 'Which one is a generous action?' }, options: { pt: ['Dividir o lanche com um amigo', 'Esconder os brinquedos', 'Gastar tudo sozinho'], en: ['Sharing a snack with a friend', 'Hiding your toys', 'Spending everything on yourself'] }, answer: 0 }
      ]
    },
    {
      id: 'budget', emoji: '🫙', color: '#26a69a',
      title: { pt: 'Orçamento: os potes', en: 'Budget: the pots' },
      slides: [
        { pt: 'Orçamento é um plano para o dinheiro, {name}. Em vez de deixar tudo misturado, a gente divide em potes.', en: 'A budget is a plan for your money, {name}. Instead of mixing it all up, we split it into pots.' },
        { pt: 'Cada pote tem uma missão: dízimo, guardar, gastar, objetivos... Assim você sabe quanto pode gastar sem estragar seus planos.', en: 'Each pot has a job: tithe, save, spend, goals... That way you know how much you can spend without ruining your plans.' },
        { pt: 'Quando a mesada chega, o app divide sozinho. Se o pote de gastar acabou, a gente espera a próxima mesada. Isso é ter controle!', en: 'When the allowance arrives, the app splits it for you. If the spend pot is empty, we wait for the next allowance. That is being in control!' }
      ],
      quiz: [
        { q: { pt: 'O que é um orçamento?', en: 'What is a budget?' }, options: { pt: ['Um plano para o dinheiro', 'Um tipo de moeda', 'Uma loja'], en: ['A plan for money', 'A kind of coin', 'A store'] }, answer: 0 },
        { q: { pt: 'O pote de gastar ficou vazio. O que fazer?', en: 'The spend pot is empty. What should you do?' }, options: { pt: ['Pegar do dízimo', 'Esperar a próxima mesada', 'Pegar da emergência para um doce'], en: ['Take from the tithe', 'Wait for the next allowance', 'Take emergency money for candy'] }, answer: 1 },
        { q: { pt: 'Por que dividir em potes?', en: 'Why split money into pots?' }, options: { pt: ['Para saber quanto pode gastar em cada coisa', 'Para perder dinheiro', 'Porque é bonito'], en: ['To know how much you can spend on each thing', 'To lose money', 'Because it looks nice'] }, answer: 0 }
      ]
    },
    {
      id: 'compound-interest', emoji: '🌱', color: '#43a047',
      title: { pt: 'Juros compostos', en: 'Compound interest' },
      slides: [
        { pt: '{name}, quando você guarda dinheiro no Banco do Papai, ele te paga um "aluguel" pelo dinheiro: os JUROS.', en: '{name}, when you keep money in Daddy\'s Bank, it pays you "rent" for your money: that is INTEREST.' },
        { pt: 'Juros COMPOSTOS são juros sobre juros: no mês seguinte, os juros do mês passado também ganham juros. É como uma bola de neve!', en: 'COMPOUND interest is interest on interest: next month, last month\'s interest also earns interest. It is like a snowball!' },
        { pt: 'Quanto mais tempo o dinheiro fica guardado, mais rápido ele cresce. Paciência é o superpoder de quem investe!', en: 'The longer money stays saved, the faster it grows. Patience is the superpower of investors!' }
      ],
      quiz: [
        { q: { pt: 'O que são juros?', en: 'What is interest?' }, options: { pt: ['Um "aluguel" que o banco paga pelo seu dinheiro', 'Uma multa', 'Um brinquedo'], en: ['"Rent" the bank pays for your money', 'A fine', 'A toy'] }, answer: 0 },
        { q: { pt: 'Juros compostos são...', en: 'Compound interest is...' }, options: { pt: ['Juros sobre juros', 'Juros só uma vez', 'Dinheiro que some'], en: ['Interest on interest', 'Interest only once', 'Money that disappears'] }, answer: 0 },
        { q: { pt: 'O que faz o dinheiro crescer mais?', en: 'What makes money grow more?' }, options: { pt: ['Tirar toda semana', 'Deixar guardado por mais tempo', 'Esconder embaixo da cama'], en: ['Taking it out every week', 'Leaving it saved for longer', 'Hiding it under the bed'] }, answer: 1 }
      ]
    },
    {
      id: 'emergency-fund', emoji: '🛟', color: '#e53935',
      title: { pt: 'Reserva de emergência', en: 'Emergency fund' },
      slides: [
        { pt: 'Às vezes acontecem coisas que a gente não espera, {name}: um brinquedo quebra, o tênis rasga, aparece um gasto surpresa.', en: 'Sometimes unexpected things happen, {name}: a toy breaks, a sneaker tears, a surprise expense shows up.' },
        { pt: 'A reserva de emergência é um dinheiro guardado SÓ para imprevistos. A sua meta é juntar 3 mesadas.', en: 'An emergency fund is money saved ONLY for surprises. Your goal is to save 3 allowances.' },
        { pt: 'Quando a reserva fica completa, essa parte da mesada vai para o Banco do Papai render juros. Proteção primeiro, crescimento depois!', en: 'When the fund is complete, that share of the allowance goes to Daddy\'s Bank to earn interest. Protection first, growth next!' }
      ],
      quiz: [
        { q: { pt: 'Para que serve a reserva de emergência?', en: 'What is the emergency fund for?' }, options: { pt: ['Para imprevistos', 'Para comprar doces', 'Para o dízimo'], en: ['For surprises', 'To buy candy', 'For the tithe'] }, answer: 0 },
        { q: { pt: 'Qual é a meta da sua reserva?', en: 'What is your fund\'s goal?' }, options: { pt: ['1 mesada', '3 mesadas', '10 mesadas'], en: ['1 allowance', '3 allowances', '10 allowances'] }, answer: 1 },
        { q: { pt: 'Qual destes é uma emergência?', en: 'Which of these is an emergency?' }, options: { pt: ['Um jogo novo que lançou', 'A mochila da escola rasgou', 'Vontade de comer pipoca'], en: ['A new game came out', 'Your school backpack tore', 'Craving popcorn'] }, answer: 1 }
      ]
    },
    {
      id: 'goals', emoji: '🎯', color: '#8e24aa',
      title: { pt: 'Metas e sonhos', en: 'Goals and dreams' },
      slides: [
        { pt: 'Qual é o seu sonho, {name}? Uma bicicleta? Um LEGO grande? Quando você dá nome e preço a um sonho, ele vira uma META.', en: 'What is your dream, {name}? A bike? A big LEGO set? When you give a dream a name and a price, it becomes a GOAL.' },
        { pt: 'Uma boa meta tem: o que você quer, quanto custa e até quando. Aí dá para saber quanto guardar por semana.', en: 'A good goal has: what you want, how much it costs, and by when. Then you can work out how much to save each week.' },
        { pt: 'Cada moedinha colocada na meta te deixa mais perto. E quando chegar lá... festa! 🎉', en: 'Every coin you add to the goal brings you closer. And when you get there... party! 🎉' }
      ],
      quiz: [
        { q: { pt: 'O que uma boa meta precisa ter?', en: 'What does a good goal need?' }, options: { pt: ['O que, quanto custa e até quando', 'Só uma foto', 'Nada'], en: ['What, how much and by when', 'Just a photo', 'Nothing'] }, answer: 0 },
        { q: { pt: 'Um LEGO custa R$ 40 e você guarda R$ 10 por semana. Em quantas semanas consegue?', en: 'A LEGO set costs R$ 40 and you save R$ 10 a week. How many weeks will it take?' }, options: { pt: ['2 semanas', '4 semanas', '10 semanas'], en: ['2 weeks', '4 weeks', '10 weeks'] }, answer: 1 },
        { q: { pt: 'O que te aproxima da meta?', en: 'What brings you closer to your goal?' }, options: { pt: ['Gastar tudo em doces', 'Guardar um pouco sempre', 'Esquecer a meta'], en: ['Spending it all on candy', 'Saving a little all the time', 'Forgetting the goal'] }, answer: 1 }
      ]
    },
    {
      id: 'opportunity-cost', emoji: '⚖️', color: '#1e88e5',
      title: { pt: 'Custo de oportunidade', en: 'Opportunity cost' },
      slides: [
        { pt: '{name}, o dinheiro só pode ser gasto uma vez. Quando você escolhe uma coisa, deixa de ter outra.', en: '{name}, money can only be spent once. When you choose one thing, you give up another.' },
        { pt: 'Se você gastar R$ 10 em balas hoje, esses R$ 10 não vão mais para o seu LEGO. O LEGO que você deixou de ganhar é o CUSTO DE OPORTUNIDADE.', en: 'If you spend R$ 10 on candy today, that R$ 10 no longer goes to your LEGO. The LEGO you gave up is the OPPORTUNITY COST.' },
        { pt: 'Antes de comprar, pense: "do que eu vou abrir mão?" Às vezes vale a pena, às vezes é melhor esperar.', en: 'Before buying, think: "what am I giving up?" Sometimes it is worth it, sometimes it is better to wait.' }
      ],
      quiz: [
        { q: { pt: 'Custo de oportunidade é...', en: 'Opportunity cost is...' }, options: { pt: ['O que você deixa de ter quando escolhe outra coisa', 'O preço da etiqueta', 'Um desconto'], en: ['What you give up when you choose something else', 'The price on the tag', 'A discount'] }, answer: 0 },
        { q: { pt: 'Você tem R$ 10: figurinhas ou guardar para a bola. Se comprar figurinhas, o custo de oportunidade é...', en: 'You have R$ 10: stickers or save for a ball. If you buy stickers, the opportunity cost is...' }, options: { pt: ['As figurinhas', 'Chegar mais perto da bola', 'Nenhum'], en: ['The stickers', 'Getting closer to the ball', 'None'] }, answer: 1 },
        { q: { pt: 'Qual pergunta ajuda antes de comprar?', en: 'Which question helps before buying?' }, options: { pt: ['"Do que eu vou abrir mão?"', '"Qual é a cor?"', '"Quem comprou primeiro?"'], en: ['"What am I giving up?"', '"What color is it?"', '"Who bought it first?"'] }, answer: 0 }
      ]
    },
    {
      id: 'inflation', emoji: '🎈', color: '#f4511e',
      title: { pt: 'Inflação', en: 'Inflation' },
      slides: [
        { pt: 'Sabia, {name}, que as coisas costumam ficar mais caras com o tempo? Um picolé que custava R$ 3 pode passar a custar R$ 4.', en: 'Did you know, {name}, that things usually get more expensive over time? A popsicle that cost R$ 3 might later cost R$ 4.' },
        { pt: 'Isso se chama INFLAÇÃO: os preços sobem como um balão. Com o mesmo dinheiro, dá para comprar menos coisas.', en: 'That is called INFLATION: prices go up like a balloon. With the same money, you can buy fewer things.' },
        { pt: 'Por isso, dinheiro parado no cofrinho perde força. No Banco do Papai, os juros ajudam seu dinheiro a crescer mais que os preços!', en: 'That is why money sitting in a piggy bank loses power. In Daddy\'s Bank, interest helps your money grow faster than prices!' }
      ],
      quiz: [
        { q: { pt: 'O que é inflação?', en: 'What is inflation?' }, options: { pt: ['Quando os preços sobem com o tempo', 'Quando o balão estoura', 'Quando ganho mesada'], en: ['When prices go up over time', 'When a balloon pops', 'When I get my allowance'] }, answer: 0 },
        { q: { pt: 'Com inflação, o mesmo dinheiro compra...', en: 'With inflation, the same money buys...' }, options: { pt: ['Mais coisas', 'Menos coisas', 'As mesmas coisas sempre'], en: ['More things', 'Fewer things', 'Always the same things'] }, answer: 1 },
        { q: { pt: 'O que ajuda a proteger seu dinheiro da inflação?', en: 'What helps protect your money from inflation?' }, options: { pt: ['Deixar rendendo juros', 'Esconder no colchão', 'Rasgar as notas'], en: ['Letting it earn interest', 'Hiding it in the mattress', 'Tearing the bills'] }, answer: 0 }
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
