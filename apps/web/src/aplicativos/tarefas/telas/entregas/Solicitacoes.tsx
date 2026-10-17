// Entregas › Solicitações (16/10/2026, a cópia fiel das Solicitações do Entregas: "cadê as solicitações"), na posição da
// aba de lá (depois do Painel). Os tópicos da janela de Solicitações do Entregas nas abas sublinhadas do nads — Nova
// solicitação, Pendentes (com o número; destacado quando há urgente) e Concluídas — e a busca no alto. As peças: cartão,
// configuração em linhas, seleção, data, segmentado, busca de cliente com lista, selo, vazio.
import { BotaoAcao, CampoData, ConfigLinha, Esqueleto, Icone, Segmentado, Vazio, useCarregando } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { FaixaDasGravacoes } from './FaixaDasGravacoes';
import { useSolicitacoes } from './useSolicitacoes';

type Vm = ReturnType<typeof useSolicitacoes>;
type Linha = Vm['urgentes'][number];

const PRIORIDADES: { valor: 'normal' | 'urgente'; rotulo: string }[] = [{ valor: 'normal', rotulo: 'Normal' }, { valor: 'urgente', rotulo: 'Urgente' }];

export function Solicitacoes() {
  const vm = useSolicitacoes();
  useCarregando(vm.carregando);
  return (
    <section className="ent-tela">
      <FaixaDasGravacoes />
      <div className="tarefas-barra-topo ent-filtros">
        <label className="busca-curta larga"><Icone nome="search" />
          <input type="text" placeholder="Buscar solicitações" aria-label="Buscar solicitações" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
      </div>
      <nav className="menu ent-categorias" role="tablist" aria-label="Solicitações">
        {vm.topicos.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={vm.topico === t.id} className={'menu-item' + (vm.topico === t.id ? ' active' : '')} onClick={() => vm.setTopico(t.id)}>
            <Icone nome={t.icone} /><span>{t.rotulo}</span>{t.n > 0 && <span className={'menu-contador' + (t.urgente ? ' ent-urgente' : '')}>{t.n}</span>}
          </button>
        ))}
      </nav>
      {vm.topico === 'nova' && <NovaSolicitacao vm={vm} />}
      {vm.topico === 'pendentes' && <Pendentes vm={vm} />}
      {vm.topico === 'concluidas' && <Concluidas vm={vm} />}
    </section>
  );
}

function Pedido({ l, vm }: { l: Linha; vm: Vm }) {
  return (
    <li>
      <div className="ent-pedido"><b>{l.titulo}</b><span className="fraco">{l.apoio}</span>
        <span className={'fraco num' + (l.atrasada ? ' ent-atrasada' : '')}>{l.datas}</span>
        {l.concluida && <span className="fraco">{l.concluida}</span>}</div>
      {l.s.status === 'concluida' ? <span className="badge badge-ok">Concluída</span> : <>
        {l.atrasada && <span className="badge badge-danger">Atrasada</span>}
        {l.podeConcluir && <button type="button" className="btn btn-outline" disabled={l.concluindo} onClick={() => void vm.concluir(l.s.id)}><Icone nome="check" />Concluir</button>}
      </>}
    </li>
  );
}

function Cartao({ titulo, lista, vm, n }: { titulo: string; lista: Linha[]; vm: Vm; n?: number }) {
  if (!lista.length) return null;
  return (
    <section className="card ent-cartao">
      <div className="card-head"><h3>{titulo}</h3>{n != null && <span className="badge badge-warn">{n}</span>}</div>
      <ul className="ent-linhas">{lista.map(l => <Pedido key={l.s.id} l={l} vm={vm} />)}</ul>
    </section>
  );
}

function Pendentes({ vm }: { vm: Vm }) {
  return (
    <>
      <p className="hint ent-sol-sub">{vm.subPendentes}{vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}</p>
      {vm.carregando ? <Esqueleto linhas={4} /> : vm.erroDaLista ? <Vazio icone="alert" texto={vm.erroDaLista} /> : vm.nenhumaPendente ? (
        <Vazio icone="checkCircle" texto="Nenhuma solicitação pendente."><button type="button" className="btn btn-primary" onClick={() => vm.setTopico('nova')}><Icone nome="plus" />Nova solicitação</button></Vazio>
      ) : !vm.urgentes.length && !vm.outras.length ? <Vazio texto="Nada encontrado nas pendentes." /> : <>
        <Cartao titulo="Urgentes" lista={vm.urgentes} vm={vm} n={vm.urgentes.length} />
        <Cartao titulo={vm.urgentes.length ? 'As outras' : 'Na fila, pelo prazo'} lista={vm.outras} vm={vm} />
      </>}
    </>
  );
}

function Concluidas({ vm }: { vm: Vm }) {
  return (
    <>
      <p className="hint ent-sol-sub">{vm.subConcluidas}{vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}</p>
      {!vm.concluidas ? <Esqueleto linhas={4} /> : vm.erroConcluidas ? <Vazio icone="alert" texto={vm.erroConcluidas} /> : !vm.concluidas.length
        ? <Vazio icone={vm.busca ? 'search' : 'caixaEntrada'} texto={vm.busca ? 'Nada encontrado nas concluídas.' : 'Nenhuma solicitação concluída ainda.'} />
        : <Cartao titulo={'Últimas ' + vm.concluidas.length} lista={vm.concluidas} vm={vm} />}
    </>
  );
}

