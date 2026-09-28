// ViewModel da Importação (balancete, entradas, saídas, tomados, prestados).
// Origem: conferencia.html btPlano.onclick (~L2526), verificarBalancete (~L2579), importar
// (~L2856), importarServ (~L4311), apagarPlano/impApagarNotas/servApagar, renderImportacoes
// (~L2433), Reimportar (~L2472), switchAutoLimpar (~L1988), MSG_IMPORT (~L2625).
import { conferencia as c, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useCallback, useState } from 'react';
import { useSessao } from '../../casca/sessao';

type TipoImp = c.PaginaImportacao;

export interface ConfigImportacao {
  titulo: string;
  icone: 'landmark' | 'arrowDown' | 'arrowUp' | 'fileDown' | 'fileUp';
  dica: string;
  aceitar: string;
  /** id da mensagem flutuante (o CSS original posiciona por id) */
  idMensagem: string;
  idArquivo: string;
}

export const CONFIG: Record<TipoImp, ConfigImportacao> = {
  balancete: { titulo: 'Importar balancete', icone: 'landmark', dica: 'Excel do balancete (XLS Dados Arquivo)', aceitar: '.xls,.xlsx,.xlsm,.xlsb,.csv,.ods', idMensagem: 'planoMsg', idArquivo: 'fPlano' },
  entradas: { titulo: 'Importar entradas', icone: 'arrowDown', dica: 'Relatório de entradas em Excel', aceitar: '.xls,.xlsx,.csv', idMensagem: 'msgEnt', idArquivo: 'fEnt' },
  saidas: { titulo: 'Importar saídas', icone: 'arrowUp', dica: 'Relatório de saídas em Excel', aceitar: '.xls,.xlsx,.csv', idMensagem: 'msgSai', idArquivo: 'fSai' },
  tomados: { titulo: 'Importar serviços tomados', icone: 'fileDown', dica: 'Relatório de ISS de serviços tomados em Excel (data, nota, fornecedor, lançamento e valor)', aceitar: '.xls,.xlsx,.csv', idMensagem: 'msgTom', idArquivo: 'fTom' },
  prestados: { titulo: 'Importar serviços prestados', icone: 'fileUp', dica: 'Relatório de ISS de serviços prestados em Excel (data, nota, cliente, lançamento e valor)', aceitar: '.xls,.xlsx,.csv', idMensagem: 'msgPrest', idArquivo: 'fPrest' },
};

/** O que a mensagem flutuante mostra (a View desenha). */
export interface Mensagem {
  tom: 'erro' | 'ok' | 'lendo';
  titulo: string;
  textos: { texto: string; tom?: 'aviso'; separado?: boolean }[];
}

const NOME_TIPO: Record<c.TipoNotaFiscal, string> = { entradas: 'entradas', saidas: 'saídas' };

