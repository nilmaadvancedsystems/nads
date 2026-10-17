// LCDPR › Configuração (a "Configuração geral" do lcdpr.html), no estilo das configurações do Notion (como o Financeiro ›
// Configurações): o produtor, os padrões do lançamento e o backup e a limpeza. Cada campo grava ao sair dele.
import { CampoArquivo, ConfigLinha, ConfigSecao, Icone, MenuSuspenso, useCarregando } from '@nads/ui';
import { useConfiguracaoLcdpr } from './useConfiguracaoLcdpr';

const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };

export function ConfiguracaoLcdpr() {
  const vm = useConfiguracaoLcdpr();
  useCarregando(!vm.carregada);
  if (!vm.carregada) return null;
  /** um campo de texto que grava ao sair (a chave refaz o valor mostrado quando o gravado muda) */
  const campo = (id: 'cpfProdutor' | 'contaCredoraPadrao', valor: string, rotulo: string, modo?: 'numeric') => (
    <input key={id + '|' + valor} type="text" className="nf-entrada" aria-label={rotulo} defaultValue={valor} inputMode={modo} disabled={!!vm.erro}
      onBlur={e => { if (e.target.value !== valor) vm.definir(id, e.target.value); }} onKeyDown={enter} />
  );
  const escolha = (id: 'tipoDocPadrao' | 'imovelPadrao' | 'tipoLancPadrao' | 'categoriaFretesCTe', o: typeof vm.tipoDoc, titulo: string) => (
    <MenuSuspenso rotulo={o.rotulo} className="btn btn-outline" titulo={titulo} direita largura={340}
      itens={o.opcoes.map(x => ({ rotulo: x.rotulo, marcado: x.valor === o.atual, onClick: () => vm.definir(id, x.valor) }))} />
  );
  return (
    <>
      {vm.exemplos && <p className="registro-dica nf-exemplos"><Icone nome="alert" />Dados de exemplo: nada do que mudar aqui vai para o banco.</p>}
      {vm.erro && <p className="registro-dica registro-dica-erro nf-exemplos"><Icone nome="alert" />{vm.erro}</p>}

      <ConfigSecao titulo="Produtor">
        <ConfigLinha titulo="CPF/CNPJ do produtor" descricao="O CT-e só entra quando o destinatário é este documento (o frete pago pela trading fica de fora).">
          {campo('cpfProdutor', vm.cpf, 'CPF/CNPJ do produtor', 'numeric')}
        </ConfigLinha>
      </ConfigSecao>

      <ConfigSecao titulo="Padrões do lançamento">
        <ConfigLinha titulo="Conta credora" descricao="A contrapartida de todo lançamento.">
          {campo('contaCredoraPadrao', vm.contaCredora, 'Conta credora', 'numeric')}
        </ConfigLinha>
        <ConfigLinha titulo="Tipo de documento">{escolha('tipoDocPadrao', vm.tipoDoc, 'Tipo de documento')}</ConfigLinha>
        <ConfigLinha titulo="Imóvel" descricao="Quando a IE do destinatário da nota não está em Tabelas de apoio › IE → imóvel.">{escolha('imovelPadrao', vm.imovel, 'Imóvel')}</ConfigLinha>
        <ConfigLinha titulo="Tipo de lançamento">{escolha('tipoLancPadrao', vm.tipoLanc, 'Tipo de lançamento')}</ConfigLinha>
        <ConfigLinha titulo="Categoria do CT-e" descricao="Todo CT-e é frete: vai para esta categoria.">{escolha('categoriaFretesCTe', vm.categoriaCte, 'Categoria do CT-e')}</ConfigLinha>
      </ConfigSecao>

      <ConfigSecao titulo="Backup e limpeza">
        <ConfigLinha titulo="Exportar backup" descricao="As regras e os cadastros num arquivo .json.">
          <button type="button" className="btn btn-outline" onClick={vm.exportarBackup}><Icone nome="download" />Exportar</button>
        </ConfigLinha>
        <ConfigLinha titulo="Importar backup" descricao="Troca as regras e os cadastros pelos do arquivo (vale para todos que usam o LCDPR).">
          <label className="btn btn-outline" htmlFor="lcdpr-backup" aria-disabled={!!vm.erro || undefined}><Icone nome="upload" />Importar</label>
          <CampoArquivo semCaixa id="lcdpr-backup" aceitar=".json,application/json" desabilitado={!!vm.erro} onEscolher={f => { void vm.importarBackup(f); }} />
        </ConfigLinha>
        <ConfigLinha titulo="Limpar lançamentos importados" descricao="Tira todos os lançamentos desta sessão. As regras e os cadastros continuam.">
          <button type="button" className="btn btn-danger" disabled={!vm.lancamentos} onClick={() => void vm.limparLancamentos()}><Icone nome="x" />Limpar</button>
        </ConfigLinha>
      </ConfigSecao>
    </>
  );
}
