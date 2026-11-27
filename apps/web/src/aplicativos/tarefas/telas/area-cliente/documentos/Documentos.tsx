// Área do Cliente › Documentos (26/11/2026, o módulo refeito). Responde "o que entrou e o que mandamos?": os Recebidos (o
// que os clientes mandaram; tocar abre a janela com a prévia e o Recusar; "quero poder ver o arquivo direto por aqui") e os
// Enviados (o que eu mandei ao cliente; "tem que ter a opcao de subir um arquivo por aqui"). Com as peças do nads
// ("essas telas… ta toda fora dos elementos predefinidos do nads"): as abas sublinhadas, a barra com o Segmentado, o filtro
// em menu e a busca, a tabela padrão, a janela da empresa do Cadastro e o modal. Só desenha: o estado vem de useDocumentos.ts.
import { CampoArquivo, Esqueleto, Icone, IconeDeArquivo, Segmentado, Vazio, formatoPeloNome, useCarregando } from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { AvisosDaArea, JanelaPequena, Selo } from '../base/Base';
import { JanelaDoArquivo } from '../../../../cliente/partes/JanelaDoArquivo';
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
        <GruposPorEmpresa grupos={vm.gruposRecebidos} titulo={['Arquivo', 'Tipo', 'Tamanho', 'Recebido']} linha={({ r, recusa, quando, quandoCompleto, tamanho, tipo: t }) => (
          <tr key={r.id} className="linha-abre" tabIndex={0} onClick={() => vm.abrir(r)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(r); }}>
            <td className="wrap">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconeDeArquivo formato={formatoPeloNome(r.nome)} tamanho={20} />{r.nome}</span>
              {r.guia && <div className="hint">{r.guia}</div>}
            </td>
            <td>{recusa ? <Selo tom="perigo" title={recusa}>Recusado</Selo> : <Selo tom="neutro">{t}</Selo>}</td>
            <td className="num">{tamanho}</td>
            <td className="fraco" title={quandoCompleto}>{quando}</td>
          </tr>
        )} />
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
        <GruposPorEmpresa grupos={vm.gruposEnviados} titulo={['Arquivo', 'Área', 'Situação', 'Quando']} linha={x => (
          <tr key={x.id}>
            <td className="wrap"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconeDeArquivo formato={formatoPeloNome(x.nome)} tamanho={20} />{x.nome}</span></td>
            <td>{x.comoGuia ? <span className="badge badge-conferido" title="Lida como guia: está em Guias na Área do Cliente">Guia {x.comoGuia}</span> : x.areaRotulo}</td>
            <td>{x.situacao === 'pronto' ? <Selo tom="ok" title="Está na Área do Cliente">Enviado</Selo>
              : x.situacao === 'erro' ? <Selo tom="perigo" title={x.erro}>Não foi</Selo> : <Selo tom="aviso">Na fila do robô</Selo>}</td>
            <td className="fraco" title={x.quandoCompleto}>{x.quando}</td>
          </tr>
        )} />
      )}
    </>
  );
}

/**
 * Por empresa (27/11/2026: "quero que acumule por empresa"), com a peça "Grupos que abrem" do nads (a do faturamento): cada
 * empresa numa linha (o código e o nome, quantos arquivos, quando foi o último); clicar abre a tabela dos arquivos dela.
 * Com uma empresa só, já vem aberta.
 */
