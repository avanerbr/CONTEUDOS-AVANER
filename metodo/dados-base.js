/* Central de Conteúdos AVANER — Método AVANER
   Dados-base: campanha, formatos, fases, lotes, bloqueios e banco de temas.
   Para mudar um texto aprovado, edite os arquivos dados-*.js e aumente a "versao" da peça. */
window.METODO = {
  campanha: {
    nome: 'Método AVANER',
    live: '2026-11-17',
    live_hora: '19h30',
    fim_condicao: '2026-11-27',
    inicio_reels: '2026-10-31',
    fim_reels: '2026-11-29',
    build: '2026.10.14-metodo-2',
    rodape_conformidade: 'Contemplação por sorteio ou lance. Condições conforme regulamento do grupo.'
  },

  fases: {
    1: { nome: 'Autoridade e curiosidade', periodo: '31/10 a 08/11', cta: 'Pergunta para comentar ou caixinha de perguntas. Sem convite.' },
    2: { nome: 'Aquecimento e inscrições', periodo: '09/11 a 16/11', cta: 'Menção leve à apresentação de 17/11, depois de entregar o conteúdo.' },
    3: { nome: 'Apresentação e conversão', periodo: '17/11 a 27/11', cta: 'Diagnóstico como opção, nunca como pressão.' },
    4: { nome: 'Conteúdo permanente', periodo: 'a partir de 28/11', cta: 'Caixinha de perguntas e seguir o perfil.' }
  },

  formatos: {
    1: { nome: 'Pergunta e resposta', dica: 'Responda uma dúvida concreta olhando para a câmera. Sem pergunta registrada, a tela diz “dúvida comum”.' },
    2: { nome: 'Conta na mesa', dica: 'Quadro branco ou simulação. Sempre com custo total, prazo e cenário desfavorável.' },
    3: { nome: 'Reação', dica: 'Reaja a uma frase ou afirmação, sem identificar pessoas e sem repostar vídeo de terceiros.' },
    4: { nome: 'Conversa estilo podcast', dica: 'Jamille ou Guilherme pergunta com as próprias palavras. Conversa real, não encenada.' },
    5: { nome: 'Bastidor espontâneo', dica: 'Câmera na mão, situação real do escritório. Nada de cliente identificado.' },
    6: { nome: 'Comparação lado a lado', dica: 'Duas alternativas na tela, com vantagens, custos e limitações de cada uma.' },
    7: { nome: 'Mito e verdade', dica: 'Frase forte no começo, esclarecimento com opinião firme. Sem atacar pessoas.' },
    8: { nome: 'Demonstração prática', dica: 'Gravação de tela com o rosto no canto. Dados fictícios marcados como exemplo.' },
    9: { nome: 'História de cliente', dica: 'Só caso real, com autorização por escrito e números conferidos.' },
    10: { nome: 'Opinião direta', dica: 'Fala direta, sentado ou andando, sem trocar de cena. No carro, só estacionado.' }
  },

  lotes: {
    L1: { nome: 'Lote 1', criterio: 'Atemporais e sem pendência de número ou caso', quando: 'Quando a central estiver no ar', extras: ['B03', 'B07'] },
    L2: { nome: 'Lote 2', criterio: 'Dependem de números oficiais e estratégias validadas', quando: 'Depois de liberar N1, N2 e E1', extras: ['B05', 'B09', 'B14'] },
    L3: { nome: 'Lote 3', criterio: 'Convites, prova e aquecimento', quando: 'Semana de 09/11' },
    L4: { nome: 'Lote 4', criterio: 'Cortes da live e perguntas recebidas', quando: '17 a 19/11' }
  },

  /* Bloqueios e pendências.
     severidade "bloqueio": a peça não pode ser marcada como aprovada, gravada ou publicada.
     severidade "publicacao": a peça pode ser aprovada, gravada e editada, mas não publicada.
     severidade "atencao": a peça pode seguir, mas mostra o aviso até a confirmação. */
  pendencias: [
    { id: 'N1', severidade: 'bloqueio', assunto: 'Números oficiais do grupo para as simulações',
      falta: 'Grupo escolhido (cerca de R$ 150 mil), taxa de administração total, fundo de reserva, seguro (se houver), prazo, parcela antes e depois da contemplação, regras de lance e data da tabela.',
      responsavel: 'Michael', alternativa: 'Usar a versão conceitual do roteiro, sem números, indicada na própria peça.' },
    { id: 'N2', severidade: 'bloqueio', assunto: 'Simulação real de financiamento bancário com data',
      falta: 'Simulação impressa de um banco, no mesmo valor e na mesma data da simulação do consórcio: entrada, prazo, parcela inicial, juros e encargos totais (CET).',
      responsavel: 'Michael', alternativa: 'Comparar só os componentes (entrada, juros, prazo, tempo até o bem), sem valores.' },
    { id: 'E1', severidade: 'bloqueio', assunto: 'Estratégias validadas para cartas de cerca de R$ 150 mil',
      falta: 'Quais mecanismos funcionam de verdade com a carta média da AVANER: compra de imóvel para aluguel, uso de crédito planejado pela empresa, negociação de carta contemplada. Grupos, valores e prazos disponíveis.',
      responsavel: 'Michael', alternativa: 'Falar só de critérios de decisão, sem prometer o que a carta compra.' },
    { id: 'C1', severidade: 'bloqueio', assunto: 'Caso real 1 autorizado',
      falta: 'Cliente real que autorize por escrito o uso da história e dos números, com os números conferidos com ele.',
      responsavel: 'Michael e Jamille', alternativa: 'Trocar pelo M16 (reserva) ou por bastidor real do escritório.' },
    { id: 'C2', severidade: 'bloqueio', assunto: 'Caso real 2 autorizado',
      falta: 'Segundo cliente real, de preferência um caso em que o diagnóstico mudou a decisão, com autorização por escrito.',
      responsavel: 'Michael e Jamille', alternativa: 'Peça reserva: se não houver caso, não publicar.' },
    { id: 'P1', severidade: 'bloqueio', assunto: 'Serviços e telas do Portal confirmados',
      falta: 'Confirmar que já são entregues hoje: plano por escrito, acompanhamento mensal da cota e revisão da estratégia de lance, atendimento da Jamille, apoio na compra do imóvel e na negociação da carta contemplada, e as telas citadas do Portal (cotas, parcelas, posição, histórico). Conta de demonstração com dados fictícios.',
      responsavel: 'Michael', alternativa: 'Tirar da fala qualquer item que ainda não exista na operação.' },
    { id: 'K1', severidade: 'atencao', assunto: 'Resposta automática por palavra-chave no direct',
      falta: 'Automação funcionando para as palavras CONTA e PLANO e material de resposta pronto (simulação ilustrativa, convite para o diagnóstico ou link da apresentação).',
      responsavel: 'Guilherme', alternativa: 'Usar o CTA “me chama no direct que eu faço essa conta com você”.' },
    { id: 'F1', severidade: 'atencao', assunto: 'Fonte da frase atribuída a Warren Buffett',
      falta: 'Fonte verificável da frase “Regra número 1: nunca perca dinheiro. Regra número 2: nunca esqueça a regra número 1”, para citar no rodapé.',
      responsavel: 'Guilherme', alternativa: 'O roteiro principal já usa o gancho A, sem a frase do Buffett. A frase só entra no gancho B.' },
    { id: 'B1', severidade: 'atencao', assunto: 'Telas atuais do site do Banco Central',
      falta: 'Conferir o caminho atual da consulta de instituições autorizadas no site do Banco Central antes de gravar a tela.',
      responsavel: 'Guilherme', alternativa: '' },
    { id: 'J1', severidade: 'bloqueio', assunto: 'Regras de desistência e reajuste nos contratos HS e Yamaha',
      falta: 'Conferir nos contratos das administradoras representadas como funciona a devolução na desistência e o índice de reajuste, para a fala não contrariar o contrato.',
      responsavel: 'Michael', alternativa: 'Dizer só “vale o que está no contrato” sem detalhar.' },
    { id: 'T1', severidade: 'bloqueio', assunto: 'Condição da turma fundadora aprovada',
      falta: 'Texto final da condição (prioridade de agenda em 72h, 4 revisões trimestrais de até 30 min, acesso ao Clube) e custo por contrato aprovado.',
      responsavel: 'Michael', alternativa: 'Falar do prazo de 27/11 sem detalhar a condição.' },
    { id: 'V1', severidade: 'bloqueio', assunto: 'Gravação da live salva e cortes aprovados',
      falta: 'Arquivo da live de 17/11 salvo, trechos escolhidos e aprovados por Michael.',
      responsavel: 'Guilherme', alternativa: '' },
    { id: 'D1', severidade: 'publicacao', assunto: 'Página da apresentação e inscrição funcionando',
      falta: 'Landing page corrigida com a data 17/11 às 19h30, sem placeholder, com selo de crédito comprovado, botões funcionando e lead teste chegando ao CRM e ao grupo.',
      responsavel: 'Guilherme', alternativa: '' },
    { id: 'D2', severidade: 'publicacao', assunto: 'Agenda e formulário do diagnóstico funcionando',
      falta: 'Formulário de 6 perguntas, agenda com horários abertos de 18 a 27/11 e regra de encaminhamento entre diagnóstico completo e atendimento prioritário.',
      responsavel: 'Michael e Jamille', alternativa: '' },
    { id: 'D3', severidade: 'publicacao', assunto: 'Página da aula permanente',
      falta: 'Página com a gravação editada da live, cadastro e convite para o diagnóstico no final.',
      responsavel: 'Guilherme', alternativa: '' },
    { id: 'H1', severidade: 'atencao', assunto: 'Respostas prontas para críticas à administradora',
      falta: 'Respostas preparadas para comentários que chamam administradoras de “furada”, antes de publicar o vídeo sobre meia parcela.',
      responsavel: 'Michael', alternativa: '' },
    { id: 'Q1', severidade: 'bloqueio', assunto: 'Pergunta real registrada',
      falta: 'Pergunta real recebida (live, stories ou atendimento), registrada com data e autorização para usar sem identificar.',
      responsavel: 'Jamille', alternativa: 'Apresentar como “dúvida comum”, sem dizer que alguém perguntou.' },
    { id: 'A1', severidade: 'bloqueio', assunto: 'Anos de mercado confirmados',
      falta: 'Número de anos de atuação do Michael em consórcio que possa ser comprovado.',
      responsavel: 'Michael', alternativa: 'Usar o gancho B, sem número de anos.' },
    { id: 'R1', severidade: 'atencao', assunto: 'Frases que dependem de experiência real',
      falta: 'Michael confirmar que as frases marcadas “(só se for verdade)” descrevem a rotina real. Se não, a frase sai antes de gravar.',
      responsavel: 'Michael', alternativa: 'Cortar a frase marcada.' }
  ],

  /* Banco editorial: temas extras, sem roteiro completo nesta etapa. */
  extras: [
    { id: 'B01', tema: 'Decisão por impulso', gancho: 'A decisão de dinheiro mais cara é a que você toma em cinco minutos.', formato: 10, uso: 'Alcance', prioridade: false, deps: [] },
    { id: 'B02', tema: 'O carro financiado', gancho: 'Quanto custou de verdade o carro que você financiou em cinco anos?', formato: 2, uso: 'Alcance e anúncio', prioridade: false, deps: ['N2'] },
    { id: 'B03', tema: 'Empresário que paga aluguel da própria sede', gancho: 'Tem empresário pagando aluguel há dez anos de um imóvel que podia ser dele.', formato: 10, uso: 'Qualificação de empresário', prioridade: true, deps: ['E1'] },
    { id: 'B04', tema: 'Lance embutido sem enrolação', gancho: 'Lance embutido em quarenta segundos.', formato: 2, uso: 'Quem já tem cota', prioridade: false, deps: ['N1'] },
    { id: 'B05', tema: 'Promessa de rendimento com consórcio', gancho: 'Se alguém te disser que consórcio rende 3% ao mês, falta uma informação importante aí.', formato: 3, uso: 'Autoridade', prioridade: true, deps: [] },
    { id: 'B06', tema: 'E se a parcela subir?', gancho: 'E se a parcela subir no meio do caminho?', formato: 1, uso: 'Qualificação', prioridade: false, deps: ['J1'] },
    { id: 'B07', tema: 'Três perguntas antes de assinar', gancho: 'Três perguntas pra fazer antes de assinar qualquer consórcio.', formato: 10, uso: 'Salvamentos e anúncio', prioridade: true, deps: [] },
    { id: 'B08', tema: 'Planta, pronto ou carta', gancho: 'Imóvel na planta, pronto ou carta de consórcio? Os três na mesma tela.', formato: 6, uso: 'Autoridade', prioridade: false, deps: ['N1', 'E1'] },
    { id: 'B09', tema: 'Quanto sobra do aluguel de verdade', gancho: 'Quanto rende o aluguel depois de vacância, condomínio, IPTU e manutenção?', formato: 2, uso: 'Autoridade', prioridade: true, deps: ['N1'] },
    { id: 'B10', tema: 'O que a Jamille mais escuta', gancho: 'Jamille, qual é a dúvida que você mais escuta de quem já tem consórcio?', formato: 4, uso: 'Confiança', prioridade: false, deps: ['Q1'] },
    { id: 'B11', tema: 'Bastidor real de um “não”', gancho: 'Acabei de sair de uma reunião em que eu não recomendei a carta maior.', formato: 5, uso: 'Autoridade', prioridade: false, deps: ['R1'] },
    { id: 'B12', tema: 'Frase real de empresário conhecido', gancho: 'Frase pública sobre crédito, imóvel ou caixa, com fonte.', formato: 3, uso: 'Alcance', prioridade: false, deps: ['F1'] },
    { id: 'B13', tema: 'Patrimônio em casal', gancho: 'Planejamento patrimonial que só um dos dois conhece não é planejamento.', formato: 10, uso: 'Identificação', prioridade: false, deps: [] },
    { id: 'B14', tema: 'Planejamento para médicos e profissionais liberais', gancho: 'Médico ganha bem e tem pouco tempo. Por isso precisa de um plano diferente.', formato: 10, uso: 'Qualificação de profissional liberal', prioridade: true, deps: [] },
    { id: 'B15', tema: 'Crédito para a empresa', gancho: 'Sede, frota, máquina: quando o crédito planejado faz sentido pra empresa.', formato: 6, uso: 'Qualificação de empresário', prioridade: false, deps: ['E1'] },
    { id: 'B16', tema: 'Goiânia, parte 2', gancho: 'O que o goiano mais me pergunta sobre imóvel.', formato: 1, uso: 'Alcance local', prioridade: false, deps: ['Q1'] }
  ],

  /* Histórico de versões da biblioteca. */
  historico: [
    { versao: '1.0', data: '2026-10-13', nota: 'Biblioteca completa: 30 Reels, 14 anúncios e 16 temas extras, com os ajustes das revisões de M01, M03, M07, M14, M23 e M26.' },
    { versao: '1.1', data: '2026-10-13', nota: 'Auditoria: M11 v1.2 (sorteio condicionado a pagamentos em dia e ao regulamento; depende também de P1), M17 passa a depender de P1, B05 sem “vi uma pessoa”, P1 inclui apoio na compra e na negociação da carta.' },
    { versao: '1.2', data: '2026-10-14', nota: 'Build metodo-2: regras de bloqueio também no banco, aprovador para versão segura e liberação de pendências, sincronização com checagem de versão. Nenhum roteiro alterado.' }
  ],

  reels: [],
  ads: []
};
