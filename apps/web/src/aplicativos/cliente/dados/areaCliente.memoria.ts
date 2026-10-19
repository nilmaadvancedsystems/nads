// A versão de exemplo da Área do Cliente (Vitor, 16/10/2026): uma empresa, "Personaly Company", com dados plausíveis que
// acompanham a data de hoje (a vencida, a que vence hoje e as a vencer andam junto com o relógio). Nada sai do navegador.
// Os tokens que abrem:
//   "exemplo"            → o exemplo completo, com todas as seções (o protótipo do Vitor);
//   "exemplo-real"       → o site COMO O CLIENTE REAL VÊ (17/10/2026): o mesmo formato que o banco entrega, montado pelo
//                          estadoDoEspelho (sem Departamento pessoal, Documentos, guias pagas, ficha, linha digitável nem
//                          avisos; o escritório sem telefone e sem horário, como o robô grava), com uma guia vencida;
//   "exemplo-real-vazio" → o mesmo, no começo: nenhuma guia, a agenda vazia, nenhum chamado e nenhum envio.
// Qualquer outro é um link inválido e não mostra dado nenhum. No modo banco, só o "exemplo" vem daqui (repo.ts).
import { areaCliente as ac, formatos } from '@nads/core';
import { AREA_VAZIA, TODAS_AS_SECOES, type DocumentoDoCliente, type Empregado, type EstadoDaArea, type RepoAreaCliente } from './areaCliente';
import { documentoFormatado, estadoDoEspelho } from './espelho';

export const TOKEN_DE_EXEMPLO = 'exemplo';
export const TOKEN_COMO_NO_BANCO = 'exemplo-real';
export const TOKEN_COMO_NO_BANCO_VAZIO = 'exemplo-real-vazio';

const dois = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
const br = (d: Date) => dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear();
/** a data de hoje deslocada em dias (meio-dia, para não virar de dia no fuso) */
const emDias = (hoje: Date, dias: number) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias, 12, 0, 0);
/** a competência de uma guia que vence na data: o mês anterior */
const competenciaDe = (venc: Date) => ac.competenciaDoMesDeVencimento(iso(venc).slice(0, 7));
const comHora = (d: Date, h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).toISOString();

/** Uma guia de exemplo que vence daqui a `dias` dias (negativo: já venceu). DAS e DAE com o id do robô:
 *  das-AAAA-MM-codigo (o código da empresa no nads). */
function guiaDeExemplo(hoje: Date, id: string, tipo: ac.TipoDeGuia, dias: number, valor: number, numero?: string): ac.GuiaDoCliente {
  const venc = emDias(hoje, dias);
  const competencia = competenciaDe(venc);
  const doRobo = tipo === 'DAS' || tipo === 'DAE' ? tipo.toLowerCase() + '-' + competencia + '-9999' : id;
  return { id: doRobo, tipo, competencia, vencimento: br(venc), valor, ...(numero ? { numero } : {}), situacao: ac.situacaoDaGuia(br(venc), hoje), temPdf: true };
}

/** A agenda de dois meses atrás até o mês que vem: o que já passou está feito, o que vem está por fazer. */
function agendaDeExemplo(hoje: Date): ac.AgendaDoMes[] {
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
  return meses;
}

