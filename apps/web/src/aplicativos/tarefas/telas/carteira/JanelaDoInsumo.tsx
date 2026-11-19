// A janela de registrar (ou mudar) um insumo (12/11/2026), no desenho das janelas da Carteira: o tipo (impressão, envelope ou
// caixa), a data, o cliente (do Cadastro, pela busca, como no Novo ticket do Mandei; ou avulso, só o nome) e a quantidade.
import { carteira, formatos } from '@nads/core';
import { BotaoFechar, CampoDataComCalendario, Icone, MenuSuspenso, useJanela } from '@nads/ui';

const ESCOLHA = 'btn btn-ghost registro-escolha';
import { useEffect, useRef } from 'react';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { useJanelaDoInsumo } from './useInsumos';

export function JanelaDoInsumo({ insumo, fechar }: { insumo: carteira.Insumo | null; fechar: () => void }) {
  const vm = useJanelaDoInsumo(insumo, fechar);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const titulo = insumo ? 'Mudar registro' : 'Registrar insumo';
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.salvar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="impressora" />Insumos<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        {/* no desenho da janela da comissão (Vitor, 19/11/2026: "organiza essa tela, pique das comissoes"): a data com o calendário, o cliente
            no menu com a busca e o avulso, o insumo no menu, a quantidade e, no alto à direita, o valor */}
        <div className="registro-corpo comissao-com-destaque">
          <div className="comissao-destaque">
            <span>{vm.vePreco ? 'Valor' : 'Quantidade'}</span>
            <b className="num" aria-live="polite">{vm.vePreco ? formatos.reais(vm.valor) : vm.qtd.toLocaleString('pt-BR')}</b>
            {vm.nomeDoTipo && <span className="insumo-destaque-conta">{vm.qtd.toLocaleString('pt-BR')} × {vm.nomeDoTipo}{vm.vePreco && vm.preco ? ' de ' + formatos.reais(vm.preco) : ''}</span>}
          </div>
          <div className="registro-props">
            <Propriedade icone="calendar" rotulo="Data"><CampoDataComCalendario valor={vm.data} onMudar={vm.setData} rotulo="Data" /></Propriedade>
            <Propriedade icone="predio" rotulo="Cliente">
              {/* do Cadastro (pela busca) ou avulso, no mesmo menu (13/11/2026: "ele tem que selecionar um cliente registrado ou avulso") */}
              <MenuSuspenso rotulo={vm.avulso ? 'Cliente avulso' : vm.cliente || 'Escolher o cliente'} className={ESCOLHA + (vm.avulso || vm.cliente ? '' : ' vazio')} titulo="O cliente" flutuante largura={380}
                conteudo={fecharMenu => (
                  <>
                    <label className="busca-curta larga">
                      <Icone nome="search" />
                      <input type="text" placeholder="Buscar pelo nome ou código" aria-label="Buscar o cliente" value={vm.busca} onChange={e => vm.setBusca(e.target.value)}
                        ref={el => { if (el && document.activeElement !== el) setTimeout(() => el.focus(), 0); }} />
                    </label>
                    <div className="menu-busca-lista">
                      <button type="button" className="popover-item" role="menuitemcheckbox" aria-checked={vm.avulso} onClick={() => { vm.setAvulso(true); fecharMenu(); }}>
                        <span className="popover-marca">{vm.avulso && <Icone nome="check" />}</span>
                        <span className="popover-texto"><b>Cliente avulso</b><br /><span className="hint">Não está no cadastro: escreva o nome</span></span>
                      </button>
                      {vm.achadas.map(e => (
                        <button key={(e.codigo ?? '') + e.nome} type="button" className="popover-item" role="menuitemcheckbox" aria-checked={!vm.avulso && vm.cliente.endsWith(e.nome)}
                          onClick={() => { vm.setAvulso(false); vm.escolherCliente(e); fecharMenu(); }}>
                          <span className="popover-marca">{!vm.avulso && vm.cliente.endsWith(e.nome) && <Icone nome="check" />}</span>
                          <span className="popover-texto">{e.codigo != null && <b className="num">{e.codigo} </b>}{e.nome}</span>
                        </button>
                      ))}
                      {!vm.achadas.length && <p className="hint">Nenhuma empresa com esse nome ou código.</p>}
                    </div>
                  </>
                )} />
            </Propriedade>
            {vm.avulso && (
              <Propriedade icone="fileText" rotulo="Nome">
                <input type="text" value={vm.nomeAvulso} autoFocus maxLength={150} placeholder="O nome do cliente" aria-label="O nome do cliente avulso" onChange={e => vm.setNomeAvulso(e.target.value)} />
              </Propriedade>
            )}
            <Propriedade icone="list" rotulo="Insumo">
              {/* os insumos da lista do Financeiro, num menu (15/11/2026: "o usuário só registra o tipo e quantidade") */}
              <MenuSuspenso rotulo={vm.nomeDoTipo || 'Escolher o insumo'} className={ESCOLHA + (vm.nomeDoTipo ? '' : ' vazio')} flutuante largura={240} titulo="O insumo"
                itens={vm.tipos.map(t => ({ rotulo: t.rotulo, marcado: t.valor === vm.tipo, onClick: () => vm.setTipo(t.valor) }))} />
            </Propriedade>
            <Propriedade icone="hash" rotulo="Quantidade">
              <input type="text" inputMode="numeric" className="insumo-qtd" autoFocus={!insumo} value={vm.quantidade} onChange={e => vm.setQuantidade(e.target.value)} placeholder="0" aria-label="Quantidade" />
            </Propriedade>
          </div>
          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
          {insumo && <button type="button" className="btn btn-outline btn-danger" onClick={() => void vm.apagar()}><Icone nome="lixeira" />Apagar</button>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando} onClick={() => void vm.salvar()} title="Gravar (Ctrl+Enter)"><Icone nome="check" />{insumo ? 'Gravar' : 'Registrar'}</button>
        </footer>
      </div>
    </div>
  );
}
