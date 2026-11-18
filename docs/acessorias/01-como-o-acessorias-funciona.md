# Como o Acessórias funciona

Este documento descreve, módulo por módulo, como funciona o Acessórias, o sistema de gestão de escritórios contábeis que serve de referência para o NADS. Também mostra o fluxo do dia a dia, do nascimento de uma obrigação até a leitura pelo cliente e o tratamento do atraso, e termina com o que os usuários elogiam e reclamam. Ele serve de base para os próximos documentos desta pasta, que comparam o Acessórias com o NADS e planejam o que fazer. Quem for implementar algo no NADS deve ler este arquivo para entender a ideia de funcionamento. Pela regra 12 do projeto, não se copiam textos, marca nem telas do Acessórias: no NADS usamos só a ideia, com nomes e textos próprios.

**Como ler**

- Tudo aqui foi levantado em 17/11/2026 em fontes públicas: a central de ajuda (https://acessorias.movidesk.com/kb), o site (https://acessorias.com/site/), a documentação da API (https://api.acessorias.com/documentation), o canal do YouTube, o Reclame Aqui, o fórum Contábeis e as lojas de aplicativo. As telas do sistema logado **não** foram vistas. A descrição vem do texto dos artigos e da transcrição dos vídeos.
- Quando as fontes divergem ou não dizem nada, o texto marca **"a confirmar"**.
- Endereço curto: `.../article/NNNNNN` é igual a `https://acessorias.movidesk.com/kb/pt-br/article/NNNNNN`. Nas tabelas, a coluna "Fonte" traz sempre o endereço completo.
- Termos do Acessórias que aparecem muito: **demanda** ou **entrega** (uma obrigação de uma empresa numa competência), **baixa** (marcar como entregue), **dispensa** (tirar a demanda daquele mês), **prazo técnico** (quando o lembrete começa) e **prazo legal** (data-limite interna).

---

## Sumário

1. [Visão geral do produto](#1-visão-geral-do-produto)
2. [Usuários e permissões](#2-usuários-e-permissões)
3. [Segurança de acesso](#3-segurança-de-acesso)
4. [Painel e indicadores](#4-painel-e-indicadores)
5. [Departamentos](#5-departamentos)
6. [Configurações gerais e e-mail](#6-configurações-gerais-e-e-mail)
7. [Empresas e contatos](#7-empresas-e-contatos)
8. [Regimes tributários e grupos](#8-regimes-tributários-e-grupos)
9. [Obrigações e agenda de prazos](#9-obrigações-e-agenda-de-prazos)
10. [Lista de Entregas](#10-lista-de-entregas)
11. [Robô de leitura de guias e pastas (e-Contínuo)](#11-robô-de-leitura-de-guias-e-pastas-e-contínuo)
12. [Envio ao cliente e protocolo digital](#12-envio-ao-cliente-e-protocolo-digital)
13. [E-mails agendados (envio agrupado)](#13-e-mails-agendados-envio-agrupado)
14. [AC Notifica e WhatsApp (Komunic, Digisac)](#14-ac-notifica-e-whatsapp-komunic-digisac)
15. [Gestão de Processos](#15-gestão-de-processos)
16. [Solicitações](#16-solicitações)
17. [AC Docs (cobrança de documentos) e GED](#17-ac-docs-cobrança-de-documentos-e-ged)
18. [Certificados (AC Certifica) e certidões](#18-certificados-ac-certifica-e-certidões)
19. [Portal e app do cliente (Área VIP e Aplicativo)](#19-portal-e-app-do-cliente-área-vip-e-aplicativo)
20. [Pesquisa de satisfação (NPS)](#20-pesquisa-de-satisfação-nps)
21. [Relatórios e indicadores de desempenho](#21-relatórios-e-indicadores-de-desempenho)
22. [Administrativo, honorários e Método APLA](#22-administrativo-honorários-e-método-apla)
23. [Integrações, API e MCP](#23-integrações-api-e-mcp)
24. [Planos e preços](#24-planos-e-preços)
25. [Suporte, implantação, LGPD e saída](#25-suporte-implantação-lgpd-e-saída)
26. [Fluxo do dia a dia, de ponta a ponta](#26-fluxo-do-dia-a-dia-de-ponta-a-ponta)
27. [O que os usuários elogiam e reclamam](#27-o-que-os-usuários-elogiam-e-reclamam)
28. [O que ficou sem confirmação](#28-o-que-ficou-sem-confirmação)

---

## 1. Visão geral do produto

O Acessórias é uma plataforma web de **gestão operacional** para escritórios contábeis. A empresa é de Belo Horizonte, fundada em 2018/2019, e diz ter mais de 10.000 escritórios clientes (artigo de 11/2026). O sistema controla prazos de obrigações, tarefas, processos, documentos, a entrega ao cliente e o atendimento. **Ele não apura imposto, não escritura, não lê extrato e não busca guia em portal do governo.** Cobre a etapa que vai da guia pronta, gerada em outro sistema, até a confirmação de que o cliente abriu.

| Item | Como é | Fonte |
|---|---|---|
| O que é e o que não é | Camada de gestão entre o sistema contábil e o cliente; não calcula tributo | https://acessorias.com/site/sistema-acessorias-contabil/ ; https://acessorias.com/site/quem-somos/ |
| Funcionalidades anunciadas (13) | Acessórias Docs, Komunic, Acessórias MCP, Aplicativo Personalizado e Área VIP, Tela de Insights, Gestão de Processos, Automação de Entregas, Protocolo Digital, Gestão de Prazos das Entregas, GED, Método APLA, AC Notifica, AC Certifica | http://acessorias.com/site/ |
| Produtos vendidos separadamente | Acessórias (base), Acessórias Docs, Komunic e Aplicativo/Área VIP | https://acessorias.com/site/demonstracao/ |
| Menu (visto em captura de 06/2026) | Barra lateral com Sistema, Obrigações, Empresas, Lista de Entregas, Gestão de processos, Solicitações (com contador), Método APLA, AC Doc's, Relatórios e Admin. No topo ficam a busca da central de ajuda, as novidades e a engrenagem (API Token, armazenamento, boletos). Há um botão "+" flutuante de acesso rápido | https://app.acessorias.com/sysajuda.php?p=585 |
| Atalhos de teclado | F2 abre a Lista de Entregas, F10 abre Processos, Ctrl+K abre a consulta de documento do robô | https://acessorias.movidesk.com/kb/pt-br/article/602057 ; https://www.youtube.com/watch?v=iaZvS4c5I9g |
| App para a equipe | **Não existe.** A equipe usa só o navegador; o app é para o cliente | https://acessorias.movidesk.com/kb/pt-br/article/592543 |
| Ordem de implantação recomendada | Usuários, departamentos, responsáveis, obrigações, regimes, empresas (obrigações, tarefas, contatos), importação, robô e, por fim, Lista de Entregas. A ordem é obrigatória porque a empresa herda o pacote do regime | https://www.youtube.com/playlist?list=PLDTPmlO5aZrstdj4Y51hOolbKelRn3laU |

---

## 2. Usuários e permissões

Ficam em **Sistema > Usuários e Permissões**. O login é o e-mail, que é único por pessoa.

| Função | Como funciona | Fonte |
|---|---|---|
| Cadastro de usuário | Pede nome, e-mail, tipo e senha inicial (padrão "123", trocada no primeiro acesso). Tem as abas "Dias e horários" (a janela em que a pessoa pode entrar) e "Permissões". A lista mostra quem entrou hoje (verde ou vermelho) e o último acesso | https://acessorias.movidesk.com/kb/pt-br/article/413346 ; https://www.youtube.com/watch?v=e5XtkwBL-8s |
| Perfis-base (6, editáveis) | Auxiliar (só as próprias demandas), Assistente, Analista, Contador, Encarregado/Gerente e Contador Sócio (quase tudo liberado). O tipo só pré-carrega as permissões | https://acessorias.movidesk.com/kb/pt-br/article/413346 |
| Chaves de permissão por nível | Cada chave tem níveis numéricos que se somam (0 é sem acesso). Exemplos: Controle de Usuários (0-2); Departamentos (0-3, inclui disparar e-mails agendados e definir gestores); Obrigações (0-4: listar, alocar em empresas, retroativa ou avulsa, editar); Regimes e Grupos; Empresas (comentários, contatos, tarefas, alterar, relatórios, exclusão); Apagar anexos; Dispensa (não / sim / sim com justificativa / em massa); Visão da Lista de Entregas (só as próprias / das empresas em que é responsável / todas); Alterar prazos; Processos (movimentar, criar matriz, excluir, autorizar); Solicitações; AC Docs; Certificado Digital; APLA; Administrativo; Configurações do sistema e do robô | https://acessorias.movidesk.com/kb/pt-br/article/413346 |
| Filtros forçados | Restringem o usuário a certos grupos de empresas, departamentos e/ou tags, que podem ser combinados. O que fica fora do filtro some para ele, inclusive os botões de disparo e os comentários de outros departamentos | https://acessorias.movidesk.com/kb/pt-br/article/589567 ; https://app.acessorias.com/sysajuda.php?p=243 |
| Transferência em massa (carteira) | Passa todas as empresas e departamentos de um responsável para outro de uma vez | https://acessorias.movidesk.com/kb/pt-br/article/593137 |
| Usuários inativos e log | A lista mostra os inativos, e há log de quem mudou cada permissão e quando | https://acessorias.movidesk.com/kb/pt-br/article/601971 ; https://acessorias.movidesk.com/kb/pt-br/article/599001 |
| APLA é restrito | A permissão do APLA só pode ser dada por quem já a tem | https://acessorias.movidesk.com/kb/pt-br/article/592831 |
| Justificar atraso | **Não há permissão própria nem papel de aprovador** documentado. Quem enxerga a demanda pode escrever a justificativa (isso é inferência) | https://acessorias.movidesk.com/kb/pt-br/article/413346 |

---

## 3. Segurança de acesso

| Função | Como funciona | Fonte |
|---|---|---|
| Dados do meu perfil | O usuário troca e-mail e senha (mínimo de 8 caracteres, com maiúscula, minúscula, número e símbolo), vê as sessões abertas e pode encerrá-las. Ali também ficam a assinatura de e-mail, o SMTP próprio, a cópia oculta e as notificações | https://acessorias.movidesk.com/kb/pt-br/article/593554 |
| 2FA (MFA) obrigatório | O código vai por e-mail por padrão. O usuário pode trocar para um aplicativo autenticador (Google ou Microsoft) lendo um QR Code. O login também tem captcha. Não há procedimento documentado para quem perde o celular | https://acessorias.movidesk.com/kb/pt-br/article/502902 |
| Dispositivo confiável | Dispensa o código por cerca de 7 dias (168 h, mesmo aparelho e navegador; o número vem do artigo de 2FA, não do 610530). Depois de uma atualização (o artigo não traz a data; o levantamento indica 11/2026, **a confirmar**) a opção só aparece depois de 3 logins seguidos com sucesso no mesmo aparelho; antes aparecia já no primeiro acesso | https://acessorias.movidesk.com/kb/pt-br/article/502902 ; https://acessorias.movidesk.com/kb/pt-br/article/610530 |
| Alerta de acesso novo | Um login vindo de aparelho ou local desconhecido (comparado com os acessos confirmados nos últimos 90 dias; o primeiro acesso do usuário não gera alerta) gera e-mail com data, hora, sistema operacional, navegador, IP e local aproximado, e os botões "Sim, fui eu" e "Não fui eu". O "Não fui eu" derruba todas as sessões, remove os dispositivos confiáveis e obriga a criar nova senha. Troca de senha também gera aviso e encerra as outras sessões. Os sócios recebem cópia se estiverem ativos, com permissão Administrativa e e-mail preenchido | https://acessorias.movidesk.com/kb/pt-br/article/610530 |
| Expediente | Bloqueia o login de colaboradores fora do horário. Eles apresentam isso como proteção trabalhista | https://www.youtube.com/watch?v=ZyuXS6aLnG8 |
| Senha exigida em ação de risco | A dispensa em massa pede a senha do usuário para confirmar | https://acessorias.movidesk.com/kb/pt-br/article/294920 |

---

## 4. Painel e indicadores

| Função | Como funciona | Fonte |
|---|---|---|
| Painel Clássico (tela inicial) | Uma faixa de números: usuários, empresas ativas, NPS, entregas OK em 30 dias, documentos enviados em 90 dias, documentos não lidos, pendentes da semana, prazo técnico vencido, atraso legal, atraso com multa, pendentes do mês e dos próximos 30 dias. Clicar num número abre a Lista de Entregas já filtrada | https://acessorias.movidesk.com/kb/pt-br/article/589152 ; https://app.acessorias.com/sysajuda.php?p=3 |
| Significado dos contadores de atraso | "Atraso com multa" conta o que passou do prazo legal e pode gerar multa; "Atraso legal" conta atrasos de meses anteriores; "Prazo téc" conta o que passou do prazo interno. São **contagens**, não valores em reais | https://acessorias.movidesk.com/kb/pt-br/article/589152 |
| Planejamento Semanal | Na impressora do bloco "Semana" sai um PDF com as pendências da semana (ver também a seção 10) | https://acessorias.movidesk.com/kb/pt-br/article/589146 |
| Dashboard Flexível (Insights) | Funciona em duas etapas. Primeiro se cadastra o **indicador** (tipo: totais numéricos, por colaborador ou por departamento; período; visível só para mim ou para todos; filtros fixos). Depois se monta o **painel** com vários indicadores, que giram como slides em tempo configurável, pensado para uma TV ("gestão à vista"). O indicador numérico tem quatro cartões: Entregas, Pendentes, Docs (lidos/não lidos) e Processos | https://acessorias.movidesk.com/kb/pt-br/article/577907 ; https://app.acessorias.com/sysajuda.php?p=53 ; https://www.youtube.com/watch?v=UWvz3qyqmt0 |

---

## 5. Departamentos

Ficam em **Sistema > Departamentos**. O departamento é o eixo de quase tudo: responsáveis, envio de e-mail, contatos que recebem, solicitações e formulários.

| Função | Como funciona | Fonte |
|---|---|---|
| Criar departamento e sub-departamento | Pede nome, departamento pai (ou nenhum), o momento de envio dos e-mails agendados, o e-mail de "responder para" e os gestores. Sub-departamentos (ex.: Contábil 1 e Contábil 2) dividem a carga e permitem comparar equipes. Ao excluir um departamento que tem obrigações, o sistema pergunta para onde transferi-las | https://acessorias.movidesk.com/kb/pt-br/article/589527 ; https://acessorias.movidesk.com/kb/pt-br/article/589696 ; https://www.youtube.com/watch?v=qwPtvj6TcW4 |
| Gestores x responsáveis | Os **gestores** do departamento recebem os follow-ups de processos e os documentos configurados como "aos gestores do dpto", que são vistos internamente antes de ir ao cliente (ex.: balanço, DRE). O **responsável** é quem executa as demandas, definido empresa a empresa | https://acessorias.movidesk.com/kb/pt-br/article/594663 |
| Replicar marcações | Copia em massa, de um departamento para outro, quais contatos recebem e quem é o responsável em cada empresa | https://acessorias.movidesk.com/kb/pt-br/article/594224 |
| Régua do envio agendado | Define quando os documentos agrupados saem: de hora em hora, no próximo dia, num dia da semana, no Nº dia útil (do 1º ao 20º) ou só manualmente (ver seção 13) | https://acessorias.movidesk.com/kb/pt-br/article/595955 |
| Modelos de e-mail do departamento | Dois modelos próprios (individual e agendado), que substituem o global. Há botão de e-mail de teste | https://www.youtube.com/watch?v=qwPtvj6TcW4 |
| Formulários de solicitação | No departamento se criam os grupos de campos personalizados usados nas solicitações (ver seção 16) | https://acessorias.movidesk.com/kb/pt-br/article/593696 |

---

## 6. Configurações gerais e e-mail

Ficam em **Sistema > Configurações Gerais**. Valem para o escritório inteiro.

| Função | Como funciona | Fonte |
|---|---|---|
| Quando a entrega conta como feita | Opção 1: anexar o arquivo já dá a demanda como entregue (o protocolo vira "OK"). Opção 2: só conta com o número de protocolo digitado | https://acessorias.movidesk.com/kb/pt-br/article/591949 |
| Quando conta como lida | Quando o cliente abre **todos** os anexos da entrega ou quando abre **pelo menos um** | https://acessorias.movidesk.com/kb/pt-br/article/591949 |
| Quem fica como responsável depois do OK | Continua o responsável definido ou passa a ser quem entregou. Isso muda também o remetente do e-mail | https://acessorias.movidesk.com/kb/pt-br/article/591949 |
| Padrão de "Enviar por e-mail?" | Não, Imediato ou Agendado | https://acessorias.movidesk.com/kb/pt-br/article/591949 |
| Expediente, responsáveis padrão, logo, backup | Define o horário padrão de login, os responsáveis padrão por departamento para empresas novas, a logo dos e-mails (variável [LogoEmpresa]) e a pasta padrão de backup do robô | https://acessorias.movidesk.com/kb/pt-br/article/591949 ; https://acessorias.movidesk.com/kb/pt-br/article/594099 |
| Modelos globais de e-mail | Há o modelo **imediato** (um documento por e-mail, com título diferente para documento com e sem vencimento) e o **agendado** (uma lista que repete os dados de cada documento). As variáveis vêm entre colchetes: [NomeCli], [EmpresaCli], [ObrNome], [CompDoc], [VctoDoc], [LinkDoc]. A guia vai como **link**, não como anexo. Configura-se também o nome exibido no remetente, para onde vai a resposta do cliente (responsável do departamento, e-mail do departamento ou um e-mail geral) e se os agendados saem do departamento da obrigação ou de um departamento central. Os agendados saem sempre em hora cheia | https://acessorias.movidesk.com/kb/pt-br/article/592054 ; https://acessorias.movidesk.com/kb/pt-br/article/598370 ; https://acessorias.movidesk.com/kb/pt-br/article/594290 ; https://www.youtube.com/watch?v=ZyuXS6aLnG8 |
| Lembrete de guia não lida | Ver seção 12 | https://acessorias.movidesk.com/kb/pt-br/article/600317 |
| Servidor de e-mail | Por padrão os e-mails saem de noreply@acessorias.com com o nome do escritório. Cada usuário pode configurar SMTP próprio (há guias para Google e Office 365), sujeito aos limites do provedor. A alternativa paga é o **Módulo de Disparos**: envio pela AWS com o domínio do escritório autenticado (SPF, DKIM, DMARC), sem limite por hora, a 0,25 por CNPJ contratado ao mês (moeda presumida: real), sem fidelidade | https://acessorias.movidesk.com/kb/pt-br/article/594713 ; https://acessorias.movidesk.com/kb/pt-br/article/598940 ; https://acessorias.movidesk.com/kb/pt-br/article/295055 |
| Aparência | "Trocar estilo" oferece três temas de cor | https://acessorias.movidesk.com/kb/pt-br/article/596849 |

---

## 7. Empresas e contatos

Ficam no menu **Empresas**. A ficha da empresa é dividida em seções, que se ligam e desligam por ícones.

| Função | Como funciona | Fonte |
|---|---|---|
| Cadastro manual | Digita-se o CNPJ, CPF ou CAEPF e o "Buscar" preenche razão social e endereço pela Receita (os dados podem vir defasados). Escolhem-se o regime (que carrega as obrigações), o grupo de empresas, o honorário (usado no APLA), um ID interno (pode ser igual ao do sistema contábil) e se está ativa. Aceita CNPJ alfanumérico | https://acessorias.movidesk.com/kb/pt-br/article/294612 ; https://acessorias.movidesk.com/kb/pt-br/article/602018 |
| Importação em massa | CSV com uma coluna identificadora obrigatória, que é a chave para saber se a empresa já existe. Vai um contato por linha e uma inscrição estadual por linha. Linhas incompletas ficam "em processo de cadastro". Os vídeos mostram também uma importação por lista de CNPJs que busca na Receita, com a barra "empresa 1 de 15", que pode ser retomada outro dia | https://acessorias.movidesk.com/kb/pt-br/article/413354 ; https://acessorias.movidesk.com/kb/pt-br/article/598822 ; https://www.youtube.com/watch?v=XR8mlZiRrW0 |
| Seções da ficha | Endereço e contatos; comentários (um CRM simples de atendimento, cada comentário ligado a um departamento); processos; obrigações da empresa; tarefas agendadas; processos recorrentes; solicitações; responsáveis por departamento; arquivos anexos. Um polegar vermelho na lista de empresas indica entrega atrasada e leva à Lista de Entregas filtrada | https://www.youtube.com/watch?v=aMJwAKcTLdU ; https://www.youtube.com/watch?v=LeOBQ-PkcxQ ; https://app.acessorias.com/sysajuda.php?p=243 |
| Contatos (quem recebe o quê) | Cada contato tem nome, cargo, celular (obrigatório para WhatsApp) e e-mail (obrigatório para qualquer envio; é o login do app). A caixa "Recebe e-mails ref. documentos postados" e as caixas de departamentos definem o que ele recebe. Dá para restringir um contato a obrigações específicas. Ao desmarcar o e-mail, ele para de receber e-mail e WhatsApp mas continua vendo no app. Todos os contatos habilitados recebem. Um e-mail repetido em dois contatos duplica demandas na Área VIP. O ícone roxo traz "checar block-list" e o de robozinho gerencia o acesso ao app | https://acessorias.movidesk.com/kb/pt-br/article/596133 ; https://acessorias.movidesk.com/kb/pt-br/article/413398 ; https://acessorias.movidesk.com/kb/pt-br/article/593362 |
| Responsáveis por departamento | Para cada departamento, a empresa tem um colaborador responsável. Ele herda as obrigações daquele departamento e é o remetente dos e-mails do setor. Trocar o responsável reatribui sozinho as demandas em aberto (as entregues não mudam). Há transferência em massa e o relatório "Responsáveis Dptos" | https://acessorias.movidesk.com/kb/pt-br/article/594081 ; https://acessorias.movidesk.com/kb/pt-br/article/593145 ; https://acessorias.movidesk.com/kb/pt-br/article/593800 |
| Identificadores para o robô | O identificador principal (CNPJ, CPF ou CAEPF), as inscrições estaduais (várias, com UF) e "outros identificadores" (CEI/CNO ou CPF adicional). O campo "Apelido e-Contínuo" dá nome à pasta de backup. A inscrição municipal **não** é lida | https://acessorias.movidesk.com/kb/pt-br/article/294981 ; https://acessorias.movidesk.com/kb/pt-br/article/476170 ; https://acessorias.movidesk.com/kb/pt-br/article/594403 |
| Matriz e filial | Não há estrutura de matriz e filial: cada filial seria um cadastro próprio (inferência) | https://acessorias.movidesk.com/kb/pt-br/article/602544 |
| Tarefas agendadas | Lembretes por empresa (renovar alvará, certificado, seguro) com descrição, tempo previsto, departamento, dia/mês/ano (ano 0 repete todo ano) e "lembrar em" N dias antes. Aparecem na Lista de Entregas do responsável, só têm baixa manual e não geram datas passadas | https://acessorias.movidesk.com/kb/pt-br/article/294617 ; https://acessorias.movidesk.com/kb/pt-br/article/595224 |
| Tags e grupos de empresas | **Tags** são rótulos livres, aplicados um a um ou em massa a partir da lista filtrada. Servem em filtros, relatórios, alocação de obrigações, comunicados, processos recorrentes e filtros forçados. O **grupo de empresas** junta empresas por dono ou holding; empresa nova cai no "Grupo Geral" | https://acessorias.movidesk.com/kb/pt-br/article/595333 |
| Grupos de envio de obrigações | Configurados empresa a empresa (não há replicação em massa): nome, remetente, as obrigações que compõem o grupo (podem ser de departamentos diferentes) e um modelo de e-mail próprio. O e-mail só sai quando **todas** as obrigações do grupo estiverem entregues | https://acessorias.movidesk.com/kb/pt-br/article/594343 ; https://acessorias.movidesk.com/kb/pt-br/article/476185 |
| Arquivos anexos (acervo permanente) | Até 10 arquivos por vez, com descrição e departamento. Vão para a pasta DocsEmpresa do cliente sem enviar e-mail. Apagar remove também do app | https://acessorias.movidesk.com/kb/pt-br/article/594422 |
| Inativar, reativar, excluir | Inativar exige o motivo de cancelamento (de uma lista) e grava "cliente desde/até". Os processos em andamento vão para "Desistência". Há um checklist de vários passos para a empresa sair da contagem de CNPJs do plano. A exclusão definitiva tem permissão própria e não tem volta | https://acessorias.movidesk.com/kb/pt-br/article/414847 ; https://acessorias.movidesk.com/kb/pt-br/article/599632 ; https://acessorias.movidesk.com/kb/pt-br/article/596533 ; https://app.acessorias.com/sysajuda.php?p=586 |
| Log e relatórios | Desde 06/2026 há uma linha do tempo única do cadastro (troca de regime com "de/para", tags, processos recorrentes). A lista exporta PDF e Excel, e os e-mails dos contatos em CSV | https://acessorias.movidesk.com/kb/pt-br/article/600043 ; https://acessorias.movidesk.com/kb/pt-br/article/598317 ; https://acessorias.movidesk.com/kb/pt-br/article/593820 |

---

## 8. Regimes tributários e grupos

No Acessórias, **regime** é só um pacote de obrigações com nome livre, como "Lucro Real com folha", "Domésticas" ou "Terceiro setor". O sistema não traz regras fiscais.

| Função | Como funciona | Fonte |
|---|---|---|
| Cadastrar regime | Em Obrigações > Regimes Tributários: nome, status e a lista de obrigações com tempo previsto. Ao escolher o regime na empresa, o pacote é carregado. Dá para duplicar o regime e listar as empresas de cada um | https://acessorias.movidesk.com/kb/pt-br/article/413350 ; https://www.youtube.com/watch?v=ZT9J7kqhoxg |
| Mudar o regime | Ao **incluir** uma obrigação, o sistema pergunta se ela vale para as empresas atuais e as novas ou só para as novas. Ao **remover**, pergunta se inativa nas atuais e nas novas ou só deixa de aplicar às novas | https://acessorias.movidesk.com/kb/pt-br/article/590903 ; https://acessorias.movidesk.com/kb/pt-br/article/590891 |
| Trocar o regime da empresa | As obrigações do regime anterior saem e ficam só as do novo. As vindas de grupo ou adicionadas à parte permanecem. Para as obrigações novas aparece "Prazos a partir de", que permite gerar o passado. **Não há vigência por data nem histórico de regime** | https://acessorias.movidesk.com/kb/pt-br/article/592714 ; https://acessorias.movidesk.com/kb/pt-br/article/593267 |
| Grupos de obrigações | Pacotes que só **somam** obrigações à empresa, sem substituir as que já existem (o regime substitui) | https://acessorias.movidesk.com/kb/pt-br/article/592714 |
| Alocar em massa | O botão "+" > "Alocar Obrigação em Empresas" aplica por empresa, regime, grupo ou tag e reativa a obrigação onde ela estava inativa | https://acessorias.movidesk.com/kb/pt-br/article/593267 |
| Alerta do próprio manual | O regime sozinho não define as entregas: é preciso olhar atividade, UF, município, folha, retenções, filiais | https://acessorias.movidesk.com/kb/pt-br/article/602544 |
| Catálogo pronto | Nenhum artigo diz que a conta nova vem com obrigações ou regimes prontos. Tudo indica que o escritório monta o catálogo do zero (**a confirmar**) | https://acessorias.movidesk.com/kb/pt-br/article/413347 |
| Reforma Tributária (IBS/CBS) | Nada encontrado. Há uma live marcada para 26/11/2026 | https://www.youtube.com/@Acess%C3%B3rias/streams |

---

## 9. Obrigações e agenda de prazos

Ficam no menu **Obrigações**. A obrigação é cadastrada uma vez para o escritório e depois vinculada às empresas.

### 9.1 Cadastro da obrigação

| Campo | Para que serve | Fonte |
|---|---|---|
| Nome e mininome | O mininome é a coluna curta dos relatórios | https://acessorias.movidesk.com/kb/pt-br/article/413347 |
| Departamento e responsável padrão | Diz quem executa | idem |
| Tempo previsto (minutos) | Alimenta o APLA (ver seção 22) | idem |
| Competências referentes a | Desloca a competência em relação ao mês do prazo (ex.: "mês anterior") e orienta a baixa feita pelo robô | idem |
| Exigir robô? | Bloqueia a baixa manual: só o robô pode baixar | idem ; https://www.youtube.com/watch?v=Dl2ir-wXBJs |
| Passível de multa? | Sim/não. Gera um cifrão vermelho na lista e entra no contador do painel. **Não há campo de valor da multa** | idem |
| Alerta de guia não lida? | Liga o lembrete ao cliente (seção 12) | idem |
| Comentário padrão | Um mini-manual para quem executa | idem |
| Prazo técnico ("Lembrar responsável quantos dias antes?") | Número de dias antes do prazo legal em que o alerta começa. Se a contagem é em dias úteis ou corridos e se existe a opção "sábado é útil?" o artigo citado **não diz** (**a confirmar**) | https://acessorias.movidesk.com/kb/pt-br/article/294577 |
| Prazo legal | Uma tabela de 12 meses com o dia de cada mês (ou "Não tem"). Uma seta azul replica o dia para os demais meses. Se o dia cair em fim de semana, pode antecipar, postergar ou manter | https://acessorias.movidesk.com/kb/pt-br/article/294566 ; https://acessorias.movidesk.com/kb/pt-br/article/294577 |
| Ativa? | Obrigação nunca é excluída, só inativada | https://acessorias.movidesk.com/kb/pt-br/article/593088 |

A lista de obrigações mostra quantas empresas usam cada uma e um ícone de robô quando o documento já está mapeado no robô. Editar o vencimento corrige também as entregas já geradas, e há log das últimas 15 alterações (https://www.youtube.com/watch?v=Dl2ir-wXBJs). Também dá para **duplicar** uma obrigação (ex.: transformar "GPS mensal" em "GPS 13º").

### 9.2 Prazo técnico, prazo legal e cores

O prazo legal é uma data-limite **interna**, e o manual recomenda pô-la antes do vencimento oficial. O prazo técnico é quando o responsável começa a ser lembrado. Exemplo do manual: a guia vence no dia 15, o prazo legal é o dia 12 e o técnico é de 5 dias, então o alerta começa no dia 7.

| Quando foi entregue | Cor | Nome do status |
|---|---|---|
| Antes do prazo técnico | Azul | Antecipada |
| Entre o técnico e o legal | Amarela | No prazo técnico |
| Depois do prazo legal | Vermelha | Atrasada |

Fonte: https://acessorias.movidesk.com/kb/pt-br/article/294577

### 9.3 Como os prazos nascem (geração automática)

| Regra | Como funciona | Fonte |
|---|---|---|
| Horizonte | Ao vincular, o sistema gera até **4 meses** à frente nas mensais e **2 anos** nas anuais. Uma rotina cria novos lotes quando o último se aproxima. Outros três artigos falam em 3 meses; o artigo dedicado ao motor diz 4 | https://acessorias.movidesk.com/kb/pt-br/article/599014 ; https://acessorias.movidesk.com/kb/pt-br/article/594817 |
| Não retroage | Conta a data do vínculo. O mês corrente só nasce se o vínculo for feito antes do início do prazo técnico | https://acessorias.movidesk.com/kb/pt-br/article/599014 |
| Sem data, sem geração | Uma obrigação sem dia na tabela de prazo legal não gera nada sozinha: depende de avulsa ou do robô com "criar demanda" | idem |
| Periodicidades | Só **mensal** e **anual**. Não existe semanal nem quinzenal. Trimestral se cadastra como mensal com "Não tem" nos meses sem entrega. Tributo anual pago em parcelas (ex.: alvará em 2x) deve ser cadastrado como mensal | https://acessorias.movidesk.com/kb/pt-br/article/413347 ; https://acessorias.movidesk.com/kb/pt-br/article/599019 |
| Armadilha da anual | Mudar o mês de vencimento de uma anual faz o sistema considerar a do ano resolvida; o próximo prazo só aparece no ano seguinte (corrige-se com "Retro") | https://acessorias.movidesk.com/kb/pt-br/article/599019 |
| 13º salário | Sempre cai na competência de dezembro, inclusive a 1ª parcela | https://acessorias.movidesk.com/kb/pt-br/article/594915 |
| Retro | O botão "Retro" gera as competências passadas para todas as empresas vinculadas a partir de uma data, com a opção de voltar as dispensadas para pendentes | https://acessorias.movidesk.com/kb/pt-br/article/294580 |
| Avulsa | Gera as competências de um intervalo para **uma** empresa (pensado para o cliente que chega atrasado do contador anterior). Não duplica. Armadilha: criar a avulsa antes de vincular a obrigação faz a geração automática parar | https://acessorias.movidesk.com/kb/pt-br/article/597517 ; https://www.youtube.com/watch?v=Dl2ir-wXBJs |
| Parar de gerar | Dispensar na lista **não** interrompe os meses seguintes. É preciso inativar a obrigação (no geral, no regime ou só na empresa; o sistema pergunta o que fazer com as pendências) ou apagar as datas do prazo legal | https://acessorias.movidesk.com/kb/pt-br/article/594817 ; https://acessorias.movidesk.com/kb/pt-br/article/593088 |

### 9.4 Vincular obrigação a empresas (3 caminhos)

São três: pelo cadastro da obrigação ("adicionar empresa"), pelo cadastro da empresa ("obrigações dessa empresa", com "prazos a partir de" para gerar o passado) ou em massa pelo "+" (por empresas, regimes, grupos ou tags). Fonte: https://acessorias.movidesk.com/kb/pt-br/article/593267

### 9.5 Feriados

Os nacionais já vêm cadastrados. Estaduais e municipais entram pelo ícone de sol: dia, mês e ano (ano 0 repete), descrição e cidades. O nome da cidade precisa bater exatamente com o do cadastro da empresa. **O sistema não distingue esfera**: um feriado municipal desloca também o prazo de tributo federal. Feriado não pode ser excluído, só zerado. Fonte: https://acessorias.movidesk.com/kb/pt-br/article/599023 ; https://www.youtube.com/watch?v=Dl2ir-wXBJs

---

## 10. Lista de Entregas

É a tela central de trabalho (atalho F2). Cada linha é uma demanda (obrigação + empresa + competência).

### 10.1 Status

| Grupo | Status dentro do grupo | Fonte |
|---|---|---|
| Pendentes | Pendente, em prazo técnico, atrasada | https://acessorias.movidesk.com/kb/pt-br/article/294938 |
| Justificadas | Pendente justificada, atraso justificado | idem |
| Entregues | Antecipada, no prazo técnico, atrasada, justificada | idem |
| Dispensadas | Dispensada | idem |

Enquanto o campo de justificativa estiver preenchido, a demanda continua em "Justificadas", **mesmo depois de entregue**. Para ela ir para "Entregues" é preciso apagar o texto, e com isso se perde o motivo (https://acessorias.movidesk.com/kb/pt-br/article/294938).

### 10.2 Ações na demanda

| Ação | Como funciona | Fonte |
|---|---|---|
| Entrega manual completa | Clica-se na demanda e preenchem-se: protocolo, anexo (até 30 MB, um por vez), "Enviar por e-mail?" (Não / Imediato / Agendado / Pré-agendado), data de vencimento (sem ela a guia não aparece no calendário do app), comentário que vai no corpo do e-mail, comentário interno e justificativa. "OK - Salvar" baixa e envia | https://acessorias.movidesk.com/kb/pt-br/article/590996 ; https://www.youtube.com/watch?v=ITPUmwCcP_M |
| Entrega rápida | O polegar na linha marca como entregue sem documento. Fica bloqueado se a obrigação exige robô | https://acessorias.movidesk.com/kb/pt-br/article/596976 |
| Dispensa rápida e com justificativa | O "X" dispensa. Com a permissão "exigir justificativa", é preciso escrever o motivo antes | https://acessorias.movidesk.com/kb/pt-br/article/596983 |
| Justificar atraso | Texto livre (o 584134 fala em 200 caracteres para o campo de **comentário** da lista; se o limite vale para a justificativa é **a confirmar**). O status muda sozinho, **sem aprovação**, sem lista de motivos e sem marcar se a culpa foi do cliente ou do escritório | https://acessorias.movidesk.com/kb/pt-br/article/294938 ; https://acessorias.movidesk.com/kb/pt-br/article/584134 |
| Dispensa em massa | Só com a permissão para isso: filtrar pendentes e justificadas com "prazo téc até" e confirmar com a senha. A reversão é uma a uma | https://acessorias.movidesk.com/kb/pt-br/article/294920 |
| Desfazer | Para voltar uma dispensada, usa-se "Voltar para pendente". Para desfazer uma entregue, apaga-se o protocolo e salva-se. Se o arquivo estava errado, apaga-se o anexo (com permissão), o que corta na hora o acesso do cliente por e-mail, app e WhatsApp | https://acessorias.movidesk.com/kb/pt-br/article/610098 ; https://acessorias.movidesk.com/kb/pt-br/article/593384 ; https://acessorias.movidesk.com/kb/pt-br/article/597428 |
| Alterar prazo | Uma a uma, clicando na data. Em massa, com uma única competência e uma única obrigação filtradas, pela seta vermelha. Tudo fica em log com o prazo original | https://acessorias.movidesk.com/kb/pt-br/article/294922 ; https://acessorias.movidesk.com/kb/pt-br/article/595270 |
| Transferir pontualmente | Filtrando pelo responsável atual, uma seta passa as pendentes para outra pessoa (férias, licença) sem mexer no cadastro da empresa | https://acessorias.movidesk.com/kb/pt-br/article/593107 |
| Histórico (balão) | Linha do tempo de cada demanda: quem fez o quê e quando (status, anexos, cancelamento de agendamento, prazo, origem avulsa, "guia desativada pelo reprocessamento") | https://acessorias.movidesk.com/kb/pt-br/article/604826 |
| Responsável pelo prazo x pela entrega | A demanda guarda as duas pessoas e mostra as duas quando são diferentes | https://acessorias.movidesk.com/kb/pt-br/article/337272 |

### 10.3 Filtros

Busca por empresa ou ID; caixas de status; barra de datas (competência, prazo técnico, prazo legal, entrega); e "+Filtros" com departamento, grupo, tag, obrigação, responsável, regime, "somente passíveis de multa", "somente tarefas agendadas", "falha no envio imediato", "com anexo e sem envio de e-mail" e "com envio agendado". A lupa vira **filtro removedor** (mostra tudo menos o selecionado). Fonte: https://acessorias.movidesk.com/kb/pt-br/article/592939 ; https://acessorias.movidesk.com/kb/pt-br/article/599596 ; https://acessorias.movidesk.com/kb/pt-br/article/610305

### 10.4 Outros recursos da lista

| Função | Como funciona | Fonte |
|---|---|---|
| Protocolo físico | Para entrega em mãos: título, data, status (pendente, impresso, cancelado, entregue) e itens (sugere obrigações próximas ou aceita texto livre). Gera um PDF que o cliente assina; depois anexa-se o protocolo assinado digitalizado | https://acessorias.movidesk.com/kb/pt-br/article/294921 ; https://acessorias.movidesk.com/kb/pt-br/article/294937 |
| Planejamento semanal por e-mail | Toda segunda de madrugada chega um PDF com as pendências da semana. Sócios e gerentes veem tudo; os demais, só as próprias. Pode ser reenviado na hora | https://acessorias.movidesk.com/kb/pt-br/article/577488 ; https://acessorias.movidesk.com/kb/pt-br/article/602237 |
| Relatórios da lista | Respeitam o filtro: Planejamento Semanal, PDF relação, PDF relação com comentários (traz data, hora e IP do acesso do cliente), PDF grade e Excel completo (com comentários e logs desde 10/2026). Pode calcular o tempo previsto total | https://acessorias.movidesk.com/kb/pt-br/article/596919 ; https://acessorias.movidesk.com/kb/pt-br/article/604810 ; https://app.acessorias.com/sysajuda.php?p=45 |

---

## 11. Robô de leitura de guias e pastas (e-Contínuo)

O e-Contínuo é o coração da automação. A única tarefa humana passa a ser **salvar o PDF numa pasta**. É um programa **Windows** (32/64 bits) instalado em cada computador, que entra com o login de cada colaborador.

| Função | Como funciona | Fonte |
|---|---|---|
| Instalação | É baixado em Sistema > e-Contínuo. Tem uso individual por máquina: num servidor compartilhado, as entregas saem no nome do primeiro usuário. Em Mac ou Linux, só com máquina virtual | https://acessorias.movidesk.com/kb/pt-br/article/294967 ; https://acessorias.movidesk.com/kb/pt-br/article/596028 ; https://www.youtube.com/watch?v=Ec96L4f6OBI |
| Pastas Upload e Download | Na **Upload** o colaborador salva os PDFs. Na **Download** fica o backup organizado por variáveis (padrão: empresa/tipo/ano-mês_nome), que pode ser uma pasta sincronizada com nuvem | https://acessorias.movidesk.com/kb/pt-br/article/415234 |
| Pastas monitoradas | Até 10 pastas locais. Tudo que cair nelas vai para a Upload (não se recomenda pasta de rede) | https://acessorias.movidesk.com/kb/pt-br/article/594184 |
| O que lê | Só **PDF de texto** e dois XML renomeados (nota de transporte/Reinf e evento do eSocial). Precisa de um identificador (CNPJ, CPF, CAEPF, IE, CEI/CNO) e de uma data. Arquivos acima de 10 MB são ignorados. Excel, Word, ZIP e imagem só vão por envio manual | https://acessorias.movidesk.com/kb/pt-br/article/594593 ; https://acessorias.movidesk.com/kb/pt-br/article/294981 ; https://acessorias.movidesk.com/kb/pt-br/article/597624 |
| Leitura por posição e homologação | O robô lê pela posição no layout ("a segunda data de cima para baixo"), num mapeamento feito pela **equipe do Acessórias**. Um modelo novo ou com layout alterado exige ticket de homologação com pelo menos 2 PDFs, com prazo de até 5 dias úteis. Cabeçalho ou rodapé de impressão do navegador quebram a leitura (ex.: o robô lê o CPF do contador no lugar do CNPJ) | https://acessorias.movidesk.com/kb/pt-br/article/294975 ; https://acessorias.movidesk.com/kb/pt-br/article/593750 ; https://acessorias.movidesk.com/kb/pt-br/article/596787 |
| Base de conhecimento (regra por modelo) | Em Consulta documento (Ctrl+K), sobe-se um PDF de exemplo e configura-se uma vez por modelo: a obrigação correspondente (só uma); cópia local e caminho; envio (Não / Imediato / Agendado / Pré-agendado / Aos gestores do dpto); o que fazer no reenvio; o que fazer se não houver demanda na competência (ignorar ou criar); antecipar vencimento em dia não útil; considerar o vencimento do documento; multipages | https://acessorias.movidesk.com/kb/pt-br/article/297299 |
| Configuração em lote | Até 30 PDFs por vez (2 MB cada), com triagem automática | https://acessorias.movidesk.com/kb/pt-br/article/591494 |
| Reenvio na mesma competência | **Ignorar** (padrão: recusa a nova guia); **reprocessa e mantém** (as antigas continuam valendo); **reprocessa e desativa** (elimina os arquivos anteriores daquele prazo, inclusive do e-mail; serve para recálculo. O 294972 não fala do link em si: o que o cliente vê ao abrir o link antigo é **a confirmar**) | https://acessorias.movidesk.com/kb/pt-br/article/294972 ; https://acessorias.movidesk.com/kb/pt-br/article/604826 |
| Criar demanda (esporádicas) | Se não houver a competência aberta, cria a demanda na hora e vincula a obrigação à empresa. Não se deve usar em obrigação de prazo fixo nem em demanda vinda de processo, porque duplica | https://acessorias.movidesk.com/kb/pt-br/article/596083 |
| Multipages | Divide um PDF com uma página por cliente e baixa cada página na empresa certa. Precisa ser liberado pela homologação | https://acessorias.movidesk.com/kb/pt-br/article/593373 |
| OCR à parte | O "eContínuo OCR" é outro programa (Windows 64 bits) que pega o PDF-imagem da pasta nIdentificado, torna pesquisável e devolve à Upload. O modo avançado, mais lento, serve para guias com campos pequenos (DAM) | https://acessorias.movidesk.com/kb/pt-br/article/596199 |
| Pastas de exceção e mensagens | **nProcessado** (leu, mas a configuração impediu a baixa), **nIdentificado** (não leu) e **Ignorados** (extensão não aceita). Mensagens típicas: "Cadastro inexistente", "Favor indicar a obrigação correspondente", "Não possui a obrigação", "Competência inexistente", "Já realizado na competência", "Impossível definir a competência" | https://acessorias.movidesk.com/kb/pt-br/article/593444 ; https://acessorias.movidesk.com/kb/pt-br/article/592104 ; https://acessorias.movidesk.com/kb/pt-br/article/592034 ; https://acessorias.movidesk.com/kb/pt-br/article/592177 |
| "Processada" não quer dizer "enviada" | O histórico do robô mostra "Entrega Processada" (baixou) ou "Reprocessada", mas isso **não garante** que o e-mail saiu. A conferência é feita pelos ícones da Lista de Entregas | https://acessorias.movidesk.com/kb/pt-br/article/595290 |
| Robô e processos | Obrigação criada por um passo de processo é baixada pelo robô, desde que a mesma obrigação esteja inativa no cadastro da empresa. O robô sempre baixa o prazo mais antigo | https://acessorias.movidesk.com/kb/pt-br/article/592253 |
| Envio por API | `POST /econtinuo` recebe um PDF e processa na nuvem como se ele tivesse caído na Upload. É assim que Contmatic, Contabit e Jettax entregam guias | https://api.acessorias.com/documentation |
| Problemas conhecidos | Antivírus bloqueiam o robô (há guias de exceção); ele desconecta quando está desatualizado; PDF somente leitura dá problema; arquivo com data futura em relação ao relógio do PC fica parado; a baixa pode cair em competência errada conforme a configuração | https://acessorias.movidesk.com/kb/pt-br/article/294980 ; https://acessorias.movidesk.com/kb/pt-br/article/595454 ; https://acessorias.movidesk.com/kb/pt-br/article/596404 ; https://acessorias.movidesk.com/kb/pt-br/article/593762 |

---

## 12. Envio ao cliente e protocolo digital

Uma baixa com envio dispara até **três canais com um único gatilho**: e-mail com link, aviso no WhatsApp (se houver AC Notifica) e publicação no app/GED.

### 12.1 Modos de envio por documento

| Modo | O que faz | Fonte |
|---|---|---|
| Não | Só baixa, sem enviar | https://acessorias.movidesk.com/kb/pt-br/article/595955 |
| Imediato | Um e-mail por documento, na hora | idem |
| Agendado | Junta os documentos do mesmo departamento num e-mail só, no horário do departamento | idem |
| Pré-agendado | Fica retido e "pega carona" quando outro documento do departamento for agendado | idem |
| Aos gestores do dpto | Vai para conferência interna em vez de ir ao cliente | https://acessorias.movidesk.com/kb/pt-br/article/297299 |
| Grupo de envio de obrigações | Só sai quando todas as obrigações do grupo estiverem prontas (seção 7) | https://acessorias.movidesk.com/kb/pt-br/article/594343 |

### 12.2 Ícones de envio e leitura na Lista de Entregas

| Ícone | Significado | Fonte |
|---|---|---|
| Relógio laranja | Agendado, esperando na fila | https://acessorias.movidesk.com/kb/pt-br/article/600437 |
| Relógio vermelho | Agendado abortado por falta de dados | idem |
| Envelope vermelho | Enviado e **não lido** | idem ; https://acessorias.movidesk.com/kb/pt-br/article/476179 |
| Envelope vermelho de borda grossa | O envio imediato falhou. Passando o mouse aparece o motivo: sem contato, sem e-mail, sem responsável, departamento desmarcado ou e-mail inválido | idem |
| Envelope azul | O cliente abriu o link | idem |
| Envelope azul preenchido | O escritório marcou a leitura à mão (dá para distinguir da leitura real) | https://acessorias.movidesk.com/kb/pt-br/article/593010 |
| Robozinho azul | O contato recebe só pelo app | https://acessorias.movidesk.com/kb/pt-br/article/595290 |
| Sem ícone | A obrigação está configurada para não enviar | https://app.acessorias.com/sysajuda.php?p=354&ctg=1 |

Os vídeos antigos chamam o "não lido" de envelope **laranja**. O manual atual diz **vermelho**; o laranja é o do relógio de agendado (https://www.youtube.com/watch?v=6-diwJEiYhY).

### 12.3 Protocolo digital (prova de entrega e de leitura)

- O cliente recebe um link direto para o arquivo, **sem login por padrão**. A abertura registra data, hora e IP, e o registro aparece no "PDF relação com comentários". O site vende isso como prova de entrega (https://acessorias.com/site/funcionalidade/protocolo-digital/ ; https://app.acessorias.com/sysajuda.php?p=45).
- "Lido" quer dizer que o cliente **clicou no link**. Pela regra da seção 6, conta todos os anexos ou basta um. Há um envelope por entrega. **A confirmar** se fica registrado qual contato abriu (https://acessorias.movidesk.com/kb/pt-br/article/591949).
- A página que abre é uma tela mínima de download ("Baixar"/"Ver"), sem os dados da guia (https://acessorias.movidesk.com/kb/pt-br/article/596600).
- **Exigir login** para abrir o documento do e-mail está documentado desde 21/10/2026 (data de criação do artigo; a data de lançamento não é dita), vem desligado e protege contra e-mail encaminhado (https://acessorias.movidesk.com/kb/pt-br/article/608607).
- O site fala em "assinatura digital" no app. No manual não há esse fluxo: a "assinatura" parece ser o próprio registro do clique (**a confirmar**) (https://acessorias.com/site/funcionalidade/protocolo-digital/).
- O link do WhatsApp vale 30 dias. A validade do link do e-mail não está documentada (**a confirmar**) (https://acessorias.movidesk.com/kb/pt-br/article/585262).

### 12.4 Falha de envio

Quando o envio falha, além do ícone, vai um e-mail "Guia não enviada por falta de informações" para sócios, gerentes e responsáveis com permissão Administrativa. Para corrigir, revisam-se os contatos (e-mail válido, fora da block list, departamentos marcados), o responsável e o SMTP. Fonte: https://acessorias.movidesk.com/kb/pt-br/article/593312

### 12.5 Lembrete de guia não lida (régua)

O campo "Qtde de dias antes do vcto" aceita uma lista como `2,1,0`: lembra 2 dias antes, 1 dia antes e no dia, **só para quem não abriu**. O prefixo `F` (ex.: `F0`) força o lembrete também para quem já abriu; `100` desliga; em branco manda um lembrete no dia. A regra é **única para o escritório inteiro**, sem exceção por cliente, e exige que a entrega tenha vencimento. O artigo 600317 só fala de e-mail; é o artigo do AC Notifica (585262) que diz que os lembretes de não lida também vão pelo WhatsApp. Fonte: https://acessorias.movidesk.com/kb/pt-br/article/600317 ; https://acessorias.movidesk.com/kb/pt-br/article/585262 ; https://app.acessorias.com/sysajuda.php?p=43&ctg=1

### 12.6 Reenvio

**Não há "reenviar para este contato"** no manual. Os caminhos são indiretos: voltar a demanda para pendente e entregar de novo, ou reprocessar pelo robô. O envio vai sempre para todos os contatos habilitados do departamento, sem escolher item a item. Isso bate com uma queixa do Reclame Aqui (seção 27). Fonte: https://acessorias.movidesk.com/kb/pt-br/article/590996 ; https://acessorias.movidesk.com/kb/pt-br/article/294972

### 12.7 Comprovante de pagamento

Desde 26/06/2026, no calendário do app, um clipe ao lado de cada guia permite ao cliente anexar o comprovante. **A confirmar**: onde o escritório vê o comprovante, se é avisado e se a guia fica marcada como paga. Fonte: https://app.acessorias.com/sysajuda.php?p=586&ctg=1

---

## 13. E-mails agendados (envio agrupado)

| Função | Como funciona | Fonte |
|---|---|---|
| Régua por departamento | De hora em hora, no próximo dia, num dia da semana, no Nº dia útil (1º ao 20º) ou só manual. Sai sempre em hora cheia | https://acessorias.movidesk.com/kb/pt-br/article/595955 ; https://www.youtube.com/watch?v=ZyuXS6aLnG8 |
| Fila e "forçar agora" | No cadastro do departamento aparece a fila das empresas com guias agrupadas. Quem tem permissão pode disparar na hora ou cancelar (X) | https://acessorias.movidesk.com/kb/pt-br/article/415236 |
| Cancelar pela lista | O relógio laranja ao lado do anexo cancela o agendamento. Fica log de quem cancelou | https://acessorias.movidesk.com/kb/pt-br/article/596566 |
| Remetente central | Os agendados podem sair do departamento da obrigação ou de um departamento único | https://acessorias.movidesk.com/kb/pt-br/article/594290 |
| Visibilidade no app | Uma configuração decide se o documento agendado aparece no app desde a postagem ou só depois que o e-mail sair | https://acessorias.movidesk.com/kb/pt-br/article/488170 |
| Filtro forçado | Quem tem filtro forçado não vê os botões de disparo de outros departamentos | https://acessorias.movidesk.com/kb/pt-br/article/589567 |

---

## 14. AC Notifica e WhatsApp (Komunic, Digisac)

O Acessórias tem três caminhos de WhatsApp: o **AC Notifica** (só aviso de documento), o **Komunic** (central de atendimento, vendida à parte) e a integração com a **Digisac** (de terceiro).

### 14.1 AC Notifica

| Função | Como funciona | Fonte |
|---|---|---|
| Conexão | Engrenagem > Notificação WhatsApp: lê-se um QR Code com o WhatsApp Business do escritório. É **um número só**, e o celular precisa ficar ligado. O artigo não diz se é API oficial; a conexão por QR Code indica que não, mas uma live de 10/2026 cita opção de API oficial da Meta (**a confirmar**) | https://acessorias.movidesk.com/kb/pt-br/article/585262 |
| Mensagem | A cada documento postado vai uma mensagem com empresa, CNPJ, departamento, competência, vencimento e link de download (30 dias). Os lembretes de não lida também vão por aqui | idem |
| Limites | Só sai se o documento também for por e-mail (exceção corrigida em 06/2026 para os agendados). Não manda comunicados. O número não recebe respostas (o rodapé é fixo). A leitura pode ser **falso positivo**: a pré-visualização da Meta e os antivírus abrem o link sozinhos | idem ; https://acessorias.movidesk.com/kb/pt-br/article/593519 |
| Consentimento | **Não há opt-in no sistema.** Pedir autorização ao cliente fica como boa prática do escritório | https://acessorias.movidesk.com/kb/pt-br/article/596009 |
| Risco de bloqueio | Recomendam chip exclusivo, "aquecer" o número por cerca de 7 dias com uso manual e subir aos poucos (30, 60, 100 mensagens por dia). Usar o mesmo número em dois sistemas automáticos aumenta o risco | https://acessorias.movidesk.com/kb/pt-br/article/596009 ; https://acessorias.movidesk.com/kb/pt-br/article/592579 |
| Preço | Sem taxa extra, segundo o artigo (criado em 23/04/2026, atualizado em 02/09/2026) | https://acessorias.movidesk.com/kb/pt-br/article/585262 |

### 14.2 Komunic (produto à parte)

| Função | Como funciona | Fonte |
|---|---|---|
| Atendimento multiusuário | Vários atendentes no mesmo número, com departamentos, horários, fila, transferência, respostas rápidas, tags, grupos de WhatsApp, protocolo por atendimento e histórico. Conecta por QR Code ou pela API oficial da Meta | https://acessorias.com/site/funcionalidade/komunic/ ; https://acessorias.movidesk.com/kb/pt-br/article/600564 |
| API oficial | Usa um Business Manager verificado. A conversa começa com template aprovado e depois abre a janela de 24 h. A Meta cobra direto do escritório | https://acessorias.movidesk.com/kb/pt-br/article/607366 |
| Robô de menu | Menus numerados que transferem para departamento ou abrem o "menu GED", onde o cliente busca guias sozinho. No fim, envia protocolo e avaliação | https://acessorias.movidesk.com/kb/pt-br/article/581630 |
| Integração com o Acessórias | Troca de tokens nos dois sentidos. Sincroniza empresas e contatos e manda as notificações de documento pelo WhatsApp do contato. O atendente vê o GED e as solicitações ao lado da conversa | https://acessorias.movidesk.com/kb/pt-br/article/600820 |
| IA de qualidade | Avalia o atendimento encerrado em 6 critérios (sentimento, cordialidade, resolução, linguagem, empatia, frustração), com fila de revisão humana | https://acessorias.movidesk.com/kb/pt-br/article/604656 |
| Chat interno | Chat entre colaboradores, com auditoria pelo usuário Master (10/2026) | https://acessorias.movidesk.com/kb/pt-br/article/608848 |

### 14.3 Digisac

O escritório manda URL e token da Digisac ao suporte. No chat da Digisac aparece uma aba lateral que mostra entregas e processos da empresa e permite mandar um documento do GED pelo WhatsApp. Não funciona em grupos. Fonte: https://acessorias.movidesk.com/kb/pt-br/article/295051

---

## 15. Gestão de Processos

Serve para fluxos com etapas (abertura, alteração e baixa de empresa, IRPF, rotinas internas). Atalho F10.

| Função | Como funciona | Fonte |
|---|---|---|
| Matriz (modelo) | Nome, "só sub-matriz?", "pede autorização?", departamento e "barra vermelha após N dias". Pode ser replicada e tem histórico | https://acessorias.movidesk.com/kb/pt-br/article/294990 ; https://acessorias.movidesk.com/kb/pt-br/article/596311 ; https://acessorias.movidesk.com/kb/pt-br/article/602315 |
| Passo simples | Pode ser bloqueante (os seguintes só aparecem depois), pode exigir anexo, pode aparecer no app e pode **criar uma tarefa ou uma obrigação na Lista de Entregas** para o responsável do departamento ou para o gestor, com prazo, tempo previsto e dicas | https://acessorias.movidesk.com/kb/pt-br/article/592479 |
| Sub-matriz | Bloco de passos reutilizável (ex.: "Bombeiros") | https://acessorias.movidesk.com/kb/pt-br/article/592285 |
| Desdobramento | Uma pergunta com opções; cada opção conclui o passo ou abre uma sub-matriz (ex.: "Qual o regime?") | https://acessorias.movidesk.com/kb/pt-br/article/592434 |
| Follow-up | E-mail com variáveis, disparado à mão, ao iniciar ou autorizar, ou após o OK de um passo. Pode ir para os contatos, o gestor, o criador, o responsável ou os gestores do departamento, com anexos. Dá para editar antes de enviar. **É o único jeito de mandar comunicado por e-mail** e de cobrar documento de forma recorrente | https://acessorias.movidesk.com/kb/pt-br/article/592308 ; https://acessorias.movidesk.com/kb/pt-br/article/592847 ; https://acessorias.movidesk.com/kb/pt-br/article/598872 |
| Conduzir | O polegar conclui o passo, a seta volta, o X dispensa e o avião envia o follow-up. A barra fica verde, cinza ou vermelha. O processo pode ser suspenso, desistido ou excluído. A empresa não pode ser trocada depois | https://acessorias.movidesk.com/kb/pt-br/article/294992 ; https://acessorias.movidesk.com/kb/pt-br/article/609737 |
| Autorização | Fica "aguardando autorização" e o gestor recebe e-mail com link para autorizar | https://acessorias.movidesk.com/kb/pt-br/article/599671 |
| Recorrente | Abre sozinho todo mês num dia fixo, para empresas, grupo, regimes ou tags | https://acessorias.movidesk.com/kb/pt-br/article/592848 ; https://acessorias.movidesk.com/kb/pt-br/article/595621 |
| Visível ao cliente | Os passos marcados "aparece no app" viram um checklist com percentual no app. A ideia é evitar a ligação "como está minha abertura?" | https://acessorias.movidesk.com/kb/pt-br/article/593168 ; https://www.youtube.com/watch?v=iaZvS4c5I9g |
| Status (pela API) | Em andamento, concluído, suspenso, desistência, agendado, aguardando aprovação | https://api.acessorias.com/documentation |

---

## 16. Solicitações

São os pedidos do cliente e os internos. Funcionam como **chamados com situação** e uma troca de comentários dentro do chamado.

| Função | Como funciona | Fonte |
|---|---|---|
| Cliente abre | **Só pelo app ou pela Área VIP**: assunto, departamento e tipo, comentário, anexos (foto ou arquivo) e prioridade. Acompanha em Abertas e Encerradas. O responsável do departamento recebe o e-mail "Nova solicitação" | https://acessorias.movidesk.com/kb/pt-br/article/610341 ; https://acessorias.movidesk.com/kb/pt-br/article/595068 |
| Situações | Nova, Resolvendo, Cliente (aguardando o cliente) e Finalizada; tipo interna ou externa | https://api.acessorias.com/documentation |
| Formulários flexíveis | Por tipo de pedido, criados no departamento (ex.: admissão com nome, nascimento e salário). Têm campos de texto, data, valor, CPF/CNPJ e opções, anexo obrigatório, **SLA** em dias úteis ou corridos e um campo que **cria um processo** sozinho. As respostas exportam em CSV/TXT | https://acessorias.movidesk.com/kb/pt-br/article/593696 |
| Tratamento no escritório | O escritório também abre solicitações, para o cliente ou internas. Um cadeado esconde a solicitação ou um comentário do cliente. Há responsável principal (estrela), troca de departamento, a informação de quem leu cada comentário, silenciar, filtros e Excel | https://acessorias.movidesk.com/kb/pt-br/article/592842 ; https://acessorias.movidesk.com/kb/pt-br/article/594240 ; https://acessorias.movidesk.com/kb/pt-br/article/563402 ; https://acessorias.movidesk.com/kb/pt-br/article/599616 |
| Virar processo | Qualquer solicitação pode iniciar um processo, e o progresso aparece dentro dela | https://acessorias.movidesk.com/kb/pt-br/article/594273 |
| Alertas | Interação não vista em 3 horas e resumo diário de pendentes | https://acessorias.movidesk.com/kb/pt-br/article/595068 |
| Avaliação ao finalizar | Ver seção 20 | https://acessorias.movidesk.com/kb/pt-br/article/595235 |
| Não clientes | O botão "Não sou cliente" na tela de login abre uma solicitação com tag própria | https://acessorias.movidesk.com/kb/pt-br/article/476176 |

> Para o NADS: a regra 4 do projeto diz que a Área do Cliente **não tem chat**. A conversa é pelo WhatsApp e os pedidos são solicitações com situação. A troca de comentários dentro da solicitação do Acessórias é só referência de ideia, não de modelo.

---

## 17. AC Docs (cobrança de documentos) e GED

### 17.1 AC Docs

É um módulo pago, lançado em 02/2025 (R$ 199/mês segundo a live de lançamento). Faz a cobrança recorrente de documentos que o cliente precisa mandar (extrato, notas de entrada e de saída).

| Função | Como funciona | Fonte |
|---|---|---|
| Matriz de cobrança (5 etapas) | 1) Documentos pedidos; 2) Datas: dia limite e competência (mês anterior, atual ou seguinte); 3) Departamento; 4) Lembretes por e-mail (de 15 dias antes até 15 dias depois); 5) Confirmação. Depois as empresas são alocadas por grupo, tag ou regime. O controle é gerado 20 dias antes do limite | https://acessorias.movidesk.com/kb/pt-br/article/586805 ; https://www.youtube.com/watch?v=uSQwTQsJ_kg |
| Lado do cliente | Recebe e-mail ou aviso com link que **exige login**. Em AC Doc's vê cada cobrança com vencimento e situação, e em cada item **anexa** o arquivo ou marca **dispensar** (sem movimento), além de comentar | https://acessorias.movidesk.com/kb/pt-br/article/598607 |
| Conferência no escritório | Para cada item: validar, recusar (com motivo que o cliente vê) ou dispensar no mês (com justificativa). Os lembretes só param quando 100% chega | https://acessorias.movidesk.com/kb/pt-br/article/593940 ; https://acessorias.movidesk.com/kb/pt-br/article/599111 |
| Situações | Pendente, Vencido, Parcial, Dispensado, Recebido, Validado (e Retido) | https://acessorias.movidesk.com/kb/pt-br/article/586805 ; https://acessorias.movidesk.com/kb/pt-br/article/593940 |
| Exportação | CSV com os links | https://acessorias.movidesk.com/kb/pt-br/article/603101 |
| Ligação com o atraso | **Não há** ligação documentada entre um documento "Vencido" no AC Docs e a justificativa ou a multa da obrigação na Lista de Entregas | https://acessorias.movidesk.com/kb/pt-br/article/593940 |
| Limites citados na live | Download arquivo por arquivo, sem confirmação de leitura da cobrança, sem ligação com processos e sem cobrança por WhatsApp | https://www.youtube.com/watch?v=uSQwTQsJ_kg |

### 17.2 GED

Os arquivos ficam na nuvem da Amazon, em duas pastas: **DocsEmpresa** (acervo permanente anexado ao cadastro, como o contrato social) e **DocsEntregas** (cópia de tudo que foi entregue, por departamento, tipo e ano/mês). No GED o cliente consulta, baixa e compartilha. Ele envia arquivos pelas solicitações, pelo clipe do comprovante e pelo AC Docs (um vídeo antigo diz que o cliente também sobe arquivos no GED; **a confirmar**). A franquia é de 100 MB por CNPJ, com o excedente cobrado na fatura. Fonte: https://acessorias.com/site/funcionalidade/gestao-eletronica-de-documentos/ ; https://acessorias.movidesk.com/kb/pt-br/article/595479 ; https://acessorias.movidesk.com/kb/pt-br/article/594298 ; https://www.youtube.com/watch?v=_tgHpK7PN_4

---

## 18. Certificados (AC Certifica) e certidões

| Função | Como funciona | Fonte |
|---|---|---|
| AC Certifica | Painel de vencimento de certificados digitais (ícone no topo, com permissão própria). Cadastro manual ou por CSV: identificador, nome, validade e empresas vinculadas. Uma régua de e-mails avisa o cliente antes do vencimento com link de renovação na parceira Quality Cert (só A1 PJ e PF), que dá cashback ao escritório ou desconto ao cliente (o percentual não é publicado). O status inativo para os lembretes, e há log | https://acessorias.movidesk.com/kb/pt-br/article/585261 ; https://acessorias.com/site/funcionalidade/ac-certifica/ |
| O que não faz | Não guarda o arquivo do certificado nem o usa para entrar no e-CAC ou em outro portal | https://acessorias.movidesk.com/kb/pt-br/article/585261 |
| Alternativa simples | Tarefa agendada por empresa ("renovar certificado"), seção 7 | https://acessorias.movidesk.com/kb/pt-br/article/294617 |
| Certidões (CND/CRF) | Só aparecem como **tipo de documento** que o robô pode ler e enviar, se o modelo estiver homologado. **Não foi encontrada** busca automática, monitoramento de validade nem emissão de certidões. Não há integração com Receita, SEFAZ, e-CAC ou prefeituras | https://acessorias.movidesk.com/kb/pt-br/article/297299 ; https://acessorias.com/site/integracoes/ |

---

## 19. Portal e app do cliente (Área VIP e Aplicativo)

O **app** (Android/iOS, com a marca do escritório) e a **Área VIP** (web, em vip.acessorias.com) têm as mesmas funções. O menu tem Home, Calendário, Solicitações, GED, Comunicados, Processos, AC Docs, Dashboard, Avalie-nos, Meus dados e Sair.

| Função | Como funciona | Fonte |
|---|---|---|
| Login e várias empresas | E-mail e senha, "esqueci minha senha", captcha. Quem tem várias empresas usa um botão fixo "Trocar empresa" | https://vip.acessorias.com/ ; https://app.acessorias.com/sysajuda.php?p=586 |
| Ativar o acesso | Individual: no contato, pelo robozinho (e-mail e senha). Em massa: senha provisória única e e-mail de instruções, só para contatos que nunca entraram. Também se definem dias e horários permitidos | https://acessorias.movidesk.com/kb/pt-br/article/593742 ; https://acessorias.movidesk.com/kb/pt-br/article/592712 ; https://acessorias.movidesk.com/kb/pt-br/article/295010 |
| Calendário | As guias aparecem no dia do vencimento (vermelho = novo, azul = visto, com um balão de não lidos do mês). Um cifrão abre a guia e um clipe anexa o comprovante. **Guia sem vencimento não aparece no calendário**, só no GED | https://acessorias.movidesk.com/kb/pt-br/article/592543 ; https://acessorias.movidesk.com/kb/pt-br/article/595479 |
| Quando o documento aparece | O gatilho é o **envio**: o documento só é publicado se estiver configurado para ir por e-mail. Para mandar só ao app, desmarca-se o e-mail no contato | https://acessorias.movidesk.com/kb/pt-br/article/595479 ; https://acessorias.movidesk.com/kb/pt-br/article/596171 |
| Comunicados | Título, texto e imagem, para todos ou por empresas, regimes, grupos ou tags, com data de publicação. **Só no app** (não vão por e-mail nem por WhatsApp). Há registro de leitura (empresa, usuário, data e hora) em Excel. É o único caso de push documentado | https://acessorias.movidesk.com/kb/pt-br/article/577504 ; https://acessorias.movidesk.com/kb/pt-br/article/597238 ; https://acessorias.movidesk.com/kb/pt-br/article/600423 ; https://app.acessorias.com/sysajuda.php?p=219&ctg=1 |
| Processos | Checklist com percentual, só dos passos marcados "aparece no app" | https://acessorias.movidesk.com/kb/pt-br/article/593168 |
| Dashboard | Cartões e gráficos de solicitações, comunicados lidos e não lidos e processos | https://app.acessorias.com/sysajuda.php?p=75 |
| Push de guia nova | **Não documentado** (**a confirmar**). Para guias, o que existe é o balão dentro do app, mais o e-mail e o WhatsApp | https://acessorias.movidesk.com/kb/pt-br/article/592543 |
| Política de privacidade do escritório | O escritório publica a própria política. O cliente precisa aceitar antes de usar, e o aceite é guardado por versão (uma versão nova exige novo aceite) | https://acessorias.movidesk.com/kb/pt-br/article/295003 |
| App com a marca | O escritório precisa de contas próprias de desenvolvedor: Google (US$ 25 uma vez) e Apple (US$ 99/ano), com D-U-N-S, site e domínio. Abre-se um ticket de homologação (nome de até 30 caracteres, 3 alternativas e logo), com prazo de até 30 dias úteis. O app é opcional: a Área VIP web faz o mesmo | https://acessorias.movidesk.com/kb/pt-br/article/595131 ; https://acessorias.movidesk.com/kb/pt-br/article/571950 ; https://acessorias.movidesk.com/kb/pt-br/article/598902 |
| Nas lojas | Centenas de apps de escritórios. A maioria tem de 0 a 100 downloads e nenhuma avaliação; os maiores têm nota de 3,4 a 3,9 | https://play.google.com/store/apps/dev?id=4723651188981703067 |

---

## 20. Pesquisa de satisfação (NPS)

| Função | Como funciona | Fonte |
|---|---|---|
| Avalie-nos | Nota de 0 a 10 sobre o escritório, dada no app. Vira o NPS do painel (promotores menos detratores; o fabricante sugere meta acima de 50) | https://acessorias.movidesk.com/kb/pt-br/article/592543 ; https://www.youtube.com/watch?v=vgd94NyASyk |
| Avaliação da solicitação | Ao finalizar, o cliente diz se foi resolvido (se não, informa o motivo) e dá de 1 a 5 estrelas. Até 3 estrelas pede justificativa, e nota baixa gera e-mail de aviso. As notas são vistas por empresa, e a solicitação pode ser reaberta | https://acessorias.movidesk.com/kb/pt-br/article/595235 ; https://acessorias.movidesk.com/kb/pt-br/article/598403 ; https://www.youtube.com/watch?v=_tgHpK7PN_4 |
| Komunic | Avaliação ao encerrar o atendimento por WhatsApp e análise por IA (seção 14) | https://acessorias.movidesk.com/kb/pt-br/article/581630 |

---

## 21. Relatórios e indicadores de desempenho

| Função | Como funciona | Fonte |
|---|---|---|
| Insights com filtros | Totais numéricos, por colaborador ou por departamento, com os mesmos filtros da Lista de Entregas | https://acessorias.movidesk.com/kb/pt-br/article/294531 |
| Performance Analistas / Dptos (tela nova de 06/2026) | Filtros por responsável, departamento, grupo, tag e período. Colunas (o 593504 descreve os indicadores mas não lista as colunas; a lista abaixo é do levantamento e é **a confirmar**): antecipadas, prazo técnico, atraso legal, atraso justificado, atraso sem justificativa, dispensadas, com multa, total, percentual no prazo e percentual com multa. Gráficos de cumprimento. Exporta em CSV. Substituiu as antigas estatísticas semanais e mensais | https://acessorias.movidesk.com/kb/pt-br/article/593504 ; https://app.acessorias.com/sysajuda.php?p=585 |
| Outros | Responsáveis por departamento; e-mails dos contatos (CSV); relação de obrigações dos regimes; usuários; protocolo físico; solicitações; processos em Excel; relatórios do APLA | https://acessorias.movidesk.com/kb/pt-br/article/594632 ; https://app.acessorias.com/sysajuda.php?p=92 |
| O que não há | Relatório pronto de multas por cliente; valor da multa em reais; fórmula publicada do percentual de cumprimento | https://acessorias.movidesk.com/kb/pt-br/article/593504 |

---

## 22. Administrativo, honorários e Método APLA

| Função | Como funciona | Fonte |
|---|---|---|
| Campo honorário | Digitado na empresa. Serve **só** de insumo para o APLA | https://app.acessorias.com/sysajuda.php?p=164 |
| Método APLA | Entradas: salário, encargos, benefícios e minutos úteis de cada colaborador; tempo previsto de cada obrigação (a da empresa prevalece sobre a do regime e a geral); custos fixos; honorário de cada empresa. Saídas: **Produtividade** (minutos alocados x disponíveis; vermelho até 30%, amarelo de 31 a 60%, verde de 61 a 100%, roxo é sobrecarga), **Lucratividade** (honorário menos custo de RH e rateio de custos fixos, por cliente) e um dashboard com custo do minuto, capacidade de expansão, ticket médio e "dinheiro na mesa" | https://acessorias.movidesk.com/kb/pt-br/article/592831 ; https://acessorias.movidesk.com/kb/pt-br/article/592833 ; https://acessorias.movidesk.com/kb/pt-br/article/592834 ; https://acessorias.movidesk.com/kb/pt-br/article/592835 |
| Cobrança de honorários do escritório | **Não há evidência pública** de boleto, PIX, NFS-e, contas a receber, reajuste, inadimplência, contrato, proposta ou CRM de vendas | http://acessorias.com/site/ ; https://app.acessorias.com/sysajuda.php?q=boleto |
| `GET /invoices` na API | Consulta de boletos, só leitura (vencimento, pagamento, valor, taxa, status, nota, itens com plano de contas). O formato sugere honorários por empresa cliente, mas nenhuma tela descreve como eles são gerados (**a confirmar**) | https://api.acessorias.com/documentation |
| Boletos da Acessórias | Engrenagem > Boletos e NFS-e (só com a permissão Administrativa) mostra a mensalidade do próprio escritório, com PIX. O atraso bloqueia o acesso, que volta em até 4 h depois do pagamento | https://acessorias.movidesk.com/kb/pt-br/article/593062 |
| Armazenamento | A tela mostra o uso por módulo e o excedente que entra na próxima fatura | https://acessorias.movidesk.com/kb/pt-br/article/594298 |

---

## 23. Integrações, API e MCP

| Função | Como funciona | Fonte |
|---|---|---|
| API REST | Base https://api.acessorias.com, com token Bearer por usuário (que herda as permissões dele), gerado em engrenagem > API Token. Limite de 100 req/min (429). Erros de negócio voltam com HTTP 200. Paginação de 20 ou 50. **Sem webhooks**: sincroniza-se por consulta incremental (DtLastDH; no ListAll de entregas, só hoje e ontem) | https://api.acessorias.com/documentation |
| O que a API lê | Empresas (com obrigações e contadores), contatos, tags, grupos, usuários, departamentos, entregas (status, multa S/N, lida, responsáveis, anexo com link de 60 min), solicitações, matrizes, processos, boletos | idem |
| O que a API escreve | Empresas, contatos, tags, grupos, responsáveis em lote (até 50, reatribuindo pendências), solicitações (criar, comentar, mudar status), iniciar processo e `POST /econtinuo`. **Não há rota para dar baixa nem anexar numa entrega** | idem |
| MCP (IA) | Servidor em https://api.acessorias.com/mcp com o mesmo token. Consulta entregas, empresas, solicitações e processos; edita empresas, contatos, tags, grupos e solicitações; inicia processos. Não mexe em anexos nem no robô. Funciona em Claude, ChatGPT e Gemini (via Antigravity); não serve em cliente que só aceita OAuth. Em beta desde 09/2026 | https://acessorias.movidesk.com/kb/pt-br/article/603864 ; https://acessorias.movidesk.com/kb/pt-br/article/603861 ; https://acessorias.movidesk.com/kb/pt-br/article/603866 |
| Contmatic | Por token: importa empresas (na primeira vez tudo, depois os alterados em 30 dias), e o sincronizador da Contmatic manda as guias direto ao robô. Tem formulário de admissão preliminar no app que grava na Contmatic | https://acessorias.movidesk.com/kb/pt-br/article/325744 ; https://acessorias.movidesk.com/kb/pt-br/article/476182 |
| Contabit e Consisa | As guias geradas lá chegam ao robô; a Consisa sincroniza também o cadastro | https://acessorias.com/site/integracoes/ |
| Jettax | Apura e envia por API DAS, DAS-MEI, Difal, ICMS-ST, ISS e DCTFWeb, que vão ao cliente sem upload manual | https://acessorias.movidesk.com/kb/pt-br/article/555128 |
| Domínio, Alterdata, Questor, SCI, Fortes | **Sem integração nativa.** O caminho é salvar o PDF na pasta do robô e importar empresas por CSV (há guia para exportar do Domínio) | https://acessorias.movidesk.com/kb/pt-br/article/365165 |
| Órgãos públicos | Nenhuma integração com e-CAC, Receita, SEFAZ ou prefeituras | https://acessorias.com/site/integracoes/ |
| Digisac e Komunic | Seção 14 | https://acessorias.movidesk.com/kb/pt-br/article/295051 |

---

## 24. Planos e preços

Não há tabela pública: tudo passa por demonstração com consultor.

| Item | O que se sabe | Fonte |
|---|---|---|
| Modelo do plano | Pacote com limite de CNPJs ativos (há contador no menu Empresas). Para aumentar, abre-se ticket comercial | https://acessorias.movidesk.com/kb/pt-br/article/596518 |
| Armazenamento | 100 MB por CNPJ; o excedente é cobrado na fatura | https://acessorias.movidesk.com/kb/pt-br/article/594298 |
| Acessórias Docs | R$ 199/mês, sem fidelidade (dito em live) | https://www.youtube.com/watch?v=uSQwTQsJ_kg |
| Módulo de Disparos | 0,25 por CNPJ ao mês, sem fidelidade | https://acessorias.movidesk.com/kb/pt-br/article/598940 |
| AC Notifica, API e MCP | Sem taxa extra | https://acessorias.movidesk.com/kb/pt-br/article/585262 ; https://api.acessorias.com/documentation |
| Komunic | Por licenças de usuário e conexões. Análise por IA: cortesia de 1 a cada 4 atendimentos (até 300/mês) e pacotes de 100 a 2.000 por mês "a partir de R$ 37" (live) | https://acessorias.movidesk.com/kb/pt-br/article/611594 ; https://www.youtube.com/watch?v=cKYIpgTLE84 |
| Valores relatados por clientes | De cerca de R$ 250 a R$ 730 por mês, mais taxa de implantação. São relatos individuais, não verificados | https://www.reclameaqui.com.br/empresa/acessorias-com/lista-reclamacoes/ |
| Fidelidade, multa, reajuste | Sem fonte oficial. Há aviso prévio no cancelamento, de prazo desconhecido (**a confirmar**) | https://acessorias.movidesk.com/kb/pt-br/article/593262 |

---

## 25. Suporte, implantação, LGPD e saída

| Item | Como funciona | Fonte |
|---|---|---|
| Central de ajuda | Base Movidesk com cerca de 310 a 350 artigos. O "Manual Completo - Comece Aqui" é o índice | https://acessorias.movidesk.com/kb/pt-br/article/602057 |
| IA de atendimento | Um chat no sistema responde com tutoriais (aceita imagem e áudio) e passa para um humano quando pedido. Não trata de contrato nem de cobrança | https://acessorias.movidesk.com/kb/pt-br/article/598759 |
| Outros canais | Tickets, chat, telefone/WhatsApp; Academy dentro do sistema, com aulas ao vivo | https://www.youtube.com/@Acess%C3%B3rias/playlists |
| Implantação | Aulas online por cerca de uma semana, em grupo ou com consultoria dedicada | https://acessorias.com/site/sistema-de-gestao-para-escritorio-contabil/ |
| LGPD | Na política do app, o escritório é o controlador e a Acessórias é a operadora. Cancelado o contrato, os dados são apagados em 30 dias | https://app.acessorias.com/sysviewpolitica.php |
| Backup da base | Só depois do cancelamento: até 30 dias (até 120, conforme avaliação), enviado ao sócio. Vem um ZIP com arquivos, planilha de empresas e a Lista de Entregas com logs de leitura. **Solicitações, Processos e AC Docs não vão** | https://acessorias.movidesk.com/kb/pt-br/article/597852 |
| Cancelamento | Só por e-mail (cancelamento@acessorias.com). Ao cancelar, a equipe e os clientes perdem o app e a Área VIP | https://acessorias.movidesk.com/kb/pt-br/article/593262 |

---

## 26. Fluxo do dia a dia, de ponta a ponta

Esta seção junta as peças acima numa sequência só. Fontes principais: https://acessorias.movidesk.com/kb/pt-br/article/599014 ; https://acessorias.movidesk.com/kb/pt-br/article/595290 ; https://acessorias.movidesk.com/kb/pt-br/article/592543 ; https://acessorias.movidesk.com/kb/pt-br/article/600317 ; https://www.youtube.com/watch?v=ITPUmwCcP_M

### 26.1 A obrigação nasce (uma vez, na implantação)

1. O escritório cadastra a **obrigação** uma vez: departamento, prazo legal mês a mês, prazo técnico, multa sim/não, se exige robô, tempo previsto (seção 9).
2. Coloca a obrigação num **regime** (pacote) ou num **grupo de obrigações** (seção 8).
3. Cadastra a **empresa**, escolhe o regime e herda o pacote. Define o **responsável por departamento** e os **contatos** com os departamentos que cada um recebe (seção 7).
4. Ao vincular, o sistema **gera as demandas** de até 4 meses à frente (2 anos nas anuais) na Lista de Entregas, já no nome do responsável. Uma rotina continua gerando os lotes seguintes.
5. Uma vez para cada tipo de guia, o escritório sobe um PDF de exemplo no robô e diz qual obrigação ele baixa e como envia (seção 11).

### 26.2 A obrigação é feita (todo mês)

1. **Segunda-feira de madrugada** cada colaborador recebe o **planejamento semanal** em PDF. O painel mostra as pendências por departamento (seções 4 e 10).
2. Quando começa o **prazo técnico**, a demanda fica amarela e o responsável passa a ser alertado.
3. O colaborador gera a guia **no sistema contábil** (o Acessórias não gera guia) e salva o PDF na **pasta do robô**, ou anexa na demanda. Um parceiro também pode mandar a guia por API (Jettax, Contmatic).

### 26.3 A obrigação é enviada

1. O robô lê o PDF: identificador, então empresa; tipo, então obrigação; competência; vencimento.
2. Dá **baixa** na demanda (azul se antecipada, amarela se no prazo técnico, vermelha se atrasada), guarda o backup e o arquivo no GED.
3. Conforme o modo do documento: e-mail **imediato**, **agendado** (junta tudo do departamento no horário da régua), **pré-agendado**, **grupo de envio** (só quando todas do grupo estiverem prontas) ou **aos gestores** para conferência.
4. Ao mesmo tempo sai o aviso no **WhatsApp** (AC Notifica), e a guia é publicada no **calendário** e no GED do app, se tiver vencimento.
5. Se o envio falha por cadastro (sem contato, e-mail inválido, departamento desmarcado), aparece o envelope de borda grossa ou o relógio vermelho, e um **e-mail de alerta** vai para sócios e gerentes. O status "processada" do robô **não** prova que o e-mail saiu.

### 26.4 O cliente lê

1. O cliente recebe o e-mail com **link** (sem login, salvo se o escritório ligar a exigência) e o WhatsApp com link de 30 dias.
2. Ao clicar, o envelope passa de **vermelho para azul**, e o protocolo guarda data, hora e IP. No WhatsApp, a pré-visualização pode marcar como lido sem o cliente ter lido.
3. No app, a data do calendário passa de vermelha para azul. O cliente pode anexar o **comprovante de pagamento** pelo clipe.
4. Se o cliente precisa de algo, abre uma **solicitação** no app (não há chat livre fora dela).

### 26.5 O que acontece no atraso

| Situação | O que o Acessórias faz | Fonte |
|---|---|---|
| Escritório ainda não fez e o prazo técnico começou | A demanda fica amarela, entra no "Prazo téc" do painel e no planejamento semanal | https://acessorias.movidesk.com/kb/pt-br/article/294577 ; https://acessorias.movidesk.com/kb/pt-br/article/589152 |
| Passou do prazo legal | Fica vermelha ("Atrasada!"). Se for passível de multa, entra em "Atraso com multa" e ganha o cifrão vermelho. A empresa ganha o polegar vermelho na lista | https://acessorias.movidesk.com/kb/pt-br/article/589152 ; https://www.youtube.com/watch?v=Dl2ir-wXBJs |
| O atraso tem motivo | O colaborador escreve a **justificativa** (texto livre, sem aprovação), e a demanda vai para "Justificadas". No relatório, sai de "atraso sem justificativa" | https://acessorias.movidesk.com/kb/pt-br/article/294938 ; https://acessorias.movidesk.com/kb/pt-br/article/593504 |
| A obrigação não se aplica naquele mês | **Dispensa** (uma a uma, com justificativa obrigatória se configurado, ou em massa com senha). Os meses seguintes continuam nascendo | https://acessorias.movidesk.com/kb/pt-br/article/596983 ; https://acessorias.movidesk.com/kb/pt-br/article/594817 |
| Falta documento do cliente | Se o escritório usa o AC Docs, o cliente é cobrado por régua de e-mail até mandar tudo. **Não há ligação automática** com a justificativa da obrigação atrasada | https://acessorias.movidesk.com/kb/pt-br/article/593940 |
| Cliente recebeu e não abriu | A **régua de lembretes** (ex.: 2, 1 e 0 dias antes do vencimento) reenvia por e-mail e WhatsApp só para quem não abriu | https://acessorias.movidesk.com/kb/pt-br/article/600317 |
| Guia vencida, cliente não pagou | **Não há** cobrança automática de guia vencida e não paga documentada. O AC Notifica cita "lembrete de guia vencida não lida". A guia recalculada pode ser reenviada com "reprocessa e desativa" | https://acessorias.movidesk.com/kb/pt-br/article/585262 ; https://acessorias.movidesk.com/kb/pt-br/article/294972 |
| Gestão | O gestor acompanha pelo painel (TV), pelo planejamento semanal e pelo relatório de Performance por analista e departamento (percentual no prazo, percentual com multa) | https://acessorias.movidesk.com/kb/pt-br/article/593504 |

---

## 27. O que os usuários elogiam e reclamam

As avaliações independentes são poucas. O Reclame Aqui é a maior fonte e puxa naturalmente para o lado negativo. Não há página no Capterra, no G2 nem no B2B Stack. Panorama do Reclame Aqui (01/05 a 31/10/2026): reputação "Regular", nota 6,2/10, 42 reclamações no semestre, 100% respondidas, 56% resolvidas, 40% voltariam a fazer negócio. Fonte: https://www.reclameaqui.com.br/empresa/acessorias-com/lista-reclamacoes/

### 27.1 O que elogiam

| Elogio | Detalhe | Fonte |
|---|---|---|
| Entrega de documentos ao cliente pelo app e por e-mail, com comprovante | É o motivo citado para usar o sistema. Parceiros destacam o protocolo digital | https://www.contabeis.com.br/forum/tecnologia-contabil/388617/melhor-sistema-de-gestao-e-automacao-de-obrigatoriedades/ ; https://blog.contmatic.com.br/o-que-e-o-acessorias-e-como-ele-organiza-a-operacao-do-escritorio-contabil-que-utiliza-a-contmatic/ |
| Automação profunda (robô) | Faz o escritório ficar: quem reclama diz que só não sai porque teria de refazer todos os fluxos ("mal necessário") | https://www.reclameaqui.com.br/acessorias-com/sistema-acessorias-tecnologia-ultrapassada-interface-hostil-e-bloqueio-arbitrario-apos-pagamento_o7jDQi0AfuLqznIH/ |
| Funciona com vários sistemas contábeis | Qualquer sistema que gere PDF de texto serve. Isso é motivo de escolha frente ao Gestta, cuja baixa automática é ligada ao Domínio | https://www.jettax.com.br/blog/o-que-e-o-acessorias-e-como-ele-organiza-a-operacao-do-escritorio-contabil-que-utiliza-a-jettax/ ; https://andersonhernandes.com.br/gesta-o-que-e-como-funciona/ |
| Menos multas e mais produtividade | Depoimentos do próprio fabricante (não são independentes) | https://acessorias.com/site/ |

### 27.2 O que reclamam (em ordem de volume)

| # | Reclamação | Detalhe | Fonte |
|---|---|---|---|
| 1 | Reajuste unilateral em 2026 (20% a 33%) | Fora do IPCA do contrato, sem negociação, atrelado a módulos novos que o cliente não pediu (WhatsApp, certificadora), o que alguns chamam de venda casada | https://www.reclameaqui.com.br/acessorias-com/aumento-sem-aviso-previo-sem-negociacao-e-sem-qualquer-sentido_7V8cx-SC7Mq3w89j/ ; https://www.reclameaqui.com.br/acessorias-com/aumento-abusivo-contrato-acessorias-e-venda-casada-com-certificadora-digital_8y2c7S4PD81db6rY/ |
| 2 | Bloqueio rápido por atraso no pagamento | Impede enviar guias, e segundo um relato até os links já enviados aos clientes param de abrir | https://www.reclameaqui.com.br/acessorias-com/aumento-indevido-do-valor-apos-contratacao-do-servico-e-bloqueio-de-acesso_2g9YCNv3YZXi5nnP/ |
| 3 | Suporte | Só chat, triagem por IA que não passa para humano, chamado fechado sem solução, melhorias pedidas há anos | https://www.reclameaqui.com.br/acessorias-com/problemas-de-acesso-e-atendimento-precario_euprRyAO25TruJGk/ |
| 4 | Komunic / WhatsApp | 6 dias fora do ar; número banido pela Meta depois de envio em lote (num caso, duas vezes); documento indo para contato errado | https://www.reclameaqui.com.br/acessorias-com/sistema-komunic-indisponivel-por-6-dias-impossibilitando-envio-de-mensagens-a-clientes-e-prejudicando-financeiramente-a-empresa_ujNH7qMONFXpuncJ/ ; https://www.reclameaqui.com.br/acessorias-com/reajuste-abusivo-e-bloqueio-de-telefone-comercial-apos-adesao-a-ferramenta-de-whatsapp_IuNLmxcTjM7iG5Ey/ |
| 5 | Cancelamento burocrático e implantação cara | Aviso prévio pago, cobrança depois do cancelamento, treinamentos não dados, app pago e não entregue | https://www.reclameaqui.com.br/acessorias-com/descaso-do-inicio-ao-fim_eHZXAp6tOw_5k4mD/ ; https://www.reclameaqui.com.br/acessorias-com/nao-entrega-do-aplicativo-cobranca-indevida-e-solicitacao-de-cancelamento-e-reembolso_DvsNEJTpPXXr-o7P/ |
| 6 | Robô que não reconhece documento ou erra a competência | NFS-e de Fortaleza não lida há 2 anos; guia baixada no mês anterior | https://www.reclameaqui.com.br/acessorias-com/suporte-humilhante-e-sistema-que-nao-envia-nota-fiscal-de-fortaleza_3D3qFs8v-APoakuk/ ; https://www.reclameaqui.com.br/acessorias-com/sistema-de-acessorias-envia-obrigacoes-para-competencia-incorreta-e-suporte-nao-resolve_QRAwRdfADZkHpKxH/ |
| 7 | Reenvio sem escolher os itens | Não dá para escolher quais guias reenviar | https://www.reclameaqui.com.br/acessorias-com/problemas-com-relatorios-travados-exportacao-com-caracteres-erroneos-e-reenvio-de-guiasdocumentos-nao-selecionavel-na-empresa-acessorias_d67OFK-Z4pJc6WxT/ |
| 8 | Relatórios travados e exportação com acentos quebrados | Relatórios pouco flexíveis | idem |
| 9 | Interface antiga, não aguenta várias abas | "Engessado", cliques demais | https://www.reclameaqui.com.br/acessorias-com/sistema-acessorias-tecnologia-ultrapassada-interface-hostil-e-bloqueio-arbitrario-apos-pagamento_o7jDQi0AfuLqznIH/ ; https://www.contabeis.com.br/forum/tecnologia-contabil/407580/configuracao-do-tareffa-web-tareffa-com-br/ |
| 10 | 2FA só por e-mail | Código que chega vencido, sessão que cai | https://www.reclameaqui.com.br/acessorias-com/suporte-inoperante-e-autenticacao-de-dois-fatores-falha-no-sistema_1qh7gkTSXlL1auqJ/ |
| 11 | Guia adulterada | Um cliente pagou R$ 6.061,40 de uma guia adulterada que chegou com o visual de sempre. A Acessórias diz não ter achado falha do lado dela; o caso ficou sem solução | https://www.reclameaqui.com.br/acessorias-com/falha-grave-de-seguranca-na-entrega-de-guias-do-simples-nacional-resultou-em-prejuizo-financeiro-para-o-cliente_Ii4Nf0GbGcLvFL8b/ |
| 12 | Preço só depois da demonstração | Contadores reclamam da falta de transparência | https://www.contabeis.com.br/forum/tecnologia-contabil/388617/melhor-sistema-de-gestao-e-automacao-de-obrigatoriedades/ |

Nos próprios vídeos, o diretor comercial admite que clientes dizem que o produto "estacionou" (https://www.youtube.com/watch?v=cKYIpgTLE84).

### 27.3 O que dizem que falta e por que saem

- **Falta:** reenvio seletivo, relatórios flexíveis, uso em várias abas, mais de um método de 2FA, WhatsApp estável (oficial), atendimento humano e por telefone, preço transparente.
- **Por que saem:** preço e reajuste, suporte, e concorrentes vistos como mais modernos (Nibo pelo assistente de WhatsApp; Gestta pela organização). Fonte: https://www.contabeis.com.br/forum/tecnologia-contabil/388617/melhor-sistema-de-gestao-e-automacao-de-obrigatoriedades/

---

## 28. O que ficou sem confirmação

Estes pontos ficam como **"a confirmar"** e não devem ser tratados como fato em nenhum plano:

1. As telas do sistema logado; tudo veio de texto, vídeo e algumas capturas da central.
2. Se fica registrado **qual contato** abriu a guia (o envelope parece ser um só por entrega).
3. A validade do link do e-mail e o que o cliente vê ao abrir um link expirado ou desativado.
4. A tela com IP da leitura e um relatório de protocolo por guia (o IP aparece no "PDF relação com comentários" e no site).
5. Onde o escritório vê o comprovante de pagamento anexado pelo cliente e se a guia fica marcada como paga.
6. Push de guia nova ou de vencimento (só há push documentado para comunicados).
7. A "assinatura digital" citada no site.
8. Quem emite os boletos de `GET /invoices`.
9. Se a conta nova já vem com obrigações e regimes prontos.
10. O horizonte de geração: 3 ou 4 meses (o artigo do motor diz 4).
11. A opção "N-ésimo dia útil" no prazo legal (aparece em vídeo antigo; o manual só conhece dia fixo).
12. Fidelidade, multa, índice de reajuste e prazo do aviso prévio do contrato.
13. Se AC Docs, AC Certifica, AC Notifica e APLA estão no plano base ou são pagos à parte (só o AC Docs tem preço citado, R$ 199/mês).
14. Lista e quantidade de modelos homologados no robô.
15. Se o cliente consegue subir arquivos diretamente no GED.
16. Se o prazo técnico conta dias úteis ou corridos e se há a opção "sábado é útil?" (o artigo 294577 não diz).
17. O limite de caracteres da justificativa de atraso (o 584134 fala em 200 caracteres para o comentário da lista).
18. Se o AC Notifica já oferece a API oficial da Meta (o artigo descreve só QR Code; uma live de 10/2026 cita a opção).
19. As colunas exatas do relatório de Performance (o 593504 descreve indicadores, não colunas).