export function useImportacao(tipo: TipoImp) {
  const s = useSessao();
  const { toast, modal } = useRetorno();
  const e = s.empresa;
  const cfg = CONFIG[tipo];
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [reimportando, setReimportando] = useState(false);
  const [abrirArquivo, setAbrirArquivo] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagemBruta] = useState<Mensagem | null>(null);
  const [seqMensagem, setSeq] = useState(0);
  const [filtroGrupos, setFiltroGrupos] = useState<c.Grupo[]>([]);

  const setMensagem = (m: Mensagem | null) => { setMensagemBruta(m); setSeq(x => x + 1); };
  const fecharMensagem = useCallback(() => setMensagemBruta(null), []);
  const erro = (titulo: string, texto: string) => setMensagem({ tom: 'erro', titulo, textos: texto ? [{ texto }] : [] });

  const ja = c.jaImportado(e)[tipo];
  const mostrarCaixa = !ja || reimportando;

  function limparArquivo() { setArquivo(null); }
  function terminar() { setCarregando(false); }

  async function lerArquivo(f: File): Promise<c.Linhas> {
    return c.lerPlanilha(await f.arrayBuffer());
  }

  // ---------- importar ----------
  async function importar() {
    setMensagemBruta(null);
    if (!arquivo) { erro('Escolha o arquivo', tipo === 'balancete' ? 'Selecione o balancete em Excel antes de continuar.' : 'Selecione o relatório em Excel antes de importar.'); return; }
    setCarregando(true);
    try {
      const rows = await lerArquivo(arquivo);
      if (tipo === 'balancete') await importarBalancete(rows);
      else if (tipo === 'entradas' || tipo === 'saidas') await importarNotas(tipo, rows);
      else await importarServicos(tipo, rows);
    } catch (err) {
      terminar();
      erro('Não deu para ler o arquivo', err instanceof Error ? err.message : '');
    }
  }

  async function importarBalancete(rows: c.Linhas) {
    const lista = c.ordenarBalancete(c.lerBalancete(rows));
    if (!lista.length) { terminar(); erro('Não achei contas nesse arquivo', 'O balancete precisa ter o código da conta entre colchetes.'); return; }
    const v = c.verificarBalancete(e, lista);
    const concluir = (forcado: boolean) => {
      s.aplicar(x => c.importarBalancete(x, lista, new Date(), forcado ? v.problemas.map(p => p.replace(/<[^>]+>/g, '')).join(' ') : undefined));
      setReimportando(false); limparArquivo(); terminar();
      toast(lista.length + ' contas lidas.');
    };
    if (!v.problemas.length) { concluir(false); return; }
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Esse balancete parece ser de outra empresa',
      html: 'Confira se o arquivo é mesmo de <b>' + escapar(s.nome) + '</b>:<br><br>' + v.problemas.map(p => '• ' + p).join('<br>') +
        '<br><br>Importar o balancete de outra empresa desfaz a lógica do Cadastro (CFOP × conta) já configurado aqui.',
      botoes: [{ rotulo: 'Cancelar importação', valor: false, variante: 'btn-outline' }, { rotulo: 'Importar mesmo assim', valor: true, variante: 'btn-danger' }],
    });
    if (ok) { concluir(true); return; }
    terminar(); limparArquivo();
    toast('Importação cancelada — nada foi alterado.');
  }

  async function importarNotas(t: c.TipoNotaFiscal, rows: c.Linhas) {
    const lidas = c.lerNotas(rows);
    const sep = c.separarPorTipo(lidas, t);
    if (sep.todasForaDoTipo) {
      terminar();
      erro('Esse arquivo não parece ser de ' + NOME_TIPO[t], 'Todos os CFOPs dele são de ' + (t === 'entradas' ? 'saída (5, 6 e 7)' : 'entrada (1, 2 e 3)') + '. Confira se escolheu o arquivo certo.');
      return;
    }
    const novas = sep.validas;
    const qtdAntes = e[t].length;
    let modo: c.ModoImportacao = 'novas';
    if (qtdAntes) {
      const escolha = await modal<c.ModoImportacao | null>({
        icone: 'upload', titulo: 'Como importar as ' + NOME_TIPO[t] + '?',
        html: 'Já existem <b>' + qtdAntes + ' nota(s)</b> de ' + NOME_TIPO[t] + ' guardada(s); o arquivo tem <b>' + novas.length + '</b>.<br><br>' +
          '<b>Importar apenas novas</b> — mantém o que já está guardado e só acrescenta as notas que ainda não existem (e corrige lançamento/nome das que mudaram).<br><br>' +
          '<b>Sobrepor o movimento</b> — apaga as ' + qtdAntes + ' nota(s) guardada(s) e fica só com as do arquivo.',
        botoes: [{ rotulo: 'Cancelar', valor: null, variante: 'btn-outline' }, { rotulo: 'Sobrepor o movimento', valor: 'sobrepor', variante: 'btn-danger' }, { rotulo: 'Importar apenas novas', valor: 'novas', variante: 'btn-primary' }],
      });
      if (!escolha) { terminar(); toast('Importação cancelada — nada foi alterado.'); return; }
      modo = escolha;
    }
    const m = c.mesclarNotas(e[t], novas, modo);
    const nova = s.aplicar(x => c.importarNotas(x, t, m.notas, m.adicionadas, modo, new Date()));
    const div = nova ? c.acharDivergencias(nova, t).length : 0;
    const textos: Mensagem['textos'] = [{
      texto: (modo === 'sobrepor' ? 'As ' + qtdAntes + ' nota(s) que estavam guardadas foram substituídas'
        : m.semMudanca + ' já estavam aqui sem mudança' + (m.atualizadas ? ', ' + m.atualizadas + ' tiveram lançamento/nome corrigido' : '')) + '. Total guardado: ' + m.notas.length + '.',
    }];
    if (sep.foraDoTipo.length) {
      const cfops = sep.foraDoTipo.map(n => n.cfop).filter((x, i, l) => l.indexOf(x) === i).join(', ');
      textos.push({ texto: sep.foraDoTipo.length + ' nota(s) com CFOP de ' + (t === 'entradas' ? 'saída' : 'entrada') + ' ficaram de fora (' + cfops + ').', tom: 'aviso' });
    }
    if (div) textos.push({ texto: div + ' nota(s) com lançamento fora do padrão do CFOP — veja em Movimento › Relatório › ' + (t === 'entradas' ? 'Entradas' : 'Saídas') + '.', tom: 'aviso', separado: true });
    setMensagem({ tom: 'ok', titulo: modo === 'sobrepor' ? m.adicionadas + ' nota(s) importada(s) — movimento sobreposto' : m.adicionadas + ' nota(s) nova(s) guardada(s)', textos });
    setReimportando(false); limparArquivo(); terminar();
  }

  async function importarServicos(t: c.TipoServico, rows: c.Linhas) {
    const cfgS = c.SV[t];
    let lido: { notas: c.NotaServico[]; canceladas: number };
    try {
      lido = c.lerServicos(rows, t);
    } catch (err) {
      terminar();
      if (err instanceof c.ErroTipoErrado) {
        const outro = c.SV[err.tipoCerto];
        erro('Esse arquivo não parece ser de ' + cfgS.rotulo.toLowerCase(), 'O relatório é de ' + outro.rotulo.toLowerCase() + ' (tem ' + outro.part + ', não ' + cfgS.part + '). Confira se escolheu o arquivo certo.');
        return;
      }
      throw err;
    }
    if (!lido.notas.length) { terminar(); erro('Não achei notas nesse arquivo', 'Confira se é o relatório de ISS com data, nome do participante e valor base.'); return; }
    const existentes = e[cfgS.campo];
    const qtdAntes = existentes.length;
    let modo: c.ModoImportacao = 'novas';
    if (qtdAntes) {
      const nomeTipo = cfgS.rotulo.toLowerCase();
      const escolha = await modal<c.ModoImportacao | null>({
        icone: 'upload', titulo: 'Como importar os ' + nomeTipo + '?',
        html: 'Já existem <b>' + qtdAntes + ' nota(s)</b> de ' + nomeTipo + ' guardada(s); o arquivo tem <b>' + lido.notas.length + '</b>.<br><br>' +
          '<b>Importar apenas novas</b> — mantém o que já está guardado e só acrescenta as notas que ainda não existem (e corrige o lançamento das que mudaram).<br><br>' +
          '<b>Sobrepor o movimento</b> — apaga as ' + qtdAntes + ' nota(s) guardada(s) e fica só com as do arquivo.',
        botoes: [{ rotulo: 'Cancelar', valor: null, variante: 'btn-outline' }, { rotulo: 'Sobrepor o movimento', valor: 'sobrepor', variante: 'btn-danger' }, { rotulo: 'Importar apenas novas', valor: 'novas', variante: 'btn-primary' }],
      });
      if (!escolha) { terminar(); toast('Importação cancelada — nada foi alterado.'); return; }
      modo = escolha;
    }
    const m = c.mesclarServicos(existentes, lido.notas, modo);
    s.aplicar(x => c.importarServicos(x, t, m.notas, m.adicionadas, modo, new Date()));
    const textos: Mensagem['textos'] = [{
      texto: (modo === 'sobrepor' ? 'As ' + qtdAntes + ' nota(s) que estavam guardadas foram substituídas'
        : m.semMudanca + ' já estavam aqui sem mudança' + (m.atualizadas ? ', ' + m.atualizadas + ' tiveram lançamento corrigido' : '')) + '. Total guardado: ' + m.notas.length + '.',
    }];
    if (lido.canceladas) textos.push({ texto: lido.canceladas + ' nota(s) cancelada(s) ficaram de fora.' });
    setMensagem({ tom: 'ok', titulo: modo === 'sobrepor' ? m.adicionadas + ' nota(s) importada(s) — movimento sobreposto' : m.adicionadas + ' nota(s) nova(s) guardada(s)', textos });
    setReimportando(false); limparArquivo(); terminar();
  }

  // ---------- excluir ----------
  async function excluir() {
    setMensagemBruta(null);
    if (tipo === 'balancete') {
      if (!e.contas.length) { toast('Não há balancete lido pra apagar.'); return; }
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Apagar o balancete?', html: 'As <b>' + e.contas.length + ' contas lidas</b> desta empresa serão removidas.',
        botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      s.aplicar(x => c.apagarBalancete(x, new Date()));
      limparArquivo(); toast('Balancete apagado.');
      return;
    }
    if (tipo === 'entradas' || tipo === 'saidas') {
      const nome = NOME_TIPO[tipo];
      if (!e[tipo].length) { toast('Não há notas de ' + nome + ' pra apagar.'); return; }
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Apagar as notas de ' + nome + '?', html: 'Todas as <b>' + e[tipo].length + ' notas de ' + nome + '</b> guardadas desta empresa serão apagadas. O plano de contas continua.',
        botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      s.aplicar(x => c.apagarNotas(x, tipo, new Date()));
      limparArquivo(); toast('Notas apagadas.');
      return;
    }
    const cfgS = c.SV[tipo];
    const lista = e[cfgS.campo];
    if (!lista.length) { toast('Não há notas de ' + cfgS.rotulo.toLowerCase() + ' pra apagar.'); return; }
    const ok = await modal<boolean>({ icone: 'alert', titulo: 'Apagar as notas de ' + cfgS.rotulo.toLowerCase() + '?', html: 'Todas as <b>' + lista.length + ' notas</b> de ' + cfgS.rotulo.toLowerCase() + ' guardadas desta empresa serão apagadas. O cadastro de contas continua.',
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-primary' }] });
    if (!ok) return;
    s.aplicar(x => c.apagarServicos(x, tipo, new Date()));
    limparArquivo(); toast('Notas apagadas.');
  }

  // ---------- Reimportar (no topo): traz a caixa de volta e já abre a escolha de arquivo ----------
  function alternarReimportar() {
    setReimportando(r => {
      if (!r) setAbrirArquivo(x => x + 1);
      return !r;
    });
  }

  // ---------- Apagar ao sair (balancete) ----------
  const autoLimpar = e.autoLimparBalancete !== false;
  function definirAutoLimpar(ligado: boolean) {
    s.aplicar(x => c.definirAutoLimpar(x, ligado));
    toast(ligado ? 'Ligado: o balancete desta empresa será apagado ao sair.' : 'Desligado: o balancete desta empresa não será mais apagado ao sair.');
  }

  // ---------- o que foi importado ----------
  const plano = tipo === 'balancete' ? montarPlano(e.contas, filtroGrupos) : null;
  const notas = tipo === 'entradas' || tipo === 'saidas' ? resumoNotas(e[tipo]) : null;
  const servicos = tipo === 'tomados' || tipo === 'prestados' ? resumoServicos(e[c.SV[tipo].campo], tipo) : null;

  return {
    cfg, ja, mostrarCaixa, reimportando, alternarReimportar, abrirArquivo,
    arquivo, setArquivo, carregando, importar, excluir,
    mensagem, seqMensagem, fecharMensagem,
    boasVindas: tipo === 'balancete' && e.avisoBalPendente === true, autoLimpar, definirAutoLimpar, alternarAutoLimpar: () => definirAutoLimpar(!autoLimpar),
    plano, alternarGrupo: (g: c.Grupo) => setFiltroGrupos(f => (f.indexOf(g) > -1 ? f.filter(x => x !== g) : f.concat(g))),
    notas, servicos,
  };
}

function montarPlano(contas: c.Conta[], filtro: c.Grupo[]) {
  if (!contas.length) return null;
  const porGrupo: Partial<Record<c.Grupo, c.Conta[]>> = {};
  for (const a of contas) { const g = a.grupo || 'Outros'; (porGrupo[g] = porGrupo[g] || []).push(a); }
  const ordem = c.GRUPOS_ORDEM.filter(g => porGrupo[g]?.length);
  const mostrar = filtro.length ? ordem.filter(g => filtro.indexOf(g) > -1) : ordem;
  return {
    resumo: ordem.map(g => ({ grupo: g, qtd: (porGrupo[g] as c.Conta[]).length, ativo: filtro.indexOf(g) > -1 })),
    grupos: mostrar.map(g => ({
      grupo: g,
      contas: (porGrupo[g] as c.Conta[]).slice().sort((a, b) => (!!a.sintetica !== !!b.sintetica ? (a.sintetica ? -1 : 1) : a.nome.localeCompare(b.nome, 'pt-BR'))),
    })),
    comTitulo: mostrar.length > 1,
  };
}

export const LIMITE_LINHAS = 400;

function resumoNotas(todas: c.Nota[]) {
  if (!todas.length) return null;
  const datas = todas.map(n => n.data).filter(Boolean).sort((a, b) => formatos.dataOrdem(a) - formatos.dataOrdem(b));
  return { qtd: todas.length, total: todas.reduce((s, n) => s + n.valor, 0), periodo: datas.length ? datas[0] + ' a ' + datas[datas.length - 1] : '—', linhas: todas.slice(0, LIMITE_LINHAS) };
}

function resumoServicos(todas: c.NotaServico[], tipo: c.TipoServico) {
  if (!todas.length) return null;
  const cfg = c.SV[tipo];
  const parts: Record<string, 1> = {};
  let total = 0;
  for (const n of todas) { total += n.valor; parts[formatos.nomeNorm(n.nome)] = 1; }
  const datas = todas.map(n => n.data).sort((a, b) => formatos.dataOrdem(a) - formatos.dataOrdem(b));
  return {
    qtd: todas.length, total, rotValor: cfg.rotValor, qtdParticipantes: Object.keys(parts).length, rotParticipantes: formatos.capital(cfg.parts),
    rotParticipante: formatos.capital(cfg.part), comIss: tipo === 'prestados', periodo: datas[0] + ' a ' + datas[datas.length - 1], linhas: todas.slice(0, LIMITE_LINHAS),
  };
}

function escapar(t: string): string {
  return t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}
