// O Ajustes da Central: a conta, os ajustes dos robôs (os mesmos documentos que o robô já lê), os horários, os alertas e quem
// pode o quê. Tudo que grava passa por uma confirmação com o "de → para". O endereço guarda a aba: /robos/configuracoes/<aba>.
import { robos as r } from '@nads/core';
import { useState } from 'react';
import type { Central } from '../casca/useCentral';
import type { PessoaDaEquipe, ValoresDoGrupo } from '../dados/ajustes';
import { IconeDoRobo } from '../partes/IconeDoRobo';
import { Confirmacao, Janela } from '../partes/Janela';
import { useAbaAjustes, useAbaAlertas, useAbaHorarios, useAbaQuemPode } from './useAjustes';

export type AbaDosAjustes = 'conta' | 'robos' | 'horarios' | 'alertas' | 'pessoas';
const ABAS: { id: AbaDosAjustes; nome: string; nivel: 'todos' | 'administrar' | 'admin' }[] = [
  { id: 'conta', nome: 'Conta', nivel: 'todos' }, { id: 'robos', nome: 'Ajustes', nivel: 'administrar' }, { id: 'horarios', nome: 'Horários', nivel: 'administrar' },
  { id: 'alertas', nome: 'Alertas', nivel: 'administrar' }, { id: 'pessoas', nome: 'Quem pode', nivel: 'admin' },
];

export function PainelConfiguracoes({ central, aba, irPara, aoFechar }: { central: Central; aba: string; irPara: (a: AbaDosAjustes) => void; aoFechar: () => void }) {
  const visiveis = ABAS.filter(a => a.nivel === 'todos' || (a.nivel === 'administrar' ? central.administra : central.permissao.admin));
  const atual = visiveis.find(a => a.id === aba)?.id || 'conta';
  return (
    <Janela rotulo="Ajustes" aoFechar={aoFechar}
      titulo={<div className="cr-cabeca"><IconeDoRobo nome="settings" tamanho={22} /><h1 className="cr-titulo-simples">Ajustes</h1></div>}
      abas={visiveis.length > 1 ? (
        <div className="cr-abas" role="tablist" aria-label="Partes dos ajustes">
          {visiveis.map(a => <button key={a.id} type="button" role="tab" aria-selected={atual === a.id} className={'cr-aba' + (atual === a.id ? ' ativa' : '')} onClick={() => irPara(a.id)}>{a.nome}</button>)}
        </div>
      ) : undefined}>
      <div role="tabpanel">
        {atual === 'conta' && <Conta central={central} />}
        {atual === 'robos' && <AbaAjustes central={central} />}
        {atual === 'horarios' && <AbaHorarios central={central} />}
        {atual === 'alertas' && <AbaAlertas central={central} />}
        {atual === 'pessoas' && <AbaQuemPode central={central} />}
      </div>
    </Janela>
  );
}

const nomeDoPapel = (p: r.PermissaoNaCentral) => (p.admin ? 'Administrador do sistema' : r.PAPEIS.find(x => x.id === p.papel)?.nome || 'Sem acesso');

function Conta({ central }: { central: Central }) {
  return (
    <div>
      <section className="cr-secao">
        <h2>Conta</h2>
        <div className="cr-acao">
          <div><b>{central.nome || 'Sem nome'}</b><span>{nomeDoPapel(central.permissao)}{central.exemplos ? '. Dados de exemplo: nada vai para o banco nem para os robôs.' : ', com a conta do Entregas.'}</span></div>
          <button type="button" className="cr-botao" onClick={central.sair}>{central.rotuloSair}</button>
        </div>
      </section>
      <section className="cr-secao">
        <h2>Como os pedidos chegam aos robôs</h2>
        <p className="cr-fraco cr-pequeno">Cada ação vira um pedido no banco. O robô de cada máquina só lê os pedidos dela, confere quem pediu e só faz o que está na lista fechada: pausar e retomar (um robô ou todos, com hora para voltar), rodar uma tarefa conhecida, limpar a fila travada, cancelar, passar na frente ou refazer um pedido da fila, pedir para um cliente, reiniciar com calma e atualizar. Pedido com mais de 5 minutos ou repetido é recusado, e a resposta volta no próprio pedido. Nenhum comando de sistema sai daqui.</p>
      </section>
    </div>
  );
}

