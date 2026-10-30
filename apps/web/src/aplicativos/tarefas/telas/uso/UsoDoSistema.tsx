// Cadastro › Uso do sistema (só o admin; Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo usado no
// sistema, botões e funcionalidades para sabermos o que está 'inútil'"; refeita em 21/10/2026 e simplificada no mesmo
// dia: "complexo e difícil de entender"): uma lista só, das telas mais usadas às nunca abertas, e em cada uma o "Ver os
// botões", que abre a tela de verdade com os botões pintados (verde = usam, vermelho = ninguém usa). Só as peças do catálogo (Segmentado, Interruptor, Dica, Cartão, Esqueleto, Vazio).
import { BotaoIcone, Dica, Esqueleto, Interruptor, Segmentado, Vazio, useCarregando } from '@nads/ui';
import { useUsoDoSistema } from './useUsoDoSistema';

export function UsoDoSistema() {
  const vm = useUsoDoSistema();
  useCarregando(vm.carregando);
  if (!vm.admin) return <Vazio icone="lock" titulo="Só o admin" texto="O uso do sistema só o administrador vê." />;
  return (
    <section className="uso">
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.periodo} opcoes={vm.periodos} onMudar={vm.setPeriodo} />
        <BotaoIcone icone="girar" titulo="Ler de novo" onClick={vm.recarregar} />
        <span className="tarefas-barra-espaco" />
        <span className="uso-coleta">
          <span>Coletar o uso</span>
          <Dica texto={'Cada pessoa grava no máximo uma vez a cada 5 minutos (e ao sair da página), num documento por dia: cerca de '
            + vm.estimativa.toLocaleString('pt-BR') + ' gravações por dia para 10 pessoas. Só a tela, o rótulo do botão e o ponto do clique: nada do que se digita, nem dado de cliente, nem do cofre.'} />
          <Interruptor ligado={vm.coletando} onMudar={() => void vm.alternarColeta()} rotulo="Coletar o uso do sistema" />
        </span>
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo.</p>}
      {vm.erro && <p className="feedback-erro">{vm.erro}</p>}

      {vm.carregando ? <Esqueleto linhas={8} /> : !vm.numeros.dias ? (
        <Vazio icone="barChart" titulo="Nada coletado no período" texto={vm.coletando ? 'Assim que a equipe usar, aparece aqui (grava a cada 5 minutos).' : 'Ligue a coleta para começar a juntar o uso.'} />
      ) : (
        <div className="card uso-telas">
          <h3>As telas, da mais usada à menos</h3>
          <p className="uso-explica">
            <span className="uso-cor calor-5">verde = usam</span>
            <span className="uso-cor calor-0">vermelho = ninguém usa</span>
          </p>
          <div className="uso-telas-lista">
            {vm.lista.map(x => (
              <div key={x.tela} className={'uso-tela-item' + (x.visitas ? '' : ' sem-uso')}>
                <span className="uso-tela-nome">{x.rotulo}</span>
                <span className="uso-tela-val">{x.visitas ? x.visitas + (x.visitas === 1 ? ' visita' : ' visitas') : 'ninguém abriu'}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.verNaTela(x.tela)}>Ver os botões</button>
                <span className="uso-tela-barra" aria-hidden="true"><span className={'calor-' + x.nivel} style={{ width: x.pct + '%' }} /></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
