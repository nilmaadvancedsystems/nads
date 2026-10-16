// A etapa Simples Nacional a recolher (Vitor, 16/10/2026: "para empresas enquadradas no regime Simples"): a linha do razão,
// como a do Pró-labore. O DAS do mês entra a crédito e é pago no mês seguinte: o mês fecha só com o DAS dele; o de antes que
// sobrou ou o mês devedor travam o Próximo.
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useRazaoDaFolha } from '../../useRazaoDaFolha';
import { RazaoDaFolha } from '../../partes/RazaoDaFolha';

function useSimples() {
  const s = useEtapaAberta();
  const vm = useRazaoDaFolha('simples', s.nome + '|simples|' + s.meses.join(','), s.meses);
  // o ⚡ de cima: os mesmos razões de teste da linha
  useDadosDeTesteDaEtapa(s.dev ? vm.teste.map((x, i) => ({ id: String(i), rotulo: x.rotulo })) : [], id => vm.teste[+id]?.onClick());
  const faltam = [
    ...(!vm.temRazao ? ['Importar o razão do Simples Nacional a recolher'] : []),
    ...vm.sobras.map(x => 'O DAS de antes não foi pago todo em ' + x.mes + ' (sobrou ' + x.valor + ')'),
    ...(vm.devedores.length ? ['Corrigir o saldo devedor do Simples a recolher em ' + vm.devedores.join(', ')] : []),
  ];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });
  return { vm, dev: s.dev };
}

export function Simples() {
  const { vm, dev } = useSimples();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Simples Nacional a recolher</h2></div></header>
      <div className="imp-lista"><RazaoDaFolha vm={vm} dev={dev} /></div>
    </section>
  );
}