/** O que o robô teria espelhado para a Personaly Company, relativo a hoje. */
export function areaDeExemplo(hoje: Date): EstadoDaArea {
  const guias = [
    guiaDeExemplo(hoje, 'g1', 'DAS', -5, 1284.37, '07.18.26277.1234567-8'),
    guiaDeExemplo(hoje, 'g2', 'FGTS', 3, 917.42, '202609001234'),
    guiaDeExemplo(hoje, 'g3', 'DAE', 8, 432.1),
  ];
  const meses = agendaDeExemplo(hoje);

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
    carregado: true, valido: true, erro: '', exemplos: true, secoes: TODAS_AS_SECOES,
    resumo: {
      empresas: [{ codigo: 9999, nome: 'Personaly Company', cnpj: '00.000.000/0001-91' }],
      escritorio: { telefone: '(31) 3333-0000', email: 'atendimento@nilma.example', whatsapp: '(31) 99999-0000' },
      atualizadoEm: comHora(hoje, 7, 30),
    },
    guias, agenda: meses, envios, chamados,
    // a linha digitável das guias que têm (de mentira)
    codigos: { [guias[0].id]: '07190.00009 26277.123456 78901.234567 8 00000128437', [guias[1].id]: '85800000009-1 17420385001-2 26090012345-6 00000091742-0' },
    pagas: [
      { id: 'p1', tipo: 'HON', nome: 'Honorários da Nilma Contabilidade', competencia: mesDe(hoje), valor: 1250, pagoEm: br(emDias(hoje, -6)), temComprovante: true },
      { id: 'p2', tipo: 'DCTFWeb', nome: 'INSS da folha (DCTFWeb)', competencia: ac.competenciaDoMesDeVencimento(mesDe(emDias(hoje, -28))), valor: 1980.3, pagoEm: br(emDias(hoje, -28)), temComprovante: true },
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

/**
 * O que um link de verdade mostra hoje (17/10/2026), no formato exato do banco: o espelho que o robô grava
 * (robo/area-cliente.js: o escritório só com o WhatsApp e o e-mail, sem telefone) passado pelo mesmo estadoDoEspelho do
 * repositório do Firestore. `vazio`: o link recém-criado, sem guia, sem agenda, sem chamado e sem envio.
 */
export function areaComoNoBanco(hoje: Date, vazio = false): EstadoDaArea {
  const resumo: ac.ResumoDoCliente = {
    // o nome comprido de propósito: a razão social do cadastro, como o robô grava (o topo quebra a linha, nunca corta)
    empresas: [{ codigo: 9999, nome: 'Personaly Company Comércio de Roupas e Acessórios Ltda', cnpj: documentoFormatado('00000000000191') }],
    escritorio: { whatsapp: '(31) 99999-0000', email: 'atendimento@nilma.example' },
    atualizadoEm: comHora(hoje, 7, 30),
  };
  const nomeDoLink = 'Personaly Company';
  const estado = estadoDoEspelho(vazio ? { resumo, nomeDoLink, guias: [], agenda: [], envios: [], chamados: [] } : {
    resumo, nomeDoLink,
    guias: [guiaDeExemplo(hoje, 'g1', 'DAS', -5, 1284.37, '07.18.26277.1234567-8')],
    agenda: agendaDeExemplo(hoje),
    envios: [{ id: 'e1', nome: 'extrato-banco-do-brasil-setembro.pdf', tipo: 'extrato', tamanho: 482 * 1024, recebidoEm: comHora(emDias(hoje, -6), 9, 12) }],
    chamados: [{
      id: 'c1', tipo: 'documento', titulo: 'Certidão negativa estadual', situacao: 'respondido',
      mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'Preciso da certidão negativa estadual para uma licitação.', em: comHora(emDias(hoje, -3), 10, 5) },
        { de: 'escritorio', autor: 'Escritório', texto: 'Já emitimos. Está no seu e-mail e vale por 30 dias.', em: comHora(emDias(hoje, -2), 9, 40) },
      ],
    }],
  });
  // os dados são de mentira: o aviso "Versão de exemplo" continua e nada vai para o escritório
  return { ...estado, exemplos: true };
}

const mesDe = (d: Date) => iso(d).slice(0, 7);

