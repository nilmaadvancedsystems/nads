// Etapa Baixar do Conversor: o arquivo que sai (nome, aba e quantas linhas) e o Baixar .xls.
import { baixarBytes, Icone } from '@nads/ui';
import { useBaixar } from './useBaixar';

export function Baixar() {
  const vm = useBaixar();
  const baixar = () => { const a = vm.arquivo(); baixarBytes(a.bytes, a.nome, a.tipo); vm.baixou(); };
  return (
    <section>
      <div className="imp-lista">
        <div className="imp-bloco imp-ok">
          <div className="imp-linha">
            <span className="imp-ico"><Icone nome="fileDown" /></span>
            <div className="imp-txt">
              <span><b>{vm.nome}</b></span>
              <span className="hint">Excel 97-2003 · aba “{vm.aba}” · {vm.qtd} {vm.qtd === 1 ? 'lançamento' : 'lançamentos'}</span>
            </div>
            <span className="imp-topo-meio" />
            <button className="btn btn-primary" type="button" onClick={baixar}><Icone nome="download" />Baixar .xls</button>
          </div>
        </div>
      </div>
    </section>
  );
}
