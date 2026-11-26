// ViewModel da seção Comunicados da Área do Cliente refeita (26/11/2026: "quero que esse modulo seja completamente refeito
// para suportar e gerenciar de maneira mais simples e coerente a area do cliente como está hoje, preciso que seja o mais
// bonito e de facil entendimento possivel"). Parte do antigo (22/11/2026, ficha comunicados; o dono: "pode fazer tudo"):
// a equipe toda vê; o admin e os diretores escrevem, mudam e apagam. O robô do PC leva cada um para o sino da Área do
// Cliente das empresas do alvo, dentro do período. Agora: filtro por situação, busca, regimes tirados das empresas, as
// empresas escolhidas num seletor com busca (não mais códigos digitados) e a prévia de como o cliente vê.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { ehDiretor } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import type { RascunhoDoComunicado } from '../../../dados/areaCliente';
import {
  bateNaBusca, comunicadosDoFiltro, dataBr, diaDe, empresasAlcancadas, empresasParaEscolher, filtroInicial, filtrosDosComunicados,
  periodoDoComunicado, regimesDasEmpresas, rotuloDoAlvo, situacaoDoComunicado, tipoDoAlvo,
  type FiltroDosComunicados, type SituacaoDoComunicado, type TipoDoAlvo,
} from '../../../dados/comunicadosDaArea';
import { useAreaCliente, useRepo, useVersaoDoRepo } from '../../../dados/repo';
import type { TomDoSelo } from '../base/Base';
import { mensagemDoErro, plural } from '../base/comum';

export interface FormDoComunicado {
  titulo: string; texto: string; tipo: TipoDoAlvo; regimes: string[]; codigos: number[]; publicarEm: string; ate: string;
}

const TOM: Record<SituacaoDoComunicado, TomDoSelo> = { 'no ar': 'ok', agendado: 'aviso', encerrado: 'neutro' };
const ROTULO: Record<SituacaoDoComunicado, string> = { 'no ar': 'No ar', agendado: 'Agendado', encerrado: 'Encerrado' };