/** Os documentos que o escritório deixou: do mês passado (alguns ainda não baixados) e de antes. */
function documentosDeExemplo(hoje: Date): DocumentoDoCliente[] {
  const passado = ac.competenciaDoMesDeVencimento(mesDe(hoje));
  const retrasado = ac.competenciaDoMesDeVencimento(passado);
  const doc = (id: string, nome: string, descricao: string, area: DocumentoDoCliente['area'], competencia: string, dias: number, novo: boolean, formato: DocumentoDoCliente['formato']): DocumentoDoCliente =>
    ({ id, nome, descricao, area, competencia, enviadoEm: comHora(emDias(hoje, dias), 10, 0), novo, formato });
  return [
    doc('d1', 'DAS do Simples Nacional', 'A guia do imposto do mês, com o extrato do cálculo', 'fiscal', passado, -6, true, 'PDF'),
    doc('d8', 'Notas fiscais de saída', 'Os XML das notas que a empresa emitiu no mês', 'fiscal', passado, -5, true, 'XML'),
    doc('d2', 'Folha de pagamento e recibos', 'O resumo da folha e um recibo para cada funcionário assinar', 'dp', passado, -13, true, 'PDF'),
    doc('d3', 'Recibo de férias do João Pereira', 'Para o João assinar antes de sair de férias', 'dp', passado, -9, false, 'PDF'),
    doc('d4', 'Balancete do mês', 'As contas da empresa no fim do mês', 'contabil', retrasado, -18, false, 'XLSX'),
    doc('d5', 'DRE do mês', 'O resultado: quanto entrou, quanto saiu e o lucro', 'contabil', retrasado, -18, true, 'PDF'),
    doc('d9', 'Livros contábeis do ano', 'O diário e o razão, compactados', 'contabil', '', -40, false, 'ZIP'),
    doc('d6', 'Certidão negativa de débitos federais', 'Mostra que a empresa não deve impostos federais', 'societario', '', -31, false, 'PDF'),
    doc('d7', 'Contrato social (última alteração)', 'A cópia registrada na Junta Comercial', 'societario', '', -120, false, 'DOCX'),
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

/** O repositório de exemplo: guarda tudo na memória da página (recarregou, volta ao começo), um estado por token. */
export function criarRepoAreaClienteMemoria(agora: () => Date = () => new Date()): RepoAreaCliente {
  const fabricas: Record<string, (hoje: Date) => EstadoDaArea> = {
    [TOKEN_DE_EXEMPLO]: areaDeExemplo,
    [TOKEN_COMO_NO_BANCO]: h => areaComoNoBanco(h),
    [TOKEN_COMO_NO_BANCO_VAZIO]: h => areaComoNoBanco(h, true),
  };
  const estados = new Map<string, EstadoDaArea>();
  const ouvintes = new Map<string, Set<() => void>>();
  /** o estado do token, criado na primeira vez; null = link inválido */
  const de = (token: string): EstadoDaArea | null => {
    if (!Object.hasOwn(fabricas, token)) return null;
    if (!estados.has(token)) estados.set(token, fabricas[token](agora()));
    return estados.get(token)!;
  };
  const mudar = (token: string, f: (e: EstadoDaArea) => EstadoDaArea) => {
    const atual = de(token);
    if (!atual) return;
    estados.set(token, f(atual));
    ouvintes.get(token)?.forEach(o => o());
  };
  let proximo = 100;

  return {
    assinar(token, aoMudar) {
      if (!de(token)) { aoMudar({ ...AREA_VAZIA, carregado: true }); return () => undefined; }
      const avisar = () => aoMudar(de(token)!);
      if (!ouvintes.has(token)) ouvintes.set(token, new Set());
      ouvintes.get(token)!.add(avisar);
      avisar();
      return () => { ouvintes.get(token)?.delete(avisar); };
    },
    async enviar(token, tipo, arquivos) {
      const recebidoEm = agora().toISOString();
      mudar(token, e => ({ ...e, envios: [...arquivos.map(a => ({ id: 'e' + proximo++, nome: a.name, tipo, tamanho: a.size, recebidoEm })), ...e.envios] }));
    },
    async abrirChamado(token, { tipo, texto }) {
      // a foto da admissão (quando vem) fica só no pedido do banco; aqui o texto do pedido já diz que ela foi junto
      if (!de(token) || ac.erroDoNovoChamado(tipo, texto)) return '';
      const id = 'c' + proximo++;
      const chamado: ac.ChamadoDoCliente = {
        id, tipo, titulo: ac.tituloDoChamado(tipo, texto), situacao: 'aberto',
        mensagens: [{ de: 'cliente', autor: 'Você', texto: texto.trim(), em: agora().toISOString() }],
      };
      mudar(token, e => ({ ...e, chamados: [chamado, ...e.chamados] }));
      return id;
    },
    async responderChamado(token, id, texto) {
      if (!texto.trim()) return;
      mudar(token, e => ({
        ...e,
        chamados: e.chamados.map(c => c.id !== id || !ac.chamadoAceitaResposta(c) ? c
          : { ...c, situacao: 'aberto', mensagens: [...c.mensagens, { de: 'cliente', autor: 'Você', texto: texto.trim(), em: agora().toISOString() }] }),
      }));
    },
    async enviarFotoDoFuncionario(token, funcionarioId, base64Jpeg) {
      if (!base64Jpeg) return;
      const foto = 'data:image/jpeg;base64,' + base64Jpeg;
      mudar(token, e => ({ ...e, empregados: e.empregados.map(f => f.id === funcionarioId ? { ...f, foto } : f) }));
    },
    async baixarDocumento(token, id) {
      const d = de(token)?.documentos.find(x => x.id === id);
      if (!d) return null;
      if (d.novo) mudar(token, e => ({ ...e, documentos: e.documentos.map(x => x.id === id ? { ...x, novo: false } : x) }));
      return {
        nome: formatos.slug(d.nome) + (d.competencia ? '-' + d.competencia : '') + '.pdf',
        arquivo: pdfDeExemplo(['DOCUMENTO DE EXEMPLO', d.nome, d.competencia ? 'Referente a ' + formatos.rot(d.competencia) : '', 'Nilma Contabilidade']),
      };
    },
    async baixarComprovante(token, id) {
      const p = de(token)?.pagas.find(x => x.id === id);
      if (!p || !p.temComprovante) return null;
      return {
        nome: 'comprovante-' + formatos.slug(p.nome) + '.pdf',
        arquivo: pdfDeExemplo(['COMPROVANTE DE EXEMPLO (nao vale como recibo)', p.nome, 'Pago em ' + p.pagoEm, `Valor: R$ ${p.valor.toFixed(2).replace('.', ',')}`]),
      };
    },
    async baixarGuia(token, id) {
      const g = de(token)?.guias.find(x => x.id === id);
      if (!g || !g.temPdf) return null;
      return {
        nome: `guia-${g.tipo.toLowerCase()}-${g.competencia}.pdf`,
        arquivo: pdfDeExemplo(['GUIA DE EXEMPLO (nao vale como pagamento)', `Guia: ${g.tipo}`, `Competencia: ${g.competencia}`, `Vencimento: ${g.vencimento}`, `Valor: R$ ${g.valor.toFixed(2).replace('.', ',')}`]),
      };
    },
  };
}
