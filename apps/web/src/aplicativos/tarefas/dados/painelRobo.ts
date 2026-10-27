// O painel do robô (Cadastro › Painel do robô, 21/10/2026). No banco: painelRobo.firestore.ts (ouve robo/painelPC,
// robo/painelVM e a atividade enquanto a tela está aberta); nos exemplos: aqui, com os dois robôs de mentira trabalhando.
import { entregas } from '@nads/core';

export interface RepoPainelRobo {
  readonly exemplos: boolean;
  docs(): entregas.DocsDoPainelRobo;
  /** começa a ouvir (enquanto a tela está aberta); devolve como parar */
  acompanhar(): () => void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Os dois robôs de exemplo, com as horas contadas a partir de agora (a tela sempre parece viva). */
export function docsDeExemplo(agora = Date.now()): entregas.DocsDoPainelRobo {
  const ha = (min: number) => new Date(agora - min * 60000).toISOString();
  const hoje = new Date(agora);
  const mes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  const pc = entregas.lerBatimento('pc', {
    robo: 'pc', maquina: 'DPTO-FISCAL-004', versao: '8c41f2a de ' + hoje.toLocaleDateString('pt-BR'), ligadoEm: ha(372), em: ha(0.4),
    agora: [
      { chave: 'fgts', texto: 'Emitindo FGTS 3/10 — 62 AGROPECUÁRIA EXEMPLO (09/2026)', desde: ha(4) },
      { chave: 'sieg', texto: 'SIEG: baixando os XMLs de 292', desde: '' },
    ],
    modulos: [
      { id: 'arquivamento', nome: 'Arquivamento', ligado: true }, { id: 'fgts', nome: 'FGTS Digital', ligado: true },
      { id: 'alterdata', nome: 'Balancete do Alterdata', ligado: true }, { id: 'sieg', nome: 'SIEG', ligado: true },
      { id: 'area-cliente', nome: 'Área do Cliente', ligado: true },
    ],
    filas: [
      { id: 'arquivamento', nome: 'Arquivamento', esperando: 0, andamento: 0, maisAntigoEm: '' },
      { id: 'fgts', nome: 'FGTS Digital', esperando: 7, andamento: 1, maisAntigoEm: ha(14) },
      { id: 'alterdata', nome: 'Balancete do Alterdata', esperando: 1, andamento: 0, maisAntigoEm: ha(3) },
      { id: 'sieg', nome: 'SIEG', esperando: 0, andamento: 1, maisAntigoEm: ha(2) },
      { id: 'area-chamados', nome: 'Chamados da Área do Cliente', esperando: 0, andamento: 0, maisAntigoEm: '' },
      { id: 'area-envios', nome: 'Arquivos da Área do Cliente', esperando: 2, andamento: 0, maisAntigoEm: ha(75) },
      { id: 'mensagens', nome: 'Mensagens ao Claude da rotina', esperando: 0, andamento: 0, maisAntigoEm: '' },
    ],
    paraResolver: { agora: 0, em: ha(2) },
    arquivados: {
      mes, em: ha(6), hoje: 38, noMes: 912, naoIdentificadosNoMes: 17, execucoesNoMes: 19,
      execucoes: [
        { id: 'EXEC-exemplo-3', em: ha(140), arquivados: 26, clientes: 11, naoIdentificados: 2 },
        { id: 'EXEC-exemplo-2', em: ha(330), arquivados: 12, clientes: 6, naoIdentificados: 0 },
        { id: 'EXEC-exemplo-1', em: ha(60 * 24 + 300), arquivados: 54, clientes: 19, naoIdentificados: 3 },
        { id: 'EXEC-exemplo-0', em: ha(60 * 48 + 320), arquivados: 41, clientes: 15, naoIdentificados: 1 },
      ],
    },
  });
  const vm = entregas.lerBatimento('vm', {
    robo: 'vm', maquina: 'robo-nilma', versao: '8c41f2a de ' + hoje.toLocaleDateString('pt-BR') + ' · 2026-10-21a', ligadoEm: ha(60 * 26), em: ha(0.2),
    agora: [{ chave: 'gmail', texto: 'Lendo o Gmail (automático a cada 120 min)', desde: ha(1) }],
    modulos: [
      { id: 'gmail', nome: 'Gmail e cobranças', ligado: true }, { id: 'envios', nome: 'Envios do nads', ligado: true },
      { id: 'drive', nome: 'Mapa do Drive', ligado: true }, { id: 'nfse', nome: 'NFS-e dos honorários', ligado: true },
      { id: 'sefaz', nome: 'Situação na SEFAZ', ligado: false, motivo: 'o certificado do escritório venceu' },
    ],
    filas: [
      { id: 'gmail', nome: 'Gmail e cobranças', esperando: 0, andamento: 0, maisAntigoEm: '' },
      { id: 'nfse', nome: 'NFS-e dos honorários', esperando: 0, andamento: 0, maisAntigoEm: '' },
      { id: 'sefaz', nome: 'Situação na SEFAZ', esperando: 1, andamento: 0, maisAntigoEm: ha(130) },
      { id: 'envios', nome: 'Envios do nads (Claudio Secretario)', esperando: 0, andamento: 0, maisAntigoEm: '' },
    ],
  });
  const a = (id: string, min: number, robo: 'pc' | 'vm', tipo: string, texto: string, detalhe: string, erro = false) =>
    entregas.lerAtividade(id, { em: ha(min), robo, maquina: robo === 'pc' ? 'DPTO-FISCAL-004' : 'robo-nilma', tipo, texto, detalhe, erro });
  const atividades = [
    a('1', 2, 'pc', 'fgts', 'Emitiu a guia do FGTS de 58 COMÉRCIO EXEMPLO (09/2026)', 'guia 12345678901 · R$ 1.284,55 · vence 20/10/2026 · 2026/58 - COMÉRCIO EXEMPLO/DEPARTAMENTO PESSOAL/09/FGTS'),
    a('2', 6, 'pc', 'fgts', 'A guia do FGTS de 115 PADARIA EXEMPLO (09/2026) não saiu', 'sem procuração no FGTS Digital para este CNPJ', true),
    a('3', 11, 'vm', 'gmail', 'Leu o Gmail', '12 e-mails lidos, 4 anexos salvos · automático a cada 120 min'),
    a('4', 19, 'pc', 'sieg', 'Baixou os XMLs do SIEG de 292 (09/2026)', '1.292 arquivo(s), 48 novo(s) no Drive · pedido de Heverton'),
    a('5', 27, 'pc', 'alterdata', 'Gerou o balancete 292 09/2026 no Alterdata', 'Claudio Secretario/Balancete 292 2026-09.xlsx · pedido de Vitor'),
    a('6', 34, 'vm', 'extratos', 'Extrato de 62 AGROPECUÁRIA EXEMPLO na fila do Extratudo', 'extrato-sicoob-setembro.pdf · 2026-09 · pelo Drive'),
    a('7', 48, 'vm', 'sefaz', 'A SEFAZ pediu para esperar na consulta de 380 (09/2026)', 'consumo indevido: 656', true),
    a('8', 63, 'pc', 'area-cliente', 'Arquivou o que o cliente mandou — 58 COMÉRCIO EXEMPLO', 'nota-servico-setembro.pdf → 2026/58 - COMÉRCIO EXEMPLO/ÁREA DO CLIENTE/10'),
    a('9', 140, 'pc', 'arquivamento', 'Arquivou 26 arquivos de 11 clientes', '58 COMÉRCIO EXEMPLO (6), 292 INDÚSTRIA EXEMPLO (5), 62 AGROPECUÁRIA EXEMPLO (3) · 2 não identificado(s) · EXEC-exemplo-3'),
    a('10', 151, 'vm', 'cobranca', 'Enviou a cobrança em lote (14 clientes)', 'pedido de Fernando'),
    a('11', 170, 'vm', 'nfse', 'Emitiu a NFS-e nº 418 dos honorários', 'chave 31690062000000000000000000000000000000000000000418'),
    a('12', 205, 'vm', 'envios', 'Gravou no Claudio Secretario: folha-setembro.pdf', '2026-09/292 - INDÚSTRIA EXEMPLO · de Clara'),
    a('13', 330, 'pc', 'arquivamento', 'Arquivou 12 arquivos de 6 clientes', 'EXEC-exemplo-2'),
    a('14', 372, 'pc', 'robo', 'Robô do PC ligou em DPTO-FISCAL-004', 'versão 8c41f2a'),
    a('15', 60 * 9, 'pc', 'sieg', 'Contagem da madrugada pronta', '231 clientes em 2026-10 e 2026-09'),
    a('16', 60 * 20, 'vm', 'gmail', 'A leitura do Gmail deu erro', 'o Google pediu para autorizar de novo a caixa do fiscal', true),
  ];
  return { carregado: true, semPermissao: false, pc, vm, sinais: { pc: null, vm: null }, atividades };
}

export function criarPainelRoboMemoria(): RepoPainelRobo {
  let docs = docsDeExemplo();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  return {
    exemplos: true,
    docs: () => docs,
    acompanhar() {
      // o exemplo também "bate o ponto": a cada minuto, as horas andam junto com o relógio
      const r = setInterval(() => { docs = docsDeExemplo(); ver++; for (const f of ouvintes) f(); }, 60 * 1000);
      return () => clearInterval(r);
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
