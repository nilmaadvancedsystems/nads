// A saúde do robô do Entregas (Tarefas › Cadastro › Configurações): o que o robô da nuvem e o arquivador do PC
// deixam no banco, traduzido em linhas "ok / atenção / parado" para quem não lê log. Só leitura:
//   robo/estado        vigia {em, pc}, status/statusMsg (leitura do Gmail), ultimaExecucao + ultimaExecucaoResumo,
//                      caixas {robo|contabil|fiscal: {autorizada, email, erro}}, backup {ok, em, resumo}, reguaUltima
//   robo/arquivador    {em, situacao, mensagem}       (o PC do escritório que roda o Claudio Secretario)
//   robo/uso           {em, leituras, gravacoes, erro} (o consumo do banco no dia)
//   driveIndice/raiz   {atualizadoEm, varreduraEm}    (o mapa do Drive)
//   solicitacoesEmail  os pedidos que deram erro (cobrança, salvar no Drive…)

export type TomDaSaude = 'ok' | 'aviso' | 'erro' | 'neutro';

export interface ItemDaSaude {
  id: string;
  rotulo: string;
  tom: TomDaSaude;
  texto: string;
  detalhe?: string;
}

export interface ErroNaFila { tipo: string; erro: string; em: string; cliente: string }

export interface DocsDaSaude {
  estado: Record<string, unknown> | null;
  arquivador: Record<string, unknown> | null;
  uso: Record<string, unknown> | null;
  raiz: Record<string, unknown> | null;
  erros: ErroNaFila[];
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const texto = (v: unknown) => (v == null ? '' : String(v));
const MIN = 60 * 1000;
const HORA = 60 * MIN;

/** "agora há pouco", "há 5 min", "há 3 h", "há 2 dias" ('' sem data). */
export function haQuanto(iso: unknown, agora: number): string {
  const t = Date.parse(texto(iso));
  if (!Number.isFinite(t)) return '';
  const d = Math.max(0, agora - t);
  if (d < MIN) return 'agora há pouco';
  if (d < HORA) return 'há ' + Math.floor(d / MIN) + ' min';
  if (d < 48 * HORA) return 'há ' + Math.floor(d / HORA) + ' h';
  return 'há ' + Math.floor(d / (24 * HORA)) + ' dias';
}

const idade = (iso: unknown, agora: number) => { const t = Date.parse(texto(iso)); return Number.isFinite(t) ? agora - t : Infinity; };

const NOMES_DAS_CAIXAS: Record<string, string> = { robo: 'Gmail do robô', contabil: 'Gmail do contábil', fiscal: 'Gmail do fiscal' };
const NOMES_DOS_PEDIDOS: Record<string, string> = {
  um: 'cobrança', lote: 'cobrança em lote', disparo: 'disparo', responder: 'resposta', salvar: 'salvar no Drive', verificar: 'leitura do Gmail',
};

/** As linhas do cartão, na ordem de importância. */
export function saudeDoRobo(d: DocsDaSaude, agora = Date.now()): ItemDaSaude[] {
  const e = obj(d.estado);
  const itens: ItemDaSaude[] = [];

  // 1. o robô da nuvem está vivo? (bate o ponto a cada minuto)
  const vigia = obj(e.vigia);
  const vivo = idade(vigia.em, agora) < 3 * MIN;
  itens.push({
    id: 'robo', rotulo: 'Robô', tom: !d.estado ? 'neutro' : vivo ? 'ok' : 'erro',
    texto: !d.estado ? 'Sem informação do robô' : vivo ? 'Ligado' + (vigia.pc ? ' (' + texto(vigia.pc) + ')' : '') : 'Parado — último sinal ' + (haQuanto(vigia.em, agora) || 'desconhecido'),
  });

  // 2. a leitura do Gmail
  if (d.estado) {
    const status = texto(e.status);
    const ult = e.ultimaExecucao;
    const velha = idade(ult, agora) > 26 * HORA;
    itens.push({
      id: 'gmail', rotulo: 'Leitura do Gmail',
      tom: status === 'erro' ? 'erro' : velha ? 'aviso' : 'ok',
      texto: status === 'lendo' ? 'Lendo agora' : status === 'erro' ? 'Deu erro na última leitura' : ult ? 'Última leitura ' + haQuanto(ult, agora) : 'Ainda não leu',
      detalhe: status === 'erro' ? texto(e.statusMsg || e.statusMotivo) : texto(e.ultimaExecucaoResumo) || undefined,
    });
  }

  // 3. as caixas do Gmail (robô, contábil, fiscal)
  const caixas = obj(e.caixas);
  for (const k of ['robo', 'contabil', 'fiscal']) {
    if (!(k in caixas)) continue;
    const c = obj(caixas[k]);
    const tom: TomDaSaude = c.erro ? 'erro' : c.autorizada ? 'ok' : 'neutro';
    itens.push({
      id: 'caixa-' + k, rotulo: NOMES_DAS_CAIXAS[k], tom,
      texto: c.erro ? 'A autorização falhou' : c.autorizada ? texto(c.email) || 'Autorizada' : 'Ainda não autorizada',
      detalhe: c.erro ? texto(c.erro) : !c.autorizada && k === 'contabil' ? 'Enquanto isso, a cobrança do contábil sai pelo Gmail do robô.' : undefined,
    });
  }

  // 4. o arquivador (PC do escritório)
  if (d.arquivador) {
    const a = obj(d.arquivador);
    const ligado = idade(a.em, agora) < 3 * MIN && a.situacao !== 'desligado';
    const situacoes: Record<string, string> = { livre: 'Ligado, esperando pedido', aguardando: 'Esperando a hora de rodar', rodando: 'Arquivando agora' };
    itens.push({
      id: 'arquivador', rotulo: 'Arquivador (Claudio Secretario)', tom: ligado ? 'ok' : 'aviso',
      texto: ligado ? situacoes[texto(a.situacao)] || 'Ligado' : 'PC do arquivador desligado — último sinal ' + (haQuanto(a.em, agora) || 'desconhecido'),
      detalhe: texto(a.mensagem) || undefined,
    });
  }

  // 5. o mapa do Drive
  if (d.raiz) {
    const r = obj(d.raiz);
    const varredura = r.varreduraEm || r.atualizadoEm;
    itens.push({
      id: 'drive', rotulo: 'Mapa do Drive', tom: idade(varredura, agora) > 26 * HORA ? 'aviso' : 'ok',
      texto: 'Atualizado ' + (haQuanto(r.atualizadoEm, agora) || '—'),
      detalhe: r.varreduraEm ? 'Releitura completa ' + haQuanto(r.varreduraEm, agora) : undefined,
    });
  }

  // 6. o backup do dia
  if (d.estado && e.backup) {
    const b = obj(e.backup);
    const recente = idade(b.em, agora) < 30 * HORA;
    itens.push({
      id: 'backup', rotulo: 'Backup', tom: b.ok === false ? 'erro' : recente ? 'ok' : 'aviso',
      texto: b.ok === false ? 'O último backup falhou' : b.em ? 'Último backup ' + haQuanto(b.em, agora) : 'Sem backup registrado',
      detalhe: texto(b.resumo) || undefined,
    });
  }

  // 7. a régua de cobrança
  if (d.estado && e.reguaUltima) {
    const r = obj(e.reguaUltima);
    itens.push({
      id: 'regua', rotulo: 'Cobrança automática', tom: 'neutro',
      texto: 'Última ' + (haQuanto(r.em, agora) || '—') + ' · ' + (Number(r.enviados) || 0) + ' enviada(s)',
    });
  }

  // 8. o consumo do banco
  if (d.uso) {
    const u = obj(d.uso);
    itens.push({
      id: 'uso', rotulo: 'Uso do banco hoje', tom: u.erro ? 'aviso' : 'neutro',
      texto: u.erro ? 'Não consegui medir' : (Number(u.leituras) || 0).toLocaleString('pt-BR') + ' leituras · ' + (Number(u.gravacoes) || 0).toLocaleString('pt-BR') + ' gravações',
      detalhe: u.erro ? texto(u.erro) : 'Medido ' + haQuanto(u.em, agora),
    });
  }

  // 9. pedidos que deram erro nas últimas 24 h
  const recentes = d.erros.filter(x => idade(x.em, agora) < 24 * HORA).sort((a, b) => b.em.localeCompare(a.em));
  itens.push({
    id: 'fila', rotulo: 'Pedidos com erro (24 h)', tom: recentes.length ? 'aviso' : 'ok',
    texto: recentes.length ? recentes.length + (recentes.length === 1 ? ' pedido deu erro' : ' pedidos deram erro') : 'Nenhum',
    detalhe: recentes.slice(0, 3).map(x => (NOMES_DOS_PEDIDOS[x.tipo] || x.tipo) + (x.cliente ? ' de ' + x.cliente : '') + ': ' + x.erro).join(' · ') || undefined,
  });

  return itens;
}

/** O pedido da fila (solicitacoesEmail) que deu erro, conferido. */
export function erroDaFila(doc: Record<string, unknown>): ErroNaFila {
  return { tipo: texto(doc.tipo), erro: texto(doc.erro), em: texto(doc.erroEm || doc.criadoEm), cliente: texto(doc.clienteNome) };
}
