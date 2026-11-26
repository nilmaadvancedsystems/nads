// Área do Cliente › Documentos (26/11/2026, o módulo refeito). Responde "o que entrou e o que mandamos?": os Recebidos (o
// que os clientes mandaram; tocar abre a janela com a prévia e o Recusar; "quero poder ver o arquivo direto por aqui") e os
// Enviados (o que eu mandei ao cliente; "tem que ter a opcao de subir um arquivo por aqui"). Com as peças do nads
// ("essas telas… ta toda fora dos elementos predefinidos do nads"): as abas sublinhadas, a barra com o Segmentado, o filtro
// em menu e a busca, a tabela padrão, a janela da empresa do Cadastro e o modal. Só desenha: o estado vem de useDocumentos.ts.
import { CampoArquivo, Esqueleto, Icone, IconeDeArquivo, Segmentado, Vazio, formatoPeloNome, useCarregando } from '@nads/ui';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { AvisosDaArea, EmpresaDaLinha, JanelaGrande, JanelaPequena, Selo } from '../base/Base';
import { BuscaDeEmpresa } from '../base/BuscaDeEmpresa';
import { useDocumentos } from './useDocumentos';

type Vm = ReturnType<typeof useDocumentos>;

const SITUACOES = ['novos', 'todos', 'recusados'] as const;

export function Documentos() {
  const vm = useDocumentos();
  useCarregando(vm.carregando);
  return (
    <section>
      <AvisosDaArea exemplos={vm.exemplos} erro={vm.erro} oQue="os documentos" />
      <nav className="menu area-menu" aria-label="Documentos">
        <button type="button" className={'menu-item' + (vm.aba === 'recebidos' ? ' active' : '')} onClick={() => vm.setAba('recebidos')}><Icone nome="download" width={16} height={16} /><span>Recebidos dos clientes</span></button>
        <button type="button" className={'menu-item' + (vm.aba === 'enviados' ? ' active' : '')} onClick={() => vm.setAba('enviados')}>
          <Icone nome="upload" width={16} height={16} /><span>Enviados por mim</span>{vm.contaEnviados > 0 && <span className="menu-contador">{vm.contaEnviados}</span>}
        </button>
      </nav>
      {vm.aba === 'recebidos' ? <Recebidos vm={vm} /> : <Enviados vm={vm} />}
      {vm.aberto && <JanelaDoRecebido vm={vm} />}
      {vm.enviar.aberta && <JanelaDeEnviar vm={vm} />}
    </section>
  );
}

function Barra({ vm, children }: { vm: Vm; children?: React.ReactNode }) {
  return (
    <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
      {children}
      <span className="tarefas-barra-espaco" />
      <label className="busca-curta">
        <Icone nome="search" width={16} height={16} />
        <input type="text" placeholder="Buscar empresa ou arquivo" aria-label="Buscar empresa ou arquivo" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
      </label>
      <button type="button" className="btn btn-primary" onClick={() => vm.enviar.abrir()}><Icone nome="upload" width={16} height={16} />Enviar ao cliente</button>
    </div>
  );
}