export function useComunicados() {
  const area = useAreaCliente();
  const repo = useRepo();
  const versaoDoRepo = useVersaoDoRepo();
  const op = useOperador().operador;
  const { modal, toast } = useRetorno();
  const lista = area.comunicados();
  const [, setVersao] = useState(0);
  const hoje = diaDe(new Date());
  const podeEditar = ehDiretor(op);

  // as empresas do escritório: o seletor, os nomes dos chips e os regimes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const empresas = useMemo(() => repo.listarEmpresas(), [repo, versaoDoRepo]);
  const nomes = useMemo(() => new Map(empresas.filter(e => e.codigo != null).map(e => [e.codigo as number, e.nome])), [empresas]);
  const nomeDe = (codigo: number) => nomes.get(codigo);

  // a barra
  const [filtroEscolhido, setFiltro] = useState<FiltroDosComunicados | null>(null);
  const [busca, setBusca] = useState('');
  const filtro = filtroEscolhido ?? (lista.carregada ? filtroInicial(lista.lista, hoje) : 'no-ar');

  // a janela
  const vazio = (): FormDoComunicado => ({ titulo: '', texto: '', tipo: 'todos', regimes: [], codigos: [], publicarEm: hoje, ate: diaDe(new Date(Date.now() + 30 * 864e5)) });
  const [form, setForm] = useState<FormDoComunicado>(vazio);
  const [aberto, setAberto] = useState<{ id: string | null } | null>(null);
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);
  const [buscaEmpresa, setBuscaEmpresa] = useState('');

  const alvo = (): ac.AlvoDoComunicado => (form.tipo === 'todos' ? { todos: true } : form.tipo === 'regimes' ? { regimes: form.regimes } : { codigos: form.codigos });
  const rascunho = (): RascunhoDoComunicado => ({ titulo: form.titulo, texto: form.texto, alvo: alvo(), publicarEm: form.publicarEm, ate: form.ate });
  const original = aberto?.id ? lista.lista.find(c => c.id === aberto.id) ?? null : null;
  const mudar = (m: Partial<FormDoComunicado>) => { setForm(f => ({ ...f, ...m })); setErro(''); };
  const abrir = (c: ac.Comunicado | null) => {
    setForm(c ? { titulo: c.titulo, texto: c.texto, tipo: tipoDoAlvo(c.alvo), regimes: 'regimes' in c.alvo ? [...c.alvo.regimes] : [], codigos: 'codigos' in c.alvo ? [...c.alvo.codigos] : [], publicarEm: c.publicarEm, ate: c.ate } : vazio());
    setAberto({ id: c?.id ?? null }); setErro(''); setBuscaEmpresa('');
  };
  const fechar = () => { if (!gravando) setAberto(null); };

  const filtros = filtrosDosComunicados(lista.lista, hoje);
  const linhas = comunicadosDoFiltro(lista.lista, filtro, hoje).filter(c => bateNaBusca(c, busca)).map(c => {
    const s = situacaoDoComunicado(c, hoje);
    return {
      id: c.id, titulo: c.titulo, texto: c.texto,
      paraQuem: rotuloDoAlvo(c.alvo, nomeDe),
      paraQuemDica: 'codigos' in c.alvo && c.alvo.codigos.length > 1 ? c.alvo.codigos.map(n => nomeDe(n) || 'Empresa ' + n).join(', ') : undefined,
      periodo: periodoDoComunicado(c.publicarEm, c.ate),
      situacao: ROTULO[s], tom: TOM[s],
      por: c.por || '—',
      quando: c.atualizadoEm ? formatos.diaEmBrasilia(c.atualizadoEm).split('-').reverse().join('/') : '',
      abrir: () => abrir(c),
    };
  });

  const alvoAgora = alvo();
  const alcance = empresasAlcancadas(alvoAgora, empresas);
  const situacaoDoForm = /^\d{4}-\d{2}-\d{2}$/.test(form.publicarEm) && /^\d{4}-\d{2}-\d{2}$/.test(form.ate) && form.ate >= form.publicarEm
    ? situacaoDoComunicado(form, hoje) : null;

  return {
    exemplos: area.exemplos,
    carregando: !lista.carregada,
    erroDaLista: lista.erro,
    podeEditar,
    total: lista.lista.length,

    filtro, filtros, setFiltro, busca, setBusca,
    linhas,
    novo: () => abrir(null),

    // a janela
    aberto: !!aberto,
    editando: !!aberto?.id,
    somenteLeitura: !podeEditar,
    tituloDaJanela: !aberto?.id ? 'Novo comunicado' : podeEditar ? 'Editar o comunicado' : 'Comunicado',
    subDaJanela: original ? 'Publicado por ' + (original.por || '—') + (original.atualizadoEm ? ' em ' + formatos.diaEmBrasilia(original.atualizadoEm).split('-').reverse().join('/') : '') : 'Aparece no sino da Área do Cliente, só dentro do período.',
    form, erro, gravando, mudar, fechar,
    limiteDoTitulo: ac.MAIOR_TITULO_DO_COMUNICADO, limiteDoTexto: ac.MAIOR_TEXTO_DO_COMUNICADO,
    sobraDoTexto: ac.MAIOR_TEXTO_DO_COMUNICADO - form.texto.length,

    // o Para quem
    regimes: regimesDasEmpresas(empresas, form.regimes),
    alternarRegime: (r: string) => { setForm(f => ({ ...f, regimes: f.regimes.includes(r) ? f.regimes.filter(x => x !== r) : [...f.regimes, r] })); setErro(''); },
    escolhidas: form.codigos.map(c => ({ codigo: c, nome: nomeDe(c) || 'Empresa ' + c })),
    buscaEmpresa, setBuscaEmpresa,
    opcoesDeEmpresa: empresasParaEscolher(empresas, buscaEmpresa, form.codigos),
    /** as empresas para a busca de cliente com lista (a peça do nads) */
    empresasParaEscolher: empresas.filter(e => e.codigo != null).map(e => ({ codigo: e.codigo as number, nome: e.nome })),
    escolherEmpresa: (codigo: number) => { setForm(f => (f.codigos.includes(codigo) ? f : { ...f, codigos: [...f.codigos, codigo] })); setBuscaEmpresa(''); setErro(''); },
    tirarEmpresa: (codigo: number) => setForm(f => ({ ...f, codigos: f.codigos.filter(c => c !== codigo) })),
    alcance: form.tipo === 'codigos' ? plural(alcance, 'empresa escolhida', 'empresas escolhidas') : 'Chega a ' + plural(alcance, 'empresa', 'empresas'),

    // a prévia "Como o cliente vê"
    previa: {
      titulo: form.titulo.trim() || 'O título do comunicado',
      texto: form.texto.trim() || 'O texto aparece aqui, do jeito que o cliente vai ler.',
      vazio: !form.titulo.trim() && !form.texto.trim(),
      quando: situacaoDoForm === 'encerrado' ? 'Já encerrado: o cliente não vê mais.'
        : situacaoDoForm === 'agendado' ? 'Entra no ar em ' + dataBr(form.publicarEm) + ' e sai depois de ' + dataBr(form.ate) + '.'
        : situacaoDoForm === 'no ar' ? 'No ar até ' + dataBr(form.ate) + ' (aparece no próximo minuto).' : '',
      situacao: situacaoDoForm ? { rotulo: ROTULO[situacaoDoForm], tom: TOM[situacaoDoForm] } : null,
    },

    async salvar() {
      if (!podeEditar) return;
      const r = rascunho();
      const e = ac.erroDoComunicado(r);
      if (e) { setErro(e); return; }
      setGravando(true);
      try {
        await area.salvarComunicado(r, aberto?.id ?? undefined);
        toast(aberto?.id ? 'Comunicado atualizado.' : 'Comunicado publicado. Ele aparece na Área do Cliente no próximo minuto.');
        setAberto(null); setVersao(v => v + 1);
      } catch (err) { setErro(mensagemDoErro(err, 'Não deu para gravar agora.')); }
      finally { setGravando(false); }
    },
    async apagar() {
      if (!podeEditar || !original) return;
      const ok = await modal({ titulo: 'Apagar o comunicado?', texto: '"' + original.titulo + '" sai da Área do Cliente de todos. Não dá para desfazer.', botoes: [{ rotulo: 'Apagar', valor: true, variante: 'btn-danger' }, { rotulo: 'Voltar', valor: false, variante: 'btn-outline' }] });
      if (!ok) return;
      setGravando(true);
      try { await area.apagarComunicado(original.id); setAberto(null); setVersao(v => v + 1); toast('Comunicado apagado.'); }
      catch (err) { toast(mensagemDoErro(err, 'Não deu para apagar agora.')); }
      finally { setGravando(false); }
    },
  };
}

export type VmDosComunicados = ReturnType<typeof useComunicados>;