function NovaSolicitacao({ vm }: { vm: Vm }) {
  const caixa = useRef<HTMLDivElement>(null);
  const descricao = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!window.matchMedia?.('(hover: none)').matches) descricao.current?.focus(); }, []);
  useEffect(() => {
    if (!vm.listaEmpresa) return;
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) vm.fecharListaEmpresa(); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [vm]);
  const atestado = vm.tipo === 'atestado';
  return (
    <form className="card ent-cartao" noValidate onSubmit={e => { e.preventDefault(); void vm.enviar(); }}>
      <div className="card-head"><h3><Icone nome="lapis" width={16} height={16} /> O pedido</h3></div>
      <p className="hint ent-sol-sub">Peça pra equipe entregar, buscar ou resolver algo na rua.{vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}</p>
      <ConfigLinha titulo="Tipo" descricao="O que precisa ser feito.">
        <select className="ent-campo-curto" aria-label="Tipo" value={vm.tipo} onChange={e => vm.setTipo(e.target.value as typeof vm.tipo)}>
          {vm.tipos.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      </ConfigLinha>
      {atestado && <>
        <ConfigLinha titulo="Clínica" descricao="Onde o atestado vai ser buscado.">
          <select className="ent-campo-curto" aria-label="Clínica" value={vm.clinica} onChange={e => vm.setClinica(e.target.value)}>
            {vm.clinicas.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </ConfigLinha>
        <ConfigLinha titulo="Funcionário" descricao="Nome de quem fez o exame.">
          <input type="text" className="ent-campo-curto" aria-invalid={vm.erro.campo === 'funcionario' || undefined} placeholder="Nome do funcionário" aria-label="Funcionário" autoComplete="off" value={vm.funcionario} onChange={e => vm.setFuncionario(e.target.value)} />
        </ConfigLinha>
        <ConfigLinha titulo="Empresa cliente" descricao="A empresa do funcionário.">
          <div className="ent-combo ent-campo-curto" ref={caixa}>
            <input type="text" aria-invalid={vm.erro.campo === 'empresa' || undefined} placeholder="Buscar por nome, código ou CNPJ" aria-label="Empresa cliente" autoComplete="off"
              role="combobox" aria-expanded={vm.listaEmpresa} aria-controls="ent-sol-empresas" value={vm.buscaEmpresa}
              onChange={e => vm.digitarEmpresa(e.target.value)} onFocus={vm.abrirListaEmpresa}
              onKeyDown={e => { if (e.key === 'Escape' && vm.listaEmpresa) { e.preventDefault(); e.stopPropagation(); vm.fecharListaEmpresa(); } }} />
            {vm.listaEmpresa && (
              <ul className="nf-achados ent-achados" id="ent-sol-empresas" role="listbox" aria-label="Clientes encontrados">
                {vm.achadas.map(a => (
                  <li key={a.c.id}><button type="button" role="option" aria-selected={false} className="popover-item" onClick={() => vm.escolherEmpresa(a.c)}>
                    <span className="popover-texto">{a.nome}</span>{a.doc && <span className="popover-dica">{a.doc}</span>}</button></li>
                ))}
              </ul>
            )}
          </div>
        </ConfigLinha>
      </>}
      {!atestado && <>
        <ConfigLinha titulo="Cliente ou local" descricao="Opcional. Ex.: Cartório, Prefeitura, nome do cliente.">
          <input type="text" className="ent-campo-curto" placeholder="Cliente ou local" aria-label="Cliente ou local" autoComplete="off" value={vm.local} onChange={e => vm.setLocal(e.target.value)} />
        </ConfigLinha>
        <div className="field ent-sol-descricao">
          <label htmlFor="ent-sol-descricao">Descrição</label>
          <textarea id="ent-sol-descricao" ref={descricao} rows={3} aria-invalid={vm.erro.campo === 'descricao' || undefined} placeholder="O que precisa ser feito" value={vm.descricao} onChange={e => vm.setDescricao(e.target.value)} />
        </div>
      </>}
      <ConfigLinha titulo="Concluir até" descricao="Data máxima pra ficar pronto.">
        <CampoData valor={vm.prazo} onMudar={vm.setPrazo} rotulo="Concluir até" />
      </ConfigLinha>
      <ConfigLinha titulo="Prioridade" descricao="Urgente aparece em cima da fila.">
        <Segmentado valor={vm.urgente ? 'urgente' : 'normal'} opcoes={PRIORIDADES} onMudar={v => vm.setUrgente(v === 'urgente')} />
      </ConfigLinha>
      <div className="ent-sol-pe">
        {vm.erro.texto && <p className="registro-dica registro-dica-erro" role="alert"><Icone nome="alert" />{vm.erro.texto}</p>}
        <span className="tarefas-barra-espaco" />
        <BotaoAcao type="submit" className="btn btn-primary" carregando={vm.enviando} textoCarregando="Enviando…"><Icone nome="envelope" />Enviar solicitação</BotaoAcao>
      </div>
    </form>
  );
}