function Recebidos({ vm }: { vm: Vm }) {
  const conta = (v: string) => vm.filtros.find(f => f.valor === v)?.conta ?? 0;
  const tipos = vm.filtros.filter(f => !(SITUACOES as readonly string[]).includes(f.valor));
  const tipo = tipos.find(t => t.valor === vm.filtro);
  return (
    <>
      <Barra vm={vm}>
        {/* os filtros da barra em menu, como no DP (26/11/2026: "nao gostei desses filtros") */}
        <MenuDeFiltro rotulo="Situação" todos={'Todos (' + conta('todos') + ')'} valor={vm.filtro === 'novos' || vm.filtro === 'recusados' ? vm.filtro : ''}
          mudar={v => vm.setFiltro((v || 'todos') as typeof vm.filtro)}
          opcoes={[{ valor: 'novos', rotulo: 'Novos (' + conta('novos') + ')' }, { valor: 'recusados', rotulo: 'Recusados (' + conta('recusados') + ')' }]} />
        <MenuDeFiltro rotulo="Tipo" todos="Todos os tipos" valor={tipo ? tipo.valor : ''} mudar={v => vm.setFiltro((v || 'todos') as typeof vm.filtro)}
          opcoes={tipos.map(t => ({ valor: t.valor, rotulo: t.rotulo + ' (' + t.conta + ')' }))} />
      </Barra>
      {vm.carregando ? <Esqueleto linhas={6} /> : !vm.linhas.length ? (
        <Vazio icone="caixaEntrada" titulo={vm.total ? 'Nada neste filtro' : 'Nenhum arquivo recebido ainda'}
          texto={vm.total ? 'Troque o filtro ou a busca.' : 'Quando o cliente mandar um extrato, nota ou comprovante pela Área do Cliente, ele aparece aqui.'} />
      ) : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Empresa</th><th>Arquivo</th><th>Tipo</th><th className="num">Tamanho</th><th>Recebido</th></tr></thead>
            <tbody>
              {vm.linhas.map(({ r, recusa, quando, quandoCompleto, tamanho, tipo: t }) => (
                <tr key={r.id} className="linha-abre" tabIndex={0} onClick={() => vm.abrir(r)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(r); }}>
                  <td className="wrap"><EmpresaDaLinha codigo={r.codigo} nome={r.empresa} /></td>
                  <td className="wrap">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconeDeArquivo formato={formatoPeloNome(r.nome)} tamanho={20} />{r.nome}</span>
                    {r.guia && <div className="hint">{r.guia}</div>}
                  </td>
                  <td>{recusa ? <Selo tom="perigo" title={recusa}>Recusado</Selo> : <Selo tom="neutro">{t}</Selo>}</td>
                  <td className="num">{tamanho}</td>
                  <td className="fraco" title={quandoCompleto}>{quando}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Enviados({ vm }: { vm: Vm }) {
  return (
    <>
      <Barra vm={vm} />
      {!vm.enviados.length ? (
        <Vazio icone="upload" titulo="Você ainda não mandou nada ao cliente por aqui"
          texto="O arquivo vai para a pasta ÁREA DO CLIENTE › DO ESCRITÓRIO da empresa e o cliente vê em Documentos › Do escritório, em até 30 minutos." />
      ) : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Arquivo</th><th>Empresa</th><th>Área</th><th>Situação</th><th>Quando</th></tr></thead>
            <tbody>
              {vm.enviados.map(x => (
                <tr key={x.id}>
                  <td className="wrap"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconeDeArquivo formato={formatoPeloNome(x.nome)} tamanho={20} />{x.nome}</span></td>
                  <td className="wrap"><EmpresaDaLinha codigo={x.codigo} nome={x.empresa || '—'} /></td>
                  <td>{x.areaRotulo}</td>
                  <td>{x.situacao === 'pronto' ? <Selo tom="ok" title="Está na pasta; o cliente vê em até 30 minutos">Enviado</Selo>
                    : x.situacao === 'erro' ? <Selo tom="perigo" title={x.erro}>Não foi</Selo> : <Selo tom="aviso">Na fila do robô</Selo>}</td>
                  <td className="fraco" title={x.quandoCompleto}>{x.quando}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** O recebido aberto: a prévia, os dados e o Recusar, na janela da empresa do Cadastro. */
function JanelaDoRecebido({ vm }: { vm: Vm }) {
  const r = vm.aberto!;
  const p = vm.previa;
  const recusa = vm.recusaDe(r);
  return (
    <JanelaGrande codigo={r.codigo} titulo={r.empresa} rotulo={'Arquivo ' + r.nome} onFechar={vm.fechar}
      selo={recusa ? <Selo tom="perigo">Recusado</Selo> : undefined}>
      <h2 className="cfg-titulo">{r.nome}</h2>
      <div className="area-pilha">
        <div className="area-previa">
          {!p || p.estado === 'buscando' ? <p className="hint">{p?.texto || 'Buscando o arquivo no Drive…'}</p>
            : p.estado === 'erro' ? <p className="hint" role="alert">{p.texto}</p>
            : p.jeito === 'imagem' ? <img src={p.url} alt={p.nome} />
            : p.jeito === 'pdf' ? <iframe src={p.url} title={p.nome} />
            : <p className="hint">Este tipo de arquivo não tem prévia. Use “Abrir em outra aba”.</p>}
        </div>
        <dl className="ent-dados">
          {vm.detalhe(r).map(d => <div key={d.rotulo}><dt>{d.rotulo}</dt><dd>{d.valor}</dd></div>)}
          {recusa && <div><dt>Motivo da recusa</dt><dd>{recusa}</dd></div>}
        </dl>
        <div className="area-resposta-botoes">
          {p?.url && <a className="btn btn-outline" href={p.url} target="_blank" rel="noreferrer"><Icone nome="maximizar" width={16} height={16} />Abrir em outra aba</a>}
          {!recusa && <button type="button" className="btn btn-danger" onClick={vm.recusa.abrir}>Recusar</button>}
        </div>
      </div>
      {vm.recusa.aberta && <JanelaDaRecusa vm={vm} />}
    </JanelaGrande>
  );
}

function JanelaDaRecusa({ vm }: { vm: Vm }) {
  const r = vm.aberto!;
  return (
    <JanelaPequena titulo="Recusar o arquivo" sub={r.codigo + ' · ' + r.empresa + ' · ' + r.nome} onFechar={vm.recusa.fechar}
      rodape={<>
        <button type="button" className="btn btn-danger" onClick={() => void vm.recusa.confirmar()} disabled={vm.recusa.gravando}>{vm.recusa.gravando ? 'Recusando…' : 'Recusar'}</button>
        <button type="button" className="btn btn-outline" onClick={vm.recusa.fechar} disabled={vm.recusa.gravando}>Cancelar</button>
      </>}>
      <p className="hint">O cliente vê o motivo na Área do Cliente, e o aviso “Falta mandar” volta para ele.</p>
      <div className="chip-row">
        {vm.recusa.prontos.map(m => <button key={m} type="button" className={'chip-f' + (vm.recusa.motivo === m ? ' on' : '')} onClick={() => vm.recusa.setMotivo(m)}>{m}</button>)}
      </div>
      <div className="field">
        <label htmlFor="area-recusa-motivo">Motivo</label>
        <textarea id="area-recusa-motivo" rows={3} maxLength={300} value={vm.recusa.motivo} onChange={e => vm.recusa.setMotivo(e.target.value)} placeholder="Escreva o motivo ou escolha um acima" />
      </div>
      {vm.recusa.erro && <p className="hint registro-dica-erro" role="alert">{vm.recusa.erro}</p>}
    </JanelaPequena>
  );
}

/** Enviar ao cliente: a empresa, a área e o arquivo. */
function JanelaDeEnviar({ vm }: { vm: Vm }) {
  const v = vm.enviar;
  const a = v.andamento;
  const pronto = a.fase === 'pronto';
  return (
    <JanelaPequena titulo="Enviar ao cliente" sub="O cliente vê em Documentos › Do escritório, em até 30 minutos." onFechar={v.fechar}
      rodape={pronto ? <>
        <button type="button" className="btn btn-primary" onClick={v.fechar}>Pronto</button>
        <button type="button" className="btn btn-outline" onClick={v.outro}>Enviar outro</button>
      </> : <>
        <button type="button" className="btn btn-primary" onClick={() => void v.confirmar()} disabled={!v.pode}>{v.ocupado ? 'Enviando…' : 'Enviar'}</button>
        <button type="button" className="btn btn-outline" onClick={v.fechar} disabled={v.ocupado}>Cancelar</button>
      </>}>
      {pronto ? (
        <Vazio compacto icone="checkCircle" titulo="Enviado" texto={'“' + a.nomeFinal + '” está na pasta da ' + (v.empresa?.nome ?? 'empresa') + '. O cliente vê em Documentos › Do escritório em até 30 minutos.'} />
      ) : <>
        <div className="field">
          <span className="field-rotulo">Empresa</span>
          <BuscaDeEmpresa empresas={v.empresas} escolhida={v.empresa} onEscolher={v.setEmpresa} autoFocus={!v.empresa} />
          <small className="hint">Só as empresas com acesso à Área do Cliente.</small>
        </div>
        <div className="field">
          <span className="field-rotulo">Área</span>
          <Segmentado valor={v.area} onMudar={v.setArea} opcoes={v.areas.map(x => ({ valor: x.valor, rotulo: x.rotulo }))} />
        </div>
        {/* o arquivo com a peça "Escolher arquivos" do nads (fora do .field: a regra do .field label deforma o quadro) */}
        <div>
          <span className="field-rotulo">Arquivo</span>
          <CampoArquivo aceitar="*" arquivo={v.arquivo} onEscolher={f => v.setArquivo(f)} desabilitado={v.ocupado} />
          <p className="hint" style={{ marginTop: 6 }}>{v.arquivo ? v.tamanho + ' · ' : ''}Até 5 MB. Holerite não vai por aqui.</p>
          {v.erroDoArquivo && <p className="hint registro-dica-erro" role="alert">{v.erroDoArquivo}</p>}
        </div>
        {a.fase === 'enviando' && <p className="hint" role="status">{a.texto}</p>}
        {a.fase === 'erro' && <p className="hint registro-dica-erro" role="alert">{a.texto}</p>}
      </>}
    </JanelaPequena>
  );
}
