// ViewModel de LCDPR › Configuração (a "Configuração geral" do lcdpr.html): o CPF/CNPJ do produtor, os padrões do
// lançamento (conta credora, tipo de documento, imóvel, tipo de lançamento e a categoria do CT-e) e o backup e a limpeza
// (exportar e importar as regras em JSON; tirar todos os lançamentos importados). Cada campo grava ao sair dele.
import { lcdpr } from '@nads/core';
import { baixarArquivo, useRetorno } from '@nads/ui';
import { useRegrasDoLcdpr } from './useRegrasDoLcdpr';
import { mudarSessao, useSessaoDoLcdpr } from './useSessaoDoLcdpr';

type CampoGeral = keyof lcdpr.ConfigGeral;
const opcoes = (lista: readonly lcdpr.CodigoDescricao[]) => lista.map(t => ({ valor: t.codigo, rotulo: t.codigo + ' — ' + t.descricao }));

export function useConfiguracaoLcdpr() {
  const r = useRegrasDoLcdpr();
  const { modal, toast, aviso } = useRetorno();
  const s = useSessaoDoLcdpr();
  const c = r.config;
  const definir = (campo: CampoGeral, valor: string) => {
    const atual = r.atual();
    const v = campo === 'cpfProdutor' ? lcdpr.soDigitos(valor) : valor.trim();
    if (atual.config[campo] === v) return;
    void r.gravar({ ...atual, config: { ...atual.config, [campo]: v } });
  };
  /** o rótulo da opção escolhida (o código que não está mais na lista aparece como está) */
  const rotulo = (lista: { valor: string; rotulo: string }[], v: string) => lista.find(o => o.valor === v)?.rotulo || v || 'Escolher';
  const tiposDoc = opcoes(c.tipoDoc), imoveis = opcoes(c.imoveis), tiposLanc = opcoes(c.tipoLanc);
  const categorias = c.categorias.map(x => ({ valor: x.nome, rotulo: x.nome }));
  return {
    carregada: r.carregada, erro: r.erro, exemplos: r.exemplos, semDocumento: r.semDocumento,
    cpf: lcdpr.cpfCnpjFormatado(c.config.cpfProdutor) || c.config.cpfProdutor,
    contaCredora: c.config.contaCredoraPadrao,
    tipoDoc: { atual: c.config.tipoDocPadrao, rotulo: rotulo(tiposDoc, c.config.tipoDocPadrao), opcoes: tiposDoc },
    imovel: { atual: c.config.imovelPadrao, rotulo: rotulo(imoveis, c.config.imovelPadrao), opcoes: imoveis },
    tipoLanc: { atual: c.config.tipoLancPadrao, rotulo: rotulo(tiposLanc, c.config.tipoLancPadrao), opcoes: tiposLanc },
    categoriaCte: { atual: c.config.categoriaFretesCTe, rotulo: rotulo(categorias, c.config.categoriaFretesCTe), opcoes: categorias },
    definir,
    lancamentos: s.lancamentos.length,

    exportarBackup: () => baixarArquivo(lcdpr.backupDaConfig(r.atual()), lcdpr.NOME_DO_BACKUP, 'application/json'),
    async importarBackup(f: File | null) {
      if (!f) return;
      try {
        const nova = lcdpr.configDoBackup(await f.text(), r.atual());
        // o documento é um só para todo o escritório (e a página antiga do Entregas): pergunta antes de trocar
        const ok = await modal({
          icone: 'alert', titulo: 'Trocar as regras pelas do backup?', texto: 'As categorias, as regras de NCM, o plano de contas, as tabelas e a configuração passam a ser as de "' + f.name + '", para todos que usam o LCDPR.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Trocar', valor: true, variante: 'btn-danger' }],
        });
        if (ok && (await r.gravar(nova))) toast('Backup importado.');
      } catch (e) { aviso({ tom: 'erro', titulo: 'Backup inválido', texto: e instanceof Error ? e.message : String(e) }); }
    },
    async limparLancamentos() {
      const ok = await modal({
        icone: 'alert', titulo: 'Remover todos os lançamentos importados?', texto: 'As regras e os cadastros continuam.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Remover tudo', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      mudarSessao(x => ({ ...x, lancamentos: [], selecionados: new Set(), importacoes: x.importacoes.map(i => ({ ...i, ids: [] })) }));
      toast('Lançamentos removidos.');
    },
  };
}
