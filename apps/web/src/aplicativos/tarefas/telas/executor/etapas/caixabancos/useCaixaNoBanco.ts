// O caixa × os bancos, dentro da etapa Caixa (Vitor, 16/10/2026: "deixa uma função onde eu irei upar o razão do caixa, e
// você vai procurar nos bancos valores, datas semelhantes, que às vezes pagou com caixa, mas tinha no banco"; e depois,
// "aplique todas as suas sugestões": a mesma pergunta e o mesmo razão do Caixa, numa etapa só). Com o razão do caixa, a
// regra (@nads/core tarefas.caixaNoBanco) acha, para cada pagamento que saiu do caixa, o que saiu do banco com o mesmo
// valor até 5 dias, nos extratos importados na Importação; a transferência com o banco fica de fora. Só sugere.
import { extrator as x, formatos, tarefas as t } from '@nads/core';
import { useMemo } from 'react';
import { useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useCadastro } from '../../../../dados/repo';

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
  const reais = formatos.reais;
  return {
    temExtrato: extrato.length > 0,
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
