// A etapa Simples Nacional a recolher (Vitor, 16/10/2026: "para empresas enquadradas no regime Simples"): a linha do razão,
// como a do Pró-labore, e os pagamentos do DAS (o razão e o extrato dos bancos). Importou o razão e respondeu as pendências
// ("Não foi pago" ou "Ok"), segue (Vitor, 19/10/2026: "deixa o usuário passar após importar o razão").
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useRazaoDaFolha } from '../../useRazaoDaFolha';
import { RazaoDaFolha } from '../../partes/RazaoDaFolha';
import { PagamentosDoSimples } from './PagamentosDoSimples';
import { usePagamentosDoSimples } from './usePagamentosDoSimples';

function useSimples() {
  const s = useEtapaAberta();
  const vm = useRazaoDaFolha('simples', s.nome + '|simples|' + s.meses.join(','), s.meses, s.nome);
  // o ⚡ de cima: os mesmos razões de teste da linha
  useDadosDeTesteDaEtapa(s.dev ? vm.teste.map((x, i) => ({ id: String(i), rotulo: x.rotulo })) : [], id => vm.teste[+id]?.onClick());
  // os pagamentos do DAS: as pendências respondidas liberam
  const pagamentos = usePagamentosDoSimples(s, vm.razao);
  const faltam = [
    ...(!vm.temRazao ? ['Importar o razão do Simples Nacional a recolher'] : []),
    ...(pagamentos.pendentes.length ? ['Responder as pendências do DAS (Não foi pago ou Ok): ' + pagamentos.pendentes.join(', ')] : []),
  ];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });
  return { vm, dev: s.dev, pagamentos };
}

export function Simples() {
  const { vm, dev, pagamentos } = useSimples();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Simples Nacional a recolher</h2></div></header>
      <div className="imp-lista"><RazaoDaFolha vm={vm} dev={dev} /><PagamentosDoSimples vm={pagamentos} /></div>
    </section>
  );
}
