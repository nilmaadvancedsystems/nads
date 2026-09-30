// As saídas da etapa, em botões na barra de baixo (ao lado de Interromper e Próximo): o que fazer quando
// não dá para concluir — pedir ao cliente (Contato), buscar no Drive, uma orientação, ou "não se aplica"
// (ex.: na importação dos extratos: Pedir extrato, Buscar no Drive, Não teve movimento).
import type { tarefas } from '@nads/core';
import { Icone, type NomeIcone } from '@nads/ui';

const ICONE: Record<tarefas.Solucao['tipo'], NomeIcone> = { contato: 'link', drive: 'fileDown', orientacao: 'alert', 'nao-se-aplica': 'checkCircle' };

export function Objecoes({ etapa, onResolver }: { etapa: tarefas.Etapa; onResolver: (o: tarefas.Objecao) => void }) {
  return (
    <div className="executor-saidas" aria-label="Se não der para concluir">
      {etapa.objecoes.filter(o => !o.soMotivo).map(o => (
        <button key={o.id} type="button" className="btn btn-outline" title={o.texto} onClick={() => onResolver(o)}>
          <Icone nome={ICONE[o.solucao.tipo]} />{o.solucao.tipo === 'orientacao' ? o.texto : o.solucao.rotulo}
        </button>
      ))}
    </div>
  );
}
