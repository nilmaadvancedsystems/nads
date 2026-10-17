// O Departamento pessoal da Área do Cliente (Vitor, 16/10/2026, do protótipo): os números, os pedidos de admissão, férias e
// demissão (cada um vira um chamado do tipo certo; o recibo aparece aqui) e a lista de funcionários com a ficha de cada um.
import { Alerta, CampoData, Icone, useRetorno } from '@nads/ui';
import { useEffect, useRef } from 'react';
import type { Empregado } from '../dados/areaCliente';
import { useDp } from './useDp';
import type { DaCasca } from './useAreaCliente';

const CONTRATOS = ['Prazo indeterminado', 'Experiência (45 + 45 dias)', 'Estágio', 'Aprendiz'];
const DIAS = ['30 dias', '20 dias e vender 10', '15 dias (primeira parte)', '10 dias (uma parte)'];
const MOTIVOS = ['O funcionário pediu demissão', 'Dispensa sem justa causa', 'Dispensa com justa causa', 'Fim do contrato de experiência', 'Acordo entre as partes'];
const AVISOS = ['Trabalhado', 'Indenizado', 'Dispensado'];
const TITULO = { admissao: 'Solicitar admissão', ferias: 'Programar férias', demissao: 'Pedir desligamento' } as const;

export function DepartamentoPessoal(props: DaCasca) {
  const vm = useDp(props);
  const { modal } = useRetorno();
  const form = useRef<HTMLElement>(null);
  useEffect(() => { if (vm.pedido) form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [vm.pedido]);

  const ficha = async (e: Empregado) => {
    const escolha = await modal<'ferias' | 'demissao' | null>({
      icone: 'usuario', titulo: e.nome, texto: e.cargo,
      corpo: (
        <div className="cli-app cli-janela">
          <dl className="cli-dados">
            <dt>CPF</dt><dd className="num">{e.cpf}</dd>
            <dt>Admissão</dt><dd>{vm.dataBr(e.admissao)}</dd>
            <dt>Salário</dt><dd className="num">{vm.reais(e.salario)}</dd>
            <dt>Férias</dt><dd>{vm.rotuloDasFerias(e)}</dd>
          </dl>
          <p className="hint" style={{ marginTop: 12 }}>Para mudar um dado ou mandar um atestado, abra uma solicitação.</p>
        </div>
      ),
      botoes: [{ rotulo: 'Programar férias', valor: 'ferias', variante: 'btn-primary' }, { rotulo: 'Pedir desligamento', valor: 'demissao', variante: 'btn-danger' }, { rotulo: 'Fechar', valor: null, variante: 'btn-outline' }],
    });
    if (escolha) vm.abrir(escolha, e.nome);
  };

  const seletorDeFuncionario = (valor: string, mudar: (v: string) => void) => (
    <div className="field">
      <label htmlFor="cli-func">Funcionário</label>
      <select id="cli-func" value={valor} onChange={ev => mudar(ev.target.value)}>
        <option value="" disabled>Escolha</option>
        {vm.nomes.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <div className="cli-acoes">
        <button type="button" className="btn btn-primary" onClick={() => vm.abrir('admissao')}><Icone nome="plus" width={16} height={16} />Solicitar admissão</button>
        <button type="button" className="btn" onClick={() => vm.abrir('ferias')}><Icone nome="calendar" width={16} height={16} />Programar férias</button>
        <button type="button" className="btn" onClick={() => vm.abrir('demissao')}>Pedir desligamento</button>
      </div>

      {vm.recibo && (
        <Alerta naLinha tom="ok" titulo="Pedido enviado ao escritório" texto={vm.recibo.titulo + '. Acompanhe a resposta em Solicitações.'}>
          <div className="cli-acoes" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={vm.verChamados}>Ver em Solicitações</button>
            <button type="button" className="btn btn-ghost" onClick={vm.fecharRecibo}>Ok</button>
          </div>
        </Alerta>
      )}

      {vm.pedido && (
        <section className="card" ref={form}>
          <div className="card-head"><h3>{TITULO[vm.pedido]}</h3></div>
          {vm.pedido === 'admissao' && (
            <div className="cli-form tres">
              <div className="field"><label htmlFor="cli-nome">Nome completo</label><input id="cli-nome" type="text" value={vm.admissao.nome} onChange={e => vm.mudarAdmissao({ nome: e.target.value })} /></div>
              <div className="field"><label htmlFor="cli-cpf">CPF</label><input id="cli-cpf" type="text" inputMode="numeric" value={vm.admissao.cpf} onChange={e => vm.mudarAdmissao({ cpf: e.target.value })} placeholder="000.000.000-00" /></div>
              <div className="field"><label htmlFor="cli-cargo">Cargo</label><input id="cli-cargo" type="text" value={vm.admissao.cargo} onChange={e => vm.mudarAdmissao({ cargo: e.target.value })} /></div>
              <div className="field"><label htmlFor="cli-sal">Salário</label><input id="cli-sal" type="text" value={vm.admissao.salario} onChange={e => vm.mudarAdmissao({ salario: e.target.value })} placeholder="R$ 2.000,00" /></div>
              <div className="field"><label htmlFor="cli-inicio">Primeiro dia</label><CampoData id="cli-inicio" rotulo="Primeiro dia" valor={vm.admissao.inicio} onMudar={v => vm.mudarAdmissao({ inicio: v })} /></div>
              <div className="field">
                <label htmlFor="cli-contrato">Contrato</label>
                <select id="cli-contrato" value={vm.admissao.contrato} onChange={e => vm.mudarAdmissao({ contrato: e.target.value })}>{CONTRATOS.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <div className="field cli-largo"><label htmlFor="cli-obs">Horário, vale-transporte e outros detalhes</label><textarea id="cli-obs" rows={3} value={vm.admissao.observacoes} onChange={e => vm.mudarAdmissao({ observacoes: e.target.value })} /></div>
            </div>
          )}
          {vm.pedido === 'ferias' && (
            <div className="cli-form tres">
              {seletorDeFuncionario(vm.ferias.empregado, v => vm.mudarFerias({ empregado: v }))}
              <div className="field"><label htmlFor="cli-fi">Primeiro dia</label><CampoData id="cli-fi" rotulo="Primeiro dia das férias" valor={vm.ferias.inicio} onMudar={v => vm.mudarFerias({ inicio: v })} /></div>
              <div className="field">
                <label htmlFor="cli-dias">Quantos dias</label>
                <select id="cli-dias" value={vm.ferias.dias} onChange={e => vm.mudarFerias({ dias: e.target.value })}>{DIAS.map(d => <option key={d}>{d}</option>)}</select>
              </div>
              <div className="field cli-largo">
                <label className="cli-marcar"><input type="checkbox" checked={vm.ferias.adiantar13} onChange={e => vm.mudarFerias({ adiantar13: e.target.checked })} />Adiantar a metade do 13º</label>
              </div>
              <div className="field cli-largo"><label htmlFor="cli-obsf">Observações</label><textarea id="cli-obsf" rows={2} value={vm.ferias.observacoes} onChange={e => vm.mudarFerias({ observacoes: e.target.value })} /></div>
            </div>
          )}
          {vm.pedido === 'demissao' && (
            <div className="cli-form tres">
              {seletorDeFuncionario(vm.demissao.empregado, v => vm.mudarDemissao({ empregado: v }))}
              <div className="field"><label htmlFor="cli-ud">Último dia de trabalho</label><CampoData id="cli-ud" rotulo="Último dia de trabalho" valor={vm.demissao.ultimoDia} onMudar={v => vm.mudarDemissao({ ultimoDia: v })} /></div>
              <div className="field">
                <label htmlFor="cli-motivo">Motivo</label>
                <select id="cli-motivo" value={vm.demissao.motivo} onChange={e => vm.mudarDemissao({ motivo: e.target.value })}>
                  <option value="" disabled>Escolha</option>{MOTIVOS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="cli-aviso">Aviso prévio</label>
                <select id="cli-aviso" value={vm.demissao.aviso} onChange={e => vm.mudarDemissao({ aviso: e.target.value })}>{AVISOS.map(a => <option key={a}>{a}</option>)}</select>
              </div>
              <div className="field cli-largo"><label htmlFor="cli-obsd">Observações</label><textarea id="cli-obsd" rows={2} value={vm.demissao.observacoes} onChange={e => vm.mudarDemissao({ observacoes: e.target.value })} /></div>
            </div>
          )}
          {vm.erro && <p className="cli-erro" role="alert" style={{ marginBottom: 12 }}>{vm.erro}</p>}
          <div className="cli-botoes">
            <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={() => void vm.enviar()}>Enviar ao escritório</button>
            <button type="button" className="btn" onClick={vm.fechar}>Cancelar</button>
          </div>
        </section>
      )}

      <div className="stat-grid cli-app-stats">
        <div className="stat"><p className="stat-label">Funcionários</p><p className="stat-value">{vm.numeros.ativos}</p></div>
        <div className="stat"><p className="stat-label">De férias</p><p className="stat-value">{vm.numeros.emFerias}</p></div>
        <div className="stat"><p className="stat-label">Folha (salários)</p><p className="stat-value">{vm.reais(vm.numeros.folha)}</p></div>
        <div className="stat"><p className="stat-label">Admissões no ano</p><p className="stat-value">{vm.numeros.admissoesNoAno}</p></div>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Funcionários</h3>
          <input type="text" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Buscar por nome ou cargo" aria-label="Buscar funcionário" style={{ width: 220, maxWidth: '100%' }} />
        </div>
        {vm.empregados.length ? (
          <ul>
            {vm.empregados.map(e => (
              <li key={e.id} className="cli-linha">
                <div className="cli-linha-txt">
                  <b>{e.nome}</b>{' '}
                  {e.ferias === 'em ferias' && <span className="badge badge-warn">De férias</span>}
                  {e.ferias === 'vencidas' && <span className="badge badge-bad">Férias vencidas</span>}
                  <p className="hint">{e.cargo} · desde {vm.dataBr(e.admissao)}</p>
                </div>
                <div className="cli-linha-dir">
                  <span className="num">{vm.reais(e.salario)}</span>
                  <button type="button" className="btn" onClick={() => void ficha(e)}>Ficha</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="empty">{vm.total ? 'Ninguém com esse nome.' : 'Nenhum funcionário ativo.'}</p>}
      </section>
    </>
  );
}
