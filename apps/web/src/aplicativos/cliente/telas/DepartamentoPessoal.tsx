// O Departamento pessoal da Área do Cliente (Vitor, 16/10/2026), no layout da "Gestão de empregados" do protótipo com as
// peças do nads: o título com Solicitar admissão e Programar férias, os quatro números (stat do nads) e a tabela dos
// funcionários com a busca e "Exibindo N de M". Os pedidos abrem em janela, como no protótipo, e viram um chamado do tipo
// certo; a ficha de cada um também abre em janela, com Programar férias e Pedir desligamento.
import { CampoData, Icone, useRetorno } from '@nads/ui';
import { useState } from 'react';
import type { Empregado } from '../dados/areaCliente';
import type { PedidoDeAdmissao, PedidoDeDemissao, PedidoDeFerias } from '../dados/regras';
import { useDp, type DadosDoPedido, type Pedido } from './useDp';
import type { DaCasca } from './useAreaCliente';

const CONTRATOS = ['Prazo indeterminado', 'Experiência (45 + 45 dias)', 'Estágio', 'Aprendiz'];
const DIAS = ['30 dias', '20 dias e vender 10', '15 dias (primeira parte)', '10 dias (uma parte)'];
const MOTIVOS = ['O funcionário pediu demissão', 'Dispensa sem justa causa', 'Dispensa com justa causa', 'Fim do contrato de experiência', 'Acordo entre as partes'];
const AVISOS = ['Trabalhado', 'Indenizado', 'Dispensado'];
const TITULO: Record<Pedido, string> = { admissao: 'Solicitar admissão', ferias: 'Programar férias', demissao: 'Pedir desligamento' };