function GruposPorEmpresa<T>({ grupos, titulo, linha }: {
  grupos: readonly { codigo: string; nome: string; itens: T[]; quando: string; resumo: string }[];
  titulo: readonly string[]; linha: (x: T) => ReactNode;
}) {
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const aberto = (c: string) => grupos.length === 1 || abertos.has(c);
  const alternar = (c: string) => setAbertos(a => { const n = new Set(a); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  return (
    <div className="fat-grupos area-grupos">
      {grupos.map(g => (
        <div key={g.codigo || g.nome} className={'fat-grupo' + (aberto(g.codigo || g.nome) ? ' aberto' : '')}>
          <button type="button" className="fat-grupo-linha" aria-expanded={aberto(g.codigo || g.nome)} onClick={() => alternar(g.codigo || g.nome)}>
            <Icone nome={aberto(g.codigo || g.nome) ? 'chevronDown' : 'chevronRight'} width={14} height={14} />
            <span className="fat-grupo-nome">{g.codigo && <b className="num">{g.codigo}</b>}{g.codigo ? ' · ' : ''}{g.nome || '—'}</span>
            <span className="fraco">{g.resumo}</span>
            <span className="fraco">{g.quando}</span>
          </button>
          {aberto(g.codigo || g.nome) && (
            <div className="table-wrap fat-grupo-notas">
              <table className="table-compact">
                <thead><tr>{titulo.map((t, i) => <th key={t} className={t === 'Tamanho' ? 'num' : undefined} style={i === 0 ? undefined : { width: 1, whiteSpace: 'nowrap' }}>{t}</th>)}</tr></thead>
                <tbody>{g.itens.map(linha)}</tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * O recebido aberto: a janela de arquivo da Área do Cliente (o PDF em páginas, sem o leitor do navegador; 26/11/2026:
 * "visualizacao horrivel", "esse jeito aqui ta terrivel"), com o Baixar, o Recusar e as setas pela lista. Enquanto o robô
 * traz o arquivo (ou se não deu), o modal pequeno diz.
 */
function JanelaDoRecebido({ vm }: { vm: Vm }) {
  const r = vm.aberto!;
  const p = vm.previa;
  const recusa = vm.recusaDe(r);
  const recusar = recusa
    ? <span className="badge badge-bad" title={recusa}>Recusado</span>
    : <button type="button" className="btn btn-danger" onClick={vm.recusa.abrir}>Recusar</button>;
  return (
    <>
      {p?.estado === 'pronto' && p.arquivo ? (
        <JanelaDoArquivo arquivo={p.arquivo} sub={vm.subDoAberto(r)} acoes={recusar} onBaixar={vm.baixarAberto} onFechar={vm.fechar}
          onAnterior={vm.anterior} onProximo={vm.proximo} posicao={vm.posicao} />
      ) : (
        <JanelaPequena titulo={r.nome} sub={vm.subDoAberto(r)} onFechar={vm.fechar}
          rodape={<>{!recusa && <button type="button" className="btn btn-danger" onClick={vm.recusa.abrir}>Recusar</button>}<button type="button" className="btn btn-outline" onClick={vm.fechar}>Fechar</button></>}>
          {!p || p.estado === 'buscando'
            ? <p className="hint" role="status"><span className="btn-spinner" aria-hidden="true" /> {p?.texto || 'Buscando o arquivo no Drive…'}</p>
            : <p className="hint registro-dica-erro" role="alert">{p.texto}</p>}
          {recusa && <p className="hint">Recusado: {recusa}</p>}
        </JanelaPequena>
      )}
      {vm.recusa.aberta && <JanelaDaRecusa vm={vm} />}
    </>
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
  // pronto: todos foram (com vários, o resumo dos nomes)
  const pronto = v.enviadosAgora.length > 0 && !v.ocupado && !v.arquivos.length;
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
        <Vazio compacto icone="checkCircle" titulo={v.enviadosAgora.length === 1 ? 'Enviado' : v.enviadosAgora.length + ' arquivos enviados'}
          texto={(v.enviadosAgora.length === 1 ? '“' + v.enviadosAgora[0] + '”' : v.enviadosAgora.join(', ')) + ' — na Área do Cliente da ' + (v.empresa?.nome ?? 'empresa') + ', em Documentos › Do escritório.'} />
      ) : <>
        {/* o arquivo com a peça "Escolher arquivos" do nads (fora do .field: a regra do .field label deforma o quadro) */}
        {/* os arquivos (26/11/2026: "tenho que poder selecionar mais de um arquivo"), com a peça "Escolher arquivos" do nads
            (fora do .field: a regra do .field label deforma o quadro) */}
        <div>
          <span className="field-rotulo">Arquivos</span>
          <CampoArquivo aceitar="*" multiplo onEscolherVarios={fs => v.escolher(fs)} desabilitado={v.ocupado} />
          {v.arquivos.length > 0 && (
            <ul className="ent-linhas" style={{ marginTop: 8 }}>
              {v.arquivos.map(f => (
                <li key={f.nome}>
                  <IconeDeArquivo formato={formatoPeloNome(f.nome)} tamanho={20} />
                  <div><b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nome}</b><span className="fraco">{f.tamanho}{f.erro ? ' · ' + f.erro : ''}</span></div>
                  <button type="button" className="janela-x" aria-label={'Tirar ' + f.nome} title="Tirar" disabled={v.ocupado} onClick={() => v.tirar(f.nome)}><Icone nome="x" width={16} height={16} /></button>
                </li>
              ))}
            </ul>
          )}
          <p className="hint" style={{ marginTop: 6 }}>Pode escolher vários. Até 5 MB cada. Holerite não vai por aqui.</p>
        </div>
        <div className="field">
          <span className="field-rotulo">Empresa</span>
          <BuscaDeEmpresa empresas={v.empresas} escolhida={v.empresa} onEscolher={v.setEmpresa} />
          <small className="hint">{v.adivinhado ? 'Preenchido pelo arquivo: ' + v.adivinhado + '. Confira antes de enviar.' : 'Vem sozinha pelo arquivo, quando dá. Só as empresas com acesso à Área do Cliente.'}</small>
        </div>
        <div className="field">
          <span className="field-rotulo">Área</span>
          <Segmentado valor={v.area} onMudar={v.setArea} opcoes={v.areas.map(x => ({ valor: x.valor, rotulo: x.rotulo }))} />
        </div>
        {a.fase === 'enviando' && <p className="hint" role="status">{v.vez ? v.vez + ' · ' : ''}{a.texto}</p>}
        {a.fase === 'erro' && <p className="hint registro-dica-erro" role="alert">{a.texto}</p>}
      </>}
    </JanelaPequena>
  );
}
