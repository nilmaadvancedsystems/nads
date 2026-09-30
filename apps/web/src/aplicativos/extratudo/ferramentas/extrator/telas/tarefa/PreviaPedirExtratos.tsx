// Prévia só da janela do "Pedir extratos" (o Vitor trabalha a tela separada, 30/09/2026): a FITO 292, com o
// Sicoob, na competência do mês passado. Usa o mesmo ViewModel e a mesma View da etapa; no site de
// exemplos, o contato e o envio são de mentira (nada sai do navegador). Endereço: /extratudo/previa/pedir-extratos
import { tarefas, type extrator } from '@nads/core';
import { urlDoLogoBanco, urlDoLogoNilma, useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { JanelaHistoricoDePedidos, JanelaPedirExtratos } from './JanelaPedirExtratos';
import { usePedirExtratos, type VmDoPedido } from './usePedirExtratos';

const EMPRESA = 'FITO INDÚSTRIA E COMÉRCIO DE ALIMENTOS LTDA';

export function PreviaPedirExtratos() {
  const { toast } = useRetorno();
  const [competencia] = useState(() => tarefas.competenciasRecentes(new Date(), 12)[0]);
  const [pedidos, setPedidos] = useState<extrator.PedidoRegistrado[]>([]);
  const vm: VmDoPedido = {
    competencia,
    competencias: tarefas.competenciasRecentes(new Date(), 12).map(c => ({ valor: c, rotulo: tarefas.rotuloCompetencia(c) })),
    bancos: [{ id: 'sicoob', nome: 'Sicoob', marca: 'sicoob', conta: '', extrato: { qtdArquivos: 0 } }],
    pedidos,
    registrarPedido: reg => setPedidos(v => [reg, ...v]),
    avisar: t => toast(t),
    avisarErro: (t, d) => toast(t + ': ' + d),
  };
  const p = usePedirExtratos(vm, 292, EMPRESA, [], () => undefined, { logo: urlDoLogoNilma(), logoDoBanco: urlDoLogoBanco });
  // já abre a janela do e-mail
  const abriu = useRef(false);
  useEffect(() => { if (!abriu.current) { abriu.current = true; p.abrir(); } });
  return (
    <div className="previa-pedir">
      <p className="hint">Prévia da janela <b>Pedir extratos</b> · 292 · {EMPRESA}</p>
      <div className="previa-pedir-botoes">
        <button type="button" className="btn btn-outline" onClick={p.abrir}>Pedir por e-mail</button>
        <button type="button" className="btn btn-outline" onClick={p.abrirHistorico}>Histórico ({p.pedidos.length})</button>
      </div>
      <JanelaPedirExtratos p={p} />
      <JanelaHistoricoDePedidos p={p} />
    </div>
  );
}
