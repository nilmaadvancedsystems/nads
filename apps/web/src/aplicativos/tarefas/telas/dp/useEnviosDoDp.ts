// ViewModel de DP › Envios (27/10/2026: "uma aba de envios, onde vai ser enviado para o gmail do cliente arquivos que já
// foram arquivados nas pastas dos clientes, coisas como folha de pagamento, fgts, darf… com um clique de botão num formato
// padrão via VM do google"): os clientes do DP no mês, os documentos do DP que o robô achou na pasta de cada um (a pasta do
// mês do DP, a folha e a DARF do INSS), os e-mails do cadastro e o último envio. Enviar: um cliente (com os arquivos
// marcados) ou todos os prontos. O e-mail enviado marca a Entrega do mês nas Obrigações (Vitor, 27/10/2026: "marca sozinho").
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { competenciasDoDp, guardarCompetenciaDoDp } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { useEnviosDp, useExecucoes, useGmailDoEntregas, useRepo } from '../../dados/repo';
import { MODELO_PADRAO_DO_ENVIO, type ArquivoDoDp, type EnvioDoDp } from '../../dados/enviosDp';
import { useClientesDoDp } from './useClientesDoDp';

export type SituacaoDoEnvio = 'sem-arquivos' | 'sem-email' | 'pronto' | 'fila' | 'enviando' | 'enviado' | 'erro';
export type FiltroDoEnvio = 'todos' | 'prontos' | 'enviados' | 'problemas' | 'sem-arquivos';
export type AbaDaJanela = 'arquivos' | 'enviados';

export function situacaoDoEnvio(e: EnvioDoDp | undefined, arquivos: number, emails: number): SituacaoDoEnvio {
  if (e?.status === 'pendente') return 'fila';
  if (e?.status === 'processando') return 'enviando';
  if (e?.status === 'enviado') return 'enviado';
  if (!arquivos) return 'sem-arquivos';
  if (!emails) return 'sem-email';
  if (e?.status === 'erro') return 'erro';
  return 'pronto';
}

/** o responsável como nas Obrigações: HEVERTON → Heverton, GUSTAVO.P → Gustavo.P */
const nomeDe = (r: string) => (r ? r.split('.').map(p => p.charAt(0) + p.slice(1).toLowerCase()).join('.') : '');
const DO_FILTRO: Record<FiltroDoEnvio, (s: SituacaoDoEnvio) => boolean> = {
  todos: () => true,
  prontos: s => s === 'pronto',
  enviados: s => s === 'enviado',
  problemas: s => s === 'erro' || s === 'sem-email',
  'sem-arquivos': s => s === 'sem-arquivos',
};
const NADA: readonly ArquivoDoDp[] = [];

