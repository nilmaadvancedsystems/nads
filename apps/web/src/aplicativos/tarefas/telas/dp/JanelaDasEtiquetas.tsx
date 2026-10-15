// A janela "Parâmetros" das etiquetas da folha (Savio, 15/10/2026): a competência e a data de pagamento, que saem
// impressas, e a quantidade de etiquetas (uma página cheia, por padrão). Imprimir abre a impressão em A4.
import { CampoData, Icone } from '@nads/ui';
import { useEffect } from 'react';
import type { useEtiquetasDaFolha } from './useEtiquetasDaFolha';

type VM = ReturnType<typeof useEtiquetasDaFolha>;

export function JanelaDasEtiquetas({ vm }: { vm: VM }) {
  const { fechar } = vm;
  useEffect(() => {
    if (!vm.aberta) return;
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !ev.defaultPrevented) { ev.preventDefault(); fechar(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [vm.aberta, fechar]);
  if (!vm.aberta) return null;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div className="modal etq-janela" role="dialog" aria-modal="true" aria-labelledby="etqTitulo">
        <h3 id="etqTitulo"><Icone nome="fileText" />Etiquetas da folha</h3>
        <form className="etq-corpo" onSubmit={ev => { ev.preventDefault(); vm.imprimir(); }}>
          <p className="etq-dica">Informe os dois textos que saem em cada etiqueta. A data sugerida é o 5º dia útil do mês seguinte (sábado conta); pode trocar.</p>
          <label className="etq-campo">
            <span>Informe a competência</span>
            <input type="text" value={vm.competencia} onChange={ev => vm.setCompetencia(ev.target.value)} placeholder="mm/aaaa" maxLength={20} autoFocus />
          </label>
          <div className="etq-campo">
            <span>Informe data de pagamento</span>
            <CampoData valor={vm.dataDePagamento} onMudar={vm.setDataDePagamento} rotulo="Data de pagamento" />
          </div>
          <label className="etq-campo">
            <span>Quantidade de etiquetas</span>
            <input type="number" min={1} max={1000} inputMode="numeric" value={vm.quantidade} onChange={ev => vm.setQuantidade(ev.target.value)} />
          </label>
          <p className="hint etq-total">{vm.total} {vm.total === 1 ? 'etiqueta' : 'etiquetas'} em {vm.paginas} {vm.paginas === 1 ? 'página' : 'páginas'} A4 (cabem {vm.porPagina} por página, nenhuma cortada)</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!vm.pronta}><Icone nome="printer" />Imprimir</button>
          </div>
        </form>
      </div>
    </div>
  );
}
