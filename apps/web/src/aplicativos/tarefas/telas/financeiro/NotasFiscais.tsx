// Financeiro › Notas fiscais (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): no topo o estado do
// emissor (o robô, o ambiente e o que falta configurar), a barra (busca, filtro e Nova nota) e a lista das notas, a mais
// nova primeiro. Clicar na linha abre a nota; "Nova nota" abre a janela de criar.
import { formatos, nfse } from '@nads/core';
import { Alerta, Icone, Segmentado, useCarregando, Vazio } from '@nads/ui';
import { dataBr, documentoFormatado } from './formatosDaNota';
import { JanelaDaNota } from './JanelaDaNota';
import { JanelaImportarPlanilha } from './JanelaImportarPlanilha';
import { JanelaNovaNota } from './JanelaNovaNota';
import { FILTROS_DE_NOTAS, useNotasFiscais } from './useNotasFiscais';
import { useRelogio } from './useRelogio';

export function NotasFiscais() {
  const vm = useNotasFiscais();
  // o andamento das que estão andando conta sozinho (15/10/2026: "não consegue ter o feedback do robô de como tá indo?")
  const agora = useRelogio(vm.linhas.some(n => nfse.andando(n.status)));
  useCarregando(vm.carregando);
  const r = vm.robo;
  return (
    <section>
      {vm.nova && <JanelaNovaNota fechar={() => vm.setNova(false)} />}
      {vm.importando && <JanelaImportarPlanilha fechar={() => vm.setImportando(false)} />}
      {vm.corrigindo && <JanelaNovaNota nota={vm.corrigindo} fechar={vm.fecharCorrecao} />}
      {vm.aberta && <JanelaDaNota id={vm.aberta} fechar={() => vm.setAberta(null)} corrigir={vm.corrigir} />}

      {/* o estado do emissor numa faixa curta: o robô, o ambiente */}
      <div className="nf-faixa">
        <span className="nf-faixa-item">
          <Icone nome="robo" />
          Robô
          <span className={'badge ' + (!r.carregado ? 'badge-neutral' : r.ligado ? 'badge-ok' : 'badge-bad')}>{!r.carregado ? 'Lendo…' : r.ligado ? 'Ligado' : 'Desligado'}</span>
          {r.carregado && (r.ligado
            ? r.certificado && <span className="fraco">certificado de {r.certificado.titular}, válido até {dataBr(r.certificado.validade)}</span>
            : r.motivo && <span className="fraco">{r.motivo}</span>)}
        </span>
        <span className="nf-faixa-item">
          {vm.ambiente === 'producao'
            ? <span className="badge badge-ok">Produção</span>
            : <span className="badge badge-warn">Homologação — sem valor fiscal</span>}
        </span>
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
      </div>
      {vm.faltas.length > 0 && (
        <div className="alerta-linha">
          <Alerta titulo="Para emitir, falta" texto={vm.faltas.join(', ') + '.'}>
            <div className="btn-row"><button type="button" className="btn" onClick={vm.irParaConfiguracoes}>Abrir as configurações</button></div>
          </Alerta>
        </div>
      )}
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      <div className="tarefas-barra-topo nf-barra">
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" autoFocus placeholder="Buscar nota" aria-label="Buscar nota (nome, CPF ou CNPJ, descrição, número)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <Segmentado valor={vm.filtro} opcoes={FILTROS_DE_NOTAS} onMudar={vm.setFiltro} />
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" onClick={() => vm.setImportando(true)}><Icone nome="upload" />Importar planilha</button>
        <button type="button" className="btn btn-primary" onClick={() => vm.setNova(true)}><Icone nome="plus" />Nova nota</button>
      </div>

      {!vm.carregando && !vm.linhas.length ? (
        <Vazio icone="recibo" titulo={vm.total ? 'Nenhuma nota com isso' : 'Nenhuma nota ainda'}>
          {/* a saída do vazio (revisão da UI, 18/10/2026) */}
          {vm.total ? <button type="button" className="btn btn-outline" onClick={() => { vm.setBusca(''); vm.setFiltro('todas'); }}>Limpar a busca e o filtro</button>
            : <button type="button" className="btn btn-primary" onClick={() => vm.setNova(true)}><Icone nome="plus" />Emitir a primeira nota</button>}
        </Vazio>
      ) : (
        <div className="table-wrap">
          <table className="tabela-empresas cad-lista nf-lista">
            <thead><tr><th>Nº</th><th>Tomador</th><th>Descrição</th><th className="nf-direita">Valor</th><th>Serviço</th><th>Situação</th></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(n => {
                const s = nfse.rotuloDoStatus(n.status);
                return (
                  <tr key={n.id} className="linha-abre" tabIndex={0} title="Abrir a nota" onClick={() => vm.setAberta(n.id)} onKeyDown={e => { if (e.key === 'Enter') vm.setAberta(n.id); }}>
                    <td className="num">{n.numeroNfse || '—'}</td>
                    <td><span className="cad-empresa-nome">{n.tomador.nome}</span><span className="fraco nf-doc">{documentoFormatado(n.tomador.documento)}</span></td>
                    <td><span className="nf-corta" title={n.servico.descricao}>{n.servico.descricao}</span></td>
                    <td className="num nf-direita">{formatos.reais(n.servico.valor)}</td>
                    <td className="num fraco">{dataBr(n.servico.competencia)}</td>
                    <td>
                      <span className={'badge badge-' + s.tom}>{nfse.andando(n.status) && <span className="btn-spinner nf-roda" aria-hidden="true" />}{s.rotulo}</span>
                      {nfse.andando(n.status) && <span className="nf-andamento-linha">{nfse.andamentoDaNota(n, agora)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
