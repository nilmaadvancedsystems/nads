// As linhas da saúde ("ok / atenção / parado"): o ponto colorido, o rótulo, o texto e o detalhe embaixo. Saiu de Cadastro ›
// Sistema e agentes (a saúde do sistema) para servir também o site do admin (a saúde do banco, 21/10/2026). Peça do
// catálogo: "Lista da saúde" (saude-lista).
import type { entregas } from '@nads/core';

export function ListaDaSaude({ itens }: { itens: readonly entregas.ItemDaSaude[] }) {
  return (
    <ul className="saude-lista">
      {itens.map(i => (
        <li key={i.id} className={'saude-' + i.tom}>
          <span className="saude-ponto" aria-hidden="true" />
          <span className="saude-rotulo">{i.rotulo}</span>
          <span className="saude-texto">{i.texto}{i.detalhe && <span className="fraco">{i.detalhe}</span>}</span>
        </li>
      ))}
    </ul>
  );
}
