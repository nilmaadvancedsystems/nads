// ViewModel das contas padrão da empresa (as do layout de lançamentos do Creditor): a conta do banco da
// liquidação, juros, descontos e os três históricos. As contas vêm do plano (com o nome dele e o aviso se
// sumiu ou mudou de nome); vazio = o Creditor decide (sugere pelo plano, ou usa o padrão dele).
import { creditor, empresas } from '@nads/core';
import { useCadastroAberto } from '../useCadastroAberto';

const cad = empresas.cadastro;

export interface CampoPadrao {
  id: empresas.cadastro.CampoContaPadrao;
  rotulo: string;
  /** é conta do plano (os históricos não são) */
  doPlano: boolean;
  valor: string;
  /** o nome da conta no plano */
  nome?: string;
  aviso: string | null;
  /** o que vale quando fica vazio */
  seVazio: string;
}

const PARA_QUE: Record<empresas.cadastro.CampoContaPadrao, string> = {
  banco: 'A conta do banco nos lançamentos da liquidação de títulos (Creditor).',
  juros: 'Os juros (mora) recebidos na liquidação.',
  desconto: 'Os descontos concedidos na liquidação.',
  histPrincipal: 'O código de histórico do recebimento (principal).',
  histJuros: 'O código de histórico dos juros.',
  histDesconto: 'O código de histórico dos descontos.',
};

export function useContasPadrao(rota: string) {
  const c = useCadastroAberto(rota);
  const cp = c.cadastro.contasPadrao;
  const sicoob = c.bancos.find(b => b.marca === 'sicoob' && b.contaContabil);

  const campos: CampoPadrao[] = cad.CAMPOS_CONTA_PADRAO.map(k => {
    const valor = cp?.contas[k] || '';
    const doPlano = (cad.CONTAS_PADRAO_DO_PLANO as readonly string[]).includes(k);
    const seVazio = k === 'banco' && sicoob
      ? 'a conta contábil do Sicoob no cadastro (' + sicoob.contaContabil + ')'
      : doPlano ? 'o Creditor sugere pelo plano (ou usa ' + creditor.CONTAS_PADRAO[k] + ')' : 'o padrão do Creditor (' + creditor.CONTAS_PADRAO[k] + ')';
    return {
      id: k, rotulo: cad.ROTULO_CONTA_PADRAO[k], doPlano, valor,
      nome: doPlano && valor ? cad.contaNoPlano(c.plano, valor)?.nome : undefined,
      aviso: doPlano ? cad.avisoDaConta(valor, c.plano, cp?.nomes[k as empresas.cadastro.ContaPadraoDoPlano]) : null,
      seVazio,
    };
  });

  return {
    empresa: c.empresa,
    carregando: c.carregando,
    temPlano: !!c.plano,
    contasDoPlano: (c.plano?.contas || []).filter(x => !x.sintetica),
    campos,
    paraQue: PARA_QUE,
    definir(k: empresas.cadastro.CampoContaPadrao, codigo: string) {
      if (c.carregando) return;
      const novo = cad.definirContaPadrao(c.cadastro, k, codigo, c.plano, c.por, new Date());
      if (novo !== c.cadastro) c.salvar(novo);
    },
  };
}
