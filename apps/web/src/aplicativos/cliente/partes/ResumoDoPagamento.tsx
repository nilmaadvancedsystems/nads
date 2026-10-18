// O resumo do pagamento no alto do cartão das guias da Área do Cliente ("melhora mais" de 17/10/2026, como o assistente
// de pagamentos da "Visão do Cliente" do Omie): quanto falta pagar, até quando (o próximo vencimento, com quantos dias
// faltam) e, quando o escritório sabe, o que já foi pago no mês. Os números grandes e tabulares, numa faixa de fundo
// suave; no celular, um embaixo do outro. Embaixo da lista vai a dica de como pagar (cli-como-pagar). Peça do catálogo
// (Cartões).
import { formatos } from '@nads/core';

export function ResumoDoPagamento({ aPagar, quantas, proximo, faltam, pago }: {
  /** a soma das guias que ainda vão vencer */ aPagar: number; quantas: number;
  /** 'dd/mm' do próximo vencimento; '' = nenhum */ proximo: string; /** "em 3 dias"; '' = hoje */ faltam: string;
  /** o já pago no mês; undefined = o escritório não sabe (some) */ pago?: { valor: number; quantas: number };
}) {
  return (
    <dl className="cli-pagar">
      <div><dt>A pagar</dt><dd className="cli-pagar-valor">{formatos.reais(aPagar)}</dd><dd className="hint">{quantas === 1 ? '1 guia' : quantas + ' guias'}</dd></div>
      {proximo && <div><dt>Próximo vencimento</dt><dd className="cli-pagar-valor">{proximo}</dd><dd className="hint">{faltam || 'hoje'}</dd></div>}
      {pago && <div><dt>Já pago no mês</dt><dd className="cli-pagar-valor">{formatos.reais(pago.valor)}</dd><dd className="hint">{pago.quantas === 1 ? '1 guia' : pago.quantas + ' guias'}</dd></div>}
    </dl>
  );
}