function Interruptor({ ligado, rotulo, disabled, aoMudar }: { ligado: boolean; rotulo: string; disabled?: boolean; aoMudar: (v: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={disabled} className={'cr-interruptor' + (ligado ? ' ligado' : '')} onClick={() => aoMudar(!ligado)}><span /></button>;
}

function Numero({ rotulo, valor, min, max, aoMudar }: { rotulo: string; valor: number; min: number; max: number; aoMudar: (n: number) => void }) {
  return (
    <label className="cr-campo">
      <span>{rotulo}</span>
      <span className="cr-busca"><input type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(valor) ? valor : ''} onChange={e => aoMudar(e.target.value === '' ? NaN : Number(e.target.value))} /></span>
    </label>
  );
}

// ---------- Ajustes ----------

function AbaAjustes({ central }: { central: Central }) {
  const { valores, erro, gravacao } = useAbaAjustes(central.nome);
  if (erro) return <p className="cr-erro-linha" role="alert">{erro}</p>;
  if (!valores) return <p className="cr-fraco">Lendo os ajustes…</p>;
  const p = gravacao.pendente;
  return (
    <div>
      {r.AJUSTES.map(g => <GrupoAjuste key={g.doc} g={g} salvo={valores[g.doc]} aoSalvar={(antes, agora) => gravacao.preparar({ g, antes, agora })} />)}
      <p className="cr-nota">O robô vê o que mudou na próxima leitura. Senhas, tokens, certificados e endereços de serviço não aparecem aqui.</p>
      {p && (
        <Confirmacao titulo={'Salvar ' + p.g.titulo + '?'} rotuloSim="Salvar" perigo={false} enviando={gravacao.enviando} erro={gravacao.erro} aoConfirmar={() => void gravacao.confirmar()} aoCancelar={gravacao.cancelar}
          texto={<dl className="cr-dl">{Object.entries(r.mudancasDoGrupo(p.g, p.antes, p.agora)).map(([campo, v]) => {
            const c = p.g.campos.find(x => x.campo === campo)!;
            return <div key={campo} className="cr-dl-par"><dt>{c.nome}</dt><dd>{r.textoDoAjuste(c, p.antes[campo])} → {r.textoDoAjuste(c, v)}</dd></div>;
          })}</dl>} />
      )}
    </div>
  );
}

function GrupoAjuste({ g, salvo, aoSalvar }: { g: r.GrupoDeAjustes; salvo: ValoresDoGrupo; aoSalvar: (antes: ValoresDoGrupo, agora: ValoresDoGrupo) => void }) {
  const [editado, setEditado] = useState<ValoresDoGrupo>({});
  const agora = { ...salvo, ...editado };
  const mudou = Object.keys(r.mudancasDoGrupo(g, salvo, agora)).length > 0;
  const erros = g.campos.map(c => (JSON.stringify(salvo[c.campo]) === JSON.stringify(agora[c.campo]) ? '' : r.validarAjuste(c, agora[c.campo]))).filter(Boolean);
  const mudar = (campo: string, v: r.ValorDeAjuste) => setEditado(e => ({ ...e, [campo]: v }));
  return (
    <section className="cr-secao">
      <h2>{g.titulo}</h2>
      <ul className="cr-acoes">
        {g.campos.map(c => (
          <li key={c.campo} className={'cr-acao' + (c.tipo === 'chave' ? '' : ' cr-ajuste')}>
            <div><b>{c.nome}</b><span>{c.descricao}</span></div>
            <Controle c={c} valor={agora[c.campo]} aoMudar={v => mudar(c.campo, v)} />
          </li>
        ))}
      </ul>
      {erros[0] && <p className="cr-erro-linha" role="alert" style={{ marginTop: 8 }}>{erros[0]}</p>}
      {mudou && (
        <div className="cr-botoes">
          <button type="button" className="cr-botao primario" disabled={erros.length > 0} onClick={() => aoSalvar(salvo, agora)}>Salvar</button>
          <button type="button" className="cr-botao" onClick={() => setEditado({})}>Desfazer</button>
        </div>
      )}
    </section>
  );
}

function Controle({ c, valor, aoMudar }: { c: r.CampoDeAjuste; valor: r.ValorDeAjuste; aoMudar: (v: r.ValorDeAjuste) => void }) {
  if (c.tipo === 'chave') return <Interruptor ligado={valor === true} rotulo={c.nome} aoMudar={aoMudar} />;
  if (c.tipo === 'lista-emails') return <ListaDeEmails valor={valor as string[]} rotulo={c.nome} aoMudar={aoMudar} />;
  if (c.tipo === 'escolha') {
    return <span className="cr-campo cr-ajuste-campo"><span className="cr-busca"><select aria-label={c.nome} value={String(valor)} onChange={e => aoMudar(e.target.value)}>{c.opcoes!.map(o => <option key={o.valor} value={o.valor}>{o.nome}</option>)}</select></span></span>;
  }
  if (c.tipo === 'dias-do-mes') return <DiasDoMes valor={valor as number[]} rotulo={c.nome} aoMudar={aoMudar} />;
  if (c.tipo === 'numero') {
    return <span className="cr-campo cr-ajuste-campo"><span className="cr-busca"><input type="number" inputMode="numeric" aria-label={c.nome} min={c.min} max={c.max} value={valor === '' ? '' : Number(valor)} onChange={e => aoMudar(e.target.value === '' ? '' : Number(e.target.value))} /></span></span>;
  }
  return <span className="cr-campo cr-ajuste-campo"><span className="cr-busca"><input type="text" aria-label={c.nome} maxLength={c.maxLetras} value={String(valor)} onChange={e => aoMudar(e.target.value)} /></span></span>;
}

function DiasDoMes({ valor, rotulo, aoMudar }: { valor: number[]; rotulo: string; aoMudar: (v: number[]) => void }) {
  const [texto, setTexto] = useState(valor.join(', '));
  const iguais = JSON.stringify(r.listaDeDias(texto)) === JSON.stringify(valor);
  return <span className="cr-campo cr-ajuste-campo"><span className="cr-busca"><input type="text" inputMode="numeric" aria-label={rotulo} value={iguais ? texto : valor.join(', ')} onChange={e => { setTexto(e.target.value); aoMudar(r.listaDeDias(e.target.value)); }} /></span></span>;
}

function ListaDeEmails({ valor, rotulo, aoMudar }: { valor: string[]; rotulo: string; aoMudar: (v: string[]) => void }) {
  const [novo, setNovo] = useState('');
  const pronto = novo.trim().toLowerCase();
  const incluir = () => { if (pronto && !valor.includes(pronto)) aoMudar([...valor, pronto]); setNovo(''); };
  return (
    <div className="cr-ajuste-lista">
      {valor.length > 0 && <ul className="cr-acoes">{valor.map(e => <li key={e} className="cr-acao"><div><span className="num">{e}</span></div><button type="button" className="cr-botao" onClick={() => aoMudar(valor.filter(x => x !== e))} aria-label={'Tirar ' + e}>Tirar</button></li>)}</ul>}
      <form className="cr-ajuste-incluir" onSubmit={ev => { ev.preventDefault(); incluir(); }}>
        <span className="cr-busca"><input type="email" aria-label={rotulo} placeholder="nome@empresa.com" value={novo} onChange={e => setNovo(e.target.value)} /></span>
        <button type="submit" className="cr-botao" disabled={!pronto}>Incluir</button>
      </form>
    </div>
  );
}

// ---------- Horários ----------

function AbaHorarios({ central }: { central: Central }) {
  const { horarios, erro, gravacao } = useAbaHorarios(central.nome);
  if (erro) return <p className="cr-erro-linha" role="alert">{erro}</p>;
  if (!horarios) return <p className="cr-fraco">Lendo os horários…</p>;
  const p = gravacao.pendente;
  return (
    <div>
      {r.ROBOS_COM_HORARIO.map(robo => <HorarioDoRobo key={robo.id} robo={robo} salvo={horarios[robo.id]} aoSalvar={(antes, agora) => gravacao.preparar({ robo, antes, agora })} />)}
      <p className="cr-nota">Hora de Brasília. Os robôs seguem como sempre enquanto não tiverem horário, e o novo vale em até 15 minutos. Fora do horário o robô termina o que está fazendo e não pega trabalho novo. O Arquivador, a NFS-e, os Envios, a SEFAZ e o Suporte não têm horário próprio.</p>
      {p && (
        <Confirmacao titulo={'Mudar o horário do ' + p.robo.nome + '?'} rotuloSim="Salvar" perigo={false} enviando={gravacao.enviando} erro={gravacao.erro} aoConfirmar={() => void gravacao.confirmar()} aoCancelar={gravacao.cancelar}
          texto={<dl className="cr-dl"><div className="cr-dl-par"><dt>Antes</dt><dd>{r.textoDoHorario(p.robo, p.antes)}</dd></div><div className="cr-dl-par"><dt>Agora</dt><dd>{r.textoDoHorario(p.robo, p.agora)}</dd></div></dl>} />
      )}
    </div>
  );
}

function HorarioDoRobo({ robo, salvo, aoSalvar }: { robo: r.RoboDaCentral; salvo: r.HorarioDoRobo; aoSalvar: (antes: r.HorarioDoRobo, agora: r.HorarioDoRobo) => void }) {
  const [h, setH] = useState(salvo);
  const mudou = JSON.stringify(h) !== JSON.stringify(salvo);
  const erro = mudou ? r.validarHorario(robo, h) : '';
  const mudar = (parcial: Partial<r.HorarioDoRobo>) => setH(x => ({ ...x, ...parcial }));
  const trocarDia = (d: number) => mudar({ dias: h.dias.includes(d) ? h.dias.filter(x => x !== d) : [...h.dias, d].sort((a, b) => a - b) });
  return (
    <section className="cr-secao">
      <div className="cr-acao">
        <div><b>{robo.nome}</b><span>{h.ativo ? r.textoDoHorario(robo, h) : 'Sem horário: trabalha como sempre.'}</span></div>
        <Interruptor ligado={h.ativo} rotulo={'Usar horário no ' + robo.nome} aoMudar={ativo => mudar({ ativo })} />
      </div>
      {h.ativo && (
        <div className="cr-horario">
          <div className="cr-horario-dias" role="group" aria-label="Dias">
            {r.DIAS_DA_SEMANA.map((nome, d) => <label key={nome} className="cr-chave"><input type="checkbox" checked={h.dias.includes(d)} onChange={() => trocarDia(d)} /><span>{nome}</span></label>)}
          </div>
          <div className="cr-horario-horas">
            <label className="cr-campo"><span>Das</span><span className="cr-busca"><input type="time" value={h.de} onChange={e => mudar({ de: e.target.value })} /></span></label>
            <label className="cr-campo"><span>Às</span><span className="cr-busca"><input type="time" value={h.ate} onChange={e => mudar({ ate: e.target.value })} /></span></label>
            {robo.horario?.intervalo && (
              <label className="cr-campo"><span>A cada (min)</span><span className="cr-busca"><input type="number" inputMode="numeric" min={r.LIMITES_DO_HORARIO.intervaloMin} max={r.LIMITES_DO_HORARIO.intervaloMax} placeholder="padrão" value={h.intervaloMin ?? ''}
                onChange={e => { const novo = { ...h }; delete novo.intervaloMin; setH(e.target.value === '' ? novo : { ...novo, intervaloMin: Number(e.target.value) }); }} /></span></label>
            )}
          </div>
        </div>
      )}
      {robo.horario?.nota && <p className="cr-nota">{robo.horario.nota}</p>}
      {erro && <p className="cr-erro-linha" role="alert" style={{ marginTop: 8 }}>{erro}</p>}
      {mudou && (
        <div className="cr-botoes">
          <button type="button" className="cr-botao primario" disabled={!!erro} onClick={() => aoSalvar(salvo, h)}>Salvar</button>
          <button type="button" className="cr-botao" onClick={() => setH(salvo)}>Desfazer</button>
        </div>
      )}
    </section>
  );
}

// ---------- Alertas ----------

function AbaAlertas({ central }: { central: Central }) {
  const { alertas, pessoas, erro, gravacao } = useAbaAlertas(central.nome);
  if (erro) return <p className="cr-erro-linha" role="alert">{erro}</p>;
  if (!alertas || !pessoas) return <p className="cr-fraco">Lendo os alertas…</p>;
  return <FormAlertas salvo={alertas} pessoas={pessoas} gravacao={gravacao} />;
}

const alterna = (l: string[], x: string) => (l.includes(x) ? l.filter(y => y !== x) : [...l, x]);

function Maquinas({ lista, mudar }: { lista: string[]; mudar: (l: string[]) => void }) {
  return (
    <div className="cr-marcas" role="group" aria-label="Máquinas">
      {r.MAQUINAS.map(m => <label key={m.id} className="cr-chave"><input type="checkbox" checked={lista.includes(m.id)} onChange={() => mudar(alterna(lista, m.id))} /><span>{m.nome}</span></label>)}
    </div>
  );
}

function FormAlertas({ salvo, pessoas, gravacao }: { salvo: r.AlertasDosRobos; pessoas: PessoaDaEquipe[]; gravacao: ReturnType<typeof useAbaAlertas>['gravacao'] }) {
  const [a, setA] = useState(salvo);
  const mudou = JSON.stringify(a) !== JSON.stringify(salvo);
  const erro = mudou ? r.validarAlertas(a) : '';
  const L = r.LIMITES_DOS_ALERTAS;
  const vaiLigar = gravacao.pendente?.ligado && !salvo.ligado;
  return (
    <div>
      <section className="cr-secao">
        <div className="cr-acao">
          <div><b>Mandar avisos no celular</b><span>{a.ligado ? 'Ligado: os avisos marcados abaixo vão para as pessoas escolhidas.' : 'Desligado: nenhum aviso sai.'}</span></div>
          <Interruptor ligado={a.ligado} rotulo="Mandar avisos no celular" aoMudar={ligado => setA({ ...a, ligado })} />
        </div>
      </section>
      <section className="cr-secao">
        <h2>Quem recebe</h2>
        <div className="cr-marcas" role="group" aria-label="Quem recebe">
          {pessoas.map(p => <label key={p.uid} className="cr-chave"><input type="checkbox" checked={a.pessoas.includes(p.uid)} onChange={() => setA({ ...a, pessoas: alterna(a.pessoas, p.uid) })} /><span>{p.nome}</span></label>)}
        </div>
      </section>
      <section className="cr-secao">
        <div className="cr-acao">
          <div><b>Robô deu erro</b><span>Um aviso por robô, com o primeiro erro e quantos houve.</span></div>
          <Interruptor ligado={a.erro.ligado} rotulo="Avisar erro de robô" aoMudar={ligado => setA({ ...a, erro: { ...a.erro, ligado } })} />
        </div>
        {a.erro.ligado && <>
          <div className="cr-marcas" role="group" aria-label="Robôs">
            {r.ROBOS.map(x => <label key={x.id} className="cr-chave"><input type="checkbox" checked={a.erro.robos.includes(x.id)} onChange={() => setA({ ...a, erro: { ...a.erro, robos: alterna(a.erro.robos, x.id) } })} /><span>{x.nome}</span></label>)}
          </div>
          <p className="cr-nota">Sem nenhum marcado, vale para todos os robôs.</p>
        </>}
      </section>
      <section className="cr-secao">
        <div className="cr-acao">
          <div><b>Máquina sem sinal</b><span>A máquina parou de dar notícia.</span></div>
          <Interruptor ligado={a.semSinal.ligado} rotulo="Avisar máquina sem sinal" aoMudar={ligado => setA({ ...a, semSinal: { ...a.semSinal, ligado } })} />
        </div>
        {a.semSinal.ligado && <>
          <Maquinas lista={a.semSinal.maquinas} mudar={maquinas => setA({ ...a, semSinal: { ...a.semSinal, maquinas } })} />
          <div className="cr-horario-horas"><Numero rotulo="Sem sinal há (min)" valor={a.semSinal.minutos} min={L.semSinalMin[0]} max={L.semSinalMin[1]} aoMudar={minutos => setA({ ...a, semSinal: { ...a.semSinal, minutos } })} /></div>
          <p className="cr-nota">O PC do escritório desliga à noite: marcado, ele avisa toda noite.</p>
        </>}
      </section>
      <section className="cr-secao">
        <div className="cr-acao">
          <div><b>Disco enchendo</b><span>O disco da máquina passou do limite.</span></div>
          <Interruptor ligado={a.disco.ligado} rotulo="Avisar disco enchendo" aoMudar={ligado => setA({ ...a, disco: { ...a.disco, ligado } })} />
        </div>
        {a.disco.ligado && <>
          <Maquinas lista={a.disco.maquinas} mudar={maquinas => setA({ ...a, disco: { ...a.disco, maquinas } })} />
          <div className="cr-horario-horas"><Numero rotulo="Limite (%)" valor={a.disco.limite} min={L.discoLimite[0]} max={L.discoLimite[1]} aoMudar={limite => setA({ ...a, disco: { ...a.disco, limite } })} /></div>
        </>}
      </section>
      <section className="cr-secao">
        <h2>Para não virar enxurrada</h2>
        <div className="cr-horario-horas">
          <Numero rotulo="Repetir o mesmo aviso a cada (min)" valor={a.repetirMin} min={L.repetirMin[0]} max={L.repetirMin[1]} aoMudar={repetirMin => setA({ ...a, repetirMin })} />
          <Numero rotulo="No máximo, por hora" valor={a.maxPorHora} min={L.maxPorHora[0]} max={L.maxPorHora[1]} aoMudar={maxPorHora => setA({ ...a, maxPorHora })} />
        </div>
      </section>
      {erro && <p className="cr-erro-linha" role="alert">{erro}</p>}
      {mudou && (
        <div className="cr-botoes">
          <button type="button" className="cr-botao primario" disabled={!!erro} onClick={() => gravacao.preparar(a)}>Salvar</button>
          <button type="button" className="cr-botao" onClick={() => setA(salvo)}>Desfazer</button>
        </div>
      )}
      {gravacao.pendente && (
        <Confirmacao titulo={vaiLigar ? 'Ligar os avisos?' : 'Salvar os alertas?'} rotuloSim={vaiLigar ? 'Ligar' : 'Salvar'} perigo={!!vaiLigar} enviando={gravacao.enviando} erro={gravacao.erro} aoConfirmar={() => void gravacao.confirmar()} aoCancelar={gravacao.cancelar}
          texto={<p>{gravacao.pendente.ligado ? 'Vai mandar avisos no celular para ' + (gravacao.pendente.pessoas.length === 1 ? '1 pessoa' : gravacao.pendente.pessoas.length + ' pessoas') + ': ' + pessoas.filter(p => gravacao.pendente!.pessoas.includes(p.uid)).map(p => p.nome).join(', ') + '. No máximo ' + gravacao.pendente.maxPorHora + ' por hora.' : 'Nenhum aviso vai sair enquanto estiver desligado.'}</p>} />
      )}
    </div>
  );
}

// ---------- Quem pode ----------

function AbaQuemPode({ central }: { central: Central }) {
  const { permissoes, pessoas, erro, gravacao } = useAbaQuemPode(central.nome);
  if (erro) return <p className="cr-erro-linha" role="alert">{erro}</p>;
  if (!permissoes || !pessoas) return <p className="cr-fraco">Lendo a equipe…</p>;
  const p = gravacao.pendente;
  return (
    <div>
      <section className="cr-secao">
        <ul className="cr-acoes">
          {pessoas.map(x => <LinhaDaPessoa key={x.uid} pessoa={x} salvo={permissoes[x.uid] || r.SEM_PERMISSAO} aoSalvar={(antes, agora) => gravacao.preparar({ pessoa: x, antes, agora })} />)}
        </ul>
      </section>
      <p className="cr-nota">Vale no banco e no robô: ele confere quem pediu antes de executar. Quem não tem papel não entra. Só o administrador do sistema muda esta lista.</p>
      {p && (
        <Confirmacao titulo={'Mudar o acesso de ' + p.pessoa.nome + '?'} rotuloSim="Salvar" perigo={false} enviando={gravacao.enviando} erro={gravacao.erro} aoConfirmar={() => void gravacao.confirmar()} aoCancelar={gravacao.cancelar}
          texto={<dl className="cr-dl"><div className="cr-dl-par"><dt>Antes</dt><dd>{textoDaPermissao(p.antes)}</dd></div><div className="cr-dl-par"><dt>Agora</dt><dd>{textoDaPermissao(p.agora)}</dd></div></dl>} />
      )}
    </div>
  );
}

function textoDaPermissao(p: r.PermissaoNaCentral) {
  if (p.papel !== 'comandar') return nomeDoPapel(p);
  return 'Comandar: ' + r.ROBOS.filter(x => p.robos.includes(x.id)).map(x => x.nome).join(', ');
}

function LinhaDaPessoa({ pessoa, salvo, aoSalvar }: { pessoa: PessoaDaEquipe; salvo: r.PermissaoNaCentral; aoSalvar: (antes: r.PermissaoNaCentral, agora: r.PermissaoNaCentral) => void }) {
  const [p, setP] = useState(salvo);
  if (pessoa.admin) return <li className="cr-acao"><div><b>{pessoa.nome}</b><span>{pessoa.email}</span></div><span className="cr-estado">Administrador do sistema</span></li>;
  const mudou = JSON.stringify(p) !== JSON.stringify(salvo);
  const erro = mudou ? r.validarPermissao(p) : '';
  const marcar = (id: string) => setP({ ...p, robos: p.robos.includes(id) ? p.robos.filter(x => x !== id) : [...p.robos, id] });
  return (
    <li className="cr-pessoa">
      <div className="cr-acao cr-ajuste">
        <div><b>{pessoa.nome}</b><span>{pessoa.email}</span></div>
        <span className="cr-campo cr-ajuste-campo"><span className="cr-busca"><select aria-label={'Papel de ' + pessoa.nome} value={p.papel} onChange={e => setP({ admin: false, papel: e.target.value as r.PapelNaCentral, robos: e.target.value === 'comandar' ? p.robos : [] })}>{r.PAPEIS.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></span></span>
      </div>
      {p.papel === 'comandar' && (
        <div className="cr-marcas" role="group" aria-label={'Robôs de ' + pessoa.nome}>
          {r.ROBOS.map(x => <label key={x.id} className="cr-chave"><input type="checkbox" checked={p.robos.includes(x.id)} onChange={() => marcar(x.id)} /><span>{x.nome}</span></label>)}
        </div>
      )}
      {erro && <p className="cr-erro-linha" role="alert" style={{ marginTop: 8 }}>{erro}</p>}
      {mudou && (
        <div className="cr-botoes">
          <button type="button" className="cr-botao primario" disabled={!!erro} onClick={() => aoSalvar(salvo, p)}>Salvar</button>
          <button type="button" className="cr-botao" onClick={() => setP(salvo)}>Desfazer</button>
        </div>
      )}
    </li>
  );
}
