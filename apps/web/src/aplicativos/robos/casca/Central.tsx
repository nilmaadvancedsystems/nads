// A tela inicial da Central dos robôs (inspirada no Umbrel): papel de parede escuro, saudação e relógio, os widgets (as
// máquinas, as filas, os erros do dia), a busca, a grade de ícones (um por robô) e o dock (Início, Máquinas, Registros,
// Configurações). Clicar num ícone abre a janela do robô por cima. O endereço guarda o que está aberto:
//   /robos                       a tela inicial
//   /robos/robo/<id>/<aba>       a janela de um robô (aba: geral, registros, acoes, config)
//   /robos/maquinas | /robos/registros | /robos/configuracoes
import { robos as r } from '@nads/core';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { IconeDoRobo } from '../partes/IconeDoRobo';
import { Confirmacao } from '../partes/Janela';
import { ABAS, AppIcone, JanelaDoRobo, Pilula, type AbaDoRobo } from '../telas/JanelaDoRobo';
import { Barra, PainelConfiguracoes, PainelMaquinas, PainelRegistros, PAPEIS, type IdPapel } from '../telas/Paineis';
import { useAcoes, useBusca, useCentral } from './useCentral';

const CHAVE_PAPEL = 'central-robos-papel';
const lerPapel = (): IdPapel => {
  try { const p = localStorage.getItem(CHAVE_PAPEL); return PAPEIS.some(x => x.id === p) ? (p as IdPapel) : 'aurora'; } catch { return 'aurora'; }
};

const DOCK = [
  { id: '', nome: 'Início', icone: 'home' },
  { id: 'maquinas', nome: 'Máquinas', icone: 'servidor' },
  { id: 'registros', nome: 'Registros', icone: 'terminal' },
  { id: 'configuracoes', nome: 'Configurações', icone: 'settings' },
] as const;

