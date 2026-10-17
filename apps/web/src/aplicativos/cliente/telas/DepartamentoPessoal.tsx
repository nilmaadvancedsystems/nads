// O Departamento pessoal da Área do Cliente (Vitor, 16/10/2026): a lista de funcionários e a ação principal, Solicitar
// admissão. Férias e desligamento saem da ficha de cada um. Cada pedido vira um chamado do tipo certo; a confirmação aparece
// numa linha.
import { CampoData, useRetorno } from '@nads/ui';
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
      titulo: e.nome, texto: e.cargo,
      corpo: (
        <div className="cli-app cli-janela">
          <dl className="cli-dados">
            <dt>CPF</dt><dd>{e.cpf}</dd>
            <dt>Admissão</dt><dd>{vm.dataBr(e.admissao)}</dd>
            <dt>Salário</dt><dd>{vm.reais(e.salario)}</dd>
            <dt>Férias</dt><dd>{vm.rotuloDasFerias(e)}</dd>
          </dl>
        </div>
      ),
      botoes: [{ rotulo: 'Programar férias', valor: 'ferias', variante: 'btn-primary' }, { rotulo: 'Pedir desligamento', valor: 'demissao', variante: 'btn-danger' }, { rotulo: 'Fechar', valor: null, variante: 'btn-outline' }],
    });
    if (escolha) vm.abrir(escolha, e.nome);
  };

  const funcionario = (valor: string, mudar: (v: string) => void) => (
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
      <div className="cli-acao" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={() => vm.abrir('admissao')}>Solicitar admissão</button>
      </div>

      {vm.recibo && (
        <p className="cli-recibo">
          {vm.recibo.titulo}. Enviado ao escritório.{' '}
          <button type="button" className="btn btn-ghost" onClick={vm.verChamados}>Acompanhar</button>
          <button type="button" className="btn btn-ghost" onClick={vm.fecharRecibo}>Ok</button>
        </p>
      )}

      {vm.pedido && (
        <section ref={form} className="cli-form-secao">
          <h2 className="cli-secao">{TITULO[vm.pedido]}</h2>
          {vm.pedido === 'admissao' && (
            <div className="cli-form">
              <div className="field"><label htmlFor="cli-nome">Nome completo</label><input id="cli-nome" type="text" value={vm.admissao.nome} onChange={e => vm.mudarAdmissao({ nome: e.target.value })} /></div>
              <div className="field"><label htmlFor="cli-cpf">CPF</label><input id="cli-cpf" type="text" inputMode="numeric" value={vm.admissao.cpf} onChange={e => vm.mudarAdmissao({ cpf: e.target.value })} /></div>
              <div className="field"><label htmlFor="cli-cargo">Cargo</label><input id="cli-cargo" type="text" value={vm.admissao.cargo} onChange={e => vm.mudarAdmissao({ cargo: e.target.value })} /></div>
              <div className="field"><label htmlFor="cli-sal">Salário</label><input id="cli-sal" type="text" value={vm.admissao.salario} onChange={e => vm.mudarAdmissao({ salario: e.target.value })} /></div>
              <div className="field"><label htmlFor="cli-inicio">Primeiro dia</label><CampoData id="cli-inicio" rotulo="Primeiro dia" valor={vm.admissao.inicio} onMudar={v => vm.mudarAdmissao({ inicio: v })} /></div>
              <div className="field">
                <label htmlFor="cli-contrato">Contrato</label>
                <select id="cli-contrato" value={vm.admissao.contrato} onChange={e => vm.mudarAdmissao({ contrato: e.target.value })}>{CONTRATOS.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <div className="field cli-largo"><label htmlFor="cli-obs">Horário, vale-transporte e outros detalhes</label><textarea id="cli-obs" rows={3} value={vm.admissao.observacoes} onChange={e => vm.mudarAdmissao({ observacoes: e.target.value })} /></div>
            </div>
          )}
          {vm.pedido === 'ferias' && (
            <div className="cli-form">
              {funcionario(vm.ferias.empregado, v => vm.mudarFerias({ empregado: v }))}
              <div className="field"><label htmlFor="cli-fi">Primeiro dia</label><CampoData id="cli-fi" rotulo="Primeiro dia das férias" valor={vm.ferias.inicio} onMudar={v => vm.mudarFerias({ inicio: v })} /></div>
              <div className="field">
                <label htmlFor="cli-dias">Quantos dias</label>
                <select id="cli-dias" value={vm.ferias.dias} onChange={e => vm.mudarFerias({ dias: e.target.value })}>{DIAS.map(d => <option key={d}>{d}</option>)}</select>
              </div>
              <div className="field">
                <label className="cli-marcar"><input type="checkbox" checked={vm.ferias.adiantar13} onChange={e => vm.mudarFerias({ adiantar13: e.target.checked })} />Adiantar metade do 13º</label>
              </div>
            </div>
          )}
          {vm.pedido === 'demissao' && (
            <div className="cli-form">
              {funcionario(vm.demissao.empregado, v => vm.mudarDemissao({ empregado: v }))}
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
            </div>
          )}
          {vm.erro && <p className="cli-erro" role="alert">{vm.erro}</p>}
          <div className="cli-acao">
            <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={() => void vm.enviar()}>Enviar ao escritório</button>
            <button type="button" className="btn" onClick={vm.fechar}>Cancelar</button>
          </div>
        </section>
      )}

      <h2 className="cli-secao">Funcionários</h2>
      {vm.empregados.length ? (
        <ul>
          {vm.empregados.map(e => (
            <li key={e.id} className="cli-linha">
              <div className="cli-linha-txt">
                <b>{e.nome}</b>
                <p className="hint">{e.cargo}{e.ferias === 'em ferias' || e.ferias === 'vencidas' ? ' · ' + vm.rotuloDasFerias(e) : ''}</p>
              </div>
              <button type="button" className="btn" onClick={() => void ficha(e)}>Ficha</button>
            </li>
          ))}
        </ul>
      ) : <p className="cli-vazio">Nenhum funcionário ativo.</p>}
    </>
  );
}
