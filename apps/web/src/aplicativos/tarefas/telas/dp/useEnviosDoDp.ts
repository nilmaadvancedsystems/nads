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
import type { ArquivoDoDp, EnvioDoDp } from '../../dados/enviosDp';
import { useClientesDoDp } from './useClientesDoDp';

export type SituacaoDoEnvio = 'sem-arquivos' | 'sem-email' | 'pronto' | 'fila' | 'enviando' | 'enviado' | 'erro';
export type FiltroDoEnvio = 'todos' | 'prontos' | 'enviados' | 'problemas' | 'sem-arquivos';

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
  const [enviandoTodos, setEnviandoTodos] = useState(false);
  // o que cada linha está fazendo ("enviar:<código>"): o botão dela mostra que trabalha e trava
  const [fazendo, setFazendo] = useState<ReadonlySet<string>>(new Set());
  const comLinha = async (chave: string, f: () => Promise<void>) => {
    if (fazendo.has(chave)) return;
    setFazendo(s => new Set(s).add(chave));
    try { await f(); } finally { setFazendo(s => { const n = new Set(s); n.delete(chave); return n; }); }
  };
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
    .sort((a, b) => a.codigo - b.codigo);
  type Linha = (typeof todas)[number];
  const q = busca.trim().toLowerCase();
  const doResponsavel = responsavel ? todas.filter(l => l.responsavel === responsavel) : todas;
  const linhas = doResponsavel.filter(l => (!q || l.nome.toLowerCase().includes(q) || String(l.codigo).includes(q) || l.emails.some(e => e.includes(q))) && DO_FILTRO[filtro](l.situacao));
  const prontos = doResponsavel.filter(l => l.situacao === 'pronto' && l.escolhidos.length > 0);

  // O envio feito marca a Entrega do mês (quem pediu, quando o robô mandou). Só uma vez: quem desfez a Entrega depois do
  // envio decide (a etapa mexida depois do envio fica como está).
  const marcadas = useRef(new Set<string>());
  useEffect(() => {
    if (!carregada || !doDp.carregado) return;
    for (const l of todas) {
      const e = l.envio;
      if (!e || e.status !== 'enviado' || !e.enviadoEm || marcadas.current.has(e.id)) continue;
      const est = t.estadoDa(l.ex, 'dp-envio');
      marcadas.current.add(e.id);
      if (est && est.em >= e.enviadoEm) continue;
      const ex = l.ex || t.execucaoNova(l.nome, l.codigo, competencia, 'dp');
      const r = t.fazer(ex, 'dp-envio', e.criadoPor || op.nome, new Date(e.enviadoEm));
      tarefas.gravar(r.execucao, r.evento);
    }
  });

  async function pedir(l: Linha) {
    if (!l.escolhidos.length) return;
    await repo.enviar({ codigo: l.codigo, empresa: l.nome, competencia, arquivos: l.escolhidos.map(a => a.id) });
  }

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
    /** todos os prontos (com arquivo e e-mail, ainda não enviados), depois de confirmar */
    async enviarTodos() {
      if (enviandoTodos || !prontos.length) return;
      const ok = await modal({
        icone: 'envelope', titulo: 'Enviar para ' + prontos.length + (prontos.length === 1 ? ' cliente?' : ' clientes?'),
        texto: 'Cada cliente recebe, no e-mail do cadastro, os documentos do DP de ' + t.rotuloCompetencia(competencia) + ' que estão na pasta dele.',
        botoes: [{ rotulo: 'Enviar', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
      });
      if (!ok) return;
      setEnviandoTodos(true);
      try {
        for (const l of prontos) await pedir(l);
        toast(prontos.length + (prontos.length === 1 ? ' envio pedido' : ' envios pedidos') + ' ao robô.');
      } catch (e) { toast('Parou no meio: ' + (e instanceof Error ? e.message : String(e))); } finally { setEnviandoTodos(false); }
    },
    /** o cliente aberto na janela (os arquivos para marcar e o último envio) */
    aberto: aberto != null ? todas.find(l => l.codigo === aberto) || null : null,
    abrir: (codigo: number) => setAberto(codigo),
    fechar: () => setAberto(null),
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
