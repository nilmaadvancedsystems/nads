// ViewModel do "Confirme os bancos da empresa" na Importação (Vitor, 21/10/2026: "quando o banco não está cadastrado, faz
// um procedimento na própria tela, o usuário confirmar os bancos e também colocar a conta contábil"). A lista começa com o
// ponto de partida do Cadastro (o que o Extrator já usava e o que o Entregas sabe do cliente), cada banco marcado e com a
// conta contábil sugerida pelo nome no plano; confirmar grava no Cadastro da empresa e as linhas de banco aparecem.
import { empresas, type extrator } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useSessao } from '../../casca/sessao';
import { useCadastroDaEmpresa } from '../../dados/repo';

const cad = empresas.cadastro;

/** quem confirmou (o operador da Tarefa; fora dela, a tela) */
const quem = () => { try { return localStorage.getItem('nads-tarefas-operador') || 'Importação'; } catch { return 'Importação'; } };

export function useConfirmarBancos() {
  const s = useSessao();
  const c = useCadastroDaEmpresa(s.nome, s.codigo);
  const { toast } = useRetorno();
  // o que o Entregas sabe do cliente (os bancos e as contas que o robô aprendeu): carregado só aqui, quando precisa
  const [doEntregas, setDoEntregas] = useState<empresas.cadastro.BancosDoEntregas | null>(null);
  useEffect(() => {
    let vale = true;
    if (s.codigo != null) {
      void import('../../../../../tarefas/dados/fonte')
        .then(m => m.bancosDoEntregas())
        .then(mapa => { if (vale) setDoEntregas(mapa.get(s.codigo as number) || null); }, () => undefined);
    }
    return () => { vale = false; };
  }, [s.codigo]);
  // os bancos que a pessoa já tinha adicionado no Extrator entram com os mesmos ids (os arquivos ficam neles)
  const adicionados = s.empresa.bancos as extrator.BancoAdicionado[] | undefined;
  const partida = useMemo(() => cad.juntarComEntregas(cad.pontoDePartida(s.codigo, adicionados || []), doEntregas), [s.codigo, adicionados, doEntregas]);
  // a lista para confirmar: a do ponto de partida, até a pessoa mexer (depois, a dela)
  const inicial = useMemo<empresas.cadastro.BancoParaConfirmar[]>(() => partida.map(b => ({
    id: b.id, marca: b.marca, agencia: b.agencia || '', conta: b.conta || '', contaContabil: b.contaContabil || cad.sugerirContaContabil(c.plano, b.marca), marcado: true,
  })), [partida, c.plano]);
  const [editadas, setEditadas] = useState<empresas.cadastro.BancoParaConfirmar[] | null>(null);
  const [erro, setErro] = useState('');
  const linhas = editadas ?? inicial;
  const mudar = (i: number, m: Partial<empresas.cadastro.BancoParaConfirmar>) => { setErro(''); setEditadas(linhas.map((l, k) => (k === i ? { ...l, ...m } : l))); };
  const contas = (c.plano?.contas || []).filter(k => !k.sintetica);
  return {
    carregando: !c.cadastro,
    temPlano: !!c.plano,
    /** as contas do plano que recebem lançamento (a lista da conta contábil) */
    contasDoPlano: contas,
    linhas: linhas.map((l, i) => {
      const noPlano = l.contaContabil.trim() ? cad.contaNoPlano(c.plano, l.contaContabil.trim()) : null;
      return {
        ...l, i,
        nome: partida.find(b => b.id === l.id)?.nome || cad.nomeDoBanco(l.marca),
        /** a conta nova (adicionada aqui): precisa de agência e conta; a do ponto de partida pode ficar sem */
        nova: !l.id,
        /** o nome da conta contábil no plano, ou o aviso (fora do plano, sintética) */
        nomeContabil: noPlano && !noPlano.sintetica ? noPlano.nome : '',
        avisoContabil: l.contaContabil.trim() ? cad.avisoDaConta(l.contaContabil.trim(), c.plano) || '' : '',
      };
    }),
    marcadas: linhas.filter(l => l.marcado).length,
    erro,
    bancosParaAdicionar: [...empresas.BANCOS_CONHECIDOS, cad.BANCO_OUTRO],
    mudar,
    adicionar: (marca: string) => { setErro(''); setEditadas([...linhas, { id: null, marca, agencia: '', conta: '', contaContabil: cad.sugerirContaContabil(c.plano, marca), marcado: true }]); },
    tirar: (i: number) => { setErro(''); setEditadas(linhas.filter((_, k) => k !== i)); },
    confirmar() {
      if (!c.cadastro) return;
      const r = cad.confirmarBancos(c.cadastro, linhas, partida, c.plano, quem(), new Date());
      if (r.erro) { setErro(r.erro); return; }
      c.salvar(r.cadastro);
      setEditadas(null);
      const n = r.cadastro.bancos?.length || 0;
      toast(n + (n === 1 ? ' banco confirmado' : ' bancos confirmados') + ' no Cadastro da empresa.');
    },
  };
}

export type VmConfirmarBancos = ReturnType<typeof useConfirmarBancos>;
