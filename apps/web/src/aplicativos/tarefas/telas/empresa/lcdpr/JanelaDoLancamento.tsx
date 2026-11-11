// A janela de um lançamento do LCDPR (11/11/2026). Os campos são os da "Lançamentos (Cadastramento)" do LCDPR do
// Alterdata; o desenho segue as telas de despesa do QuickBooks, da Conta Azul e do Aegro ("ainda to achando feio,
// consegue pesquisar outros sistemas que fazem isso e usar como base?"; "não pode ter scroll pra baixo"): à esquerda, o
// valor grande com a data e o documento; o "Pago com" em botões só com o logo de cada banco (a conta credora; o nome na dica); a categoria
// (o lançamento automático) com a conta devedora; o fornecedor; o histórico; o imóvel e os tipos. À direita, o resumo de
// como o lançamento vai para a planilha (débito, crédito, valor, histórico) e o que falta. Nas lupas, o código, a lupa e
// o nome numa caixa cinza; a lupa troca o corpo pela pesquisa (Esc volta). No rodapé, Excluir (o lançamento à mão),
// Cancelar e Gravar (Ctrl+Enter).
import { BotaoFechar, Icone, LogoBanco, useJanela } from '@nads/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import { useJanelaDoLancamento, type CampoDaPesquisa } from './useJanelaDoLancamento';

/** Um campo com o rótulo em cima. */
function Campo({ rotulo, para, className, children }: { rotulo: string; para?: string; className?: string; children: ReactNode }) {
  return (
    <div className={'lcdpr-campo' + (className ? ' ' + className : '')}>
      <label className="lcdpr-rotulo" htmlFor={para}>{rotulo}</label>
      {children}
    </div>
  );
}

/** Uma linha do resumo (o rótulo e o valor; vazio, o traço). */
function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="lcdpr-resumo-linha">
      <span>{rotulo}</span>
      <b className={valor ? '' : 'vazio'}>{valor || '—'}</b>
    </div>
  );
}

