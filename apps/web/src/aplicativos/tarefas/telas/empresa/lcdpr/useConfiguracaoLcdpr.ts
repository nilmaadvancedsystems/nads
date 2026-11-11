// ViewModel de LCDPR › Configuração (a "Configuração geral" do lcdpr.html): o CPF/CNPJ do produtor, os padrões do
// lançamento (conta credora, tipo de documento, imóvel, tipo de lançamento e a categoria do CT-e) e o backup e a limpeza
// (exportar e importar as regras em JSON; tirar todos os lançamentos importados). Cada campo grava ao sair dele.
import { formatos, lcdpr } from '@nads/core';
import { baixarArquivo, useRetorno } from '@nads/ui';
import { useLcdpr } from '../../../dados/repo';
import { useRegrasDoLcdpr } from './useRegrasDoLcdpr';
import { mudarCadaMes, mudarTela, useSessaoDoLcdpr } from './useSessaoDoLcdpr';

type CampoGeral = keyof lcdpr.ConfigGeral;
const opcoes = (lista: readonly lcdpr.CodigoDescricao[]) => lista.map(t => ({ valor: t.codigo, rotulo: t.codigo + ' — ' + t.descricao }));

export function useConfiguracaoLcdpr() {
  const r = useRegrasDoLcdpr();
  const { modal, toast, aviso } = useRetorno();
  const s = useSessaoDoLcdpr();
  const repo = useLcdpr();
  // os históricos e as contas do movimento do Alterdata (11/11/2026: "falta bastante historico")
  const aprendidos = s.empresa != null ? repo.cadastros(s.empresa).cadastros : lcdpr.cadastrosVazios();
  const mesAno = (c: string) => (c ? c.slice(5) + '/' + c.slice(0, 4) : '');
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

    /** o que veio da planilha do movimento do Alterdata ('' = nada importado ainda) */
    alterdata: aprendidos.historicos.length
      ? aprendidos.historicos.length + ' históricos e ' + aprendidos.contas.length + ' contas de ' + aprendidos.lancamentos.toLocaleString('pt-BR') + ' lançamentos'
        + (aprendidos.de ? ' (' + mesAno(aprendidos.de) + ' a ' + mesAno(aprendidos.ate) + ')' : '') + ' · ' + aprendidos.arquivo
      : '',
    async importarAlterdata(f: File | null) {
      if (!f || s.empresa == null) return;
      try {
        const c = lcdpr.cadastrosDoMovimento(lcdpr.linhasDaPlanilhaDoMovimento(await f.arrayBuffer()), f.name, new Date().toISOString());
        if (!c.historicos.length) { aviso({ tom: 'erro', titulo: 'Nenhum histórico na planilha', texto: 'A coluna Histórico veio vazia em todas as linhas.' }); return; }
        await repo.salvarCadastros(s.empresa, c);
        toast(c.historicos.length + ' históricos e ' + c.contas.length + ' contas importados do Alterdata.');
      } catch (e) { aviso({ tom: 'erro', titulo: 'Não importou a planilha do Alterdata', texto: e instanceof Error ? e.message : String(e) }); }
    },

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
        icone: 'alert', titulo: 'Remover todos os lançamentos de ' + s.meses.map(formatos.rot).join(', ') + '?', texto: 'Saem dos meses abertos. As regras, os cadastros e os outros meses continuam.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Remover tudo', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      mudarCadaMes(x => ({ ...x, lancamentos: [], importacoes: x.importacoes.map(i => ({ ...i, ids: [] })) }), msg => aviso({ tom: 'erro', titulo: 'Não gravou o mês do LCDPR', texto: msg }));
      mudarTela(x => ({ ...x, selecionados: new Set() }));
      toast('Lançamentos do mês removidos.');
    },
  };
}
