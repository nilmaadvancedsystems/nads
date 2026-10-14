// A janela flutuante de uma empresa no Cadastro, por cima da lista: no topo, "‹ Empresas" (voltar), a empresa
// e o ✕; na lateral, as abas dela; no meio, a aba aberta. Esc ou clicar fora fecha.
import { Icone, useEntradaAnimada, useIndicador } from '@nads/ui';
import { Fragment, useEffect } from 'react';
import { ContasBancarias } from '../bancos/ContasBancarias';
import { ContasPadrao } from '../contas-padrao/ContasPadrao';
import { DadosDaEmpresa } from '../empresa/DadosDaEmpresa';
import { HistoricoCadastro } from '../historico/HistoricoCadastro';
import { PlanoDeContas } from '../plano/PlanoDeContas';
import { useJanelaDaEmpresa } from './useJanelaDaEmpresa';
import { SenhasNoCadastro } from '../../senhas/SenhasNoCadastro';

function Aba({ rota, aba }: { rota: string; aba: string }) {
  switch (aba) {
    case 'empresa': return <DadosDaEmpresa rota={rota} />;
    case 'plano': return <PlanoDeContas rota={rota} />;
    case 'contas-padrao': return <ContasPadrao rota={rota} />;
    case 'historico': return <HistoricoCadastro rota={rota} />;
    case 'senhas': return <SenhasNoCadastro rota={rota} />;
    default: return <ContasBancarias rota={rota} />;
  }
}

/**
 * O que falta no cadastro, numa linha no topo da aba Empresa (13/10/2026; enxuto depois: "achei com muita informação"):
 * o placar e os itens que faltam, cada um levando à aba dele. Completo, some.
 */
function ResumoDoCadastro({ vm }: { vm: ReturnType<typeof useJanelaDaEmpresa> }) {
  const r = vm.resumo;
  if (!r.carregado || r.completos === r.itens.length) return null;
  const faltam = r.itens.filter(i => !i.tem);
  return (
    <div className="cad-resumo-linha">
      <span className="cad-resumo-barra" aria-hidden="true"><span style={{ width: Math.round((r.completos / r.itens.length) * 100) + '%' }} /></span>
      <b>Cadastro {r.completos}/{r.itens.length}</b>
      <span className="fraco">Falta:</span>
      {faltam.map(i => (
        <button key={i.id} type="button" className="cad-resumo-falta" onClick={() => { if (i.aba !== vm.aba) vm.irPara(i.aba); }}
          title={i.aba !== vm.aba ? 'Abrir ' + i.rotulo : i.texto}>{i.rotulo}</button>
      ))}
    </div>
  );
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

  // a aba ativa: o fundo e a barrinha deslizam até ela; o conteúdo da aba chega do jeito do app
  const abasInd = useIndicador<HTMLElement>('.cad-janela-aba.ativa', [vm.aba], 'fundo');
  const conteudoDaAba = useEntradaAnimada<HTMLDivElement>(null, [vm.aba], 'repetida');

  return (
    // data-volta-para: ao fechar, a janela encolhe de volta para a linha desta empresa na lista (mesmo aberta por link)
    <div className="cad-janela-fundo" data-volta-para={vm.empresa.codigo != null ? '[data-empresa="' + vm.empresa.codigo + '"]' : undefined}
      onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="cad-janela" role="dialog" aria-modal="true" aria-label={'Cadastro de ' + vm.empresa.nome}>
        <header className="cad-janela-topo">
          <button type="button" className="btn btn-ghost" onClick={fechar} title="Voltar para a lista de empresas">
            <Icone nome="chevronLeft" />Empresas
          </button>
          <span className="cad-janela-empresa">
            <b className="num">{vm.empresa.codigo ?? '—'}</b>
            <span className="cad-janela-nome">{vm.empresa.nome}</span>
            {vm.regime && <span className="badge badge-neutral cad-regime">{vm.regime}</span>}
            {vm.resumo.cnpj && <span className="fraco num">{vm.resumo.cnpj}</span>}
          </span>
          <button type="button" className="btn btn-ghost cad-janela-x" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)">
            <Icone nome="x" />
          </button>
        </header>
        <div className="cad-janela-corpo">
          <nav ref={abasInd} className="cad-janela-abas com-indicador" aria-label="Abas da empresa">
            {vm.abas.map((a, i) => (
              <Fragment key={a.id}>
                {/* o nome do grupo, quando muda (Dados · Bancos · Contabilidade · Acessos · Registro) */}
                {(i === 0 || vm.abas[i - 1].grupo !== a.grupo) && <span className="cad-janela-grupo">{a.grupo}</span>}
                <button type="button" className={'cad-janela-aba' + (a.ativa ? ' ativa' : '')} aria-current={a.ativa ? 'page' : undefined}
                  onClick={() => vm.irPara(a.id)} title={a.pendente ? (a.pendente === 1 ? 'Falta 1 item' : 'Faltam ' + a.pendente + ' itens') : undefined}>
                  <Icone nome={a.icone} />{a.rotulo}
                  {a.pendente > 0 && <span className="cad-janela-pendente" aria-label={'faltam ' + a.pendente}>{a.pendente}</span>}
                </button>
              </Fragment>
            ))}
          </nav>
          <div ref={conteudoDaAba} className="cad-janela-conteudo">
            {vm.aba === 'empresa' && <ResumoDoCadastro vm={vm} />}
            <Aba rota={rota} aba={vm.aba} />
          </div>
        </div>
      </div>
    </div>
  );
}
