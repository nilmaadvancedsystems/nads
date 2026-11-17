// A faixa dos primeiros passos na Visão geral (15/11/2026: "Pode fazer"): o título com o progresso, os itens lado a lado
// (o feito com o visto verde, o que falta leva até onde se faz) e o "x" para ocultar. A regra fica em
// dados/primeirosPassos.ts; aqui só desenha.
// (16/11/2026: o dono apresentou a área e ouviu "tinha muita informação") mais discreta: só os passos que faltam (o feito
// já conta no "2 de 5"), sem o número na bolinha.
import { Icone } from '@nads/ui';
import type { AcaoDoPrimeiroPasso, PrimeiroPasso } from '../dados/primeirosPassos';
import type { AreaCliente } from '../telas/useAreaCliente';

export function PrimeirosPassos({ lista, irPara, enviar }: {
  lista: { itens: PrimeiroPasso[]; feitos: number; ocultar: () => void; abrirTutorial: () => void };
  irPara: AreaCliente['irPara']; enviar: () => void;
}) {
  const fazer = (id: AcaoDoPrimeiroPasso) => {
    switch (id) {
      case 'tour': lista.abrirTutorial(); break;
      case 'guias': irPara('guias'); break;
      case 'enviar': enviar(); break;
      case 'pedido': irPara('chamados'); break;
      case 'empresa': irPara('empresa'); break;
    }
  };
  const total = lista.itens.length;
  return (
    <section className="card cli-pp" aria-label="Primeiros passos">
      <div className="cli-pp-topo">
        <b>Primeiros passos</b>
        <span className="cli-pp-conta">
          <span className="cli-pp-barra" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={lista.feitos} aria-label="Primeiros passos feitos">
            <span style={{ width: (lista.feitos / total) * 100 + '%' }} />
          </span>
          {lista.feitos} de {total}
        </span>
      </div>
      <ol className="cli-pp-itens">
        {lista.itens.filter(x => !x.feito).map(x => (
          <li key={x.id}>
            <button type="button" className="cli-pp-item" onClick={() => fazer(x.id)}>
              <span className="cli-pp-marca" aria-hidden="true" />
              <span className="cli-pp-rotulo">{x.rotulo}</span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="icon-btn icon-btn-sm cli-pp-x" onClick={lista.ocultar} aria-label="Ocultar os primeiros passos" title="Ocultar"><Icone nome="x" width={14} height={14} /></button>
    </section>
  );
}
