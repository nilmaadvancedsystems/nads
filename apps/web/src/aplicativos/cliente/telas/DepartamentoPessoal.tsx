// O Registro da Área do Cliente (12/11/2026: "a função de registro, onde o cliente vai ter acesso aos funcionários
// registrados, folha de pagamento, férias e afins"), no lugar da "Gestão de empregados" do protótipo (Vitor, 16/10/2026):
// o título com Solicitar admissão e Programar férias; os quatro números; os funcionários (pelas guias do FGTS, com o CPF
// mascarado; quem saiu, no interruptor) com a ficha de cada um e os documentos dele; e os documentos do DP mês a mês, por
// categoria (a folha, os recibos, o pró-labore, as férias, as rescisões, o ponto, o FGTS e o INSS), para baixar. Os
// pedidos abrem em janela, como no protótipo, e viram uma solicitação do tipo certo.
// Refeito (12/11/2026: "agora o registro"; a escolhida: "equipe + ficha ao lado"): os números no alto; a equipe à esquerda
// (os ativos ou quem saiu, a busca) e a ficha da pessoa à direita (os dados, os documentos dela e as ações); embaixo, a
// folha do mês por categoria, no estilo extrato. No celular, a equipe e a ficha um de cada vez.
import { CampoData, Icone, IconeDeArquivo, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { Avatar } from '../partes/Avatar';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { ACEITA_FOTO, fotoQuadrada, urlDaFoto } from '../partes/foto';
import { Vazio } from '../partes/Vazio';
import type { PedidoDeAdmissao, PedidoDeDemissao, PedidoDeFerias } from '../dados/regras';
import { formatos } from '@nads/core';
import { useDp, type DadosDoPedido, type Pedido } from './useDp';
import type { DaCasca } from './useAreaCliente';

const CONTRATOS = ['Prazo indeterminado', 'Experiência (45 + 45 dias)', 'Estágio', 'Aprendiz'];
const DIAS = ['30 dias', '20 dias e vender 10', '15 dias (primeira parte)', '10 dias (uma parte)'];
const MOTIVOS = ['O funcionário pediu demissão', 'Dispensa sem justa causa', 'Dispensa com justa causa', 'Fim do contrato de experiência', 'Acordo entre as partes'];
const AVISOS = ['Trabalhado', 'Indenizado', 'Dispensado'];
const TITULO: Record<Pedido, string> = { admissao: 'Solicitar admissão', ferias: 'Programar férias', demissao: 'Pedir desligamento' };

/** o campo opcional da foto na admissão: prepara a foto na hora e mostra como ficou */
function CampoDaFoto({ nome, foto, aoMudar }: { nome: string; foto?: string; aoMudar: (b64: string | undefined) => void }) {
  const [erro, setErro] = useState('');
  const escolheu = async (f: File) => {
    try { aoMudar(await fotoQuadrada(f)); setErro(''); } catch (x) { setErro(x instanceof Error ? x.message : 'Não deu para usar esta imagem.'); }
  };
  return (
    <div className="field">
      <label htmlFor="cli-foto-adm">Foto do funcionário <span className="hint">(opcional)</span></label>
      <div className="cli-campo-foto">
        <Avatar nome={nome || '?'} foto={foto ? urlDaFoto(foto) : undefined} tamanho={48} />
        <label className="btn" htmlFor="cli-foto-adm"><Icone nome="camera" width={16} height={16} />{foto ? 'Trocar foto' : 'Escolher foto'}</label>
        <input id="cli-foto-adm" type="file" className="sr-only" accept={ACEITA_FOTO} onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) void escolheu(f); }} />
        {foto && <button type="button" className="btn btn-ghost" onClick={() => aoMudar(undefined)}>Tirar</button>}
      </div>
      {erro && <p className="cli-erro" role="alert">{erro}</p>}
    </div>
  );
}

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
          <CampoDaFoto nome={a.nome} foto={a.foto} aoMudar={foto => mudar({ foto })} />
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

type VM = ReturnType<typeof useDp>;
type Doc = VM['grupos'][number]['docs'][number];

