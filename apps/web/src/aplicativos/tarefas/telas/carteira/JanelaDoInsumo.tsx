// A janela de registrar (ou mudar) um insumo (12/11/2026), no desenho das janelas da Carteira: o tipo (impressão, envelope ou
// caixa), a data, o cliente (do Cadastro, pela busca, como no Novo ticket do Mandei; ou avulso, só o nome) e a quantidade.
import { carteira } from '@nads/core';
import { BotaoFechar, CampoData, Icone, MenuSuspenso, Segmentado, useJanela } from '@nads/ui';
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
        <div className="registro-corpo">
          <div className="registro-props">
            <Propriedade icone="list" rotulo="Insumo">
              {/* os insumos da lista do Financeiro; com muitos, num menu (15/11/2026: "o usuário só registra o tipo e quantidade") */}
              {vm.tipos.length <= 4
                ? <Segmentado valor={vm.tipo} opcoes={vm.tipos} onMudar={vm.setTipo} />
                : <MenuSuspenso rotulo={vm.tipos.find(t => t.valor === vm.tipo)?.rotulo || 'Escolher o insumo'} className="btn btn-outline" flutuante largura={280} titulo="O insumo"
                    itens={vm.tipos.map(t => ({ rotulo: t.rotulo, marcado: t.valor === vm.tipo, onClick: () => vm.setTipo(t.valor) }))} />}
            </Propriedade>
            <Propriedade icone="calendar" rotulo="Data"><CampoData valor={vm.data} onMudar={vm.setData} rotulo="Data" /></Propriedade>
            <Propriedade icone="predio" rotulo="Cliente">
              {/* do Cadastro (pela busca) ou avulso, só com o nome (13/11/2026: "ele tem que selecionar um cliente registrado ou avulso") */}
              <span className="insumo-cliente">
              {vm.avulso ? (
                <input type="text" value={vm.nomeAvulso} autoFocus maxLength={150} placeholder="O nome do cliente" aria-label="O nome do cliente avulso" onChange={e => vm.setNomeAvulso(e.target.value)} />
              ) : (
              <MenuSuspenso rotulo={vm.cliente || 'Escolher o cliente'} icone="briefcase" className="btn btn-outline" largura={420} conteudo={fecharMenu => (
                <div className="imp-cert-busca">
                  <input type="text" className="pessoal-select" autoFocus placeholder="Nome ou código" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} aria-label="Buscar o cliente" />
                  {vm.achadas.map(e => (
                    <button key={(e.codigo ?? '') + e.nome} type="button" className="popover-item" onClick={() => { vm.escolherCliente(e); fecharMenu(); }}>
                      <span className="num fraco">{e.codigo ?? ''}</span><span className="popover-texto">{e.nome}</span>
                    </button>
                  ))}
                  {!vm.achadas.length && <span className="hint" style={{ padding: '4px 8px' }}>Nenhuma empresa com esse nome ou código.</span>}
                </div>
              )} />
              )}
              <label className="tdl-ja-fazendo"><input type="checkbox" checked={vm.avulso} onChange={e => vm.setAvulso(e.target.checked)} />Avulso (não está no cadastro)</label>
              </span>
            </Propriedade>
            <Propriedade icone="hash" rotulo="Quantidade">
              <input type="text" inputMode="numeric" autoFocus={!insumo} value={vm.quantidade} onChange={e => vm.setQuantidade(e.target.value)} placeholder="0" aria-label="Quantidade" />
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
