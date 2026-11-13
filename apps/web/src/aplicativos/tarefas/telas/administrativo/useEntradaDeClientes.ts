// ViewModel da Entrada de clientes do Administrativo (Vitor, 13/11/2026: "Seria um fluxo completo de uma entrada de cliente no
// escritorio, desenvolve o prototipo para mim no modo desenvolvedor"). A lista das entradas e a aberta, em quatro passos: a
// ficha pré-cadastral (a entrevista e o cliente ideal), o orçamento (o PDF e o e-mail), os documentos (cada um na pasta do
// cliente no Drive, a da empresa ou a do sócio) e o cadastro (os responsáveis). Protótipo: tudo na memória do navegador.
import { administrativo, empresas, entregas, formatos, usuarios } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { empresasNovas } from '../../dados/fonte';
import { useAcesso, useEntradas, useTodosOsCadastros } from '../../dados/repo';
import { useOperador, type Operador } from '../../casca/operador';

const e = administrativo.entrada;
type Entrada = administrativo.entrada.Entrada;
type Ficha = administrativo.entrada.Ficha;
type Orcamento = administrativo.entrada.Orcamento;
export type Passo = 'ficha' | 'orcamento' | 'documentos' | 'cadastro';

/** o passo em que a entrada abre, pela etapa */
const passoDaEtapa = (x: Entrada): Passo =>
  x.etapa === 'ficha' ? 'ficha' : x.etapa === 'orcamento' || x.etapa === 'aguardando' || x.etapa === 'recusada' ? 'orcamento' : x.etapa === 'documentos' ? 'documentos' : 'cadastro';
