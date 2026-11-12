// O Novo ticket da Central (11/11/2026): o ticket avulso a partir de um modelo, num cartão em cima da lista. Só desenha:
// o estado e o Mandar vêm do useNovoTicket.
import { Icone, MenuSuspenso, SeletorMes } from '@nads/ui';
import { useNovoTicket } from './useNovoTicket';

export function NovoTicket({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (id: string) => void }) {
  const vm = useNovoTicket(aoCriar);
  return (
    <section className="card" style={{ marginTop: 12 }}>
      <div className="card-head">
        <h3>Novo ticket</h3>
        <span className="card-head-ctl">
          <button type="button" className="icon-btn" onClick={aoFechar} title="Fechar" aria-label="Fechar o novo ticket"><Icone nome="x" /></button>
        </span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* o modelo: cada um com o que costuma pedir */}
        <div className="chip-row" role="radiogroup" aria-label="Modelo do ticket" style={{ margin: 0 }}>
          {vm.modelos.map(x => (
            <button key={x.id} type="button" role="radio" aria-checked={vm.modeloId === x.id} className={'chip-f' + (vm.modeloId === x.id ? ' on' : '')}
              title={x.descricao} onClick={() => vm.setModeloId(x.id)}>{x.nome}</button>
          ))}
        </div>
        <div className="mandei-novo-grade">
          {/* a empresa pela busca (11/11/2026: "pesquisa ruim"): o botão abre o campo com o nome ou o código e a lista */}
          <div className="field" style={{ margin: 0 }}>
            <label>Empresa</label>
            <MenuSuspenso rotulo={vm.empresa || 'Escolher a empresa'} icone="briefcase" className="btn btn-outline nt-empresa" largura={420} conteudo={fechar => (
              <div className="imp-cert-busca">
                <input type="text" className="pessoal-select" autoFocus placeholder="Nome ou código" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} aria-label="Buscar empresa" />
                {vm.achadas.map(e => (
                  <button key={e.codigo + e.nome} type="button" className="popover-item" onClick={() => { vm.escolherEmpresa(e.nome); fechar(); }}>
                    <span className="num fraco">{e.codigo}</span><span className="popover-texto">{e.nome}</span>
                  </button>
                ))}
                {!vm.achadas.length && <span className="hint" style={{ padding: '4px 8px' }}>Nenhuma empresa com esse nome ou código.</span>}
              </div>
            )} />
          </div>
          {/* o mês pela peça do catálogo (11/11/2026: "competência fora dos componentes") */}
          {vm.mensal && (
            <div className="field" style={{ margin: 0 }}>
              <label>Mês</label>
              <SeletorMes rotulo="Mês" valor={vm.competencia} onMudar={vm.setCompetencia} />
            </div>
          )}
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="nt-email">E-mail</label>
            <input id="nt-email" type="email" value={vm.email} placeholder="O do Cadastro da empresa" onChange={e => vm.setEmail(e.target.value)} />
            {vm.whatsapp && <span className="hint">E o WhatsApp {vm.whatsapp}</span>}
          </div>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="nt-assunto">Assunto</label>
          <input id="nt-assunto" type="text" value={vm.assunto} onChange={e => vm.setAssunto(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="nt-mensagem">Mensagem (o topo do formulário)</label>
          <textarea id="nt-mensagem" rows={2} value={vm.mensagem} onChange={e => vm.setMensagem(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>O que pedir</th><th>Explicação (opcional)</th><th>Tipo</th><th /></tr></thead>
            <tbody>
              {vm.itens.map(i => (
                <tr key={i.n}>
                  <td><input type="text" value={i.titulo} placeholder="Ex.: Extrato da conta do Sicoob" aria-label={'Item ' + (i.n + 1)} onChange={e => vm.mudarTitulo(i.n, e.target.value)} style={{ width: '100%' }} /></td>
                  <td><input type="text" value={i.detalhe} aria-label={'Explicação do item ' + (i.n + 1)} onChange={e => vm.mudarDetalhe(i.n, e.target.value)} style={{ width: '100%' }} /></td>
                  <td>
                    <select className="select-compact" value={i.tipo} aria-label={'Tipo do item ' + (i.n + 1)} onChange={e => vm.mudarTipo(i.n, e.target.value as typeof i.tipo)}>
                      {vm.tipos.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                    </select>
                  </td>
                  <td><button type="button" className="icon-btn icon-btn-sm" onClick={() => vm.tirarItem(i.n)} title="Tirar o item" aria-label={'Tirar o item ' + (i.n + 1)}><Icone nome="x" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn" onClick={vm.somarItem}><Icone nome="plus" />Adicionar item</button>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            {vm.erro && <span className="hint">{vm.erro}</span>}
            <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!!vm.erro || vm.mandando} onClick={() => void vm.mandar()}><Icone nome="caixaEntrada" />Mandar pelo Mandei</button>
          </span>
        </div>
        <p className="hint" style={{ margin: 0 }}>"Pedir arquivo" dá ao cliente: Envio o arquivo, Não tenho este mês ou Outro. "Pergunta" pede a resposta por escrito.</p>
      </div>
    </section>
  );
}
