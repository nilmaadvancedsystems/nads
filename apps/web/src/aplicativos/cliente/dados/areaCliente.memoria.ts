// A versão de exemplo da Área do Cliente (Vitor, 16/10/2026): uma empresa, "Personaly Company", com dados plausíveis que
// acompanham a data de hoje (a vencida, a que vence hoje e as a vencer andam junto com o relógio). Só o token "exemplo"
// abre; qualquer outro é um link inválido e não mostra dado nenhum. Nada sai do navegador.
import { areaCliente as ac, formatos } from '@nads/core';
import { AREA_VAZIA, type DocumentoDoCliente, type Empregado, type EstadoDaArea, type RepoAreaCliente } from './areaCliente';

export const TOKEN_DE_EXEMPLO = 'exemplo';

const dois = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
const br = (d: Date) => dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear();
/** a data de hoje deslocada em dias (meio-dia, para não virar de dia no fuso) */
const emDias = (hoje: Date, dias: number) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias, 12, 0, 0);
/** a competência de uma guia que vence na data: o mês anterior */
const competenciaDe = (venc: Date) => ac.competenciaDoMesDeVencimento(iso(venc).slice(0, 7));
const comHora = (d: Date, h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).toISOString();

/** O que o robô teria espelhado para a Personaly Company, relativo a hoje. */
export function areaDeExemplo(hoje: Date): EstadoDaArea {
  const guia = (id: string, tipo: ac.TipoDeGuia, dias: number, valor: number, numero?: string): ac.GuiaDoCliente => {
    const venc = emDias(hoje, dias);
    // DAS e DAE com o id do robô: das-AAAA-MM-codigo (o código da empresa no nads)
    const competencia = competenciaDe(venc);
    const doRobo = tipo === 'DAS' || tipo === 'DAE' ? tipo.toLowerCase() + '-' + competencia + '-9999' : id;
    return { id: doRobo, tipo, competencia, vencimento: br(venc), valor, ...(numero ? { numero } : {}), situacao: ac.situacaoDaGuia(br(venc), hoje), temPdf: true };
  };
  const guias = [
    guia('g1', 'DAS', -5, 1284.37, '07.18.26277.1234567-8'),
    guia('g2', 'FGTS', 3, 917.42, '202609001234'),
    guia('g3', 'DAE', 8, 432.1),
  ];

  // a agenda: de dois meses atrás até o mês que vem; o que já passou está feito, o que vem está por fazer
  const meses: ac.AgendaDoMes[] = [];
  for (let i = -2; i <= 1; i++) {
    const mes = iso(new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)).slice(0, 7);
    const competencia = ac.competenciaDoMesDeVencimento(mes);
    const itens: ac.ItemDaAgenda[] = [];
    for (const id of ['das', 'icms', 'iss', 'dctfweb', 'esocial', 'darf-inss', 'fgts']) {
      const linha = ac.VENCIMENTOS.find(v => v.id === id)!;
      const vence = ac.vencimentoNaCompetencia(linha, competencia)!;
      // ICMS e ISS: esta empresa é do Simples, não tem
      const naoSeAplica = id === 'icms' || id === 'iss';
      const passou = vence < iso(hoje);
      const situacao: ac.SituacaoDoItem = naoSeAplica ? 'nao se aplica' : passou ? 'feito' : 'a fazer';
      const feitoEm = new Date(Number(vence.slice(0, 4)), Number(vence.slice(5, 7)) - 1, Number(vence.slice(8, 10)) - 3, 15, 30).toISOString();
      itens.push({ id, nome: linha.nome, vence, situacao, ...(situacao === 'feito' ? { feitoEm } : {}) });
    }
    meses.push(ac.agendaDoMes(mes, itens));
  }

  const envios: ac.ReciboDeEnvio[] = [
    { id: 'e1', nome: 'extrato-banco-do-brasil-setembro.pdf', tipo: 'extrato', tamanho: 482 * 1024, recebidoEm: comHora(emDias(hoje, -6), 9, 12) },
    { id: 'e2', nome: 'notas-fiscais-setembro.zip', tipo: 'nota', tamanho: 612_000, recebidoEm: comHora(emDias(hoje, -2), 16, 40) },
  ];

  const chamados: ac.ChamadoDoCliente[] = [
    {
      id: 'c1', tipo: 'admissao', titulo: 'Admissão da Maria Souza (auxiliar administrativo)', situacao: 'em andamento',
      mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'Vamos contratar a Maria Souza para auxiliar administrativo, começando dia 1º. O que vocês precisam de nós?', em: comHora(emDias(hoje, -4), 10, 5) },
        { de: 'escritorio', autor: 'Escritório', texto: 'Oi! Precisamos de cópia do RG, CPF, título de eleitor, comprovante de residência e da carteira de trabalho digital. Pode mandar por aqui, na aba Enviar.', em: comHora(emDias(hoje, -4), 11, 20) },
        { de: 'cliente', autor: 'Você', texto: 'Mandei os documentos agora.', em: comHora(emDias(hoje, -2), 14, 2) },
      ],
    },
    {
      id: 'c2', tipo: 'ferias', titulo: 'Dúvida sobre as férias do João', situacao: 'respondido',
      mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'O João pode tirar 10 dias de férias e vender os outros 20?', em: comHora(emDias(hoje, -9), 9, 40) },
        { de: 'escritorio', autor: 'Escritório', texto: 'Pode tirar 20 dias e vender até 10. Quando ele quiser sair, nos avise com 30 dias de antecedência para a gente preparar o aviso e o recibo.', em: comHora(emDias(hoje, -8), 8, 55) },
      ],
    },
  ];

  return {
    carregado: true, valido: true,
    resumo: {
      empresas: [{ codigo: 9999, nome: 'Personaly Company', cnpj: '00.000.000/0001-91' }],
      escritorio: { telefone: '(31) 3333-0000', email: 'atendimento@nilma.example', whatsapp: '(31) 99999-0000' },
      atualizadoEm: comHora(hoje, 7, 30),
    },
    guias, agenda: meses, envios, chamados,
    // a linha digitável das guias que têm (de mentira)
    codigos: { [guias[0].id]: '07190.00009 26277.123456 78901.234567 8 00000128437', [guias[1].id]: '85800000009-1 17420385001-2 26090012345-6 00000091742-0' },
    pagas: [
      { id: 'p1', sigla: 'HON', nome: 'Honorários da Nilma Contabilidade', competencia: mesDe(hoje), valor: 1250, pagoEm: br(emDias(hoje, -6)), temComprovante: true },
      { id: 'p2', sigla: 'INSS', nome: 'INSS da folha (DCTFWeb)', competencia: ac.competenciaDoMesDeVencimento(mesDe(emDias(hoje, -28))), valor: 1980.3, pagoEm: br(emDias(hoje, -28)), temComprovante: true },
    ],
    documentos: documentosDeExemplo(hoje),
    certificado: { tipo: 'A1', titular: 'PERSONALY COMPANY LTDA', validoAte: iso(emDias(hoje, 25)) },
    empregados: empregadosDeExemplo(hoje),
    ficha: {
      razaoSocial: 'Personaly Company Ltda', nomeFantasia: 'Personaly', cnpj: '00.000.000/0001-91', inscricaoEstadual: '000.000.000.0000',
      inscricaoMunicipal: '000000-0', regime: 'Simples Nacional', cnae: '47.12-1-00 (comércio varejista de mercadorias em geral)', abertura: '2019-04-02',
      endereco: 'Rua de Exemplo, 100, Centro, Belo Horizonte/MG, 30000-000',
      socios: [{ nome: 'Marcos da Silva', participacao: '60%' }, { nome: 'Paula Santos', participacao: '40%' }],
    },
    atendimento: {
      equipe: 'Equipe Nilma Contabilidade', horario: 'Segunda a sexta, das 8h às 18h',
      setores: [{ nome: 'Fiscal', email: 'fiscal@nilma.example' }, { nome: 'Pessoal', email: 'dp@nilma.example' }, { nome: 'Contábil', email: 'contabil@nilma.example' }],
    },
    avisos: [
      { id: 'a1', titulo: 'Extratos de ' + formatos.rot(mesDe(hoje)).toLowerCase(), texto: 'Mande os extratos bancários do mês até o dia 5 de ' + formatos.rot(mesDe(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1))).toLowerCase() + ' para o escritório fechar a contabilidade.', ir: 'documentos' },
    ],
  };
}

