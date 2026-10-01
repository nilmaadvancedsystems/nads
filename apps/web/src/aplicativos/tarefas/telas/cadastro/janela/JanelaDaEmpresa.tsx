// A janela flutuante de uma empresa no Cadastro, por cima da lista: no topo, "‹ Empresas" (voltar), a empresa
// e o ✕; na lateral, as abas dela; no meio, a aba aberta. Esc ou clicar fora fecha.
import { Icone } from '@nads/ui';
import { useEffect } from 'react';
import { ContasBancarias } from '../bancos/ContasBancarias';
import { ContasPadrao } from '../contas-padrao/ContasPadrao';
import { DadosDaEmpresa } from '../empresa/DadosDaEmpresa';
import { HistoricoCadastro } from '../historico/HistoricoCadastro';
import { PlanoDeContas } from '../plano/PlanoDeContas';
import { useJanelaDaEmpresa } from './useJanelaDaEmpresa';

function Aba({ rota, aba }: { rota: string; aba: string }) {
  switch (aba) {
    case 'empresa': return <DadosDaEmpresa rota={rota} />;
    case 'plano': return <PlanoDeContas rota={rota} />;
    case 'contas-padrao': return <ContasPadrao rota={rota} />;
    case 'historico': return <HistoricoCadastro rota={rota} />;
    default: return <ContasBancarias rota={rota} />;
  }
}

export function JanelaDaEmpresa({ rota, aba }: { rota: string; aba: string }) {
  const vm = useJanelaDaEmpresa(rota, aba);
  const { fechar } = vm;

  // a página de trás não rola com a janela aberta; Esc fecha (menos quando um menu da janela está aberto)
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('.cad-janela .popover, .modal-overlay')) return;
      fechar();
    };
    document.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = antes; document.removeEventListener('keydown', esc); };
  }, [fechar]);

  return (
    // data-volta-para: ao fechar, a janela encolhe de volta para a linha desta empresa na lista (mesmo aberta por link)
    <div className="cad-janela-fundo" data-volta-para={vm.empresa.codigo != null ? '[data-empresa="' + vm.empresa.codigo + '"]' : undefined}
      onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="cad-janela" role="dialog" aria-modal="true" aria-label={'Cadastro de ' + vm.empresa.nome}>
        <header className="cad-janela-topo">
          <button type="button" className="btn btn-ghost btn-sm" onClick={fechar} title="Voltar para a lista de empresas">
            <Icone nome="chevronLeft" />Empresas
          </button>
          <span className="cad-janela-empresa">
            <b className="num">{vm.empresa.codigo ?? '—'}</b>
            <span className="cad-janela-nome">{vm.empresa.nome}</span>
            {vm.empresa.regime && <span className="fraco">{vm.empresa.regime}</span>}
          </span>
          <button type="button" className="btn btn-ghost btn-sm cad-janela-x" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)">
            <Icone nome="x" />
          </button>
        </header>
        <div className="cad-janela-corpo">
          <nav className="cad-janela-abas" aria-label="Abas da empresa">
            {vm.abas.map(a => (
              <button key={a.id} type="button" className={'cad-janela-aba' + (a.ativa ? ' ativa' : '')} aria-current={a.ativa ? 'page' : undefined}
                onClick={() => vm.irPara(a.id)}>
                <Icone nome={a.icone} />{a.rotulo}
              </button>
            ))}
          </nav>
          <div className="cad-janela-conteudo">
            <Aba rota={rota} aba={vm.aba} />
          </div>
        </div>
      </div>
    </div>
  );
}
