// ViewModel das Configurações do DP (Vitor, 06/10/2026: "quero que o dp tenha a própria aba de configurações"; "faça no
// estilo do cadastro"): a lista dos clientes do DP com os parâmetros de cada um (o movimento, as obrigações do mês, a
// entrega e o agrupamento; a REINF é do Fiscal); clicar abre a janela do cliente, onde se muda. Começa com o da planilha; o que mudar
// grava no cadastro da empresa e vale nas abas do DP na hora. "Voltar à planilha" tira o que foi mudado.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../casca/navegacao';
import { useRetorno } from '@nads/ui';
import { useOperador } from '../../casca/operador';
import { useCategoriasDp, useGmailDoEntregas } from '../../dados/repo';
import { useClientesDoDp } from './useClientesDoDp';

export type TopicoDoClienteDp = 'obrigacoes' | 'entrega';

/** as competências para escolher: as 3 próximas e as recentes (a mais nova primeiro) */
function competenciasDasConfiguracoes(): string[] {
  const d = new Date();
  const futuras = [3, 2, 1].map(n => { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); });
  return [...new Set([...futuras, ...competenciasDaTela(12)])].sort().reverse();
}

export function useConfiguracoesDoDp() {
  // a competência (Vitor, 07/10/2026: "configurações por competência"): o que mudar vale dela em diante; a mesma do Painel (na URL)
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDasConfiguracoes();
  const atual = competenciasDaTela(1)[0];
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : atual;
  const dp = useClientesDoDp(competencia);
  // as categorias novas de obrigações (Vitor, 07/10/2026: "uma opção onde posso criar novas categorias"): só o admin cria
  const repoCategorias = useCategoriasDp();
  const categorias = repoCategorias.lista().lista;
  const admin = !!useOperador().operador?.admin;
  const { modal, toast } = useRetorno();
  const [categoriasAbertas, setCategoriasAbertas] = useState(false);
  const [nova, setNova] = useState<{ nome: string; rotulo: string; parte: empresas.ParteDaCategoriaDp; erro: string }>({ nome: '', rotulo: '', parte: 'guias', erro: '' });
  // o CNPJ/CPF de cada cliente (Sávio, 07/10/2026: "copiar o CNPJ ou CPF de cada cliente sem pontos ou traços para acesso
  // aos sites do governo"): do cadastro do Entregas, pelo código; só os dígitos
  const gmail = useGmailDoEntregas();
  const documentoDoCodigo = new Map(gmail.clientes().lista.filter(c => c.documento).map(c => [Number(c.codigo), c.documento as string]));
  // nos exemplos não há cadastro do Entregas: um CNPJ inventado pelo código, para a coluna aparecer
  if (gmail.exemplos) for (const c of dp.clientes) if (!documentoDoCodigo.has(c.codigo)) documentoDoCodigo.set(c.codigo, String(c.codigo).padStart(8, '0') + '000100');
  const [busca, setBusca] = useState('');
  const [movimento, setMovimento] = useState('');
  const [soMudados, setSoMudados] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);
  const [topico, setTopico] = useState<TopicoDoClienteDp>('obrigacoes');
  const buscaDigitos = busca.replace(/\D/g, '');
  const achadas = busca.trim()
    ? new Set([
      ...empresas.buscarEmpresas(dp.clientes.map(c => ({ codigo: c.codigo, nome: c.nomeNaTela, regime: c.enquadramento })), busca).map(e => e.codigo),
      // a busca pelo CNPJ/CPF (com ou sem pontos)
      ...(buscaDigitos.length >= 5 ? dp.clientes.filter(c => (documentoDoCodigo.get(c.codigo) || '').includes(buscaDigitos)).map(c => c.codigo) : []),
    ])
    : null;
  const rotuloDe = (id: string) => empresas.OBRIGACOES_DP.find(o => o.id === id)?.rotulo || categorias.find(c => c.id === id)?.rotulo || id;
  const linhas = dp.clientes
    .filter(c => (!achadas || achadas.has(c.codigo)) && (!movimento || c.movimento === movimento) && (!soMudados || c.mudado))
    .sort((a, b) => a.nomeNaTela.localeCompare(b.nomeNaTela, 'pt-BR'))
    .map(c => ({ ...c, documento: documentoDoCodigo.get(c.codigo) || '', obrigacoesTexto: c.obrigacoes.length ? (c.obrigacoes as string[]).map(rotuloDe).join(' · ') : 'Nenhuma' }));
  const cliente = aberto != null ? dp.clientes.find(c => c.codigo === aberto) || null : null;
  return {
    carregando: !dp.carregado,
    linhas,
    total: dp.clientes.length,
    mudados: dp.clientes.filter(c => c.mudado).length,
    obrigacoes: [...empresas.OBRIGACOES_DP.map(o => ({ id: o.id as string, nome: o.nome, rotulo: o.rotulo })), ...categorias],
    movimentos: empresas.MOVIMENTOS_DP,
    entregas: empresas.ENTREGAS_DP,
    agrupamentos: [...new Set(dp.clientes.map(c => c.agrupamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    busca, setBusca, movimento, setMovimento, soMudados, setSoMudados,
    competencia,
    rotuloCompetencia: t.rotuloCompetencia(competencia),
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia(c: string) { const n = new URLSearchParams(params); n.set('competencia', c); setParams(n); },
    mudadosNoMes: dp.clientes.filter(c => c.mudadoNoMes).length,
    /** a janela do cliente (como a da empresa no Cadastro) */
    cliente,
    topico, setTopico,
    abrir: (codigo: number) => { setAberto(codigo); setTopico('obrigacoes'); },
    fechar: () => setAberto(null),
    mudarMovimento: (codigo: number, v: string) => dp.mudarDp(codigo, { movimento: v }),
    alternarObrigacao(codigo: number, id: string) {
      const c = dp.clientes.find(x => x.codigo === codigo);
      if (!c) return;
      const atuais: string[] = c.obrigacoes;
      dp.mudarDp(codigo, { obrigacoes: atuais.includes(id) ? atuais.filter(o => o !== id) : [...atuais, id] });
    },
    mudarEntrega: (codigo: number, v: string) => dp.mudarDp(codigo, { entrega: v }),
    mudarAgrupamento: (codigo: number, v: string) => dp.mudarDp(codigo, { agrupamento: v.trim() }),
    voltarAPlanilha: (codigo: number) => dp.voltar(codigo, false),
    /** tira só o que foi mudado nesta competência */
    desfazerMes: (codigo: number) => dp.voltar(codigo, true),
    /** as categorias novas (a janela Categorias, só o admin) */
    admin,
    categorias: categorias.map(c => ({ ...c, parteRotulo: empresas.PARTES_DAS_CATEGORIAS_DP.find(p => p.id === c.parte)?.rotulo || '' })),
    partesDasCategorias: empresas.PARTES_DAS_CATEGORIAS_DP,
    categoriasAbertas,
    abrirCategorias: () => setCategoriasAbertas(true),
    fecharCategorias: () => { setCategoriasAbertas(false); setNova(n => ({ ...n, erro: '' })); },
    nova,
    mudarNova: (m: Partial<Omit<typeof nova, 'erro'>>) => setNova(n => ({ ...n, ...m, erro: '' })),
    async criarCategoria() {
      const r = empresas.novaCategoriaDoDp(nova.nome, nova.rotulo, nova.parte, categorias);
      if ('erro' in r) { setNova(n => ({ ...n, erro: r.erro })); return; }
      try {
        await repoCategorias.salvar([...categorias, r]);
        setNova({ nome: '', rotulo: '', parte: nova.parte, erro: '' });
        toast('Categoria ' + r.nome + ' criada.');
      } catch (e) { setNova(n => ({ ...n, erro: 'Não gravou: ' + (e instanceof Error ? e.message : String(e)) })); }
    },
    async tirarCategoria(id: string) {
      const c = categorias.find(x => x.id === id);
      if (!c) return;
      const ok = await modal({ icone: 'alert', titulo: 'Tirar a categoria ' + c.nome + '?', texto: 'A coluna sai da tabela das Obrigações. O que já foi marcado nos meses fica guardado.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      await repoCategorias.salvar(categorias.filter(x => x.id !== id)).catch(e => toast('Não gravou: ' + (e instanceof Error ? e.message : String(e))));
    },
  };
}
