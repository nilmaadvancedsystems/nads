// Cadastro › Obrigações (plano do Acessórias, ficha E08): o que esta empresa tem de diferente da rotina do Fiscal e do
// Contábil. O padrão vem do regime; aqui só o que muda, a partir de uma competência (os meses antes dela não mudam).
import { ConfigLinha, ConfigSecao, MenuSuspenso, useCarregando } from '@nads/ui';
import { useObrigacoesDaEmpresa, type EscolhaDaEtapa } from './useObrigacoesDaEmpresa';

const ROTULO: Record<EscolhaDaEtapa, string> = { rotina: 'Como a rotina', tem: 'Tem', 'nao-tem': 'Não tem' };
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

export function ObrigacoesDaEmpresa({ rota }: { rota: string }) {
  const vm = useObrigacoesDaEmpresa(rota);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  const desdeAtual = vm.opcoesDeDesde.find(o => o.valor === vm.desde)?.rotulo || vm.desde;
  return (
    <>
      <ConfigSecao titulo="Obrigações da empresa">
        <ConfigLinha titulo="A partir de"
          descricao={'O padrão vem do regime' + (vm.regime ? ' (' + vm.regime + ')' : '') + '. Mude só o que esta empresa tem de diferente; vale da competência escolhida em diante.'}>
          <MenuSuspenso rotulo={desdeAtual} className="btn btn-ghost" titulo="A partir de qual competência" direita largura={220}
            itens={vm.opcoesDeDesde.map(o => ({ rotulo: o.rotulo, marcado: o.valor === vm.desde, onClick: () => vm.setDesde(o.valor) }))} />
        </ConfigLinha>
      </ConfigSecao>
      {vm.setores.map(s => (
        <ConfigSecao key={s.setor} titulo={s.titulo}>
          {s.etapas.map(e => (
            <ConfigLinha key={e.id} titulo={<span className={e.temAgora ? undefined : 'fraco'}>{e.nome}</span>}
              descricao={e.padrao + (e.diaPadrao ? ' · prazo dia ' + e.diaPadrao : '')}
              aviso={e.ajuste ? 'Nesta empresa: ' + e.ajuste : undefined}>
              {e.diaPadrao != null && (
                <MenuSuspenso rotulo={'Dia ' + (e.dia ?? e.diaPadrao)} className="btn btn-ghost" titulo={'Dia do prazo de ' + e.nome} direita largura={160}
                  itens={[
                    { rotulo: 'Da tabela (dia ' + e.diaPadrao + ')', marcado: e.dia == null, onClick: () => vm.mudarDia(s.setor, e.id, e.nome, null) },
                    ...DIAS.filter(d => d !== e.diaPadrao).map(d => ({ rotulo: 'Dia ' + d, marcado: e.dia === d, onClick: () => vm.mudarDia(s.setor, e.id, e.nome, d) })),
                  ]} />
              )}
              <MenuSuspenso rotulo={ROTULO[e.escolha]} className="btn btn-ghost" titulo={e.nome} direita largura={180}
                itens={(Object.keys(ROTULO) as EscolhaDaEtapa[]).map(x => ({ rotulo: ROTULO[x], marcado: e.escolha === x, onClick: () => { if (e.escolha !== x) vm.escolher(s.setor, e.id, e.nome, x); } }))} />
            </ConfigLinha>
          ))}
        </ConfigSecao>
      ))}
    </>
  );
}