export function Central() {
  const central = useCentral();
  const acoes = useAcoes(central);
  const busca = useBusca(central.situacoes);
  const ir = useNavigate();
  const { '*': resto = '' } = useParams();
  const partes = resto.split('/').filter(Boolean);
  const secao = partes[0] || '';
  const roboAberto = secao === 'robo' ? central.situacoes.find(s => s.robo.id === partes[1]) || null : null;
  const aba: AbaDoRobo = ABAS.some(a => a.id === partes[2]) ? (partes[2] as AbaDoRobo) : 'geral';
  const [papel, setPapel] = useState<IdPapel>(lerPapel);
  const trocarPapel = (p: IdPapel) => { setPapel(p); try { localStorage.setItem(CHAVE_PAPEL, p); } catch { /* vale só agora */ } };
  const voltar = () => { acoes.cancelar(); ir('/robos'); };

  const maquinasVivas = central.maquinas.filter(m => m.tom === 'ok').length;
  const atencao = central.situacoes.filter(s => s.tom === 'erro' || s.tom === 'aviso');

  return (
    <div className={'cr papel-' + papel}>
      <div className="cr-papel-de-parede" aria-hidden="true" />
      <main className="cr-inicio">
        <header className="cr-saudacao">
          <p className="cr-relogio"><time>{central.hora}</time><span>{central.data}</span></p>
          <h1>{central.saudacao}</h1>
          <p className="cr-resumo">
            {central.semPermissao ? 'O banco não deixou ler: só o administrador vê os robôs.'
              : !central.carregado ? 'Chamando os robôs…'
              : atencao.length ? atencao.length + (atencao.length === 1 ? ' robô pede atenção.' : ' robôs pedem atenção.')
              : 'Todos os robôs funcionando.'}
            {central.exemplos && <span className="cr-etiqueta">dados de exemplo</span>}
          </p>
        </header>

        <section className="cr-widgets" aria-label="Resumo">
          <button type="button" className="cr-widget" onClick={() => ir('/robos/maquinas')}>
            <span className="cr-widget-titulo">Máquinas</span>
            <span className="cr-widget-grande">{maquinasVivas}<small>/{central.maquinas.length} vivas</small></span>
            <span className="cr-widget-maquinas">
              {central.maquinas.map(m => (
                <span key={m.maquina.id} className="cr-widget-maquina">
                  <span className={'cr-ponto ' + m.tom} aria-hidden="true" />
                  <span className="cr-widget-maquina-nome">{m.maquina.nome}</span>
                  <span className="cr-widget-maquina-cpu">{m.sinais?.cpu != null ? 'CPU ' + r.porcento(m.sinais.cpu) + '%' : m.rotulo}</span>
                </span>
              ))}
            </span>
          </button>
          <button type="button" className="cr-widget" onClick={() => ir('/robos/maquinas')}>
            <span className="cr-widget-titulo">Servidor</span>
            <span className="cr-barras">
              <Barra rotulo="CPU" valor={central.maquinas[0]?.sinais?.cpu ?? null} />
              <Barra rotulo="Memória" valor={central.maquinas[0]?.sinais?.memoria ?? null} />
              <Barra rotulo="Disco" valor={central.maquinas[0]?.sinais?.disco ?? null} />
            </span>
          </button>
          <button type="button" className="cr-widget" onClick={() => { const l = central.filas.linhas[0]; if (l) ir('/robos/robo/' + l.robo.id + '/geral'); }}>
            <span className="cr-widget-titulo">Filas</span>
            <span className="cr-widget-grande">{central.filas.esperando}<small> esperando</small></span>
            <span className="cr-widget-maquinas">
              {central.filas.linhas.slice(0, 3).map(l => (
                <span key={l.robo.id} className="cr-widget-maquina sem-ponto">
                  <span className="cr-widget-maquina-nome">{l.robo.nome}</span>
                  <span className="cr-widget-maquina-cpu">{l.esperando + l.andamento}</span>
                </span>
              ))}
              {!central.filas.linhas.length && <span className="cr-fraco">Nenhum pedido esperando.</span>}
            </span>
          </button>
          <button type="button" className="cr-widget" onClick={() => ir('/robos/registros')}>
            <span className="cr-widget-titulo">Erros de hoje</span>
            <span className={'cr-widget-grande' + (central.erros.length ? ' ruim' : '')}>{central.erros.length}</span>
            <span className="cr-widget-linhas">
              {central.erros.slice(0, 2).map(e => <span key={e.id}><b>{r.roboDaAtividade(e)?.nome || e.tipo}</b><span>{e.texto}</span></span>)}
              {!central.erros.length && <span className="cr-fraco">Nenhum erro hoje.</span>}
            </span>
          </button>
        </section>

        <label className="cr-busca">
          <IconeDoRobo nome="search" tamanho={18} />
          <input type="search" placeholder="Buscar robô" value={busca.termo} onChange={e => busca.setTermo(e.target.value)} aria-label="Buscar robô" />
        </label>

        <section className="cr-grade" aria-label="Robôs">
          {busca.visiveis.map(s => (
            <button key={s.robo.id} type="button" className="cr-app" onClick={() => ir('/robos/robo/' + s.robo.id + '/geral')} aria-label={s.robo.nome + ': ' + s.rotulo}>
              <span className="cr-app-moldura">
                <AppIcone robo={s.robo} />
                <span className={'cr-app-estado ' + (s.pausa ? 'pausado' : s.tom)} aria-hidden="true">{s.pausa && <IconeDoRobo nome="pausa" tamanho={10} />}</span>
              </span>
              <span className="cr-app-nome">{s.robo.nome}</span>
              <span className="cr-app-sub">{s.fila && s.fila.esperando + s.fila.andamento > 0 ? s.fila.esperando + s.fila.andamento + ' na fila' : r.maquinaPorId(s.robo.maquina)?.nome}</span>
            </button>
          ))}
          {!busca.visiveis.length && <p className="cr-fraco cr-vazio">Nenhum robô com “{busca.termo}”.</p>}
        </section>
      </main>

      <nav className="cr-dock" aria-label="Dock">
        {DOCK.map(d => {
          const ativo = d.id === '' ? !secao : secao === d.id;
          return (
            <button key={d.id} type="button" className={'cr-dock-item' + (ativo ? ' ativo' : '')} aria-label={d.nome} title={d.nome} aria-current={ativo ? 'page' : undefined}
              onClick={() => ir(d.id ? '/robos/' + d.id : '/robos')}>
              <IconeDoRobo nome={d.icone} tamanho={24} />
              <span className="cr-dock-nome">{d.nome}</span>
            </button>
          );
        })}
      </nav>

      {roboAberto && (
        <JanelaDoRobo key={roboAberto.robo.id} central={central} s={roboAberto} aba={aba} acoes={acoes} aoFechar={voltar}
          irPara={a => ir('/robos/robo/' + roboAberto.robo.id + '/' + a, { replace: true })} />
      )}
      {secao === 'maquinas' && <PainelMaquinas central={central} acoes={acoes} aoFechar={voltar} />}
      {secao === 'registros' && <PainelRegistros central={central} aoFechar={voltar} />}
      {secao === 'configuracoes' && <PainelConfiguracoes central={central} papel={papel} trocarPapel={trocarPapel} aoFechar={voltar} />}

      {acoes.pendente && (
        <Confirmacao
          titulo={acoes.pendente.acao.nome + ' · ' + (acoes.pendente.acao.alvo === 'maquina' ? acoes.pendente.maquina.nome : acoes.pendente.robo?.nome || '') + '?'}
          texto={<>
            <p>{acoes.pendente.acao.descricao}</p>
            <p className="cr-fraco">Vai para {acoes.pendente.maquina.nome} ({acoes.pendente.maquina.host}). O robô responde no histórico de pedidos.</p>
          </>}
          rotuloSim={acoes.pendente.acao.nome} perigo enviando={acoes.enviando} erro={acoes.erro}
          aoConfirmar={acoes.confirmar} aoCancelar={acoes.cancelar} />
      )}
      {acoes.enviado && !acoes.pendente && <Enviado key={acoes.enviado} central={central} id={acoes.enviado} />}
    </div>
  );
}

/** O aviso pequeno no rodapé: o pedido foi e o que o robô respondeu (some sozinho depois que termina). */
function Enviado({ central, id }: { central: ReturnType<typeof useCentral>; id: string }) {
  const c = central.comandos.find(x => x.id === id);
  if (!c || c.status === 'feito' && central.agora - Date.parse(c.respondidoEm || c.em) > 20000) return null;
  return (
    <div className="cr-recado" role="status">
      <b>{r.textoDoComando(c)}</b>
      <Pilula tom={r.TOM_DO_STATUS[c.status]}>{r.ROTULO_DO_STATUS[c.status]}</Pilula>
      {c.mensagem && <span className="cr-linha-meta">{c.mensagem}</span>}
    </div>
  );
}
