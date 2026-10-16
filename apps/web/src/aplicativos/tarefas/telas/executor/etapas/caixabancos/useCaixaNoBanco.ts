// ViewModel da etapa Caixa × bancos, no Fechamento (Vitor, 16/10/2026: "deixa uma função onde eu irei upar o razão do caixa,
// e você vai procurar nos bancos valores, datas semelhantes, que às vezes pagou com caixa, mas tinha no banco"). A pessoa
// importa o razão do caixa (XLS da conciliação do Alterdata); a regra (@nads/core tarefas.caixaNoBanco) acha, para cada
// pagamento que saiu do caixa, o que saiu do banco com o mesmo valor até 5 dias (Vitor, 16/10/2026: "o que sai do banco e o
// que está saindo do caixa"); a transferência com o banco fica de fora. Só sugere; o razão fica guardado neste
// navegador (voltou, está onde parou).
import { extrator as x, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo } from 'react';
import { useGuardado } from '../../../../../../comum/guardado';
import { useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useCadastro } from '../../../../dados/repo';
import { useChaveDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

const dataBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

export function useCaixaNoBanco() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const chave = useChaveDaEtapa('caixa-bancos');
  const [razao, setRazao] = useGuardado<{ arquivo: string; razao: t.RazaoDaConta } | null>(chave + '|razao', null);
  // os lançamentos dos extratos importados (todos os bancos), com o nome e o logo do banco
  const ext = useExtratorDaEmpresa(s.nome);
  const vivo = useCadastro(s.nome, s.codigo);
  const cadastroVivo = vivo.carregada ? vivo.cadastro : null;
  const extrato = useMemo(() => {
    const { bancos, primeiro } = x.bancosDaEmpresaNa(ext, cadastroVivo, s.codigo, s.meses[s.meses.length - 1] || s.competencia);
    const doBanco = new Map(bancos.map(b => [b.id, b]));
    return ext.arquivos.filter(a => a.lado === 'banco').flatMap(a => {
      const b = x.bancoDoArquivo(a, primeiro);
      const banco = doBanco.get(b);
      return a.lancamentos.map(l => ({ data: l.data, valor: l.valor, historico: l.historico, banco: banco?.nome || b, marca: banco?.marca || b }));
    });
  }, [ext, cadastroVivo, s.codigo, s.meses, s.competencia]);

  async function importar(f: File | null) {
    if (!f) return;
    try {
      setRazao({ arquivo: f.name, razao: t.lerRazaoDoArquivo(await f.arrayBuffer()) });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o razão do caixa', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  const achados = useMemo(() => (razao ? t.caixaNoBanco(razao.razao.lancamentos, extrato, s.meses) : []), [razao, extrato, s.meses]);
  const doPeriodo = razao ? razao.razao.lancamentos.filter(l => s.meses.includes(l.data.slice(0, 7))).length : 0;
  // opcional: a tela só sugere (o Próximo não espera o razão)
  useRequisitosDaEtapa({ pronto: true, faltam: [] });

  const reais = formatos.reais;
  return {
    temRazao: !!razao, arquivo: razao?.arquivo || '',
    importar, remover: () => setRazao(null),
    temExtrato: extrato.length > 0,
    resumo: razao ? [doPeriodo + ' lançamentos no período', achados.length ? achados.length + (achados.length === 1 ? ' saída também saiu do banco' : ' saídas também saíram do banco') : 'Nenhuma saída no banco'] : [],
    itens: achados.map((a, k) => ({
      id: k + '|' + a.caixa.data + '|' + a.caixa.valor,
      data: dataBR(a.caixa.data), historico: a.caixa.historico, contrapartida: [a.caixa.contrapartida, a.caixa.nomeContrapartida].filter(Boolean).join(' - '),
      valor: reais(Math.abs(a.caixa.valor)), saida: a.saida,
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