export function useEnviosDoDp() {
  const repo = useEnviosDp();
  const tarefas = useRepo();
  const gmail = useGmailDoEntregas();
  const op = useOperador().operador as Operador;
  const { toast, modal } = useRetorno();
  const { lista: competencias, padrao } = competenciasDoDp(12);
  const [competencia, setCompetencia] = useState(padrao);
  const [filtro, setFiltro] = useState<FiltroDoEnvio>('todos');
  const [busca, setBusca] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [aberto, setAberto] = useState<number | null>(null);
  // a aba da janela do cliente: os arquivos do mês ou o que já foi enviado (28/10/2026: "ver o que já foi enviado")
  const [aba, setAba] = useState<AbaDaJanela>('arquivos');
  // o histórico do cliente aberto, de todos os meses (null = lendo)
  const [historico, setHistorico] = useState<{ codigo: number; lista: EnvioDoDp[] } | null>(null);
  useEffect(() => {
    if (aberto == null) return;
    return repo.historico(aberto, lista => setHistorico({ codigo: aberto, lista }));
  }, [aberto, repo]);
  const [enviandoTodos, setEnviandoTodos] = useState(false);
  // o que cada linha está fazendo ("enviar:<código>"): o botão dela mostra que trabalha e trava
  const [fazendo, setFazendo] = useState<ReadonlySet<string>>(new Set());
  const comLinha = async (chave: string, f: () => Promise<void>) => {
    if (fazendo.has(chave)) return;
    setFazendo(s => new Set(s).add(chave));
    try { await f(); } finally { setFazendo(s => { const n = new Set(s); n.delete(chave); return n; }); }
  };
  // os clientes marcados para o lote (28/10/2026: "com seleção de quais vou enviar, no estilo do fgts")
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<number>>(new Set());
  // a janela do modelo do e-mail (28/10/2026: "que nem o de emissão do financeiro")
  const [editandoModelo, setEditandoModelo] = useState(false);
  // os arquivos desmarcados de cada cliente (por padrão vão todos os do mês)
  const [fora, setFora] = useState<ReadonlyMap<number, ReadonlySet<string>>>(new Map());

  const doDp = useClientesDoDp(competencia);
  const { execucoes, carregada } = useExecucoes(competencia, 'dp');
  const lista = repo.arquivos(competencia);
  const envios = repo.envios(competencia);
  const clientesDoEntregas = gmail.clientes();
  const emailsDe = new Map(clientesDoEntregas.lista.map(c => [c.codigo, [...new Set([c.email, ...c.emails].filter(Boolean))]]));
  const porNome = new Map(execucoes.map(e => [e.empresa, e]));

  const todas = doDp.clientes
    // os clientes com alguma obrigação do DP no mês (os mesmos das Obrigações)
    .filter(c => c.obrigacoes.length > 0)
    .map(c => {
      const cod = String(c.codigo);
      const arquivos = lista.porCodigo.get(cod) || NADA;
      // nos exemplos não há cadastro do Entregas: um e-mail inventado, para a tela andar
      const emails = emailsDe.get(cod) || (repo.exemplos ? ['financeiro@exemplo.com.br'] : []);
      const envio = envios.porCodigo.get(cod);
      const desmarcados = fora.get(c.codigo);
      const escolhidos = desmarcados ? arquivos.filter(a => !desmarcados.has(a.id)) : arquivos;
      return {
        codigo: c.codigo, nome: c.nomeNaTela, responsavel: nomeDe(c.responsavel), arquivos, escolhidos, emails, envio,
        situacao: situacaoDoEnvio(envio, arquivos.length, emails.length), ex: porNome.get(c.nomeNaTela) || null,
      };
    })
    // marcar para o lote: tem arquivo e e-mail e não está com o robô
    .map(l => ({ ...l, podeMarcar: l.arquivos.length > 0 && l.emails.length > 0 && l.situacao !== 'fila' && l.situacao !== 'enviando' }))
    .sort((a, b) => a.codigo - b.codigo);
  type Linha = (typeof todas)[number];
  const q = busca.trim().toLowerCase();
  const doResponsavel = responsavel ? todas.filter(l => l.responsavel === responsavel) : todas;
  const linhas = doResponsavel.filter(l => (!q || l.nome.toLowerCase().includes(q) || String(l.codigo).includes(q) || l.emails.some(e => e.includes(q))) && DO_FILTRO[filtro](l.situacao));
  const prontos = doResponsavel.filter(l => l.situacao === 'pronto' && l.escolhidos.length > 0);
  const marcadasValidas = todas.filter(l => l.podeMarcar && selecionadas.has(l.codigo) && l.escolhidos.length > 0);
  // o robô agora (como o do FGTS): com quem está e a fila
  const comORobo = todas.find(l => l.situacao === 'enviando') || null;
  const naFila = todas.filter(l => l.situacao === 'fila').sort((a, b) => (a.envio?.criadoEm || '').localeCompare(b.envio?.criadoEm || ''));
  const comArquivos = doResponsavel.filter(l => l.arquivos.length > 0).length;
  const modelo = repo.modelo();

  // O envio feito marca a Entrega do mês (quem pediu, quando o robô mandou). Só uma vez: quem desfez a Entrega depois do
  // envio decide (a etapa mexida depois do envio fica como está).
  const entreguesMarcadas = useRef(new Set<string>());
  useEffect(() => {
    if (!carregada || !doDp.carregado) return;
    for (const l of todas) {
      const e = l.envio;
      if (!e || e.status !== 'enviado' || !e.enviadoEm || entreguesMarcadas.current.has(e.id)) continue;
      const est = t.estadoDa(l.ex, 'dp-envio');
      entreguesMarcadas.current.add(e.id);
      if (est && est.em >= e.enviadoEm) continue;
      const ex = l.ex || t.execucaoNova(l.nome, l.codigo, competencia, 'dp');
      const r = t.fazer(ex, 'dp-envio', e.criadoPor || op.nome, new Date(e.enviadoEm));
      tarefas.gravar(r.execucao, r.evento);
    }
  });

  async function pedir(l: Linha, arquivos: readonly ArquivoDoDp[] = l.escolhidos) {
    if (!arquivos.length) return;
    await repo.enviar({ codigo: l.codigo, empresa: l.nome, competencia, arquivos: arquivos.map(a => a.id) });
  }
  const podeEnviar = (l: Linha) => l.emails.length > 0 && l.situacao !== 'fila' && l.situacao !== 'enviando';
  /** um lote (os prontos ou os marcados), depois de confirmar: são e-mails para muitos clientes de uma vez */
  async function enviarLote(lote: readonly Linha[], depois?: () => void) {
    if (enviandoTodos || !lote.length) return;
    const ok = await modal({
      icone: 'envelope', titulo: 'Enviar para ' + lote.length + (lote.length === 1 ? ' cliente?' : ' clientes?'),
      texto: 'Cada cliente recebe, no e-mail do cadastro, os documentos do DP de ' + t.rotuloCompetencia(competencia) + ' que estão na pasta dele.',
      botoes: [{ rotulo: 'Enviar', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!ok) return;
    setEnviandoTodos(true);
    try {
      for (const l of lote) await pedir(l);
      toast(lote.length + (lote.length === 1 ? ' envio pedido' : ' envios pedidos') + ' ao robô.');
      depois?.();
    } catch (e) { toast('Parou no meio: ' + (e instanceof Error ? e.message : String(e))); } finally { setEnviandoTodos(false); }
  }
  const exemplo = prontos[0] || todas[0];
  const camposDoExemplo: Record<string, string> = { cliente: exemplo?.nome || 'EMPRESA EXEMPLO LTDA', competencia: competencia.slice(5) + '/' + competencia.slice(0, 4), mes: t.rotuloCompetencia(competencia).toLowerCase().replace('/', ' de ') };
  const encher = (m: string) => m.replace(/\{(\w+)\}/g, (tudo, nome: string) => camposDoExemplo[nome] ?? tudo);

  return {
    exemplos: repo.exemplos,
    carregando: !lista.carregados || !envios.carregados || !clientesDoEntregas.carregados || !doDp.carregado,
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    /** a competência do DP é a mesma em todas as páginas (21/10/2026) */
    setCompetencia: (c: string) => { guardarCompetenciaDoDp(c); setCompetencia(c); setFora(new Map()); },
    filtro, setFiltro, busca, setBusca,
    responsavel, setResponsavel,
    responsaveis: [...new Set(todas.map(l => l.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    contagem: Object.fromEntries((Object.keys(DO_FILTRO) as FiltroDoEnvio[]).map(f => [f, doResponsavel.filter(l => DO_FILTRO[f](l.situacao)).length])) as Record<FiltroDoEnvio, number>,
    linhas,
    prontos: prontos.length,
    enviandoTodos,
    /** a linha está trabalhando (o botão dela mostra a rodinha e trava) */
    fazendo: (chave: string) => fazendo.has(chave),
    async enviar(codigo: number) {
      const l = todas.find(x => x.codigo === codigo);
      if (!l) return;
      await comLinha('enviar:' + codigo, async () => {
        try { await pedir(l); toast('Pedido ao robô: ' + l.escolhidos.length + (l.escolhidos.length === 1 ? ' arquivo' : ' arquivos') + ' para ' + l.nome + '.'); }
        catch (e) { toast('Não consegui pedir: ' + (e instanceof Error ? e.message : String(e))); }
      });
    },
    /** um documento só (28/10/2026: "a opção de enviar um único documento") */
    async enviarArquivo(codigo: number, id: string) {
      const l = todas.find(x => x.codigo === codigo);
      const a = l?.arquivos.find(x => x.id === id);
      if (!l || !a || !podeEnviar(l)) return;
      await comLinha('enviar:' + codigo + ':' + id, async () => {
        try { await pedir(l, [a]); toast('Pedido ao robô: ' + a.nome + ' para ' + l.nome + '.'); }
        catch (e) { toast('Não consegui pedir: ' + (e instanceof Error ? e.message : String(e))); }
      });
    },
    /** o cliente pode receber agora (tem e-mail e não está com o robô) */
    podeEnviar: (codigo: number) => { const l = todas.find(x => x.codigo === codigo); return !!l && podeEnviar(l); },
    /** todos os prontos (com arquivo e e-mail, ainda não enviados), depois de confirmar */
    enviarTodos: () => enviarLote(prontos),
    /** os marcados na tabela (como o "Emitir marcadas" do FGTS) */
    enviarMarcadas: () => enviarLote(marcadasValidas, () => setSelecionadas(new Set())),
    marcadas: marcadasValidas.length,
    marcada: (codigo: number) => selecionadas.has(codigo),
    alternarMarca: (codigo: number) => setSelecionadas(m => { const n = new Set(m); if (n.has(codigo)) n.delete(codigo); else n.add(codigo); return n; }),
    /** todas as que dá para marcar, na tela (com os filtros), ou nenhuma */
    marcarTodas: (sim: boolean) => setSelecionadas(sim ? new Set(linhas.filter(l => l.podeMarcar).map(l => l.codigo)) : new Set()),
    todasMarcadas: linhas.some(l => l.podeMarcar) && linhas.filter(l => l.podeMarcar).every(l => selecionadas.has(l.codigo)),
    /** o robô agora: a empresa com ele e a fila; o progresso do mês */
    roboAgora: comORobo ? { codigo: comORobo.codigo, nome: comORobo.nome, desde: comORobo.envio?.criadoEm || '' } : null,
    fila: naFila.map(l => ({ codigo: l.codigo, nome: l.nome })),
    progresso: { enviados: doResponsavel.filter(l => l.situacao === 'enviado').length, total: comArquivos },
    /** o modelo do e-mail (vazio = o padrão), a janela de editar e a prévia com um cliente da lista */
    modelo: { carregado: modelo.carregado, assunto: modelo.assunto, texto: modelo.texto, padrao: MODELO_PADRAO_DO_ENVIO },
    editandoModelo, setEditandoModelo,
    previa: { assunto: encher(modelo.assunto || MODELO_PADRAO_DO_ENVIO.assunto), texto: encher(modelo.texto || MODELO_PADRAO_DO_ENVIO.texto) },
    gravarModelo: async (m: { assunto: string; texto: string }) => {
      try { await repo.gravarModelo(m); toast('Modelo do e-mail salvo.'); }
      catch (e) { toast('Não consegui salvar: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** o cliente aberto na janela (os arquivos para marcar e o último envio) */
    aberto: aberto != null ? todas.find(l => l.codigo === aberto) || null : null,
    abrir: (codigo: number, na: AbaDaJanela = 'arquivos') => { setAba(na); setAberto(codigo); },
    fechar: () => { setAberto(null); setHistorico(null); },
    aba, setAba,
    /** o que já foi pedido para o cliente aberto, de todos os meses (null = lendo) */
    historico: historico && historico.codigo === aberto ? historico.lista : null,
    marcado: (codigo: number, id: string) => !fora.get(codigo)?.has(id),
    alternarArquivo: (codigo: number, id: string) => setFora(m => {
      const n = new Map(m);
      const s = new Set(n.get(codigo) || []);
      if (s.has(id)) s.delete(id); else s.add(id);
      n.set(codigo, s);
      return n;
    }),
  };
}

export type VmEnviosDoDp = ReturnType<typeof useEnviosDoDp>;