/** Uma linha de documento: o ícone pelo tipo, o nome, de quem e o mês, e o Ver e o Baixar (o grande demais, pedir ao escritório). */
function LinhaDoDocumento({ d, vm }: { d: Doc; vm: VM }) {
  return (
    <li className="cli-reg-doc">
      <IconeDeArquivo formato={d.formato} tamanho={30} />
      <span className="cli-reg-doc-txt">
        <b>{d.nome}</b>
        <span className="hint">{[d.dono, d.detalhe].filter(Boolean).join(' · ')}</span>
      </span>
      {d.podeBaixar ? (
        <span className="cli-reg-doc-acoes">
          <button type="button" className="icon-btn" title="Ver" aria-label={'Ver ' + d.nome} disabled={vm.vista.abrindo === d.id} onClick={() => vm.verDoc(d.id)}><Icone nome="olho" width={16} height={16} /></button>
          <button type="button" className="icon-btn" title="Baixar" aria-label={'Baixar ' + d.nome} disabled={vm.baixando === d.id} onClick={() => vm.baixar(d.id)}><Icone nome="download" width={16} height={16} /></button>
        </span>
      ) : <span className="hint">Grande demais: peça ao escritório</span>}
    </li>
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

  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Registro</h1>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={() => void abrirPedido('admissao', vm.novaAdmissao())}><Icone nome="plus" width={16} height={16} />Solicitar admissão</button>
          <button type="button" className="btn" onClick={() => void abrirPedido('ferias', vm.novasFerias())}><Icone nome="calendar" width={16} height={16} />Programar férias</button>
        </div>
      </div>

      <div className="cli-numeros cli-numeros-reg">
        <div className="cli-numero"><span className="cli-sobre">Funcionários ativos</span><span className="cli-numero-valor menor">{vm.numeros.ativos}</span><span className="hint">no registro</span></div>
        <div className="cli-numero"><span className="cli-sobre">Folha{vm.competencia ? ' de ' + vm.competencia : ''}</span><span className="cli-numero-valor menor">{formatos.reais(vm.numeros.folha)}</span><span className="hint">remuneração dos ativos</span></div>
        <div className="cli-numero"><span className="cli-sobre">Entraram no ano</span><span className="cli-numero-valor menor">{vm.numeros.admissoesNoAno}</span><span className="hint">admissões</span></div>
        <div className="cli-numero"><span className="cli-sobre">Saíram</span><span className="cli-numero-valor menor">{vm.numeros.saidas}</span><span className="hint">desligamentos</span></div>
      </div>

      <div className={'cli-sol cli-reg' + (vm.fichaNoCelular ? ' painel-aberto' : '')}>
        {/* a equipe */}
        <section className="card cli-sol-lista">
          <div className="cli-sol-filtros" role="tablist" aria-label="Equipe">
            <button type="button" role="tab" aria-selected={!vm.mostrarSaidas} className={'cli-sol-filtro' + (!vm.mostrarSaidas ? ' ativo' : '')} onClick={vm.verAtivos}>Ativos<b>{vm.ativosN}</b></button>
            <button type="button" role="tab" aria-selected={vm.mostrarSaidas} className={'cli-sol-filtro' + (vm.mostrarSaidas ? ' ativo' : '')} onClick={vm.verSaidas}>Saíram<b>{vm.saidas}</b></button>
          </div>
          <label className="cli-busca cli-reg-busca">
            <Icone nome="search" width={16} height={16} />
            <input type="text" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Nome, CPF ou matrícula" aria-label="Buscar funcionário" />
          </label>
          {vm.funcionarios.length ? (
            <ul>
              {vm.funcionarios.map(f => (
                <li key={f.id}>
                  <button type="button" className={'cli-reg-pessoa' + (f.escolhido ? ' escolhida' : '') + (f.ativo ? '' : ' saiu')} aria-current={f.escolhido ? 'true' : undefined} onClick={() => vm.escolher(f.id)}>
                    <Avatar nome={f.nome} />
                    <span className="cli-reg-pessoa-txt"><b>{f.nome}</b><span className="hint">{f.ativo ? 'desde ' + f.desde : f.situacao}{f.matricula ? ' · mat. ' + f.matricula : ''}</span></span>
                    <span className="cli-reg-pessoa-valor">{f.remuneracao}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : vm.temFuncionarios && vm.busca ? <p className="hint cli-sol-vazio">Ninguém com esse nome. <button type="button" className="cli-link-mini" onClick={() => vm.mudarBusca('')}>Limpar a busca</button></p>
            : vm.temFuncionarios ? <p className="hint cli-sol-vazio">{vm.mostrarSaidas ? 'Ninguém saiu do registro.' : 'Nenhum funcionário ativo.'}</p>
            : <Vazio icone="usuario" titulo="Nenhum funcionário no registro" texto="Os funcionários aparecem aqui quando o escritório emite a guia do FGTS do mês." />}
        </section>

        {/* a ficha */}
        <section className="card cli-sol-painel cli-reg-ficha">
          <button type="button" className="btn btn-ghost btn-sm cli-sol-voltar" onClick={vm.voltar}><Icone nome="chevronLeft" width={16} height={16} />Voltar à equipe</button>
          {(() => {
            const f = vm.funcionarios.find(x => x.escolhido);
            if (!f) return <Vazio icone="usuario" titulo="Escolha alguém da equipe" texto="A ficha mostra os dados e os documentos da pessoa." />;
            return (
              <>
                <div className="cli-reg-cabeca">
                  <Avatar nome={f.nome} tamanho={52} />
                  <div>
                    <h2>{f.nome}</h2>
                    <p className="hint"><span className={'badge ' + (f.ativo ? 'badge-ok' : 'badge-neutral')}>{f.situacao}</span>{f.matricula && <> · Matrícula {f.matricula}</>}</p>
                  </div>
                </div>
                <div className="cli-ficha-dados">
                  <div className="cli-ficha-dado"><span className="cli-sobre">CPF</span><b>{f.cpf || '—'}</b></div>
                  <div className="cli-ficha-dado"><span className="cli-sobre">No registro desde</span><b>{f.desde || '—'}</b></div>
                  <div className="cli-ficha-dado cli-ficha-largo">
                    <span className="cli-sobre">Remuneração{vm.competencia && f.ativo ? ' · ' + vm.competencia : ''}</span>
                    <b className="cli-ficha-valor">{f.remuneracao}</b>
                  </div>
                </div>
                <div className="cli-sol-bloco">
                  <p className="cli-sol-rotulo">Documentos de {f.nome.split(' ')[0]}</p>
                  {f.docs.length ? <ul className="cli-reg-docs">{f.docs.map(d => <LinhaDoDocumento key={d.id} d={d} vm={vm} />)}</ul>
                    : <p className="hint">Nenhum documento só dela(e) nos últimos meses.</p>}
                </div>
                <div className="cli-sol-rodape">
                  <span className="hint">Para mudar um dado ou mandar um atestado, abra uma solicitação.</span>
                  {f.ativo && <>
                    <button type="button" className="btn btn-ghost cli-perigo" onClick={() => void abrirPedido('demissao', vm.novaDemissao(f.nome))}>Pedir desligamento</button>
                    <button type="button" className="btn btn-primary" onClick={() => void abrirPedido('ferias', vm.novasFerias(f.nome))}><Icone nome="calendar" width={16} height={16} />Programar férias</button>
                  </>}
                </div>
              </>
            );
          })()}
        </section>
      </div>

      {/* a folha do mês: os documentos do DP por categoria (a folha, os recibos, as férias…), no estilo extrato */}
      <section className="card cli-reg-folha">
        <div className="card-head">
          <h3>Folha {vm.meses.length ? 'de ' + (vm.meses.find(m => m.valor === vm.mes)?.rotulo.toLowerCase() ?? '') : 'do mês'}</h3>
          {vm.meses.length > 1 && (
            <span className="card-head-ctl">
              <span className="chip-row" role="radiogroup" aria-label="Mês dos documentos" style={{ margin: 0 }}>
                {vm.meses.map(m => (
                  <button key={m.valor} type="button" role="radio" aria-checked={vm.mes === m.valor} className={'chip-f' + (vm.mes === m.valor ? ' on' : '')} onClick={() => vm.mudarMes(m.valor)}>{m.rotulo}</button>
                ))}
              </span>
            </span>
          )}
        </div>
        {vm.grupos.length ? vm.grupos.map(g => (
          <div key={g.categoria} className="cli-reg-grupo">
            <p className="cli-biblioteca-mes-titulo">{g.rotulo.toUpperCase()}</p>
            <ul className="cli-reg-docs">{g.docs.map(d => <LinhaDoDocumento key={d.id} d={d} vm={vm} />)}</ul>
          </div>
        )) : <Vazio icone="pastaAberta" titulo="Nenhum documento ainda" texto="A folha, os recibos e as guias do mês aparecem aqui quando o escritório salva na pasta da empresa." />}
      </section>
      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar} />}
    </>
  );
}
