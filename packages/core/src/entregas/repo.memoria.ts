// O Drive e o Gmail EM MEMÓRIA (modo exemplos): um mapa e uma caixa de exemplo, para as telas terem o que
// mostrar. Nada vai para o banco, e nenhum arquivo de verdade abre.
import { mapaDaRaiz, type AndamentoDoPedido, type ItemDoDrive } from './drive';
import { partesDoArquivo, PASTA_SEM_CLIENTE, type AndamentoDoEnvio } from './secretario';
import { estadoDoRobo, type ClienteDoEntregas, type EmailLido, type RespostaPedida } from './gmail';
import type { RepoDriveDoEntregas, RepoGmailDoEntregas } from './repo';

const agora = () => new Date().toISOString();

const PASTAS = [
  { id: 'p292', nome: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', nomePasta: '292 - FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', codigo: '292', arquivos: 6, pastas: 7, bytes: 5_400_000, mod: '2026-09-28T13:00:00.000Z' },
  { id: 'p58', nome: 'TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA', nomePasta: '58 - TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA', codigo: '58', arquivos: 2, pastas: 3, bytes: 800_000, mod: '2026-09-20T10:00:00.000Z' },
];

const ITENS: Record<string, ItemDoDrive[]> = {
  p292: [
    { i: 'c1', n: 'CONTÁBIL', p: 'p292', t: 'd' },
    { i: 'c2', n: 'EXTRATOS', p: 'c1', t: 'd' },
    { i: 'c3', n: '2026', p: 'c2', t: 'd' },
    { i: 'c4', n: '08', p: 'c3', t: 'd' },
    { i: 'c5', n: 'BANCÁRIOS', p: 'c4', t: 'd' },
    { i: 'c6', n: 'SICOOB', p: 'c5', t: 'd' },
    { i: 'f1', n: 'extrato-sicoob-08-2026.pdf', p: 'c6', t: 'f', s: 182_000, m: '2026-09-02T12:00:00.000Z', x: 'application/pdf' },
    { i: 'f2', n: 'extrato-bb-08-2026.pdf', p: 'c5', t: 'f', s: 96_000, m: '2026-09-03T12:00:00.000Z', x: 'application/pdf' },
    { i: 'c7', n: 'RECEBIMENTO DE CLIENTES', p: 'c1', t: 'd' },
    { i: 'f3', n: 'relatorio-liquidacao-08-2026.pdf', p: 'c7', t: 'f', s: 240_000, m: '2026-09-05T12:00:00.000Z', x: 'application/pdf' },
    { i: 'f4', n: 'Balancete 08-2026.xlsx', p: 'p292', t: 'f', s: 4_200_000, m: '2026-09-28T13:00:00.000Z' },
    { i: 'g1', n: 'Anotações do cliente', p: 'p292', t: 'g', m: '2026-09-10T12:00:00.000Z' },
    { i: 'f5', n: 'contrato-social.pdf', p: 'p292', t: 'f', s: 700_000, m: '2026-01-10T12:00:00.000Z', x: 'application/pdf' },
  ],
  p58: [
    { i: 'd1', n: 'CONTÁBIL', p: 'p58', t: 'd' },
    { i: 'd2', n: 'EXTRATOS', p: 'd1', t: 'd' },
    { i: 'd3', n: '2026', p: 'd2', t: 'd' },
    { i: 'e1', n: 'extrato-nubank-08.pdf', p: 'd3', t: 'f', s: 120_000, m: '2026-09-04T12:00:00.000Z', x: 'application/pdf' },
    { i: 'e2', n: 'extrato-sicoob-08.pdf', p: 'd3', t: 'f', s: 680_000, m: '2026-09-04T12:00:00.000Z', x: 'application/pdf' },
  ],
};

function ouvintes() {
  let ver = 0;
  const fs = new Set<() => void>();
  return { mudou: () => { ver++; for (const f of fs) f(); }, assinar: (f: () => void) => { fs.add(f); return () => { fs.delete(f); }; }, versao: () => ver };
}

export function criarDriveDoEntregasMemoria(): RepoDriveDoEntregas {
  const o = ouvintes();
  const mapa = mapaDaRaiz({ pastaId: 'ano', pastaNome: '2026', atualizadoEm: agora(), clientes: PASTAS });
  return {
    exemplos: true,
    mapa: () => mapa,
    itens: id => ({ carregados: true, itens: ITENS[id] || [] }),
    pedir(p, aoMudar) {
      let vivo = true;
      const passos: AndamentoDoPedido[] = [
        p.modo === 'zip' ? { status: 'buscando', progresso: '1 de ' + (p.fileIds?.length || 3) + ' arquivos' } : { status: 'buscando' },
        { status: 'erro', erro: 'nos dados de exemplo o Drive não abre arquivos de verdade' },
      ];
      passos.forEach((a, i) => setTimeout(() => { if (vivo) aoMudar(a); }, 400 * (i + 1)));
      return () => { vivo = false; };
    },
    enviar(arquivo, destino, aoMudar) {
      // exemplos: finge subir as partes e o robô gravar (nada vai para o Drive)
      let vivo = true;
      const partes = Math.max(1, partesDoArquivo(arquivo.bytes).length);
      const pasta = destino.competencia + '/' + (destino.cliente.trim() || PASTA_SEM_CLIENTE);
      const passos: AndamentoDoEnvio[] = [
        ...Array.from({ length: partes }, (_, i) => ({ status: 'enviando' as const, enviadas: i + 1, partes })),
        { status: 'pendente', partes },
        { status: 'gravando', partes },
        { status: 'pronto', partes, pasta, nomeFinal: arquivo.nome },
      ];
      passos.forEach((a, i) => setTimeout(() => { if (vivo) aoMudar(a); }, 300 * (i + 1)));
      return () => { vivo = false; };
    },
    assinar: o.assinar,
    versao: o.versao,
  };
}

const CLIENTES: ClienteDoEntregas[] = [
  { id: 'k292', nome: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', codigo: '292', email: 'financeiro@fito.com.br', emails: [] },
  { id: 'k58', nome: 'TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA', codigo: '58', email: 'volponi@gmail.com', emails: [] },
  { id: 'k14', nome: 'PADARIA PAO DOURADO LTDA', codigo: '14', email: '', emails: [] },
];

export function criarGmailDoEntregasMemoria(): RepoGmailDoEntregas {
  const o = ouvintes();
  const h = (dias: number, min = 9) => new Date(Date.now() - dias * 86400000 - min * 60000).toISOString();
  let doc: Record<string, unknown> = {
    vigia: { em: agora() }, status: 'ok', ultimaExecucao: h(0),
    caixa: [
      { mensagemId: '18f0a1b2c3d4e5f6', em: h(0), remetente: 'financeiro@fito.com.br', nome: 'Financeiro Fito', assunto: 'Extratos de agosto', trecho: 'Bom dia, seguem os extratos do Sicoob e do BB.', arquivos: ['extrato-sicoob-08.pdf', 'extrato-bb-08.pdf'], clienteId: 'k292', clienteNome: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA' },
      { mensagemId: '18f0a1b2c3d4e5f7', em: h(1), remetente: 'volponi@gmail.com', nome: 'Volponi', assunto: 'Comprovantes', trecho: 'Segue comprovante do DAS.', arquivos: ['das-08.pdf'], clienteId: 'k58', clienteNome: 'TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA' },
      { mensagemId: '18f0a1b2c3d4e5f8', em: h(2), remetente: 'contato@grupoalfa.com.br', nome: 'Grupo Alfa', assunto: 'Notas de agosto', trecho: 'Notas das duas empresas.', arquivos: ['notas.zip'], clienteId: null, candidatos: ['ALFA COMERCIO LTDA', 'ALFA SERVICOS LTDA'] },
    ],
    naoReconhecidos: [
      { mensagemId: '18f0a1b2c3d4e5f9', em: h(0), remetente: 'padaria.paodourado@gmail.com', nome: 'Pão Dourado', assunto: 'extrato', trecho: 'Oi, mandando o extrato do mês.', arquivos: ['extrato.pdf'] },
      { mensagemId: '18f0a1b2c3d4e5fa', em: h(3), remetente: 'naoresponda@banco.com.br', nome: 'Banco', assunto: 'Seu extrato está disponível', trecho: 'Acesse o app.', arquivos: [] },
    ],
    spam: [
      { mensagemId: '18f0a1b2c3d4e5fb', em: h(1), remetente: 'promo@loja.com', nome: 'Loja', assunto: 'Ofertas da semana', trecho: 'Só hoje!', arquivos: [] },
    ],
    execucoes: [
      { em: h(0), dias: 3, emails: 42, marcados: 5, baixados: 7, naoReconhecidos: 2, conversas: 12, erros: 0, duracaoMs: 48000 },
      { em: h(1), dias: 3, emails: 38, marcados: 3, baixados: 4, naoReconhecidos: 1, conversas: 9, erros: 1, duracaoMs: 52000 },
    ],
    salvos: {},
  };
  let ignorados: string[] = [];
  const clientes = CLIENTES.map(c => ({ ...c, emails: [...c.emails] }));
  const respostas = new Map<string, RespostaPedida[]>();
  const ouvRespostas = new Map<string, Set<(r: RespostaPedida[]) => void>>();
  const mudar = (novo: Record<string, unknown>) => { doc = { ...doc, ...novo, vigia: { em: agora() } }; o.mudou(); };
  const espera = (ms: number) => new Promise(r => setTimeout(r, ms));
  return {
    exemplos: true,
    estado: () => estadoDoRobo(doc),
    clientes: () => ({ carregados: true, lista: clientes }),
    ignorados: () => ignorados,
    async verificar(dias) {
      mudar({ andamento: { ativo: true, tipo: 'leitura', motivo: 'pedido', fase: 'lendo', feito: 3, total: 10, recentes: [{ em: agora(), texto: 'Lendo os e-mails dos últimos ' + dias + ' dias…' }] } });
      await espera(1500);
      mudar({ andamento: null, ultimaExecucao: agora() });
    },
    async cancelar() { mudar({ andamento: null }); },
    async salvarNoDrive(id, clienteId) {
      await espera(500);
      const salvos = { ...(doc.salvos as Record<string, unknown>), [id]: { em: agora(), pasta: 'Claudio Secretario/2026-09/' + (clientes.find(c => c.id === clienteId)?.nome || 'cliente'), arquivos: 1 } };
      mudar({ salvos });
    },
    async ligarRemetente(clienteId, email) {
      const c = clientes.find(x => x.id === clienteId);
      if (!c) throw new Error('cliente não encontrado');
      if (!c.email) c.email = email.toLowerCase(); else c.emails.push(email.toLowerCase());
      o.mudou();
    },
    async ignorar(email) { ignorados = [...ignorados, email.toLowerCase()]; o.mudou(); },
    async ler(id): Promise<EmailLido> {
      await espera(500);
      const todos = [...(doc.caixa as Record<string, unknown>[]), ...(doc.naoReconhecidos as Record<string, unknown>[]), ...(doc.spam as Record<string, unknown>[])];
      const e = todos.find(x => x.mensagemId === id) || {};
      return {
        texto: String(e.trecho || '') + '\n\nAtenciosamente,\n' + String(e.nome || ''), truncado: false,
        de: String(e.nome || '') + ' <' + String(e.remetente || '') + '>', para: 'nilmacontabilidade@gmail.com', cc: '',
        assunto: String(e.assunto || ''), em: String(e.em || ''),
        anexos: ((e.arquivos as string[]) || []).map(nome => ({ nome, tamanho: 120_000 })),
      };
    },
    async responder(p) {
      const lista = [...(respostas.get(p.mensagemId) || []), { id: String(Date.now()), status: 'enviado', corpo: p.corpo, por: 'você', em: agora() }];
      respostas.set(p.mensagemId, lista);
      for (const f of ouvRespostas.get(p.mensagemId) || []) f(lista);
    },
    respostas(id, aoMudar) {
      if (!ouvRespostas.has(id)) ouvRespostas.set(id, new Set());
      ouvRespostas.get(id)?.add(aoMudar);
      aoMudar(respostas.get(id) || []);
      return () => { ouvRespostas.get(id)?.delete(aoMudar); };
    },
    assinar: o.assinar,
    versao: o.versao,
  };
}