/** o formulário de um pedido dentro da janela; cada mudança volta para quem abriu (que envia ao fechar com "Enviar") */
function FormDoPedido({ pedido, inicial, erro, nomes, aoMudar }: { pedido: Pedido; inicial: DadosDoPedido; erro: string; nomes: string[]; aoMudar: (d: DadosDoPedido) => void }) {
  const [d, setD] = useState(inicial);
  const mudar = (m: Partial<PedidoDeAdmissao & PedidoDeFerias & PedidoDeDemissao>) => { const novo = { ...d, ...m } as DadosDoPedido; setD(novo); aoMudar(novo); };
  const a = d as PedidoDeAdmissao, f = d as PedidoDeFerias, x = d as PedidoDeDemissao;
  const funcionario = (valor: string) => (
    <div className="field">
      <label htmlFor="cli-func">Funcionário</label>
      <select id="cli-func" value={valor} onChange={ev => mudar({ empregado: ev.target.value })}>
        <option value="" disabled>Escolha</option>
        {nomes.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
  return (
    <div className="cli-app cli-janela">
      {pedido === 'admissao' && (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>O eSocial pede o registro até um dia antes do primeiro dia de trabalho.</p>
          <div className="field"><label htmlFor="cli-nome">Nome completo</label><input id="cli-nome" type="text" value={a.nome} onChange={e => mudar({ nome: e.target.value })} /></div>
          <div className="field"><label htmlFor="cli-cpf">CPF</label><input id="cli-cpf" type="text" inputMode="numeric" value={a.cpf} onChange={e => mudar({ cpf: e.target.value })} placeholder="000.000.000-00" /></div>
          <div className="field"><label htmlFor="cli-cargo">Cargo</label><input id="cli-cargo" type="text" value={a.cargo} onChange={e => mudar({ cargo: e.target.value })} /></div>
          <div className="field"><label htmlFor="cli-sal">Salário</label><input id="cli-sal" type="text" value={a.salario} onChange={e => mudar({ salario: e.target.value })} placeholder="R$ 2.000,00" /></div>
          <div className="field"><label htmlFor="cli-inicio">Primeiro dia</label><CampoData id="cli-inicio" rotulo="Primeiro dia" valor={a.inicio} onMudar={v => mudar({ inicio: v })} /></div>
          <div className="field">
            <label htmlFor="cli-contrato">Contrato</label>
            <select id="cli-contrato" value={a.contrato} onChange={e => mudar({ contrato: e.target.value })}>{CONTRATOS.map(c => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="field"><label htmlFor="cli-obs">Horário, vale-transporte e outros detalhes</label><textarea id="cli-obs" rows={2} value={a.observacoes} onChange={e => mudar({ observacoes: e.target.value })} /></div>
        </>
      )}
      {pedido === 'ferias' && (
        <>
          {funcionario(f.empregado)}
          <div className="field"><label htmlFor="cli-fi">Primeiro dia das férias</label><CampoData id="cli-fi" rotulo="Primeiro dia das férias" valor={f.inicio} onMudar={v => mudar({ inicio: v })} /></div>
          <div className="field">
            <label htmlFor="cli-dias">Quantos dias</label>
            <select id="cli-dias" value={f.dias} onChange={e => mudar({ dias: e.target.value })}>{DIAS.map(o => <option key={o}>{o}</option>)}</select>
          </div>
          <div className="field"><label className="cli-marcar"><input type="checkbox" checked={f.adiantar13} onChange={e => mudar({ adiantar13: e.target.checked })} />Adiantar metade do 13º</label></div>
        </>
      )}
      {pedido === 'demissao' && (
        <>
          {funcionario(x.empregado)}
          <div className="field"><label htmlFor="cli-ud">Último dia de trabalho</label><CampoData id="cli-ud" rotulo="Último dia de trabalho" valor={x.ultimoDia} onMudar={v => mudar({ ultimoDia: v })} /></div>
          <div className="field">
            <label htmlFor="cli-motivo">Motivo</label>
            <select id="cli-motivo" value={x.motivo} onChange={e => mudar({ motivo: e.target.value })}><option value="" disabled>Escolha</option>{MOTIVOS.map(m => <option key={m}>{m}</option>)}</select>
          </div>
          <div className="field">
            <label htmlFor="cli-aviso">Aviso prévio</label>
            <select id="cli-aviso" value={x.aviso} onChange={e => mudar({ aviso: e.target.value })}>{AVISOS.map(o => <option key={o}>{o}</option>)}</select>
          </div>
        </>
      )}
      {erro && <p className="cli-erro" role="alert">{erro}</p>}
    </div>
  );
}

export function DepartamentoPessoal(props: DaCasca) {
  const vm = useDp(props);
  const { modal } = useRetorno();

  /** abre a janela do pedido; se faltar algo, abre de novo com o que já foi preenchido e o aviso */
  const abrirPedido = async (pedido: Pedido, dados: DadosDoPedido, erro = ''): Promise<void> => {
    let atual = dados;
    const enviar = await modal<boolean>({
      titulo: TITULO[pedido],
      corpo: <FormDoPedido pedido={pedido} inicial={dados} erro={erro} nomes={vm.nomes} aoMudar={d => { atual = d; }} />,
      botoes: [{ rotulo: pedido === 'admissao' ? 'Encaminhar ao departamento pessoal' : 'Enviar ao escritório', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!enviar) return;
    const problema = await vm.pedir(pedido, atual);
    if (problema) await abrirPedido(pedido, atual, problema);
  };

  const ficha = async (e: Empregado) => {
    const escolha = await modal<'ferias' | 'demissao' | null>({
      titulo: e.nome, texto: e.cargo,
      corpo: (
        <div className="cli-app cli-janela">
          <dl className="cli-dados">
            <dt>CPF</dt><dd>{e.cpf}</dd>
            <dt>Admissão</dt><dd>{vm.dataBr(e.admissao)}</dd>
            <dt>Salário</dt><dd>{vm.reais(e.salario)}</dd>
            <dt>Férias</dt><dd>{vm.rotuloDasFerias(e)}</dd>
          </dl>
          <p className="hint" style={{ marginTop: 12 }}>Para mudar um dado ou mandar um atestado, abra uma solicitação.</p>
        </div>
      ),
      botoes: [{ rotulo: 'Programar férias', valor: 'ferias', variante: 'btn-primary' }, { rotulo: 'Pedir desligamento', valor: 'demissao', variante: 'btn-danger' }, { rotulo: 'Fechar', valor: null, variante: 'btn-outline' }],
    });
    if (escolha === 'ferias') await abrirPedido('ferias', vm.novasFerias(e.nome));
    if (escolha === 'demissao') await abrirPedido('demissao', vm.novaDemissao(e.nome));
  };

  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Departamento pessoal</h1>
          <p className="page-desc">Seus funcionários, os pedidos de admissão e a programação de férias.</p>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={() => void abrirPedido('admissao', vm.novaAdmissao())}><Icone nome="plus" width={16} height={16} />Solicitar admissão</button>
          <button type="button" className="btn" onClick={() => void abrirPedido('ferias', vm.novasFerias())}><Icone nome="calendar" width={16} height={16} />Programar férias</button>
        </div>
      </div>

      <div className="stat-grid cli-numeros">
        <div className="stat"><p className="stat-label">Total de ativos</p><p className="stat-value">{vm.numeros.ativos}</p></div>
        <div className="stat"><p className="stat-label">Em férias</p><p className="stat-value">{vm.numeros.emFerias}</p></div>
        <div className="stat"><p className="stat-label">Folha bruta total</p><p className="stat-value">{vm.reais(vm.numeros.folha)}</p></div>
        <div className="stat"><p className="stat-label">Admissões no ano</p><p className="stat-value">{vm.numeros.admissoesNoAno}</p></div>
      </div>

      <section className="card cli-card-tabela">
        <div className="card-head">
          <input type="text" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Buscar por nome ou CPF" aria-label="Buscar funcionário" className="cli-busca" />
          <span className="card-head-ctl">Exibindo {vm.empregados.length} de {vm.total}</span>
        </div>
        <table className="cli-tabela">
          <thead>
            <tr><th>Colaborador</th><th className="cli-so-largo">Cargo</th><th className="cli-so-largo">Admissão</th><th className="cli-so-largo num">Salário base</th><th className="cli-so-largo">Férias</th><th className="num"><span className="sr-only">Ficha</span></th></tr>
          </thead>
          <tbody>
            {vm.empregados.map(e => (
              <tr key={e.id}>
                <td>
                  <div className="cli-pessoa">
                    <span className="cli-iniciais" aria-hidden="true">{vm.iniciais(e.nome)}</span>
                    <div><b>{e.nome}</b><span className="hint">CPF {e.cpf}</span></div>
                  </div>
                </td>
                <td className="cli-so-largo">{e.cargo}</td>
                <td className="cli-so-largo">{vm.dataBr(e.admissao)}</td>
                <td className="cli-so-largo num">{vm.reais(e.salario)}</td>
                <td className="cli-so-largo"><span className={vm.seloDasFerias(e)}>{vm.rotuloDasFerias(e)}</span></td>
                <td className="num"><button type="button" className="btn" onClick={() => void ficha(e)}>Detalhes</button></td>
              </tr>
            ))}
            {!vm.empregados.length && <tr><td colSpan={6}><p className="empty">{vm.total ? 'Ninguém com esse nome.' : 'Nenhum funcionário ativo.'}</p></td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