const mesDe = (d: Date) => iso(d).slice(0, 7);

/** Os documentos que o escritório deixou: do mês passado (alguns ainda não baixados) e de antes. */
function documentosDeExemplo(hoje: Date): DocumentoDoCliente[] {
  const passado = ac.competenciaDoMesDeVencimento(mesDe(hoje));
  const retrasado = ac.competenciaDoMesDeVencimento(passado);
  const doc = (id: string, nome: string, descricao: string, area: DocumentoDoCliente['area'], competencia: string, dias: number, novo: boolean): DocumentoDoCliente =>
    ({ id, nome, descricao, area, competencia, enviadoEm: comHora(emDias(hoje, dias), 10, 0), novo, formato: 'PDF' });
  return [
    doc('d1', 'DAS do Simples Nacional', 'A guia do imposto do mês, com o extrato do cálculo', 'fiscal', passado, -6, true),
    doc('d2', 'Folha de pagamento e recibos', 'O resumo da folha e um recibo para cada funcionário assinar', 'dp', passado, -13, true),
    doc('d3', 'Recibo de férias do João Pereira', 'Para o João assinar antes de sair de férias', 'dp', passado, -9, false),
    doc('d4', 'Balancete do mês', 'As contas da empresa no fim do mês', 'contabil', retrasado, -18, false),
    doc('d5', 'DRE do mês', 'O resultado: quanto entrou, quanto saiu e o lucro', 'contabil', retrasado, -18, true),
    doc('d6', 'Certidão negativa de débitos federais', 'Mostra que a empresa não deve impostos federais', 'societario', '', -31, false),
    doc('d7', 'Contrato social (última alteração)', 'A cópia registrada na Junta Comercial', 'societario', '', -120, false),
  ];
}

