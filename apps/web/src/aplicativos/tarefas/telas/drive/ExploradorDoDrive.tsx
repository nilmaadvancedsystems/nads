// Drive › Pastas: a pasta do ano como o robô do Entregas mapeia. Na raiz, as pastas de cliente; dentro, a trilha,
// a busca (a pasta aberta e tudo abaixo), a lista (pastas primeiro) e a seleção para baixar (um arquivo, ou vários
// num .zip), além do .zip da pasta inteira. Clicar num arquivo abre no navegador: a aba nasce no clique (senão o
// navegador bloqueia) e recebe o link quando o robô termina de buscar.
import type { entregas as e } from '@nads/core';
import { Icone, useCarregando } from '@nads/ui';
import { useExploradorDoDrive, type VmDrive } from './useExploradorDoDrive';

const quando = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

function baixar(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function abrirArquivo(vm: VmDrive, it: e.ItemDoDrive) {
  const janela = window.open('', '_blank');
  if (janela) { try { janela.document.title = 'Abrindo ' + it.n; janela.document.body.textContent = 'Buscando "' + it.n + '" no Drive…'; } catch { /* outra origem */ } }
  vm.linkParaAbrir(it).then(url => {
    if (janela && !janela.closed) janela.location.href = url; else window.open(url, '_blank');
  }, () => { try { janela?.close(); } catch { /* já fechou */ } });
}

function IconeDoItem({ it }: { it: e.ItemDoDrive }) {
  return <Icone nome={it.t === 'd' ? 'pasta' : it.t === 'g' ? 'fileText' : 'arquivo'} className={'drive-ico' + (it.t === 'd' ? ' pasta' : '')} />;
}

function Linha({ vm, it, onde }: { vm: VmDrive; it: e.ItemDoDrive; onde: string }) {
  const pasta = it.t === 'd';
  const dentro = pasta ? vm.quantos(it) : null;
  const abrir = () => (pasta ? vm.abrirPasta(it.i) : abrirArquivo(vm, it));
  return (
    <tr className="linha-abre" tabIndex={0} onClick={abrir} onKeyDown={ev => { if (ev.key === 'Enter') abrir(); }}>
      <td className="drive-marca" onClick={ev => ev.stopPropagation()}>
        {!pasta && <input type="checkbox" aria-label={'Marcar ' + it.n} checked={vm.estaMarcado(it)} onChange={() => vm.marcar(it)} />}
      </td>
      <td>
        <span className="drive-nome"><IconeDoItem it={it} /><span>{it.n}{onde && <span className="fraco drive-onde">{onde}</span>}</span></span>
      </td>
      <td className="fraco num">{pasta ? (dentro?.arquivos ?? 0) + ' arq.' : vm.tamanho(it.s)}</td>
      <td className="fraco num">{quando(it.m)}</td>
    </tr>
  );
}

export function ExploradorDoDrive() {
  const vm = useExploradorDoDrive();
  useCarregando(vm.carregando);
  const baixarMarcados = () => { vm.linkDosMarcados().then(url => { baixar(url); vm.limparSelecao(); }, () => {}); };
  const baixarPasta = () => { vm.linkDaPasta().then(baixar, () => {}); };
  const lista = vm.buscando ? vm.achados : vm.filhos;

  return (
    <section>
      <div className="tarefas-barra-topo">
        <nav className="drive-trilha" aria-label="Onde estou">
          <button type="button" className="btn btn-ghost btn-sm" onClick={vm.irParaRaiz}><Icone nome="pasta" />{vm.ano}</button>
          {vm.pastaCliente && (
            <><span className="drive-sep">›</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => vm.abrirCliente(vm.pastaCliente?.id || '')}>{vm.pastaCliente.nomePasta}</button></>
          )}
          {vm.caminho.map(p => (
            <span key={p.id} className="drive-trilha-item"><span className="drive-sep">›</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => vm.abrirPasta(p.id)}>{p.nome}</button></span>
          ))}
        </nav>
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder={vm.naRaiz ? 'Buscar cliente' : 'Buscar nesta pasta'} aria-label="Buscar" value={vm.busca}
            onChange={ev => vm.setBusca(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Escape') vm.setBusca(''); }} />
        </label>
        {vm.marcados.length > 0 && (
          <>
            <button type="button" className="btn btn-primary" onClick={baixarMarcados}><Icone nome="download" />Baixar ({vm.marcados.length})</button>
            <button type="button" className="btn btn-outline" onClick={vm.limparSelecao}>Limpar</button>
          </>
        )}
        {!vm.naRaiz && !vm.marcados.length && <button type="button" className="btn btn-outline" onClick={baixarPasta}><Icone nome="download" />Baixar pasta</button>}
      </div>

      {vm.erro && <div className="alert"><Icone nome="alert" /><div><p className="alert-text">{vm.erro}</p></div></div>}
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: as pastas são inventadas e nenhum arquivo abre de verdade.</p>}

      {vm.naRaiz ? (
        <div className="table-wrap">
          <table className="tabela-empresas">
            <thead><tr><th>Código</th><th>Pasta do cliente</th><th>Arquivos</th><th>Tamanho</th><th>Modificado</th></tr></thead>
            <tbody>
              {!vm.carregando && vm.clientes.map(c => (
                <tr key={c.id} className="linha-abre" tabIndex={0} onClick={() => vm.abrirCliente(c.id)} onKeyDown={ev => { if (ev.key === 'Enter') vm.abrirCliente(c.id); }}>
                  <td className="num">{c.codigo || '—'}</td>
                  <td><span className="drive-nome"><Icone nome="pasta" className="drive-ico pasta" /><span>{c.nome || c.nomePasta}</span></span></td>
                  <td className="fraco num">{c.arquivos}</td>
                  <td className="fraco num">{vm.tamanho(c.bytes)}</td>
                  <td className="fraco num">{quando(c.mod)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!vm.carregando && !vm.clientes.length && <p className="empty">Nenhuma pasta com isso.</p>}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tabela-empresas drive-tabela">
            <thead><tr><th /><th>Nome</th><th>Tamanho</th><th>Modificado</th></tr></thead>
            <tbody>
              {!vm.carregando && lista.map(x => <Linha key={x.item.i} vm={vm} it={x.item} onde={x.onde} />)}
            </tbody>
          </table>
          {!vm.carregando && !lista.length && <p className="empty">{vm.buscando ? 'Nada com esse nome aqui dentro.' : 'Pasta vazia.'}</p>}
        </div>
      )}

      {vm.pedidos.length > 0 && (
        <div className="drive-pedidos" role="status" aria-live="polite">
          {vm.pedidos.map(p => <div key={p.id} className="drive-pedido"><span className="drive-girando" aria-hidden="true" />{p.texto}</div>)}
        </div>
      )}
    </section>
  );
}