const agora = () => new Date().toISOString();
const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export function useEntradaDeClientes() {
  const op = useOperador().operador as Operador;
  const { toast, aviso } = useRetorno();
  const { repo, teste, ligarTeste } = useEntradas();
  const acesso = useAcesso();
  const cadastros = useTodosOsCadastros();
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [passo, setPasso] = useState<Passo>('ficha');
  const [busca, setBusca] = useState('');
  const lista = e.ordenar(repo.lista());
  const aberta = lista.find(x => x.id === abertaId) || null;
  const erro = (titulo: string, ex: unknown) => aviso({ tom: 'erro', titulo, texto: ex instanceof Error ? ex.message : String(ex) });

  // os códigos que já existem (as empresas do escritório e as cadastradas aqui), para o próximo livre
  const codigosUsados = useMemo(() => {
    const doEscritorio = [...empresas.EMPRESAS_COM_DP, ...empresasNovas()].map(x => x.codigo).filter((c): c is number => c != null);
    return [...new Set(doEscritorio)];
    // as empresas novas vêm do cadastro: refaz quando ele muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastros]);
  const usadosAqui = lista.filter(x => x.cadastro && x.id !== abertaId).map(x => x.cadastro!.codigo);
  const todosOsCodigos = [...codigosUsados, ...usadosAqui];

  // a equipe por setor (os responsáveis do cadastro)
  const equipe = acesso.equipe().lista.filter(u => u.ativo && !usuarios.ehContaReservada(u.email));
  const doSetor = (d: usuarios.Departamento) => equipe.filter(u => u.departamento === d).map(u => ({ uid: u.uid, nome: u.nome }));

  const salvar = (x: Entrada) => repo.salvar(x);
  // cada mudança parte da entrada como está agora (dois cliques seguidos, antes de redesenhar, não se perdem)
  const daVez = () => repo.lista().find(x => x.id === abertaId) || null;
  const mudarFicha = (parcial: Partial<Ficha> | ((f: Ficha) => Partial<Ficha>)) => {
    const x = daVez();
    if (x) salvar(e.comFicha(x, { ...x.ficha, ...(typeof parcial === 'function' ? parcial(x.ficha) : parcial) }, agora()));
  };
  const mudarOrcamento = (parcial: Partial<Orcamento> | ((o: Orcamento) => Partial<Orcamento>)) => {
    const x = daVez();
    if (x?.orcamento) salvar(e.comOrcamento(x, { ...x.orcamento, ...(typeof parcial === 'function' ? parcial(x.orcamento) : parcial) }, agora()));
  };
  const tentar = (titulo: string, f: () => void) => { try { f(); } catch (ex) { erro(titulo, ex); } };

  const pedidos = aberta ? e.documentosPedidos(aberta.ficha) : [];
  const pasta = aberta ? e.pastaDoCliente(new Date().getFullYear(), aberta.cadastro?.codigo ?? null, aberta.ficha.razaoSocial || 'cliente novo') : '';

  async function pdfDoOrcamento(x: Entrada) {
    const { desenharOrcamento } = await import('./orcamentoPdf');
    return desenharOrcamento(x.ficha, x.orcamento!, x.numero, new Date());
  }
  const nomeDoPdf = (x: Entrada) => 'Orçamento ' + String(x.numero).padStart(4, '0') + ' - ' + (x.ficha.razaoSocial.trim() || 'cliente') + '.pdf';

  return {
    exemplos: teste,
    ligarExemplos: (ligar: boolean) => { setAbertaId(null); ligarTeste(ligar); },
    busca, setBusca,
    lista: lista.filter(x => !busca.trim() || (x.ficha.razaoSocial + ' ' + x.ficha.contato).toLowerCase().includes(busca.trim().toLowerCase())).map(x => {
      const nota = e.notaDoCliente(x.ficha);
      const etapa = e.ETAPAS.find(t => t.valor === x.etapa)!;
      return {
        id: x.id, numero: x.numero, cliente: x.ficha.razaoSocial || '(sem nome)', contato: x.ficha.contato, motivo: e.MOTIVOS.find(m => m.valor === x.ficha.motivo)?.rotulo || '',
        nota: nota.sim + '/' + nota.total, classificacao: nota.classificacao, etapa: etapa.rotulo, tom: etapa.tom, atualizada: quando(x.atualizadaEm),
        total: x.orcamento ? formatos.reais(e.totalMensal(x.orcamento)) : '—',
      };
    }),
    nova() { const id = repo.nova(op.nome); setAbertaId(id); setPasso('ficha'); },
    abrir(id: string) { const x = lista.find(y => y.id === id); setAbertaId(id); if (x) setPasso(passoDaEtapa(x)); },
    voltar: () => setAbertaId(null),

    // ---- a entrada aberta
    aberta,
    passo, setPasso,
    /** os passos liberados: o orçamento depois da ficha, os documentos depois do sim do cliente, o cadastro depois deles */
    passos: aberta ? ([
      { valor: 'ficha', rotulo: '1. Ficha', travada: false },
      { valor: 'orcamento', rotulo: '2. Orçamento', travada: aberta.etapa === 'ficha' ? 'Feche a ficha antes' : false },
      { valor: 'documentos', rotulo: '3. Documentos', travada: ['documentos', 'cadastro', 'concluida'].includes(aberta.etapa) ? false : 'Depois que o cliente aprovar o orçamento' },
      { valor: 'cadastro', rotulo: '4. Cadastro', travada: ['cadastro', 'concluida'].includes(aberta.etapa) ? false : 'Depois dos documentos' },
    ] as const) : [],
    etapa: aberta ? e.ETAPAS.find(t => t.valor === aberta.etapa)! : null,
    historico: aberta ? [...aberta.historico].reverse().map(h => ({ ...h, quando: quando(h.em) })) : [],

    // a ficha
    mudarFicha,
    responder: (id: administrativo.entrada.IdRequisito, r: administrativo.entrada.Resposta) => mudarFicha(f => ({ requisitos: { ...f.requisitos, [id]: r } })),
    nota: aberta ? e.notaDoCliente(aberta.ficha) : null,
    problemaDaFicha: aberta ? e.problemaDaFicha(aberta.ficha) : '',
    novoSocio: () => mudarFicha(f => ({ socios: [...f.socios, { nome: '', cpf: '', participacao: f.socios.length ? 0 : 100, administrador: !f.socios.length }] })),
    mudarSocio: (i: number, parcial: Partial<administrativo.entrada.Socio>) => mudarFicha(f => ({ socios: f.socios.map((s, n) => (n === i ? { ...s, ...parcial } : s)) })),
    tirarSocio: (i: number) => mudarFicha(f => ({ socios: f.socios.filter((_, n) => n !== i) })),
    fecharFicha: () => tentar('A ficha ainda não fecha', () => { if (aberta) { salvar(e.paraOOrcamento(aberta, op.nome, agora())); setPasso('orcamento'); } }),

    // o orçamento
    mudarOrcamento,
    mudarItem: (i: number, parcial: Partial<administrativo.entrada.ItemDoOrcamento>) => mudarOrcamento(o => ({ itens: o.itens.map((x, n) => (n === i ? { ...x, ...parcial } : x)) })),
    novoItem: () => mudarOrcamento(o => ({ itens: [...o.itens, { descricao: '', valor: 0 }] })),
    tirarItem: (i: number) => mudarOrcamento(o => ({ itens: o.itens.filter((_, n) => n !== i) })),
    refazerSugestao: () => { if (aberta) mudarOrcamento(e.sugestaoDeOrcamento(aberta.ficha)); },
    total: aberta?.orcamento ? formatos.reais(e.totalMensal(aberta.orcamento)) : '',
    problemaDoOrcamento: aberta?.orcamento ? e.problemaDoOrcamento(aberta.orcamento) : '',
    async baixarPdf() {
      if (!aberta?.orcamento) return;
      try { baixarBytes(await pdfDoOrcamento(aberta), nomeDoPdf(aberta), 'application/pdf'); } catch (ex) { erro('O PDF não foi gerado', ex); }
    },
    /** o e-mail: baixa o PDF (para anexar) e abre o e-mail pronto, com o assunto e o texto; marca como enviado */
    async enviarPorEmail() {
      if (!aberta?.orcamento) return;
      const p = e.problemaDoOrcamento(aberta.orcamento);
      if (p) { aviso({ tom: 'erro', titulo: p }); return; }
      try {
        baixarBytes(await pdfDoOrcamento(aberta), nomeDoPdf(aberta), 'application/pdf');
        const m = e.emailDoOrcamento(aberta.ficha, aberta.orcamento, formatos.reais);
        window.open('mailto:' + encodeURIComponent(aberta.ficha.email.trim()) + '?subject=' + encodeURIComponent(m.assunto) + '&body=' + encodeURIComponent(m.corpo), '_blank');
        if (aberta.etapa === 'orcamento') salvar(e.enviado(aberta, op.nome, agora()));
        toast('O PDF foi baixado: anexe no e-mail que abriu.');
      } catch (ex) { erro('Não deu para preparar o e-mail', ex); }
    },
    marcarEnviado: () => tentar('Não deu para marcar', () => { if (aberta) salvar(e.enviado(aberta, op.nome, agora())); }),
    resposta: (aprovado: boolean, obs: string) => tentar('Não deu para gravar a resposta', () => { if (aberta) { salvar(e.respostaDoCliente(aberta, aprovado, obs, op.nome, agora())); if (aprovado) setPasso('documentos'); } }),

    // os documentos
    pasta,
    documentos: pedidos.map(p => {
      const r = aberta?.documentos.find(d => d.documento === p.id);
      return { ...p, recebido: r ? { nome: r.nome, detalhe: [entregas.tamanhoLegivel(r.tamanho), quando(r.em), r.por].filter(Boolean).join(' · ') } : null, destino: pasta + '/' + p.pasta };
    }),
    faltam: aberta ? e.faltando(pedidos, aberta.documentos).length : 0,
    socios: aberta?.ficha.socios.map(s => s.nome || '(sem nome)') || [],
    guardar: async (documento: string, arquivo: File) => { if (aberta) { try { await repo.guardar(aberta.id, documento, arquivo, op.nome); toast(arquivo.name + ' guardado.'); } catch (ex) { erro('O arquivo não foi guardado', ex); } } },
    baixar: (documento: string) => {
      if (!aberta) return;
      const b = repo.baixar(aberta.id, documento);
      const r = aberta.documentos.find(d => d.documento === documento);
      if (b && r) baixarBytes(b, r.nome, 'application/octet-stream'); else toast('É um arquivo de exemplo: não tem o que baixar.');
    },
    tirar: (documento: string) => { if (aberta) salvar(e.semDocumento(aberta, documento, agora())); },
    paraOCadastro: () => { if (aberta) { salvar(e.paraOCadastro(aberta, op.nome, agora())); setPasso('cadastro'); } },

    // o cadastro
    codigoSugerido: e.proximoCodigo(todosOsCodigos),
    fiscais: doSetor('fiscal'),
    contabeis: doSetor('contabil'),
    dps: doSetor('dp'),
    regimes: e.REGIMES,
    problemaDoCadastro: (c: administrativo.entrada.Cadastro) => (aberta ? e.problemaDoCadastro(c, todosOsCodigos, aberta.ficha.funcionarios > 0) : ''),
    cadastrar: (c: administrativo.entrada.Cadastro) => tentar('O cliente não foi cadastrado', () => {
      if (!aberta) return;
      salvar(e.cadastrado(aberta, c, todosOsCodigos, op.nome, agora()));
      toast('Cliente ' + c.codigo + ' cadastrado (protótipo: o cadastro de verdade e a pasta no Drive vêm depois).');
    }),
  };
}