/** Os funcionários ativos (CPF mascarado). */
function empregadosDeExemplo(hoje: Date): Empregado[] {
  const ano = hoje.getFullYear();
  return [
    { id: 'f1', nome: 'Ana Luiza Ferreira', cpf: '***.491.826-**', cargo: 'Gerente financeira', admissao: '2021-03-12', salario: 5400, ferias: 'vencidas' },
    { id: 'f2', nome: 'Carlos Eduardo Santos', cpf: '***.102.396-**', cargo: 'Assistente de vendas', admissao: '2023-08-01', salario: 2450, ferias: 'em ferias', retornoEm: iso(emDias(hoje, 9)) },
    { id: 'f3', nome: 'João Pereira', cpf: '***.774.105-**', cargo: 'Vendedor', admissao: '2022-06-20', salario: 2300, ferias: 'em dia' },
    { id: 'f4', nome: 'Mariana Oliveira Silva', cpf: '***.883.216-**', cargo: 'Analista de marketing', admissao: ano + '-01-15', salario: 3800, ferias: 'periodo aquisitivo' },
    { id: 'f5', nome: 'Rodrigo de Almeida', cpf: '***.554.906-**', cargo: 'Auxiliar de estoque', admissao: ano + '-05-10', salario: 1850, ferias: 'periodo aquisitivo' },
  ];
}

