// DP › FGTS Digital (07/10/2026): o robô da nuvem emite a guia mensal de cada cliente no portal do FGTS Digital, com o
// certificado do escritório (procuração no SPE). Em cima, o robô (ligado com o certificado, ou por que está desligado);
// a competência, os filtros e "Emitir as que faltam"; na lista, cada cliente com folha no mês: a situação da guia,
// Emitir / Ensaio e, pronta, Baixar o PDF. Clicar na situação abre os passos do robô (as telas por onde passou).
import { Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { useEffect, useState } from 'react';
import { JanelaLateral } from '../janela/JanelaLateral';
import { useFgtsDoDp, type FiltroFgts, type SituacaoFgts } from './useFgtsDoDp';

const cnpjFormatado = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const data = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

const SELO: Record<SituacaoFgts, { classe: string; rotulo: string }> = {
  'sem-cnpj': { classe: 'pill-vazio', rotulo: 'sem CNPJ no cadastro' },
  nada: { classe: 'pill-vazio', rotulo: 'não pedida' },
  fila: { classe: 'badge badge-neutral', rotulo: 'Na fila do robô' },
  trabalhando: { classe: 'badge badge-warn', rotulo: 'O robô está no portal…' },
  emitida: { classe: 'badge badge-ok', rotulo: 'Guia emitida' },
  'ensaio-ok': { classe: 'badge badge-neutral', rotulo: 'Ensaio: entrou' },
  erro: { classe: 'badge badge-danger', rotulo: 'Não deu' },
  captcha: { classe: 'badge badge-warn', rotulo: 'Fazer à mão' },
};

type Tela = { n: string; nome: string; imagem: string };

function Telas({ id, telas }: { id: string; telas: (id: string) => Promise<Tela[]> }) {
  const [fotos, setFotos] = useState<{ id: string; lista: Tela[] } | null>(null);
  useEffect(() => { let vale = true; void telas(id).then(lista => { if (vale) setFotos({ id, lista }); }); return () => { vale = false; }; }, [id, telas]);
  if (!fotos || fotos.id !== id) return <Esqueleto linhas={3} />;
  if (!fotos.lista.length) return null;
  return (
    <div className="fgts-telas">
      {fotos.lista.map(f => (
        <figure key={f.n} className="fgts-tela">
          <img src={'data:image/jpeg;base64,' + f.imagem} alt={'Tela ' + f.n + ': ' + f.nome} loading="lazy" />
          <figcaption><span className="num fraco">{Number(f.n)}</span> {f.nome}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function FgtsDoDp() {
  const vm = useFgtsDoDp();
  useCarregando(vm.carregando);
  const r = vm.robo;
  const filtros: { valor: FiltroFgts; rotulo: string }[] = [
    { valor: 'todos', rotulo: 'Todos · ' + vm.contagem.todos },
    { valor: 'faltam', rotulo: 'Faltam · ' + vm.contagem.faltam },
    { valor: 'emitidas', rotulo: 'Emitidas · ' + vm.contagem.emitidas },
    { valor: 'problemas', rotulo: 'Com problema · ' + vm.contagem.problemas },
  ];
  const aberto = vm.aberto;
  const pedidoAberto = aberto?.pedido;
  return (
    <section>
      {r.carregado && (
        r.ligado && r.certificado
          ? <div className="alert alert-ok fgts-robo"><Icone nome="check" /><div><p className="alert-title">Robô do FGTS ligado</p><p className="alert-text">Certificado de {r.certificado.titular}, válido até {data(r.certificado.validade)}.</p></div></div>
          : <div className="alert fgts-robo"><Icone nome="alert" /><div><p className="alert-title">Robô do FGTS desligado</p><p className="alert-text">{r.motivo || 'Sem o certificado do escritório na máquina do robô.'}</p></div></div>
      )}
      <div className="tarefas-barra-topo">
        <select className="select-compact" value={vm.competencia} onChange={e => vm.setCompetencia(e.target.value)} aria-label="Competência">
          {vm.competencias.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
        </select>
        <Segmentado valor={vm.filtro} opcoes={filtros} onMudar={vm.setFiltro} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar empresa ou CNPJ" aria-label="Buscar empresa" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        <button type="button" className="btn btn-primary" disabled={!r.ligado || !vm.faltam || vm.pedindo} onClick={() => void vm.emitirTodas()}>
          <Icone nome="fileDown" />Emitir as que faltam{vm.faltam ? ' · ' + vm.faltam : ''}
        </button>
      </div>
      {vm.carregando ? <Esqueleto linhas={8} /> : vm.linhas.length ? (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Cód.</th><th>Empresa</th><th>CNPJ</th><th>Guia</th><th /></tr></thead>
            <tbody>
              {vm.linhas.map(l => {
                const selo = SELO[l.situacao];
                const p = l.pedido;
                return (
                  <tr key={l.codigo}>
                    <td><span className="emp-cod">{l.codigo}</span></td>
                    <td className="cofre-nome">{l.nome}</td>
                    <td className="num fraco">{l.cnpj ? cnpjFormatado(l.cnpj) : ''}</td>
                    <td>
                      {p ? (
                        <button type="button" className="fgts-situacao" title={p.erro || p.resultado || ''} onClick={() => vm.abrir(p.id)}>
                          <span className={selo.classe}>{selo.rotulo}</span>
                          <span className="fraco">{hora(p.fimEm || p.criadoEm)}</span>
                        </button>
                      ) : <span className={selo.classe}>{selo.rotulo}</span>}
                    </td>
                    <td className="fgts-acoes">
                      {p && l.situacao === 'emitida' && <button type="button" className="btn btn-outline" onClick={() => void vm.baixar(p)}><Icone nome="download" />PDF</button>}
                      {l.cnpj && !['fila', 'trabalhando'].includes(l.situacao) && (
                        <>
                          <button type="button" className="btn btn-ghost" disabled={!r.ligado} onClick={() => void vm.pedir(l.codigo, 'ensaio')}>Ensaio</button>
                          <button type="button" className="btn btn-outline" disabled={!r.ligado} onClick={() => void vm.pedir(l.codigo, 'emitir')}>{l.situacao === 'emitida' ? 'Emitir de novo' : 'Emitir'}</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="card gh-blank"><Icone nome="search" /><h4>Nenhuma empresa aqui</h4><p>Nenhum cliente do DP com folha neste filtro.</p></div>}

      {aberto && pedidoAberto && (
        <JanelaLateral rotulo={aberto.nome} topicos={[{ id: 'passos', rotulo: 'Passos do robô', icone: 'list' }]} topico="passos" mudar={() => undefined} fechar={vm.fechar} classe="fgts-janela" resumo={(
          <div className="usuario-quem"><span className="emp-cod">{aberto.codigo}</span><b>{aberto.nome}</b></div>
        )}>
          <div className="card">
            <h3>{pedidoAberto.modo === 'emitir' ? 'Emitir a guia' : 'Ensaio'} · {pedidoAberto.competencia.split('-').reverse().join('/')}</h3>
            <div className="fgts-pedido">
              <span className={SELO[aberto.situacao].classe}>{SELO[aberto.situacao].rotulo}</span>
              <span className="fraco">pedido por {pedidoAberto.criadoPor} · {hora(pedidoAberto.criadoEm)}</span>
              {(pedidoAberto.erro || pedidoAberto.resultado) && <p>{pedidoAberto.erro || pedidoAberto.resultado}</p>}
            </div>
            <ol className="fgts-passos">
              {pedidoAberto.passos.map(p => (
                <li key={p.n}><b>{p.nome}</b> <span className="fraco">{hora(p.quando)}</span><div className="fraco fgts-url">{p.url}</div></li>
              ))}
            </ol>
          </div>
          <Telas id={pedidoAberto.id} telas={vm.telas} />
        </JanelaLateral>
      )}
    </section>
  );
}
