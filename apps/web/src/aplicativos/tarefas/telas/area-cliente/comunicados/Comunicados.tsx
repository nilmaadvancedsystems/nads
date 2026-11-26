// Área do Cliente › Comunicados, refeita em 26/11/2026 ("quero que esse modulo seja completamente refeito… o mais bonito e
// de facil entendimento possivel"). Os avisos do escritório aos clientes (recesso, prazo, mudança de lei), para todos, um
// regime ou empresas escolhidas, com o período. Com as peças do nads ("essas telas… ta toda fora dos elementos
// predefinidos do nads"): a barra com o Segmentado e a busca, a tabela padrão e o modal com os campos (field), os chips, a
// busca de cliente com lista e o campo de data com calendário; ao lado, como o cliente vê. Só desenha.
import { CampoDataComCalendario, Esqueleto, Icone, Segmentado, Vazio, useCarregando } from '@nads/ui';
import { useState } from 'react';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { AvisosDaArea, JanelaPequena, Selo } from '../base/Base';
import { BuscaDeEmpresa } from '../base/BuscaDeEmpresa';
import { useComunicados, type VmDosComunicados } from './useComunicados';

export function Comunicados() {
  const vm = useComunicados();
  useCarregando(vm.carregando);
  return (
    <section>
      <AvisosDaArea exemplos={vm.exemplos} erro={vm.erroDaLista} oQue="os comunicados" />
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        <MenuDeFiltro rotulo="Situação" todos={'Todos (' + (vm.filtros.find(f => f.valor === 'todos')?.conta ?? 0) + ')'}
          valor={vm.filtro === 'todos' ? '' : vm.filtro} mudar={v => vm.setFiltro((v || 'todos') as typeof vm.filtro)}
          opcoes={vm.filtros.filter(f => f.valor !== 'todos').map(f => ({ valor: f.valor, rotulo: f.rotulo + ' (' + f.conta + ')' }))} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Buscar comunicado" aria-label="Buscar comunicado" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        {vm.podeEditar && <button type="button" className="btn btn-primary" onClick={vm.novo}><Icone nome="plus" width={16} height={16} />Novo comunicado</button>}
      </div>
      <p className="hint" style={{ margin: '-8px 0 12px' }}>
        O aviso aparece no sino da Área do Cliente das empresas escolhidas, só dentro do período.{!vm.podeEditar && ' Só o admin e os diretores publicam.'}
      </p>

      {vm.carregando ? <Esqueleto linhas={4} />
        : !vm.total ? (
          <Vazio icone="sino" titulo="Nenhum comunicado ainda" texto="Avise os clientes de um recesso, de um prazo ou de uma mudança de lei. Eles veem no sino da Área do Cliente." />
        ) : !vm.linhas.length ? (
          <Vazio icone="search" titulo="Nada por aqui" texto={vm.busca ? 'Nenhum comunicado com "' + vm.busca + '" neste filtro.' : 'Nenhum comunicado nesta situação.'}>
            <button type="button" className="btn" onClick={() => { vm.setBusca(''); vm.setFiltro('todos'); }}>Ver todos</button>
          </Vazio>
        ) : (
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Comunicado</th><th>Para quem</th><th>Período</th><th>Situação</th><th>Por</th></tr></thead>
              <tbody>
                {vm.linhas.map(c => (
                  <tr key={c.id} className="linha-abre" tabIndex={0} onClick={c.abrir} onKeyDown={e => { if (e.key === 'Enter') c.abrir(); }}>
                    <td className="wrap"><b>{c.titulo}</b><span className="hint" style={{ display: 'block' }}>{c.texto.length > 90 ? c.texto.slice(0, 90) + '…' : c.texto}</span></td>
                    <td className="wrap" title={c.paraQuemDica}>{c.paraQuem}</td>
                    <td className="fraco">{c.periodo}</td>
                    <td><Selo tom={c.tom}>{c.situacao}</Selo></td>
                    <td className="fraco">{c.por}{c.quando && <span className="hint" style={{ display: 'block' }}>{c.quando}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {vm.aberto && <JanelaDoComunicado vm={vm} />}
    </section>
  );
}

/** 'AAAA-MM-DD' ↔ 'dd/mm/aaaa' (o campo de data do nads é dd/mm/aaaa) */
const paraTela = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const paraIso = (br: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(br) ? br.slice(6, 10) + '-' + br.slice(3, 5) + '-' + br.slice(0, 2) : null);

/** O campo de data do nads (com o calendário) guardando o dia como 'AAAA-MM-DD'. */
function CampoDia({ rotulo, iso, onMudar, id }: { rotulo: string; iso: string; onMudar: (iso: string) => void; id: string }) {
  const [texto, setTexto] = useState(paraTela(iso));
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor={id}>{rotulo}</label>
      <CampoDataComCalendario id={id} rotulo={rotulo} valor={texto} onMudar={v => { setTexto(v); const i = paraIso(v); if (i) onMudar(i); else if (!v) onMudar(''); }} />
    </div>
  );
}

function JanelaDoComunicado({ vm }: { vm: VmDosComunicados }) {
  const f = vm.form;
  const so = vm.somenteLeitura;
  return (
    <JanelaPequena larga titulo={vm.tituloDaJanela} sub={vm.subDaJanela} onFechar={vm.fechar}
      rodape={so
        ? <button type="button" className="btn btn-outline" onClick={vm.fechar}>Fechar</button>
        : <>
            {vm.editando && <button type="button" className="btn btn-danger area-esquerda" onClick={() => void vm.apagar()} disabled={vm.gravando}><Icone nome="lixeira" width={16} height={16} />Apagar</button>}
            <button type="button" className="btn btn-primary" onClick={() => void vm.salvar()} disabled={vm.gravando}>{vm.gravando ? 'Gravando…' : vm.editando ? 'Salvar' : 'Publicar'}</button>
            <button type="button" className="btn btn-outline" onClick={vm.fechar} disabled={vm.gravando}>Cancelar</button>
          </>}>
      <div className="area-duas">
        <fieldset disabled={so} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {so && <p className="hint"><Icone nome="lock" width={12} height={12} /> Só o admin e os diretores mudam os comunicados. Aqui é só para ler.</p>}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="com-titulo">Título</label>
            <input id="com-titulo" type="text" maxLength={vm.limiteDoTitulo} value={f.titulo} onChange={e => vm.mudar({ titulo: e.target.value })} placeholder="Ex.: Recesso de fim de ano" autoFocus={!so} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="com-texto">Texto <span className="hint" style={{ fontWeight: 400 }}>· {f.texto.length}/{vm.limiteDoTexto}</span></label>
            <textarea id="com-texto" rows={5} maxLength={vm.limiteDoTexto} value={f.texto} onChange={e => vm.mudar({ texto: e.target.value })} placeholder="O que o cliente precisa saber, em poucas linhas." />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <span className="field-rotulo">Para quem</span>
            <Segmentado valor={f.tipo} onMudar={v => vm.mudar({ tipo: v })} opcoes={[{ valor: 'todos', rotulo: 'Todos os clientes' }, { valor: 'regimes', rotulo: 'Por regime' }, { valor: 'codigos', rotulo: 'Empresas escolhidas' }]} />
            {f.tipo === 'regimes' && (
              vm.regimes.length
                ? <div className="chip-row" style={{ margin: '8px 0 0' }}>
                    {vm.regimes.map(r => <button key={r} type="button" aria-pressed={f.regimes.includes(r)} className={'chip-f' + (f.regimes.includes(r) ? ' on' : '')} onClick={() => vm.alternarRegime(r)}>{r}</button>)}
                  </div>
                : <p className="hint" style={{ marginTop: 8 }}>Nenhuma empresa com regime no cadastro ainda.</p>
            )}
            {f.tipo === 'codigos' && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!!vm.escolhidas.length && (
                  <div className="chip-row" style={{ margin: 0 }}>
                    {vm.escolhidas.map(e => (
                      <span key={e.codigo} className="chip-f on" title={e.nome}>
                        <b className="num">{e.codigo}</b> {e.nome}
                        {!so && <button type="button" className="janela-x" style={{ width: 20, height: 20 }} aria-label={'Tirar ' + e.nome} onClick={() => vm.tirarEmpresa(e.codigo)}><Icone nome="x" width={12} height={12} /></button>}
                      </span>
                    ))}
                  </div>
                )}
                {!so && <BuscaDeEmpresa empresas={vm.empresasParaEscolher} escolhida={null} excluir={new Set(f.codigos)} onEscolher={e => e && vm.escolherEmpresa(e.codigo)} />}
              </div>
            )}
            <p className="hint" style={{ marginTop: 6 }}>{vm.alcance}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CampoDia id="com-de" rotulo="Aparece de" iso={f.publicarEm} onMudar={v => vm.mudar({ publicarEm: v })} />
            <CampoDia id="com-ate" rotulo="Até" iso={f.ate} onMudar={v => vm.mudar({ ate: v })} />
          </div>

          {vm.erro && <p className="hint registro-dica-erro" role="alert">{vm.erro}</p>}
        </fieldset>

        <PreviaDoCliente vm={vm} />
      </div>
    </JanelaPequena>
  );
}

/** Como o cliente vê: o aviso no sino e o comunicado aberto, num cartão do nads. */
function PreviaDoCliente({ vm }: { vm: VmDosComunicados }) {
  const p = vm.previa;
  return (
    <div className="card" style={{ marginBottom: 0 }} aria-label="Como o cliente vê">
      <div className="card-head"><h3><Icone nome="olho" width={16} height={16} /> Como o cliente vê</h3>{p.situacao && <Selo tom={p.situacao.tom}>{p.situacao.rotulo}</Selo>}</div>
      <p className="hint" style={{ marginBottom: 6 }}>No sino da Área do Cliente</p>
      <ul className="ent-linhas" style={{ marginBottom: 16 }}>
        <li><div><b>Comunicado do escritório</b><span className="fraco">{p.titulo}</span></div><Icone nome="sino" width={16} height={16} /></li>
      </ul>
      <p className="hint" style={{ marginBottom: 6 }}>Ao abrir</p>
      <div className="card" style={{ marginBottom: 0 }}>
        <b style={{ display: 'block', marginBottom: 8 }}>{p.titulo}</b>
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.texto}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><span className="btn btn-primary" aria-hidden="true">Entendi</span></div>
      </div>
      {p.quando && <p className="hint" style={{ marginTop: 10 }}>{p.quando}</p>}
    </div>
  );
}