/** Um PDF mínimo (uma página com um texto) para o "Baixar guia" do exemplo. */
function pdfDeExemplo(linhas: string[]): Blob {
  const texto = linhas.map((l, i) => `BT /F1 14 Tf 60 ${760 - i * 22} Td (${l.replace(/[()\\]/g, '')}) Tj ET`).join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posicoes: number[] = [];
  objetos.forEach((o, i) => { posicoes.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` + posicoes.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

/** O repositório de exemplo: guarda tudo na memória da página (recarregou, volta ao começo). */
export function criarRepoAreaClienteMemoria(agora: () => Date = () => new Date()): RepoAreaCliente {
  let estado = areaDeExemplo(agora());
  const ouvintes = new Set<() => void>();
  const mudar = (f: (e: EstadoDaArea) => EstadoDaArea) => { estado = f(estado); ouvintes.forEach(o => o()); };
  let proximo = 100;

  return {
    exemplos: true,
    assinar(token, aoMudar) {
      if (token !== TOKEN_DE_EXEMPLO) { aoMudar({ ...AREA_VAZIA, carregado: true }); return () => undefined; }
      const avisar = () => aoMudar(estado);
      ouvintes.add(avisar);
      avisar();
      return () => { ouvintes.delete(avisar); };
    },
    async enviar(token, tipo, arquivos) {
      if (token !== TOKEN_DE_EXEMPLO) return;
      const recebidoEm = agora().toISOString();
      mudar(e => ({ ...e, envios: [...arquivos.map(a => ({ id: 'e' + proximo++, nome: a.name, tipo, tamanho: a.size, recebidoEm })), ...e.envios] }));
    },
    async abrirChamado(token, { tipo, texto }) {
      if (token !== TOKEN_DE_EXEMPLO || ac.erroDoNovoChamado(tipo, texto)) return '';
      const id = 'c' + proximo++;
      const chamado: ac.ChamadoDoCliente = {
        id, tipo, titulo: ac.tituloDoChamado(tipo, texto), situacao: 'aberto',
        mensagens: [{ de: 'cliente', autor: 'Você', texto: texto.trim(), em: agora().toISOString() }],
      };
      mudar(e => ({ ...e, chamados: [chamado, ...e.chamados] }));
      return id;
    },
    async responderChamado(token, id, texto) {
      if (token !== TOKEN_DE_EXEMPLO || !texto.trim()) return;
      mudar(e => ({
        ...e,
        chamados: e.chamados.map(c => c.id !== id || !ac.chamadoAceitaResposta(c) ? c
          : { ...c, situacao: 'aberto', mensagens: [...c.mensagens, { de: 'cliente', autor: 'Você', texto: texto.trim(), em: agora().toISOString() }] }),
      }));
    },
    async baixarDocumento(token, id) {
      const d = token === TOKEN_DE_EXEMPLO ? estado.documentos.find(x => x.id === id) : null;
      if (!d) return null;
      if (d.novo) mudar(e => ({ ...e, documentos: e.documentos.map(x => x.id === id ? { ...x, novo: false } : x) }));
      return {
        nome: formatos.slug(d.nome) + (d.competencia ? '-' + d.competencia : '') + '.pdf',
        arquivo: pdfDeExemplo(['DOCUMENTO DE EXEMPLO', d.nome, d.competencia ? 'Referente a ' + formatos.rot(d.competencia) : '', 'Nilma Contabilidade']),
      };
    },
    async baixarComprovante(token, id) {
      const p = token === TOKEN_DE_EXEMPLO ? estado.pagas.find(x => x.id === id) : null;
      if (!p || !p.temComprovante) return null;
      return {
        nome: 'comprovante-' + formatos.slug(p.nome) + '.pdf',
        arquivo: pdfDeExemplo(['COMPROVANTE DE EXEMPLO (nao vale como recibo)', p.nome, 'Pago em ' + p.pagoEm, `Valor: R$ ${p.valor.toFixed(2).replace('.', ',')}`]),
      };
    },
    async baixarGuia(token, id) {
      const g = token === TOKEN_DE_EXEMPLO ? estado.guias.find(x => x.id === id) : null;
      if (!g || !g.temPdf) return null;
      return {
        nome: `guia-${g.tipo.toLowerCase()}-${g.competencia}.pdf`,
        arquivo: pdfDeExemplo(['GUIA DE EXEMPLO (nao vale como pagamento)', `Guia: ${g.tipo}`, `Competencia: ${g.competencia}`, `Vencimento: ${g.vencimento}`, `Valor: R$ ${g.valor.toFixed(2).replace('.', ',')}`]),
      };
    },
  };
}
