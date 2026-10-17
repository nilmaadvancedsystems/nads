// O caixa × os bancos, dentro da etapa Caixa (Vitor, 16/10/2026: "deixa uma função onde eu irei upar o razão do caixa, e
// você vai procurar nos bancos valores, datas semelhantes, que às vezes pagou com caixa, mas tinha no banco"; e depois,
// "aplique todas as suas sugestões": a mesma pergunta e o mesmo razão do Caixa, numa etapa só). Com o razão do caixa, a
// regra (@nads/core tarefas.caixaNoBanco) acha, para cada pagamento que saiu do caixa, o que saiu do banco com o mesmo
// valor até 5 dias, nos extratos importados na Importação; a transferência com o banco fica de fora. Só sugere.
import { clientes as cl, extrator as x, formatos, tarefas as t } from '@nads/core';
import { useMemo } from 'react';
import { useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useCadastro } from '../../../../dados/repo';
import { useMarcasDoMes } from '../../../../dados/clientes';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';

const dataBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

export function useCaixaNoBancoDoRazao(nome: string, codigo: number | null, meses: readonly string[], razao: t.RazaoDaConta | null) {
  const ext = useExtratorDaEmpresa(nome);
  const vivo = useCadastro(nome, codigo);
  const cadastroVivo = vivo.carregada ? vivo.cadastro : null;
  const ultimo = meses[meses.length - 1] || '';
  const extrato = useMemo(() => {
    const { bancos, primeiro } = x.bancosDaEmpresaNa(ext, cadastroVivo, codigo, ultimo);
    const doBanco = new Map(bancos.map(b => [b.id, b]));
    return ext.arquivos.filter(a => a.lado === 'banco').flatMap(a => {
      const b = x.bancoDoArquivo(a, primeiro);
      const banco = doBanco.get(b);
      return a.lancamentos.map(l => ({ data: l.data, valor: l.valor, historico: l.historico, banco: banco?.nome || b, marca: banco?.marca || b }));
    });
  }, [ext, cadastroVivo, codigo, ultimo]);
  const achados = useMemo(() => (razao ? t.caixaNoBanco(razao.lancamentos, extrato, meses) : []), [razao, extrato, meses]);

  // o conciliador das notas em aberto (Vitor, 16/10/2026: "tinha uma nota fiscal no caixa, sendo que tinha ela em aberto no
  // fornecedor"; "era essa função que eu queria, esse conciliador"): as notas em aberto de Fornecedores e de Clientes (as das
  // etapas e as dos razões da Importação) procuradas no caixa, pela NF no histórico ou pelo valor em parcelas iguais
  const mf = useMarcasDoMes(nome, nome ? ultimo : '', undefined, 'fornecedores');
  const mc = useMarcasDoMes(nome, nome ? ultimo : '', undefined, 'clientes');
  const contabil = useContabilDaEmpresa(nome, codigo);
  const notas = useMemo(() => {
    const out: t.NotaEmAbertoNoCaixa[] = [];
    const add = (lado: t.NotaEmAbertoNoCaixa['lado'], conta: string, nomeDaConta: string, ns: readonly { nf: string; aberto: number }[]) => {
      for (const n of ns) if (n.aberto > 0.005 && !out.some(o => o.lado === lado && o.conta === conta && o.nf === n.nf)) out.push({ lado, conta, nome: nomeDaConta, nf: n.nf, aberto: n.aberto });
    };
    for (const [lado, m] of [['fornecedor', mf], ['cliente', mc]] as const) {
      for (const [conta, marca] of Object.entries(m.doc.contas)) if (marca.razao) add(lado, conta, marca.nome, marca.razao.notas);
    }
    const nomeDe = (c: string) => contabil.dinamico?.d.linhas.find(l => l.codigo === c)?.descricao.replace(/\s+/g, ' ') || c;
    if (ultimo) {
      for (const [lado, tipo, l] of [['fornecedor', 'fornecedor', 'fornecedores'], ['cliente', 'cliente', 'clientes']] as const) {
        for (const r of contabil.razoesDoTipo(tipo)) add(lado, r.conta, nomeDe(r.conta), cl.conferirRazaoDoCliente(r.razao, ultimo, l).emAberto);
      }
    }
    return out;
  // as marcas e os razões da Importação dizem tudo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mf.doc, mc.doc, contabil.razoes, contabil.dinamico, ultimo]);
  // o pagamento do banco que passou pelo caixa (Vitor, 16/10/2026: "tinha 700,00 da Nova Tratores que passou batido"): a
  // nota já foi baixada pelo caixa, então não está em aberto; os lançamentos dele não entram de novo nas notas em aberto
  const passagens = useMemo(() => (razao ? t.passouPeloCaixa(razao.lancamentos, meses) : []), [razao, meses]);
  const conciliadas = useMemo(() => {
    if (!razao) return [];
    const usados = new Set(passagens.flatMap(p => [p.entrada, p.saida]));
    return t.notasNoCaixa(razao.lancamentos.filter(l => !usados.has(l)), meses, notas);
  }, [razao, meses, notas, passagens]);
  const linhaDoCaixa = (l: t.LancamentoDoRazao, j: number) => ({
    id: j, data: dataBR(l.data), historico: l.historico, valor: formatos.reais(Math.abs(l.valor)),
    contrapartida: [l.contrapartida, l.nomeContrapartida].filter(Boolean).join(' - '),
    sentido: l.valor > 0 ? 'Saiu do caixa' : 'Entrou no caixa',
  });
  const reais = formatos.reais;
  return {
    temExtrato: extrato.length > 0,
    /** quantas notas em aberto havia para procurar (sem nenhuma: importe os razões de Fornecedores e Clientes) */
    qtdNotas: notas.length + passagens.length,
    notas: [
      ...conciliadas.map((c, k) => ({
        id: k + '|' + c.nota.lado + c.nota.conta + c.nota.nf,
        lado: c.nota.lado === 'fornecedor' ? 'Fornecedor' : 'Cliente', conta: c.nota.conta, nome: c.nota.nome, nf: c.nota.nf,
        valor: formatos.reais(c.nota.aberto) + ' em aberto',
        como: c.como === 'nf' ? 'NF no histórico' : c.vezes === 1 ? 'O valor da nota' : c.vezes + 'x de ' + formatos.reais(c.nota.aberto / c.vezes),
        tom: c.como === 'nf' ? 'ok' : 'neutral',
        lancamentos: c.lancamentos.map(linhaDoCaixa),
      })),
      ...passagens.map((p, k) => ({
        id: 'passou|' + k + '|' + p.entrada.data,
        lado: 'Fornecedor', conta: p.saida.contrapartida, nome: p.saida.nomeContrapartida, nf: p.nfs[0] || '—',
        valor: formatos.reais(Math.abs(p.saida.valor)),
        como: 'Pago pelo banco, passou pelo caixa',
        tom: 'warn',
        lancamentos: [p.entrada, p.saida].map(linhaDoCaixa),
      })),
    ],
    itens: achados.map((a, k) => ({
      id: k + '|' + a.caixa.data + '|' + a.caixa.valor,
      data: dataBR(a.caixa.data), historico: a.caixa.historico, contrapartida: [a.caixa.contrapartida, a.caixa.nomeContrapartida].filter(Boolean).join(' - '),
      valor: reais(Math.abs(a.caixa.valor)),
      noBanco: a.noBanco.map(b => ({
        data: dataBR(b.data), banco: b.banco, marca: b.marca || '', historico: b.historico,
        curto: b.historico.length > 60 ? b.historico.slice(0, 60).trimEnd() + '…' : b.historico,
        valor: reais(Math.abs(b.valor) / 100),
        dias: b.dias === 0 ? 'Mesmo dia' : (b.dias > 0 ? b.dias + (b.dias === 1 ? ' dia depois' : ' dias depois') : -b.dias + (b.dias === -1 ? ' dia antes' : ' dias antes')),
        mesmoDia: b.dias === 0,
      })),
    })),
  };
}

export type CaixaNoBancoDoRazao = ReturnType<typeof useCaixaNoBancoDoRazao>;
