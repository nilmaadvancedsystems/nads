// ViewModel da tarefa aberta na Central (a nova e a que já existe; 28/10/2026, o cadastro de tarefas do Toriba): as abas
// Tarefa (o título, a descrição, o cliente vinculado, o "Delegar para", a prioridade, o prazo, o status, as datas e os
// anexos), Parecer (os comentários) e Histórico (a linha do tempo das mudanças). Salvar grava e volta para a lista;
// Cancelar volta sem gravar (pergunta se mudou algo); Excluir só para quem criou (ou o admin). Na tarefa que já existe os
// anexos sobem e saem na hora; na nova, ficam esperando o Salvar.
import { empresas as emp, entregas, tarefas, usuarios } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useAcesso, useRepo, useTarefasDelegadas } from '../../dados/repo';
import { bytesDoAnexo, encolherAnexo } from '../../dados/encolherAnexo';
import { tamanhoDoArquivo, type ArquivoParaAnexar } from '../../dados/tarefasDelegadas';
import { useEmpresasPermitidas } from '../empresas/andamento';

const d = tarefas.delegadas;
type Rascunho = tarefas.delegadas.Rascunho;
export type AbaDaTarefa = 'tarefa' | 'parecer' | 'historico';

const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const tipoDoArquivo = (ext: string) =>
  (ext === 'pdf' ? 'application/pdf' : ext === 'txt' ? 'text/plain' : ext === 'webp' ? 'image/webp' : 'application/octet-stream');

/** Lê os arquivos escolhidos, já encolhidos para gastar o mínimo no banco (a imagem em WebP, o resto em gzip). */
const lerArquivos = (fs: File[]): Promise<ArquivoParaAnexar[]> => Promise.all(fs.map(encolherAnexo));

/**
 * alvo: o id da tarefa ou 'nova'. voltar: para a lista. criada: depois de criar (paraMim: a tarefa ficou com quem criou).
 */
