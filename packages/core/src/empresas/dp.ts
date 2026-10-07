// Os clientes do Departamento Pessoal (Vitor, 06/10/2026: "eu queria incluir ele no nads … ele seria a rotina do dp"), da
// planilha do Checklist Folha (checklist_folha.html; atualizada pela RESPONSAVEIS.xls em 07/10/2026): o enquadramento, o responsável, o movimento (Folha,
// Pró-Labore, Sem Movimento ou Apenas REINF), se a REINF está autorizada, quais obrigações do mês cada um tem, como recebe
// (a entrega) e o agrupamento. A rotina do DP usa as obrigações para saber quais etapas valem para a empresa.
// Gerado da planilha; para mudar um cliente, mude a linha dele aqui.
import { EMPRESAS } from './lista';
import type { EmpresaDoEscritorio } from './tipos';

export type MovimentoDp = 'Folha' | 'Sem Movimento' | 'Pró-Labore' | 'Apenas REINF';

/** As obrigações do mês, na ordem das colunas da planilha. */
export const OBRIGACOES_DP = [
  { id: 'recibos', rotulo: 'Recibos', nome: 'Recibos de pagamento' },
  { id: 'folha', rotulo: 'Folha', nome: 'Folha de pagamento' },
  { id: 's1200', rotulo: 'S-1200', nome: 'eSocial S-1200' },
  { id: 's1210', rotulo: 'S-1210', nome: 'eSocial S-1210' },
  { id: 's1299', rotulo: 'S-1299', nome: 'eSocial S-1299' },
  { id: 'dctfweb', rotulo: 'DCTFWeb', nome: 'DCTFWeb' },
  { id: 'darf', rotulo: 'DARF', nome: 'DARF (INSS/IRRF)' },
  { id: 'fgts', rotulo: 'FGTS', nome: 'FGTS Digital' },
  // o crédito do trabalhador (Vitor, 07/10/2026: "uma opção de eConsignado")
  { id: 'econsignado', rotulo: 'eConsig.', nome: 'eConsignado' },
] as const;
export type ObrigacaoDp = (typeof OBRIGACOES_DP)[number]['id'];

export interface ClienteDoDp {
  codigo: number;
  nome: string;
  /** Simples, Presumido, Real, Isentas, Física, Domésticas, MEI */
  enquadramento: string;
  /** o responsável do Fiscal pela empresa (a coluna Responsável da planilha é do Fiscal; vazio = sem responsável) */
  responsavel: string;
  movimento: MovimentoDp;
  reinfAutorizada: boolean;
  obrigacoes: ObrigacaoDp[];
  /** como as guias chegam ao cliente (Office boy, eContador, WhatsApp, E-mail, Malote, Em mãos) */
  entrega: string;
  agrupamento: string;
}