export function JanelaDoLancamento({ id, fechar }: { id: number | 'novo'; fechar: () => void }) {
  const vm = useJanelaDoLancamento(id, fechar);
  const janela = useRef<HTMLDivElement>(null);
  // o Esc da pesquisa volta para o lançamento (o da janela fecha)
  useJanela(janela, vm.pesquisa ? vm.fecharPesquisa : fechar);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); vm.salvar(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  if (vm.sumiu) return null;
  const r = vm.rascunho;
  const z = vm.resumo;

  /** o código, a lupa e o nome */
  const comLupa = (campo: CampoDaPesquisa, rotulo: string) => (
    <span className="lcdpr-codigo">
      <input id={'lcdpr-' + campo} type="text" className="lcdpr-cod" value={r[campo]} aria-label={rotulo} autoComplete="off" inputMode={campo === 'imovel' ? undefined : 'numeric'}
        onChange={e => vm.mudar(campo, e.target.value)} onKeyDown={e => { if (e.key === 'F2' || (e.key === 'Enter' && !r[campo])) { e.preventDefault(); vm.abrirPesquisa(campo); } }} />
      <button type="button" className="lcdpr-lupa" title={'Pesquisar ' + rotulo.toLowerCase() + ' (F2)'} aria-label={'Pesquisar ' + rotulo.toLowerCase()} onClick={() => vm.abrirPesquisa(campo)}>
        <Icone nome="search" />
      </button>
      <span className={'lcdpr-cod-nome' + (vm.nomes[campo] ? '' : ' vazio')} title={vm.nomes[campo]}>{vm.nomes[campo] || (r[campo] ? 'Não está na lista' : 'Pesquise pela lupa (F2)')}</span>
    </span>
  );

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo lcdpr-janela" role="dialog" aria-modal="true" aria-label={vm.novo ? 'Novo lançamento' : 'Lançamento'}>
        <header className="registro-topo">
          <span className="registro-caminho">
            <Icone nome="recibo" />LCDPR<Icone nome="chevronRight" />
            {vm.pesquisa ? <><button type="button" className="btn btn-ghost lcdpr-volta" onClick={vm.fecharPesquisa}>{vm.novo ? 'Novo lançamento' : 'Lançamento'}</button><Icone nome="chevronRight" /><b>{vm.pesquisa.titulo}</b></>
              : <b>{vm.novo ? 'Novo lançamento' : 'Lançamento'}</b>}
          </span>
          <span className="lcdpr-janela-origem">
            {vm.revisar ? <span className="badge badge-warn">REVISAR</span> : <span className="badge badge-neutral">{vm.origem}</span>}
          </span>
          <BotaoFechar onClick={fechar} />
        </header>

        {vm.pesquisa ? (
          <div className="registro-corpo lcdpr-pesquisa">
            <label className="busca-curta lcdpr-pesquisa-busca">
              <Icone nome="search" />
              <input type="text" autoFocus placeholder="Digite o código ou parte do nome…" aria-label="Pesquisar" value={vm.pesquisa.termo} onChange={e => vm.setTermo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const p = vm.pesquisa?.itens.find(i => !i.sintetica); if (p) { e.preventDefault(); vm.escolher(p.codigo); } } }} />
            </label>
            <div className="lcdpr-pesquisa-lista" role="listbox" aria-label={vm.pesquisa.titulo}>
              <div className="lcdpr-pesquisa-cabeca" aria-hidden="true">{vm.pesquisa.cabeca.map((c, k) => <span key={k}>{c}</span>)}</div>
              {vm.pesquisa.itens.map(i => (
                <button key={i.codigo} type="button" role="option" aria-selected={i.atual} disabled={i.sintetica}
                  className={'lcdpr-pesquisa-linha' + (i.sintetica ? ' sintetica' : '') + (i.atual ? ' atual' : '')} onClick={() => vm.escolher(i.codigo)}>
                  <span className="num">{i.codigo}</span>
                  <span className="num" title={i.detalhe}>{i.detalhe || ''}</span>
                  <span className="lcdpr-pesquisa-nome" title={i.nome}>{i.nome}</span>
                  <span>{i.tipo}</span>
                </button>
              ))}
              {!vm.pesquisa.itens.length && <p className="registro-dica">Nada com "{vm.pesquisa.termo}".</p>}
            </div>
            <p className="registro-dica">{vm.pesquisa.total} registro(s) encontrado(s){vm.pesquisa.total > vm.pesquisa.itens.length ? ' · digite para achar os outros' : ''}</p>
          </div>
        ) : (
          <div className="registro-corpo lcdpr-corpo">
            <div className="lcdpr-form">
              <div className="lcdpr-grade">
                <Campo rotulo="Valor" para="lcdpr-valor" className="c-5">
                  <span className="lcdpr-adorno lcdpr-adorno-grande"><b>R$</b>
                    <input id="lcdpr-valor" type="text" className="lcdpr-valor" value={r.valor} placeholder="0,00" inputMode="decimal" autoComplete="off" autoFocus={vm.novo} onChange={e => vm.mudar('valor', e.target.value)} />
                  </span>
                </Campo>
                <Campo rotulo="Data" para="lcdpr-data" className="c-4">
                  <span className="lcdpr-adorno"><Icone nome="calendar" />
                    <input id="lcdpr-data" type="text" value={r.data} placeholder="dd/mm/aaaa" inputMode="numeric" autoComplete="off" onChange={e => vm.mudar('data', e.target.value)} />
                  </span>
                </Campo>
                <Campo rotulo="Documento" para="lcdpr-documento" className="c-3">
                  <input id="lcdpr-documento" type="text" value={r.documento} placeholder="Nº da nota" autoComplete="off" onChange={e => vm.mudar('documento', e.target.value)} />
                </Campo>

                <div className="lcdpr-campo c-12" role="group" aria-label="Pago com">
                  <span className="lcdpr-rotulo">Pago com · conta credora</span>
                  <div className="lcdpr-pagar">
                    {vm.pagamentos.map(p => (
                      <button key={p.codigo} type="button" className={'lcdpr-pagar-opcao' + (p.atual ? ' atual' : '')} aria-pressed={p.atual} aria-label={p.codigo + ' — ' + p.nome}
                        onClick={() => vm.pagarCom(p.codigo)} title={p.codigo + ' — ' + p.nome}>
                        <span className="lcdpr-pagar-logo">{p.marca ? <LogoBanco banco={p.marca} cor /> : <Icone nome="dinheiro" />}</span>
                      </button>
                    ))}
                    <button type="button" className={'lcdpr-pagar-opcao outra' + (vm.pagamentoFora ? ' atual' : '')} onClick={() => vm.abrirPesquisa('contaCred')}
                      aria-label="Outra conta do plano" title={vm.pagamentoFora ? r.contaCred + ' — ' + (vm.nomes.contaCred || 'outra conta') : 'Outra conta do plano (F2)'}>
                      <span className="lcdpr-pagar-logo"><Icone nome="search" /></span>
                    </button>
                  </div>
                </div>

                <Campo rotulo="Categoria · lançamento automático" para="lcdpr-automatico" className="c-5">
                  <select id="lcdpr-automatico" value={r.automatico} onChange={e => vm.escolherAutomatico(e.target.value)}>
                    <option value="">— escolher —</option>
                    {vm.automaticos.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Conta devedora" para="lcdpr-contaDeved" className="c-7">{comLupa('contaDeved', 'Conta devedora')}</Campo>

                <Campo rotulo="Fornecedor" para="lcdpr-fornecedor" className="c-5">
                  <input id="lcdpr-fornecedor" type="text" value={r.fornecedor} autoComplete="off" onChange={e => vm.mudar('fornecedor', e.target.value)} />
                </Campo>
                <Campo rotulo="CPF/CNPJ" para="lcdpr-cnpj" className="c-3">
                  <input id="lcdpr-cnpj" type="text" value={r.cnpj} inputMode="numeric" autoComplete="off" onChange={e => vm.mudar('cnpj', e.target.value)} />
                </Campo>
                <Campo rotulo="Produto(s)" para="lcdpr-produto" className="c-4">
                  <input id="lcdpr-produto" type="text" value={r.produto} autoComplete="off" onChange={e => vm.mudar('produto', e.target.value)} />
                </Campo>

                <Campo rotulo="Histórico padrão" para="lcdpr-codHist" className="c-5">{comLupa('codHist', 'Histórico padrão')}</Campo>
                <Campo rotulo="Histórico" para="lcdpr-historico" className="c-7">
                  <input id="lcdpr-historico" type="text" value={r.historico} autoComplete="off" onChange={e => vm.mudar('historico', e.target.value)} />
                </Campo>

                <Campo rotulo="Imóvel" para="lcdpr-imovel" className="c-5">{comLupa('imovel', 'Imóvel')}</Campo>
                <Campo rotulo="Tipo de documento" para="lcdpr-tipoDoc" className="c-3">
                  <select id="lcdpr-tipoDoc" value={r.tipoDoc} onChange={e => vm.mudar('tipoDoc', e.target.value)}>
                    {!vm.tiposDoc.some(t => t.valor === r.tipoDoc) && <option value={r.tipoDoc}>{r.tipoDoc}</option>}
                    {vm.tiposDoc.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Tipo de lançamento" para="lcdpr-tipoLanc" className="c-4">
                  <select id="lcdpr-tipoLanc" value={r.tipoLanc} onChange={e => vm.mudar('tipoLanc', e.target.value)}>
                    {!vm.tiposLanc.some(t => t.valor === r.tipoLanc) && <option value={r.tipoLanc}>{r.tipoLanc}</option>}
                    {vm.tiposLanc.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                  </select>
                </Campo>
              </div>
            </div>

            <aside className="lcdpr-resumo" aria-label="Resumo do lançamento">
              <span className="lcdpr-rotulo">Vai para o LCDPR assim</span>
              <b className="lcdpr-resumo-valor num">{z.valor}</b>
              <span className="lcdpr-resumo-data">{z.data || 'sem data'}</span>
              <div className="lcdpr-partida">
                <div className="lcdpr-partida-linha"><span className="lcdpr-partida-dc debito">D</span><span className={z.debito ? '' : 'vazio'}>{z.debito || 'Conta devedora'}</span></div>
                <div className="lcdpr-partida-linha"><span className="lcdpr-partida-dc credito">C</span><span className={z.credito ? '' : 'vazio'}>{z.credito || 'Conta credora'}</span></div>
              </div>
              <p className={'lcdpr-resumo-historico' + (z.historico ? '' : ' vazio')}>{z.historico || 'O histórico aparece aqui.'}</p>
              <Linha rotulo="Fornecedor" valor={z.fornecedor} />
              <Linha rotulo="Imóvel" valor={z.imovel} />
              <Linha rotulo="Tipos" valor={z.tipos} />
              <span className="tarefas-barra-espaco" />
              {vm.faltam.length > 0 ? (
                <p className={'lcdpr-resumo-falta' + (vm.problemas.length ? ' erro' : '')}><Icone nome="alert" />Falta {vm.faltam.join(', ')}.</p>
              ) : <p className="lcdpr-resumo-ok"><Icone nome="checkCircle" />Pronto para gravar.</p>}
              <span className="lcdpr-resumo-dica">F2 pesquisa · Ctrl+Enter grava · {vm.origemDasContas}{vm.ncm ? ' · NCM ' + vm.ncm : ''}</span>
            </aside>
          </div>
        )}

        <footer className="registro-pe">
          {vm.podeExcluir && !vm.pesquisa && <button type="button" className="btn btn-ghost" onClick={() => void vm.excluir()}><Icone nome="lixeira" />Excluir</button>}
          <span className="tarefas-barra-espaco" />
          {vm.pesquisa ? <button type="button" className="btn btn-outline" onClick={vm.fecharPesquisa}>Cancelar</button> : <>
            <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={vm.salvar} title="Gravar (Ctrl+Enter)"><Icone nome="check" />Gravar</button>
          </>}
        </footer>
      </div>
    </div>
  );
}
