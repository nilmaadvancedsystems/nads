// A versão de exemplo da Área do Cliente (Vitor, 16/10/2026): uma empresa, "Personaly Company", com dados plausíveis que
// acompanham a data de hoje (a vencida, a que vence hoje e as a vencer andam junto com o relógio). Só o token "exemplo"
// abre; qualquer outro é um link inválido e não mostra dado nenhum. Nada sai do navegador.
import { areaCliente as ac } from '@nads/core';
import { AREA_VAZIA, type EstadoDaArea, type RepoAreaCliente } from './areaCliente';

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
    return { id, tipo, competencia: competenciaDe(venc), vencimento: br(venc), valor, ...(numero ? { numero } : {}), situacao: ac.situacaoDaGuia(br(venc), hoje), temPdf: true };
  };
  const guias = [
    guia('g1', 'DAS', -5, 1284.37, '07.18.26277.1234567-8'),
    guia('g2', 'FGTS', 3, 917.42, '202609001234'),
    guia('g3', 'DAE', 8, 432.1),
    guia('g4', 'outra', 0, 85.9),
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
    { id: 'e2', nome: 'notas-fiscais-setembro.zip', tipo: 'nota', tamanho: 2_300_000, recebidoEm: comHora(emDias(hoje, -2), 16, 40) },
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
  };
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