// [código, nome, enquadramento, responsável, movimento, REINF autorizada, obrigações (1 = tem, na ordem de OBRIGACOES_DP), entrega, agrupamento]
type Linha = [number, string, string, string, MovimentoDp, 0 | 1, string, string, string];
const LINHAS: readonly Linha[] = [
  [6,"VANDERLEI RUFINO DOS SANTOS","Física","","Sem Movimento",0,"00001110","Office boy",""],
  [10,"DORNAS HAVANA LTDA","Simples","HEVERTON","Folha",1,"11111111","Office boy","SEM AGRUPAMENTO"],
  [15,"CERAMICA FORTALEZA LTDA","Simples","FABIANA","Folha",0,"11111111","Malote","CERAMICAS"],
  [23,"FLORENCIO MENDES DE OLIVEIRA LTDA","Simples","ADIVANIA","Folha",0,"11111111","Office boy","CASA TAIO"],
  [37,"LOTERIAS FREITAS & MENDES LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [40,"MADEIREIRA E MARCENARIA MIRANDA LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy",""],
  [43,"ORGANIZACAO ALVES & ARAUJO CONFECCOES LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [49,"POSTO DE COMBUSTIVEIS ALTA FLORESTA LTDA","Presumido","HEVERTON","Folha",1,"11111111","WhatsApp","POSTOS"],
  [50,"ROSA MENDES DE OLIVEIRA CORBELLI LTDA","Simples","ADIVANIA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [51,"ROSILENE MARQUES MARTINS","Simples","GUSTAVO","Sem Movimento",0,"00001100","Office boy",""],
  [54,"SERRALHERIA OURO VERDE LTDA","Simples","ADIVANIA","Folha",0,"11111111","Office boy","SERRALHERIA"],
  [55,"TORRA TORRA LTDA","Simples","HEVERTON","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [58,"TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA","Simples","ADIVANIA","Folha",0,"11111111","eContador","TORNEARIA VOLPONI"],
  [62,"CARLOS LUCAS MENDES - FAZ. TABATINGA","Física","","Folha",0,"11111111","Office boy","CARLOS LUCAS"],
  [65,"MERCEARIA LAGOA GRANDE LTDA","Simples","GUSTAVO","Folha",0,"11111111","Em mãos",""],
  [66,"ADERLEI DOS SANTOS & CIA LTDA","Presumido","GUSTAVO","Folha",0,"11111111","WhatsApp","POSTOS"],
  [79,"BN ELETRODOMESTICOS LTDA","Simples","ADIVANIA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [80,"TECNOAGRO PROJETOS E CONSULTORIA LTDA","Simples","ADIVANIA","Sem Movimento",0,"00001100","Office boy",""],
  [81,"CERAMICA MINAS FORTE LTDA","Simples","FABIANA","Folha",0,"11111111","eContador","CERAMICAS"],
  [83,"GRIFFIN ARTIGOS DO VESTUARIO E ACESSORIOS LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [86,"BIBOKA EMBALAGENS LTDA","Simples","HEVERTON","Sem Movimento",0,"00001100","Office boy","FLAVINHA"],
  [96,"BIG LANCHES DE TAIOBEIRAS LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111110","Office boy","SEM VARIAVEIS"],
  [101,"CAULIM ALVES DE SOUZA LTDA","Simples","GUSTAVO","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [137,"FLORENCIO MENDES DE OLIVEIRA","Física","","Folha",0,"11111111","Office boy","CASA TAIO"],
  [145,"BN ELETRODOMESTICOS LTDA","Simples","ADIVANIA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [147,"FLORENCIO MENDES DE OLIVEIRA LTDA - FILIAL 04","Simples","ADIVANIA","Sem Movimento",0,"00001100","Office boy","CASA TAIO"],
  [149,"ROSILENE MARQUES MARTINS  - FILIAL","Simples","GUSTAVO","Sem Movimento",0,"00001100","Office boy",""],
  [152,"JANIO JOSE DE ALMEIDA","Simples","GUSTAVO","Pró-Labore",0,"11111110","Office boy",""],
  [174,"ARMARINHO E PAPELARIA TAIOBEIRAS LTDA","Simples","HEVERTON","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [175,"CONSTRU-G MIRANDA MATERIAIS DE CONSTRUCAO LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [177,"EDSON FREITAS LIMA","Domésticas","","Folha",0,"11111111","Office boy","DOMÉSTICAS"],
  [179,"FLORENCIO MENDES DE OLIVEIRA","Física","","Folha",0,"11111111","Office boy","CASA TAIO"],
  [181,"JOSE MENDES FREITAS","Física","","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [183,"CLEIA CRUZ DE OLIVEIRA - CPF 033.911.646.38","Simples","HEVERTON","Folha",1,"11111101","Office boy","SEM VARIAVEIS"],
  [191,"PEDRO JORGE SANTOS SOUZA","Física","","Folha",0,"11111111","E-mail","SEM VARIAVEIS"],
  [205,"ADEMILSON OLIVEIRA CRUZ","Simples","GUSTAVO","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [207,"BMJ SOM AUTOMOTIVO LTDA","Simples","GUSTAVO","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [226,"CARLOS LUCAS MENDES - FAZ. GAMELEIRA","Física","","Folha",0,"11111111","Office boy","CARLOS LUCAS"],
  [228,"CARLOS LUCAS MENDES - SAO JOSE","Física","","Folha",0,"11111111","Office boy","CARLOS LUCAS"],
  [231,"AUTO GIRO PECAS E ACESSORIOS LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111110","Office boy","SEM VARIAVEIS"],
  [232,"VICTOR GOMES ARRUDA SPOSITO","Física","","Folha",0,"11111111","eContador","VICTOR SPOSITO"],
  [236,"MINIMERCADO SANTO EXPEDITO LTDA","Simples","ADIVANIA","Folha",0,"11111111","Office boy",""],
  [237,"POSTO DE COMBUSTIVEIS BERIZAL LTDA","Presumido","HEVERTON","Folha",0,"11111111","eContador","POSTOS"],
  [249,"LOTERIAS TAIOBEIRAS LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [250,"BRASAO INDUSTRIA FLORESTAL LTDA","Simples","GUSTAVO","Folha",0,"11111111","Malote",""],
  [252,"RENALD DA CRUZ FILHO LIMITADA","Simples","ADIVANIA","Folha",0,"11111111","E-mail","SEM VARIAVEIS"],
  [257,"MODELO TRANSPORTES E SERVICOS LTDA","Simples","ADIVANIA","Sem Movimento",0,"00001100","eContador","VICTOR SPOSITO"],
  [265,"ALTA FLORESTA TRANSPORTES LTDA","Simples","FABIANA","Folha",0,"11111111","WhatsApp","SEM VARIAVEIS"],
  [269,"VALDELICE ROCHA ALMEIDA","Domésticas","","Folha",0,"11111111","Malote","DOMÉSTICAS"],
  [277,"G.A.S SERVICOS LABORATORIAIS LTDA","Simples","HEVERTON","Folha",1,"11111111","E-mail",""],
  [279,"ALMEIDA & SOUZA PRODUTOS ALIMENTICIOS LTDA","Simples","HEVERTON","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [284,"NILMA CONTABILIDADE LTDA","Simples","FABIANA","Folha",0,"11111111","Em mãos","SEM AGRUPAMENTO"],
  [285,"CRUZ E COELHO SERVICOS MEDICOS LTDA","Simples","GUSTAVO","Sem Movimento",0,"00001100","WhatsApp",""],
  [286,"CRIATIVA EDUCACAO E TREINAMENTO LTDA","Simples","FABIANA","Sem Movimento",0,"00001100","eContador","CRIATIVA"],
  [287,"CRIATIVA PRESTACOES DE SERVICOS EDUCACIONAIS LTDA","Simples","FABIANA","Folha",0,"11111111","eContador","SEM VARIAVEIS"],
  [288,"VOLPONI COMERCIO DE ACESSORIOS LTDA","Simples","GUSTAVO","Folha",0,"11110000","E-mail",""],
  [289,"VOLPONI INDUSTRIA MECANICA LTDA","Simples","ADIVANIA","Folha",0,"11111111","eContador",""],
  [291,"G.A.S SAUDE DE DIVISA ALEGRE LTDA","Simples","HEVERTON","Sem Movimento",1,"00001100","E-mail",""],
  [292,"FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA","Presumido","HEVERTON","Folha",1,"11111111","Office boy","FITO"],
  [298,"TEOBALDO MENDES DE OLIVEIRA LTDA","Simples","HEVERTON","Folha",0,"11111111","Office boy","TEOBALDO"],
  [299,"TEOBALDO MENDES DE OLIVEIRA LTDA - FILIAL 02","Simples","HEVERTON","Folha",0,"11111111","Office boy","TEOBALDO"],
  [300,"TEOBALDO MENDES DE OLIVEIRA LTDA - FILIAL 03","Simples","HEVERTON","Folha",0,"11111111","Office boy","TEOBALDO"],
  [307,"REGINALDA PEREIRA DA SILVA SOUSA 14920571690","Simples","GUSTAVO","Pró-Labore",0,"00000000","Office boy",""],
  [309,"FITO ALIMENTOS LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy",""],
  [310,"MOR LABORATORIO NUTRICIONAL LTDA","Simples","GUSTAVO","Sem Movimento",0,"00001100","Office boy",""],
  [311,"SELMA SIMONELLY DA SILVA PEREIRA 84343540634","MEI","","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [313,"EMPORIO DAS CARNES LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [314,"M A REFLORESTAMENTO E TRANSPORTES LTDA","Simples","ADIVANIA","Folha",0,"11111111","WhatsApp",""],
  [326,"LEONEL RODRIGUES REPRESENTACOES LTDA","Simples","FABIANA","Pró-Labore",0,"11111110","eContador",""],
  [332,"DOMINGA ROSA GOMES 06371828630","Simples","ADIVANIA","Pró-Labore",0,"11111110","Office boy",""],
  [342,"ASSOCIACAO DE MULHERES EM PROL DO DESENVOLVIMENTO DE RI","Isentas","NILMA","Sem Movimento",0,"00001100","E-mail","ASSOCIAÇÕES"],
  [343,"RAIZZ EMPORIO DA SAUDE LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [345,"EMPREENDIMENTO OLIVEIRA E COSTA LTDA","Simples","FABIANA","Pró-Labore",0,"11111110","Office boy",""],
  [347,"SILVANDE AUGUSTO MIRANDA","Física","","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [348,"ORGANIZACOES JG LTDA","Simples","ADIVANIA","Folha",0,"11111111","eContador","SEM VARIAVEIS"],
  [353,"SAMIR LUCAS MENDES","Física","","Folha",0,"11111111","eContador","VICTOR SPOSITO"],
  [356,"A7 COMERCIO DE VEICULOS LTDA","Presumido","HEVERTON","Sem Movimento",1,"00001100","E-mail",""],
  [358,"MITRA TRANSPORTES E SERVICOS LTDA","Presumido","NILMA","Sem Movimento",0,"00001110","E-mail",""],
  [359,"MITRA TRANSPORTES E SERVICOS LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","E-mail",""],
  [360,"SUPERMERCADO CENTRAL DE BARREIROS LTDA","Simples","HEVERTON","Pró-Labore",0,"11111110","WhatsApp",""],
  [362,"VERA LUCIA DE OLIVEIRA","Simples","GUSTAVO","Pró-Labore",0,"00001100","Office boy",""],
  [363,"GS EMPREENDIMENTOS COMERCIAIS LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [366,"SOLUS REFLORESTAMENTO LTDA","Simples","GUSTAVO","Sem Movimento",0,"00001100","Malote",""],
  [367,"VS AGROFLORESTAL LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","eContador",""],
  [368,"CERAMICA MINAS FORTE LTDA - FILIAL 02","Simples","FABIANA","Sem Movimento",0,"00001100","eContador","CERAMICAS"],
  [371,"ACSSP ADM PROMOCAO DE VENDAS LTDA","Simples","GUSTAVO","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [380,"LEONARDO MENDES MARQUES LTDA","Presumido","HEVERTON","Folha",0,"11111111","Office boy",""],
  [381,"ORGANIZACOES FURTADO LTDA","Simples","GUSTAVO","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [388,"ORGANIZACOES PINK BIJOUX LTDA","Simples","GUSTAVO","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [389,"LATORRES DISTRIBUIDORA LTDA","Simples","ADIVANIA","Folha",0,"11111111","Office boy",""],
  [393,"INFANCY SERVICOS PEDIATRICOS LTDA","Simples","FABIANA","Folha",0,"11111111","eContador","MÉDICOS"],
  [394,"AURORA REFLORESTAMENTO E TRANSPORTES LTDA","Simples","ADIVANIA","Pró-Labore",0,"11111110","WhatsApp",""],
  [395,"AURORA REFLORESTAMENTO E TRANSPORTES LTDA - FILIAL 02","Simples","ADIVANIA","Sem Movimento",0,"00001100","WhatsApp",""],
  [396,"FLOROCARV REFLORESTAMENTO E TRANSPORTES LTDA","Simples","ADIVANIA","Folha",0,"11111111","WhatsApp",""],
  [407,"DUDA HOME DE TAIOBEIRAS LTDA","Simples","HEVERTON","Pró-Labore",0,"11111110","Office boy",""],
  [408,"OURO VERDE MINERACAO LTDA","Presumido","NILMA","Folha",0,"11111111","eContador","GRUPO FORESTRY VITOR MORONI"],
  [409,"OURO VERDE MINERACAO LTDA - FILIAL 02","Presumido","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY VITOR MORONI"],
  [411,"MINAS FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA","Presumido","NILMA","Pró-Labore",0,"11111110","eContador","GRUPO FORESTRY DILMA"],
  [412,"KOPEK FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA","Presumido","NILMA","Pró-Labore",0,"11111110","eContador","GRUPO FORESTRY DILMA"],
  [413,"BRAZILIAN FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA","Real","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY DILMA"],
  [414,"BRAZILIAN FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA","Real","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY DILMA"],
  [415,"LAVICA EMPREENDIMENTOS FLORESTAIS LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY DILMA"],
  [416,"LAVICA EMPREENDIMENTOS FLORESTAIS LTDA - FILIAL 02","Presumido","NILMA","Pró-Labore",0,"11111110","eContador","GRUPO FORESTRY DILMA"],
  [417,"VERA REFLORESTAMENTOS LTDA","Simples","ADIVANIA","Folha",0,"11111111","eContador","GRUPO FORESTRY VITOR MORONI"],
  [418,"BRAZILIAN FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA - FILIAL 03","Real","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY DILMA"],
  [421,"D´FARMA FARMACIA DE MANIPULACAO LTDA","Simples","ADIVANIA","Folha",0,"11111111","Office boy","SEM AGRUPAMENTO"],
  [423,"GUGA INDUSTRIA & COMERCIO DE RACAO ANIMAL LTDA","Simples","GUSTAVO","Sem Movimento",0,"00001100","Office boy",""],
  [424,"JOELFLOR PEREIRA DA ROCHA - FAZENDA","Física","","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [425,"JOELFLOR PEREIRA DA ROCHA - DOMÉSTICA","Domésticas","","Folha",0,"11111111","Office boy","DOMÉSTICAS"],
  [429,"POSTO DE COMBUSTIVEIS ANDRIELE LIMITADA","Presumido","HEVERTON","Sem Movimento",0,"00001100","E-mail","POSTOS"],
  [432,"AURORA REFLORESTAMENTO E TRANSPORTES LTDA - FILIAL 03","Simples","ADIVANIA","Sem Movimento",0,"00001100","WhatsApp",""],
  [433,"GUGA INDUSTRIA & COMERCIO DE RACAO ANIMAL LTDA","Simples","GUSTAVO","Sem Movimento",0,"00001100","Office boy",""],
  [434,"CONSTRUNOVO LTDA","Simples","HEVERTON","Pró-Labore",1,"11111110","E-mail",""],
  [441,"OURO PRETO REFLORESTAMENTOS LTDA","Presumido","NILMA","Folha",0,"11111111","eContador","GRUPO FORESTRY VITOR MORONI"],
  [443,"SU SEDUCAO MODA INTIMA LTDA","Simples","HEVERTON","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [444,"GALPAO VEICULOS E LOCADORA LTDA","Presumido","HEVERTON","Folha",1,"11111111","Office boy","SEM VARIAVEIS"],
  [446,"SPIROU CONSULTORIA E INVESTIMENTOS LTDA","Presumido","NILMA","Pró-Labore",0,"11111110","eContador","GRUPO FORESTRY DILMA"],
  [448,"GRANMIX COMERCIO DE ALIMENTOS LTDA - FILIAL 02","Simples","FABIANA","Folha",0,"11111111","WhatsApp","SEM VARIAVEIS"],
  [449,"GRANMIX COMERCIO DE ALIMENTOS LTDA - MATRIZ","Simples","FABIANA","Folha",0,"11111111","WhatsApp","SEM VARIAVEIS"],
  [450,"ACO FORTE METAIS LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy",""],
  [452,"OURO VERDE MINERACAO LTDA - FILIAL 04","Presumido","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY VITOR MORONI"],
  [453,"BRAZILIAN FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA - FILIAL 04","Real","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY DILMA"],
  [455,"CENTRO DE ODONTOLOGIA E SAUDE DE TAIOBEIRAS LTDA","Simples","HEVERTON","Folha",1,"11111111","WhatsApp","DENTISTAS"],
  [457,"LOCADORA DANUBIO AZUL LTDA","Simples","GUSTAVO","Sem Movimento",0,"00001100","Office boy",""],
  [458,"PABLO RAMON MENDES FREITAS","Domésticas","","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [461,"UNIVERSO CENTRO DE EDUCACAO INFANTIL LTDA","Simples","GUSTAVO","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [462,"3M EMPREENDIMENTOS FLORESTAIS LTDA","Presumido","NILMA","Pró-Labore",0,"11111110","eContador","GRUPO FORESTRY DILMA"],
  [463,"CENTRO DE ODONTOLOGIA ESTETICA LTDA","Simples","HEVERTON","Folha",1,"11111111","E-mail","DENTISTAS"],
  [465,"FSS SERVICOS MEDICOS LTDA","Simples","FABIANA","Pró-Labore",0,"11111111","E-mail","MÉDICOS"],
  [466,"WR SERVICOS FLORESTAIS LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","E-mail",""],
  [467,"CATVAN TECNOLOGIA LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111111","E-mail",""],
  [468,"CONSTRUTORA E INCORPORADORA OURO VERDE LTDA","Simples","FABIANA","Folha",0,"11111111","eContador","GRUPO FORESTRY VITOR MORONI"],
  [470,"BALAO MAGICO KIDS LTDA","Simples","GUSTAVO","Sem Movimento",0,"00001100","Office boy",""],
  [474,"LC FLORESTAL LTDA","Presumido","NILMA","Folha",0,"11111111","E-mail",""],
  [476,"OURO VERDE MINERACAO LTDA - FILIAL 05","Presumido","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY VITOR MORONI"],
  [477,"MINAS MAIS VARIEDADES LTDA","Simples","GUSTAVO","Sem Movimento",0,"00001100","E-mail",""],
  [479,"ME ATACADO LTDA","Simples","GUSTAVO","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [481,"B LIMA SERVICOS MEDICOS LTDA","Simples","HEVERTON","Pró-Labore",1,"11111110","eContador","MÉDICOS"],
  [482,"VICTOR ARAUJO SERVICOS MEDICOS LTDA","Simples","FABIANA","Pró-Labore",0,"11111111","WhatsApp","MÉDICOS"],
  [485,"XTREME ACADEMIA ESPECIALIZADA LTDA","Simples","GUSTAVO","Folha",0,"11111101","Office boy","SEM VARIAVEIS"],
  [486,"VS MEDICINA ESPECIALIZADA LTDA","Simples","ADIVANIA","Folha",0,"11111111","E-mail","MÉDICOS"],
  [488,"ASSOCIACAO BENEFICENTE GALPAO SOLIDARIO DE LAGOA SECA","Isentas","NILMA","Sem Movimento",0,"00001100","E-mail","ASSOCIAÇÕES"],
  [489,"MARISFRUTAS LTDA","Simples","FABIANA","Folha",0,"11111111","eContador","SEM VARIAVEIS"],
  [492,"VERSATIL LTDA","Simples","HEVERTON","Folha",1,"11110000","Office boy","SEM VARIAVEIS"],
  [493,"ANTONIA'S LTDA","Simples","HEVERTON","Sem Movimento",0,"00001100","Office boy",""],
  [494,"CAIXA ESCOLAR JOVITA SECUNDINA REGO","Isentas","HEVERTON","Apenas REINF",1,"00000000","E-mail","CAIXA ESCOLAR"],
  [496,"TIAGO SANTOS DE SOUZA","Simples","ADIVANIA","Sem Movimento",0,"00001100","WhatsApp",""],
  [499,"FARLEN XAVIER SANTOS 36075344896","MEI","","Folha",0,"11111111","WhatsApp","SEM VARIAVEIS"],
  [501,"CERAMICA FORTALEZA LTDA - FILIAL","Simples","FABIANA","Sem Movimento",0,"00001100","Malote","CERAMICAS"],
  [502,"VSPOSITO SERVICOS MEDICOS LTDA","Simples","FABIANA","Sem Movimento",0,"00001100","E-mail","MÉDICOS"],
  [503,"AMPLA SERVICOS DE SAUDE LTDA","Simples","FABIANA","Folha",0,"11111111","eContador","SEM VARIAVEIS"],
  [505,"LISA COSTA AME LTDA","Simples","HEVERTON","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [506,"FAST EMPREENDIMENTOS AERONAUTICO LTDA","Presumido","NILMA","Pró-Labore",0,"11111110","eContador","GRUPO FORESTRY DILMA"],
  [508,"PRIME ESTETICA AVANCADA LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [509,"OURO VERDE MINERACAO LTDA - FILIAL 06","Presumido","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY VITOR MORONI"],
  [510,"DOUGLAS AUTO CENTER LTDA","Simples","ADIVANIA","Folha",0,"11110000","Office boy","SEM VARIAVEIS"],
  [511,"VISUAL KIDS LTDA","Simples","HEVERTON","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [514,"OLARIA E TRANSPORTES TK LTDA","Simples","ADIVANIA","Pró-Labore",0,"11111111","WhatsApp",""],
  [515,"A7 MOBILE LTDA","Simples","HEVERTON","Pró-Labore",1,"11111110","WhatsApp",""],
  [519,"DARLENE DE FREITAS C VOLPONI LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111110","WhatsApp",""],
  [525,"GILDO FARIA","Física","","Folha",0,"11111111","WhatsApp",""],
  [526,"C&R ESCOLA DE IDIOMAS LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111110","WhatsApp",""],
  [527,"GL MATERIAIS DE CONSTRUCAO LTDA","Simples","HEVERTON","Folha",0,"11111111","WhatsApp",""],
  [528,"MIKAEL DOUGLAS A DE OLIVEIRA","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [532,"POUSADA, RESTAURANTE E PANIFICADORA JM- JOAO MANOEL LTDA","Simples","HEVERTON","Sem Movimento",1,"00001100","E-mail",""],
  [536,"ASSOCIAÇÃO COMERCIAL E EMPRESARIAL DE TAIOBEIRAS","Isentas","NILMA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [537,"ARTEFATO ACABAMENTOS LTDA","Simples","ADIVANIA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [538,"SENA PARTICIPACOES LTDA","Simples","FABIANA","Sem Movimento",0,"00001100","Office boy",""],
  [540,"CREATIVE COMPANY LTDA","Simples","FABIANA","Sem Movimento",0,"00001100","E-mail",""],
  [541,"AGRIENERGY FERTIAGRO LTDA","Simples","FABIANA","Sem Movimento",0,"00001100","Office boy",""],
  [542,"FELIPE ANDRADE ACADEMIA ESPECIALIZADA LTDA","Simples","FABIANA","Pró-Labore",0,"11111110","WhatsApp",""],
  [543,"FELIPE ANDRADE ACADEMIA ESPECIALIZADA LTDA","Simples","FABIANA","Sem Movimento",0,"00001100","WhatsApp",""],
  [544,"HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA","Simples","HEVERTON","Pró-Labore",0,"11111110","WhatsApp",""],
  [545,"HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA","Simples","HEVERTON","Sem Movimento",0,"00001100","WhatsApp",""],
  [546,"DERACI JOSE DE OLIVEIRA","Física","","Folha",0,"11111111","Malote",""],
  [547,"DERACI JOSE DE OLIVEIRA","Física","","Folha",0,"11111111","Malote",""],
  [548,"JOSIEL GOMES ARRUDA SPOSITO E OUTRO","Física","","Sem Movimento",0,"00001100","eContador",""],
  [549,"BOOZE PUB LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111110","Office boy",""],
  [550,"PRIME FISIOTERAPIA E CONSULTORIOS MEDICOS ESPECIAL","Simples","FABIANA","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [551,"MURILLO MENDES DE OLIVEIRA","Simples","FABIANA","Pró-Labore",0,"11111110","Office boy","MÉDICOS"],
  [552,"CONSTRULAR MATERIAIS DE PINTURA E CONSTRUCAO LTDA","Simples","HEVERTON","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [553,"GLM ODONTOLOGIA LTDA","Simples","FABIANA","Folha",0,"11111111","WhatsApp","DENTISTAS"],
  [555,"CARLOS LUCAS MENDES - FAZ UNIÃO","Física","","Folha",0,"11111111","Office boy","CARLOS LUCAS"],
  [558,"RENALD C FILHO & CIA LTDA","Simples","ADIVANIA","Sem Movimento",0,"00001100","E-mail",""],
  [559,"POSTO DE COMBUSTIVEIS JM JOAO MANOEL II LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","E-mail","POSTOS"],
  [560,"CAMARA DE DIRIGENTES LOJISTAS DE TAIOBEIRAS","Isentas","NILMA","Sem Movimento",0,"00001110","Office boy",""],
  [561,"SOMA NEGOCIOS E INTERMEDIACOES FINANCEIRAS LTDA","Simples","ADIVANIA","Pró-Labore",0,"11111111","Office boy",""],
  [562,"GERLANE ALVES SOARES","Simples","GUSTAVO","Folha",0,"11111111","Office boy","SEM VARIAVEIS"],
  [563,"EVANDRO DE CASTRO","Física","","Folha",0,"11111111","Malote",""],
  [564,"HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA - FILIAL","Simples","HEVERTON","Sem Movimento",0,"00001100","WhatsApp",""],
  [565,"DJALMA MOREIRA DE AGUIAR","Simples","GUSTAVO","Pró-Labore",0,"11111110","Office boy",""],
  [567,"VIVEIRO RENASCER LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY VITOR MORONI"],
  [568,"BRAZILIAN COFFEE LTDA","Real","NILMA","Sem Movimento",0,"00001110","eContador","GRUPO FORESTRY DILMA"],
  [569,"RDS AGREGADOS & LOGISTICA LTDA","Simples","ADIVANIA","Sem Movimento",0,"00001100","eContador",""],
  [571,"VOLPONI CONSTRUCOES MECANICAS INDUSTRIA E COMERCIO","Simples","ADIVANIA","Folha",0,"11111111","eContador","TORNEARIA VOLPONI"],
  [572,"FREEDOM REFORESTING LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY DILMA"],
  [575,"BDV LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","eContador",""],
  [576,"GUIMARAES E SILVA INSTITUTO INTEGRADO LTDA","Simples","ADIVANIA","Pró-Labore",0,"11111111","eContador",""],
  [577,"CAFE RENASCER SPE LTDA","Real","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY DILMA"],
  [578,"ELITE HIDRAULICA E SOLDAS LTDA","Simples","FABIANA","Pró-Labore",0,"11111110","WhatsApp",""],
  [579,"MORONI & XAVIER AUTOPECAS LTDA","Simples","HEVERTON","Sem Movimento",0,"00001100","eContador",""],
  [580,"LUCAS MENDES FILHO MARQUES SUCUPIRA","Física","","Sem Movimento",0,"00001100","Office boy",""],
  [581,"BC SAUDE LTDA","Simples","FABIANA","Folha",0,"11111111","eContador","SEM VARIAVEIS"],
  [582,"FREEDOM REFORESTING LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","eContador","GRUPO FORESTRY DILMA"],
  [583,"EMPORIO VERDE DISTRIBUIDORA LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111111","WhatsApp",""],
  [584,"EMPREENDIMENTOS IMOBILIARIOS M&A LTDA","Presumido","NILMA","Sem Movimento",0,"00001100","WhatsApp",""],
  [585,"MORONI & XAVIER AUTOPECAS LTDA - FILIAL","Simples","HEVERTON","Sem Movimento",0,"00001100","eContador",""],
  [586,"LC SERVICOS AGRICOLAS E FLORESTAIS LTDA","Simples","ADIVANIA","Sem Movimento",0,"00001100","E-mail",""],
  [589,"CREATIVE DIGITAL LTDA","Simples","FABIANA","Sem Movimento",0,"00001100","eContador",""],
  [590,"TORIBA TECNOLOGIA E GESTAO EMPRESARIAL LTDA","Simples","SAVIO","Pró-Labore",0,"11111110","E-mail",""],
  [591,"AAP INTERMEDIACOES LTDA","Simples","FABIANA","Sem Movimento",0,"00001100","WhatsApp",""],
  [592,"HERMES REFLORESTAMENTO E TRANSPORTE LTDA","Simples","ADIVANIA","Sem Movimento",0,"00001100","WhatsApp",""],
  [593,"CONSTRUTOP MATERIAIS DE CONSTRUCAO LTDA","Simples","HEVERTON","Sem Movimento",1,"00001100","Office boy",""],
  [594,"HERMES REFLORESTAMENTO E TRANSPORTE LTDA - FILIAL","Simples","ADIVANIA","Sem Movimento",0,"00001100","WhatsApp",""],
  [595,"NERES EMPREENDIMENTOS LTDA","Simples","ADIVANIA","Pró-Labore",0,"00000000","Office boy",""],
  [596,"ORGANIZACOES FURTADO LTDA - FILIAL","Simples","GUSTAVO","Sem Movimento",0,"00001100","Office boy","SEM VARIAVEIS"],
  [597,"CONSTRU UNIAO MATERIAIS DE CONSTRUCAO LTDA","Simples","GUSTAVO","Sem Movimento",0,"00001100","Office boy","SEM VARIÁVEIS"],
  [598,"IMPERIO DAS PIZZAS TAIOBEIRAS LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111110","Office boy",""],
  [599,"BIBOKA EMBALAGENS LTDA - FILIAL","Simples","HEVERTON","Sem Movimento",0,"00001100","Office boy",""],
  [600,"ALVES CRUZ ACADEMIA PREMIUM LTDA","Simples","FABIANA","Folha",0,"11111111","Office boy","ACADEMIAS"],
  [601,"LIZZ SHOW'S LTDA","Simples","ADIVANIA","Pró-Labore",0,"11111110","WhatsApp","SEM VARIÁVEIS"],
  [602,"ZELO AGROINDUSTRIAS LTDA - MATRIZ","Simples","GUSTAVO","Folha",0,"11111111","SCI Report","GRUPO FORESTRY DILMA"],
  [603,"WB SUSHI LTDA","Simples","FABIANA","Pró-Labore",0,"11111110","Office boy",""],
  [604,"OLARIA K&K LTDA","Simples","ADIVANIA","Pró-Labore",0,"11111110","WhatsApp",""],
  [605,"LL CENTRO ESTETICO LTDA","Simples","HEVERTON","Pró-Labore",1,"11111110","Office boy",""],
  [606,"EMILLY MARQUES ARQUITETURA LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111110","eContador",""],
  [607,"ZELO AGROINDUSTRIAS LTDA - FILIAL TAIOBEIRAS","Simples","GUSTAVO","Folha",0,"11111111","SCI Report",""],
  [608,"ZELO AGROINDUSTRIAS LTDA - FILIAL C. SALES","Simples","GUSTAVO","Folha",0,"11111111","SCI Report",""],
  [609,"ZELO AGROINDUSTRIAS LTDA - FILIAL SJP","Simples","GUSTAVO","Folha",0,"11111111","SCI Report",""],
  [610,"GAS TAIOBEIRAS LTDA","Simples","HEVERTON","Folha",1,"11111111","Office boy",""],
  [611,"FRANCIELLE SILVA SANTANA","Domésticas","","Folha",0,"11111111","WhatsApp","DOMÉSTICAS"],
  [613,"CAMPO E GESTAO AGROASSESSORIA LTDA","Simples","GUSTAVO","Pró-Labore",0,"11111110","E-mail",""],
];

export const CLIENTES_DO_DP: readonly ClienteDoDp[] = LINHAS.map(([codigo, nome, enquadramento, responsavel, movimento, reinf, bits, entrega, agrupamento]) => ({
  codigo, nome, enquadramento, responsavel, movimento, reinfAutorizada: reinf === 1,
  obrigacoes: OBRIGACOES_DP.filter((_, i) => bits[i] === '1').map(o => o.id), entrega, agrupamento,
}));

const POR_CODIGO = new Map(CLIENTES_DO_DP.map(c => [c.codigo, c]));

/** O cliente do DP pelo código do ERP (null = não está na planilha do DP). */
export function clienteDoDp(codigo: number | null | undefined): ClienteDoDp | null {
  return codigo == null ? null : POR_CODIGO.get(codigo) || null;
}

const NA_LISTA = new Set(EMPRESAS.map(e => e.codigo));

/** Os clientes do DP que não estão na lista do escritório (pessoa física, domésticas…): só a rotina do DP os vê. */
export const SO_DO_DP: readonly EmpresaDoEscritorio[] = CLIENTES_DO_DP.filter(c => !NA_LISTA.has(c.codigo))
  .map(c => ({ codigo: c.codigo, nome: c.nome, regime: c.enquadramento }));

/** A lista do escritório com os clientes que só o DP tem (para a Tarefas achar a empresa em qualquer rotina). */
export const EMPRESAS_COM_DP: readonly EmpresaDoEscritorio[] = [...EMPRESAS, ...SO_DO_DP];

/**
 * O cliente do DP com o que foi mudado no Cadastro (o responsável do Fiscal) e nas Configurações do DP (os parâmetros):
 * o que não foi mudado vale o da planilha.
 */
export function clienteDoDpNoCadastro(base: ClienteDoDp, cad: { responsaveis?: { fiscal?: string }; dp?: { movimento?: string; obrigacoes?: string[]; reinfAutorizada?: boolean; entrega?: string; agrupamento?: string } } | null | undefined): ClienteDoDp {
  if (!cad) return base;
  const d = cad.dp || {};
  const obrigacoes = d.obrigacoes;
  return {
    ...base,
    responsavel: cad.responsaveis?.fiscal ?? base.responsavel,
    movimento: (d.movimento as MovimentoDp | undefined) ?? base.movimento,
    obrigacoes: obrigacoes ? OBRIGACOES_DP.filter(o => obrigacoes.includes(o.id)).map(o => o.id) : base.obrigacoes,
    reinfAutorizada: d.reinfAutorizada ?? base.reinfAutorizada,
    entrega: d.entrega ?? base.entrega,
    agrupamento: d.agrupamento ?? base.agrupamento,
  };
}

/** Os movimentos e as entregas (para escolher nas Configurações do DP). */
export const MOVIMENTOS_DP: readonly MovimentoDp[] = ['Folha', 'Pró-Labore', 'Sem Movimento', 'Apenas REINF'];
export const ENTREGAS_DP: readonly string[] = ['Office boy', 'eContador', 'WhatsApp', 'E-mail', 'Malote', 'Em mãos'];
