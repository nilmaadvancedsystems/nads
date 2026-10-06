// A Importação no Alterdata em abas (Vitor, 06/10/2026: "quero que tenha a importação do Alterdata em cada aba no estilo do
// contábil"): cada tipo (Entradas, Saídas, Serviços Tomados, Serviços Prestados, CT-e) é uma aba do cabeçalho; aqui, a da
// vez, no desenho da Importação do Contábil — o tipo, quantas notas o SIEG tem dele no mês (para comparar com o que
// entrou no Alterdata) e o Importei ou o Não tem; feita, o estado e o Desfazer.
import { Icone } from '@nads/ui';
import { useImportacaoEmAbas } from '../useImportacaoEmAbas';

export interface ItemEmAba { id: string; nome: string; marcado: boolean; naoTem: boolean; aviso?: string }

export function ImportacaoEmAbas({ item, codigo, competencia, onImportei, onNaoTem, onDesfazer }: {
  item: ItemEmAba; codigo: string; competencia: string; onImportei: () => void; onNaoTem: () => void; onDesfazer: () => void;
}) {
  const vm = useImportacaoEmAbas(item.id, codigo, competencia);
  return (
    <div className="imp-lista importacao-abas">
      <div className={'imp-bloco' + (item.marcado ? ' importacao-feita' : '')}>
        <div className="imp-linha">
          <Icone nome={item.marcado ? 'checkCircle' : 'fileUp'} className="importacao-icone" />
          <div className="importacao-nome">
            <b>{item.nome}</b>
            <span className="fraco">{vm.textoSieg}</span>
          </div>
          <span className="tarefas-barra-espaco" />
          {item.marcado ? (
            <>
              <span className={'badge ' + (item.naoTem ? 'badge-neutral' : 'badge-ok')}>{item.naoTem ? 'Não tem' : 'Importado no Alterdata'}</span>
              <button type="button" className="btn btn-outline" onClick={onDesfazer}>Desfazer</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-outline" onClick={onNaoTem}>Não tem</button>
              <button type="button" className="btn btn-primary" onClick={onImportei}><Icone nome="check" />Importei</button>
            </>
          )}
        </div>
        {item.aviso && <p className="importacao-aviso"><Icone nome="alert" />{item.aviso}</p>}
      </div>
      <p className="fraco importacao-dica">Importe {item.nome.toLowerCase()} da competência no Alterdata e marque aqui. Se a empresa não tem esse tipo no mês, use Não tem.</p>
    </div>
  );
}