export function useTarefaAberta(alvo: string, voltar: () => void, criada: (paraMim: boolean) => void) {
  const repo = useTarefasDelegadas();
  const acesso = useAcesso();
  // o cliente vinculado: só as empresas da pessoa (29/10/2026)
  const empresas = useEmpresasPermitidas().filtrar(useRepo().listarEmpresas());
  const admin = !!useOperador().operador?.admin;
  const { toast, modal } = useRetorno();
  const eu = repo.eu();
  const uid = eu?.uid || '';
  const ehNova = alvo === 'nova';
  const { carregadas, tarefas: todas } = repo.lista();
  const tarefa = ehNova ? null : todas.find(t => t.id === alvo) || null;

  // o rascunho começa da tarefa (ou vazio); o prazo fica no texto do CampoData (dd/mm/aaaa) até salvar
  const [inicial] = useState<Rascunho>(() => (tarefa ? d.rascunhoDe(tarefa) : d.rascunhoVazio(null)));
  const [r, setR] = useState<Rascunho>(inicial);
  const [prazoTexto, setPrazoTexto] = useState(() => d.prazoParaTela(inicial.prazo));
  const [aba, setAba] = useState<AbaDaTarefa>('tarefa');
  const [pendentes, setPendentes] = useState<ArquivoParaAnexar[]>([]);
  const [parecer, setParecer] = useState('');
  const [ocupado, setOcupado] = useState<'' | 'salvar' | 'excluir' | 'anexar' | 'parecer'>('');
  const [erro, setErro] = useState('');
  // a busca da empresa (a peça da barra do Fiscal)
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);

  // a tarefa que chega do banco depois de aberta (a lista ainda carregava, ou outra pessoa mudou; 29/10/2026: "não salva
  // nada"): enquanto a pessoa não mexeu no formulário, ele acompanha o banco
  const [base, setBase] = useState(tarefa?.atualizadaEm ?? '');
  const [editou, setEditou] = useState(false);
  if (tarefa && !editou && tarefa.atualizadaEm !== base) {
    setBase(tarefa.atualizadaEm);
    const novo = d.rascunhoDe(tarefa);
    setR(novo);
    setPrazoTexto(d.prazoParaTela(novo.prazo));
  }

  const mudar = (p: Partial<Rascunho>) => { setR(x => ({ ...x, ...p })); setEditou(true); setErro(''); };
  const prazo = d.prazoDaTela(prazoTexto);
  const final: Rascunho = { ...r, prazo: prazo ?? r.prazo };
  const mudou = ehNova
    ? !!(r.titulo.trim() || r.descricao.trim() || r.cliente || r.responsavel || prazoTexto || pendentes.length || r.prioridade !== 'normal' || r.status !== 'pendente')
    : !!tarefa && (d.mudouAlgo(tarefa, final) || prazo === null);
  const podeMudar = ehNova || (!!tarefa && d.podeMudar(tarefa, uid));

  // a equipe ativa no "Delegar para" (quem já é o responsável fica, mesmo desativado)
  // com a foto de perfil (a do Entregas, usuarios.fotoPerfil) e as iniciais para quem não tem (28/10/2026: "a escolha tem
  // que ser um dropdown com foto de perfil")
  const docs = acesso.equipe().docs;
  const pessoa = (u: { uid: string; nome: string }) => ({ uid: u.uid, nome: u.nome, voce: u.uid === uid, foto: String(docs[u.uid]?.fotoPerfil || '') || null, iniciais: usuarios.iniciais(u.nome) });
  const equipe = acesso.equipe().lista.filter(u => u.ativo || u.uid === r.responsavel?.uid).map(pessoa);
  if (r.responsavel && !equipe.some(p => p.uid === r.responsavel?.uid)) equipe.unshift(pessoa(r.responsavel));

  const achadas = busca.trim() ? emp.buscarEmpresas(empresas, busca).slice(0, 8) : [];
  const escolherEmpresa = (e: { codigo: number | null; nome: string }) => { mudar({ cliente: { codigo: e.codigo, nome: e.nome } }); setBusca(''); setAtivo(0); };

  /** pergunta antes de largar o que mudou; sem mudança, segue direto */
  async function largar(depois: () => void) {
    if (mudou && podeMudar) {
      const ok = await modal({ icone: 'alert', titulo: 'Descartar as mudanças?', texto: 'O que você mudou nesta tarefa não foi salvo.',
        botoes: [{ rotulo: 'Continuar editando', valor: false, variante: 'btn-outline' }, { rotulo: 'Descartar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
    }
    depois();
  }

  return {
    carregando: !ehNova && !carregadas,
    /** a tarefa saiu da lista da pessoa (apagada, ou delegada para outra pessoa por quem criou) */
    sumiu: !ehNova && carregadas && !tarefa,
    ehNova,
    titulo: ehNova ? 'Nova tarefa' : 'Tarefa ' + (tarefa?.numero || ''),
    status: tarefa ? { rotulo: d.rotuloDoStatus(tarefa.status), tom: d.tomDoStatus(tarefa.status) } : null,
    podeMudar,
    podeExcluir: !!tarefa && d.podeExcluir(tarefa, uid, admin),
    aba, setAba,
    abas: [
      { valor: 'tarefa' as const, rotulo: 'Tarefa' },
      { valor: 'parecer' as const, rotulo: 'Parecer' + (tarefa?.pareceres.length ? ' (' + tarefa.pareceres.length + ')' : '') },
      { valor: 'historico' as const, rotulo: 'Histórico' },
    ],
    erro,

    // ---- a aba Tarefa
    rascunho: r,
    setTitulo: (titulo: string) => mudar({ titulo }),
    setDescricao: (descricao: string) => mudar({ descricao }),
    maiorTitulo: d.MAIOR_TITULO,
    maiorDescricao: d.MAIOR_DESCRICAO,
    prazoTexto,
    setPrazo: (v: string) => { setPrazoTexto(v); setEditou(true); setErro(''); },
    prazoInvalido: prazo === null,
    prioridades: d.PRIORIDADES,
    setPrioridade: (v: string) => { if (d.ehPrioridade(v)) mudar({ prioridade: v }); },
    opcoesDeStatus: d.STATUS.map(s => ({ valor: s.valor, rotulo: s.rotulo })),
    setStatus: (s: tarefas.delegadas.Status) => mudar({ status: s }),
    equipe,
    setResponsavel: (uidDoResponsavel: string) => {
      const u = acesso.equipe().lista.find(x => x.uid === uidDoResponsavel);
      mudar({ responsavel: u ? { uid: u.uid, nome: u.nome } : r.responsavel?.uid === uidDoResponsavel ? r.responsavel : null });
    },
    /** o cliente vinculado (opcional): a peça EmpresaDaBarra */
    empresa: {
      empresa: r.cliente, busca, achadas, ativo, setAtivo,
      setBusca: (v: string) => { setBusca(v); setAtivo(0); },
      mover: (n: number) => setAtivo(i => Math.max(0, Math.min(achadas.length - 1, i + n))),
      escolher: escolherEmpresa,
      escolherDestacado: () => { const e = achadas[ativo]; if (e) escolherEmpresa(e); },
      trocarEmpresa: () => mudar({ cliente: null }),
    },
    datas: tarefa ? [
      { rotulo: 'Criada em', valor: quando(tarefa.criadaEm) + ' por ' + tarefa.criadaPor.nome },
      { rotulo: 'Concluída em', valor: tarefa.concluidaEm ? quando(tarefa.concluidaEm) : '—' },
    ] : [],

    // ---- os anexos: na nova, esperando o Salvar; na que existe, sobem na hora
    anexos: ehNova
      ? pendentes.map((a, i) => ({ id: 'p' + i, nome: a.nome, detalhe: entregas.tamanhoLegivel(tamanhoDoArquivo(a)) + ' · vai ao salvar' }))
      : (tarefa?.anexos || []).map(a => ({ id: a.id, nome: a.nome, detalhe: [a.extensao.toUpperCase(), entregas.tamanhoLegivel(a.tamanho), quando(a.em), a.por].filter(Boolean).join(' · ') })),
    limiteDosAnexos: 'Até ' + d.MAIS_ANEXOS + ' arquivos de ' + d.MAIOR_ANEXO / 1024 / 1024 + ' MB cada (' + d.MAIOR_TOTAL_DE_ANEXOS / 1024 / 1024 + ' MB por tarefa).',
    anexando: ocupado === 'anexar',
    async anexar(fs: File[]) {
      if (!fs.length) return;
      const arquivos = await lerArquivos(fs);
      const problema = d.problemaDosAnexos(arquivos.map(a => ({ nome: a.nome, tamanho: tamanhoDoArquivo(a) })), ehNova ? pendentes.map(a => ({ tamanho: tamanhoDoArquivo(a) })) : tarefa?.anexos || []);
      if (problema) { toast(problema); return; }
      if (ehNova) { setPendentes(p => [...p, ...arquivos]); return; }
      if (!tarefa) return;
      setOcupado('anexar');
      try {
        await repo.anexar(tarefa.id, arquivos);
        toast(arquivos.length === 1 ? 'Arquivo anexado.' : arquivos.length + ' arquivos anexados.');
      } catch (e) { toast('Não anexei: ' + (e instanceof Error ? e.message : String(e))); } finally { setOcupado(''); }
    },
    async tirarAnexo(id: string) {
      if (ehNova) { setPendentes(p => p.filter((_, i) => 'p' + i !== id)); return; }
      const a = tarefa?.anexos.find(x => x.id === id);
      if (!tarefa || !a) return;
      const ok = await modal({ icone: 'alert', titulo: 'Tirar ' + a.nome + '?', texto: 'O arquivo sai da tarefa para todos.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      try { await repo.tirarAnexo(tarefa.id, id); toast('Arquivo tirado.'); } catch (e) { toast('Não tirei: ' + (e instanceof Error ? e.message : String(e))); }
    },
    async baixarAnexo(id: string) {
      if (ehNova) { const a = pendentes.find((_, i) => 'p' + i === id); if (a) baixarBytes(await bytesDoAnexo(a.bytes, a.gzip), a.nome, tipoDoArquivo(d.extensaoDe(a.nome))); return; }
      const a = tarefa?.anexos.find(x => x.id === id);
      if (!tarefa || !a) return;
      try {
        const bytes = await repo.baixarAnexo(tarefa.id, id);
        if (bytes) baixarBytes(bytes, a.nome, tipoDoArquivo(a.extensao)); else toast('O arquivo não está mais no banco.');
      } catch (e) { toast('Não baixei: ' + (e instanceof Error ? e.message : String(e))); }
    },

    // ---- salvar, cancelar e excluir
    salvando: ocupado === 'salvar',
    excluindo: ocupado === 'excluir',
    async salvar() {
      if (prazo === null) { setErro('O prazo não é uma data válida (dd/mm/aaaa).'); return; }
      const problema = d.problemaDaTarefa(final);
      if (problema) { setErro(problema); setAba('tarefa'); return; }
      setOcupado('salvar');
      try {
        if (ehNova) {
          await repo.criar(final, pendentes);
          const paraMim = final.responsavel?.uid === uid;
          toast(paraMim ? 'Tarefa criada.' : 'Tarefa delegada para ' + final.responsavel?.nome + '.');
          criada(paraMim);
        } else if (tarefa) {
          // sem mudança, só volta (nada a gravar nem a pôr no histórico)
          if (mudou) { await repo.salvar(tarefa.id, final); toast('Tarefa salva.'); }
          voltar();
        }
      } catch (e) { setErro('Não salvei: ' + (e instanceof Error ? e.message : String(e))); } finally { setOcupado(''); }
    },
    /** o Cancelar e o ‹ Voltar: pergunta se mudou algo */
    cancelar: () => { void largar(voltar); },
    /** sair da tarefa para outra coisa (fechar a Central, trocar de aba): pergunta se mudou algo */
    largar,
    async excluir() {
      if (!tarefa) return;
      const ok = await modal({ icone: 'alert', titulo: 'Excluir a tarefa ' + tarefa.numero + '?', texto: '"' + tarefa.titulo + '" sai da Central de todos, com os anexos. Não tem como desfazer.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      setOcupado('excluir');
      try { await repo.excluir(tarefa.id); toast('Tarefa excluída.'); voltar(); } catch (e) { setErro('Não excluí: ' + (e instanceof Error ? e.message : String(e))); } finally { setOcupado(''); }
    },

    // ---- o parecer
    pareceres: (tarefa?.pareceres || []).map((p, i) => ({ id: String(i), por: p.por, quando: quando(p.em), texto: p.texto })).reverse(),
    parecer, setParecer,
    maiorParecer: d.MAIOR_PARECER,
    escrevendo: ocupado === 'parecer',
    async escreverParecer() {
      if (!tarefa) return;
      const problema = d.problemaDoParecer(parecer, tarefa);
      if (problema) { toast(problema); return; }
      setOcupado('parecer');
      try { await repo.comentar(tarefa.id, parecer); setParecer(''); } catch (e) { toast('Não gravei o parecer: ' + (e instanceof Error ? e.message : String(e))); } finally { setOcupado(''); }
    },

    // ---- o histórico, o mais novo em cima
    historico: (tarefa?.historico || []).map((h, i) => ({ id: String(i), por: h.por, quando: quando(h.em), texto: h.texto })).reverse(),
  };
}
