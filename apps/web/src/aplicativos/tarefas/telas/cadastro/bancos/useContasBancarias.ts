// ViewModel das contas bancárias da empresa: a lista (com a conta contábil conferida contra o plano e a
// vigência), incluir, editar, encerrar, reabrir e excluir. Empresa sem cadastro mostra o que o Extrator usava
// (o ponto de partida); a primeira mudança já grava a lista inteira, e "Confirmar" grava sem mudar nada.
import { empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { rotuloCompetencia, useCadastroAberto } from '../useCadastroAberto';

const cad = empresas.cadastro;

export interface LinhaConta {
  id: string;
  marca: string;
  nome: string;
  apelido?: string;
  agencia: string;
  conta: string;
  tipo: string;
  contaContabil?: string;
  /** o nome da conta contábil no plano */
  nomeContabil?: string;
  /** conta contábil fora do plano, sintética… */
  aviso: string | null;
  vigencia: string;
  encerrada: boolean;
  /** já tem a última competência (encerrada agora ou para o futuro): o menu oferece Reabrir */
  temFim: boolean;
  /** o que o formulário de edição começa preenchido */
  dados: empresas.cadastro.DadosDaConta;
}

/** Uma sugestão do Entregas, pronta para a tela. */
export interface LinhaSugestao {
  chave: string;
  tipo: 'nova' | 'completar';
  marca: string;
  nome: string;
  /** "Ag. 3144-5 · C/C 12.345-6" (vazio = o Entregas só sabe o banco) */
  rotulo: string;
  /** tem agência e conta (dá para incluir com um clique) */
  comNumero: boolean;
  sugestao: empresas.cadastro.SugestaoDoEntregas;
}

const dadosDe = (b: empresas.cadastro.ContaBancaria): empresas.cadastro.DadosDaConta =>
  ({ marca: b.marca, agencia: b.agencia || '', conta: b.conta || '', tipo: b.tipo, apelido: b.apelido, contaContabil: b.contaContabil, desde: b.desde });

function vigencia(b: empresas.cadastro.ContaBancaria): string {
  if (b.desde && b.ate) return rotuloCompetencia(b.desde) + ' a ' + rotuloCompetencia(b.ate);
  if (b.ate) return 'até ' + rotuloCompetencia(b.ate);
  if (b.desde) return 'desde ' + rotuloCompetencia(b.desde);
  return 'desde sempre';
}

export function useContasBancarias(rota: string) {
  const c = useCadastroAberto(rota);
  const { toast, modal } = useRetorno();
  const [verEncerradas, setVerEncerradas] = useState(false);
  const tipos = new Map(cad.TIPOS_CONTA.map(t => [t.id, t.rotulo]));

  const todas: LinhaConta[] = c.bancos.map(b => ({
    id: b.id, marca: b.marca, nome: b.nome, apelido: b.apelido,
    agencia: b.agencia || '', conta: b.conta || '', tipo: b.tipo ? tipos.get(b.tipo) || '' : '',
    contaContabil: b.contaContabil,
    nomeContabil: b.contaContabil ? cad.contaNoPlano(c.plano, b.contaContabil)?.nome : undefined,
    aviso: cad.avisoDaConta(b.contaContabil, c.plano),
    vigencia: vigencia(b),
    encerrada: cad.contaEncerrada(b, c.hoje),
    temFim: !!b.ate,
    dados: { marca: b.marca, agencia: b.agencia || '', conta: b.conta || '', tipo: b.tipo, apelido: b.apelido, contaContabil: b.contaContabil, desde: b.desde },
  }));
  const encerradas = todas.filter(l => l.encerrada).length;

  /** Aplica uma sugestão do Entregas sobre um cadastro (completar a conta sem número, ou incluir a nova). */
  function comSugestao(atual: empresas.cadastro.CadastroDaEmpresa, s: empresas.cadastro.SugestaoDoEntregas): empresas.cadastro.ResultadoCadastro {
    const agencia = s.conta.agencia || '';
    const conta = s.conta.conta || '';
    if (s.tipo === 'completar' && s.id) {
      const b = (atual.bancos ?? c.partida).find(x => x.id === s.id);
      if (!b) return { cadastro: atual, erro: 'Essa conta não está mais no cadastro.' };
      return cad.salvarConta(atual, s.id, { ...dadosDe(b), agencia, conta }, c.partida, c.por, new Date());
    }
    return cad.salvarConta(atual, null, { marca: s.conta.marca, agencia, conta, tipo: 'corrente' }, c.partida, c.por, new Date());
  }
  const sugestoes: LinhaSugestao[] = c.sugestoes.map(s => ({
    chave: s.tipo + '|' + s.conta.id, tipo: s.tipo, marca: s.conta.marca, nome: s.conta.nome,
    rotulo: empresas.rotuloDaConta(s.conta), comNumero: !!s.conta.conta, sugestao: s,
  }));

  /** Grava o resultado (ou mostra o motivo de não gravar). true = gravou. */
  function aplicar(r: empresas.cadastro.ResultadoCadastro, ok: string): boolean {
    if (r.erro) { toast(r.erro); return false; }
    c.salvar(r.cadastro);
    toast(ok);
    return true;
  }

  return {
    empresa: c.empresa,
    rota,
    carregando: c.carregando,
    exemplos: c.exemplos,
    /** a empresa ainda não tem os bancos cadastrados: a lista é a do Extrator */
    semCadastro: !c.carregando && !c.cadastro.bancos,
    linhas: verEncerradas ? todas : todas.filter(l => !l.encerrada),
    total: todas.length - encerradas,
    encerradas,
    verEncerradas,
    alternarEncerradas: () => setVerEncerradas(v => !v),
    temPlano: !!c.plano,
    /** as contas do plano que recebem lançamento (para escolher a conta contábil) */
    contasDoPlano: (c.plano?.contas || []).filter(x => !x.sintetica),
    bancosParaEscolher: [...empresas.BANCOS_CONHECIDOS, cad.BANCO_OUTRO],
    tipos: cad.TIPOS_CONTA,
    hoje: c.hoje,

    salvarConta: (id: string | null, d: empresas.cadastro.DadosDaConta) =>
      aplicar(cad.salvarConta(c.cadastro, id, d, c.partida, c.por, new Date()), id ? 'Conta alterada.' : cad.nomeDoBanco(d.marca) + ' incluído.'),
    encerrar: (id: string, ate: string) =>
      aplicar(cad.encerrarConta(c.cadastro, id, ate, c.partida, c.por, new Date()), 'Conta encerrada em ' + rotuloCompetencia(ate) + '.'),
    reabrir: (id: string) => aplicar(cad.reabrirConta(c.cadastro, id, c.partida, c.por, new Date()), 'Conta reaberta.'),
    async excluir(l: LinhaConta) {
      const ok = await modal<boolean>({
        icone: 'alert', titulo: 'Excluir esta conta?',
        texto: cad.descreverConta(l) + '. Excluir é para conta cadastrada por engano: a conta que existiu e fechou deve ser encerrada (os meses dela continuam no Extrator).',
        botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }],
      });
      if (ok) aplicar(cad.excluirConta(c.cadastro, l.id, c.partida, c.por, new Date()), 'Conta excluída.');
    },
    sugestoes,
    incluirSugestao: (l: LinhaSugestao) =>
      aplicar(comSugestao(c.cadastro, l.sugestao), l.tipo === 'completar' ? l.nome + ': agência e conta completadas.' : l.nome + ' incluído.'),
    /** Inclui de uma vez as sugestões com agência e conta. */
    incluirTodas() {
      let atual = c.cadastro;
      let feitas = 0;
      for (const l of sugestoes.filter(x => x.comNumero)) {
        const r = comSugestao(atual, l.sugestao);
        if (!r.erro) { atual = r.cadastro; feitas++; }
      }
      if (!feitas) { toast('Nada para incluir.'); return; }
      c.salvar(atual);
      toast(feitas + (feitas === 1 ? ' conta incluída' : ' contas incluídas') + ' do que o robô sabe.');
    },
    confirmarLista() {
      c.salvar(cad.confirmarPontoDePartida(c.cadastro, c.partida, c.por, new Date()));
      toast('Bancos confirmados. O Extrator passa a usar este cadastro.');
    },
  };
}

export type VmContasBancarias = ReturnType<typeof useContasBancarias>;
