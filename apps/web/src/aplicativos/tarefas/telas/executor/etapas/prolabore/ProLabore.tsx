// A etapa Pró-labore (Vitor, 07/10/2026: "só importar o razão e ver se tá zerando"): a linha do razão do Pró-labore a pagar,
// como a de Salários. O razão é obrigatório; o mês pode fechar credor (o pró-labore do mês), mas o de antes tem que ser pago
// no mês — sobra antiga ou mês devedor trava o Próximo.
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useRazaoDaFolha } from '../../useRazaoDaFolha';
import { RazaoDaFolha } from '../../partes/RazaoDaFolha';

function useProLabore() {
  const s = useEtapaAberta();
  const vm = useRazaoDaFolha('prolabore', s.nome + '|prolabore|' + s.meses.join(','), s.meses);
  // o ⚡ de cima: os mesmos razões de teste da linha
  useDadosDeTesteDaEtapa(s.dev ? vm.teste.map((x, i) => ({ id: String(i), rotulo: x.rotulo })) : [], id => vm.teste[+id]?.onClick());
  const faltam = [
    ...(!vm.temRazao ? ['Importar o razão do Pró-labore a pagar'] : []),
    ...vm.sobras.map(x => 'O pró-labore de antes não zerou em ' + x.mes + ' (sobrou ' + x.valor + ')'),
    ...(vm.devedores.length ? ['Corrigir o saldo devedor do Pró-labore a pagar em ' + vm.devedores.join(', ')] : []),
  ];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });
  return { vm, dev: s.dev };
}

export function ProLabore() {
  const { vm, dev } = useProLabore();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Pró-labore</h2></div></header>
      <div className="imp-lista"><RazaoDaFolha vm={vm} dev={dev} /></div>
    </section>
  );
}
