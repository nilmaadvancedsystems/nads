// ViewModel da etapa Notas fiscais: a planilha de vendas do período (C = Data, G = Valor Bruto,
// I = Histórico) e a checagem dos meses contra o extrato do cartão.
// Origem: conciliadorZINHO.html wireStep2/proceedWith (~L1383-1440).
import { conciliadorzinho as cz } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { todasTransacoes, useSessao, type ArquivoVendas } from '../../casca/sessao';

export interface AvisoNotas { titulo: string; texto: string; outroArquivo?: boolean }

export function useNotas() {
  const s = useSessao();
  const { modal, toast } = useRetorno();
  const [aviso, setAviso] = useState<AvisoNotas | null>(null);
  const [lendo, setLendo] = useState(false);
  const vendas = s.estado.vendas;

  function seguirCom(arq: ArquivoVendas, mesesCartao: cz.Mes[], permitidos: cz.Mes[] | null) {
    const chaves = new Set(arq.meses.map(cz.chaveMes));
    s.mudar(e => ({
      ...e, vendas: arq, mesesPermitidos: permitidos,
      excluidos: permitidos ? mesesCartao.filter(m => !chaves.has(cz.chaveMes(m))) : [],
    }));
    toast('Planilha de vendas confirmada.');
    s.proxima();
  }

  async function escolher(f: File | null) {
    setAviso(null);
    if (!f) { s.mudar(e => ({ ...e, vendas: null, mesesPermitidos: null, excluidos: [] })); return; }
    if (!cz.extensaoValida(f.name, cz.EXTENSOES_VENDAS)) { setAviso({ titulo: 'Formato inválido', texto: 'Envie um arquivo no formato .xls ou .xlsx.' }); return; }
    setLendo(true);
    const r = cz.lerVendas(await f.arrayBuffer());
    setLendo(false);
    if (!r) {
      setAviso({ titulo: 'Não foi possível ler o arquivo', texto: 'Confira se a planilha segue o padrão esperado: coluna C = Data, coluna G = Valor Bruto, coluna I = Histórico (a primeira linha pode ser cabeçalho).' });
      return;
    }
    const arq: ArquivoVendas = { nome: f.name, tamanho: f.size, vendas: r.vendas, meses: r.meses };
    const mesesCartao = cz.contarMeses(todasTransacoes(s.estado));
    const { extras, comuns } = cz.compararMeses(mesesCartao, r.meses);
    if (!extras.length) { seguirCom(arq, mesesCartao, null); return; }
    if (!comuns.length) {
      setAviso({
        titulo: 'Nenhum mês em comum', outroArquivo: true,
        texto: 'A planilha de vendas é referente a ' + r.meses.map(cz.rotuloMes).join(', ') + ', mas o extrato do cartão enviado cobre ' + mesesCartao.map(cz.rotuloMes).join(', ') + ' — não há competência em comum entre os dois arquivos.',
      });
      return;
    }
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Meses fora do extrato do cartão',
      html: 'A planilha de vendas contém lançamentos de <b>' + extras.map(cz.rotuloMes).join(', ') + '</b>, que não constam no extrato do cartão enviado — a conciliação será feita apenas até onde o cartão foi enviado. Se prosseguir, o arquivo final terá <b>apenas os meses em comum</b>: <b>' + comuns.map(cz.rotuloMes).join(', ') + '</b>.',
      botoes: [{ rotulo: 'Escolher outro arquivo', valor: false, variante: 'btn-outline' }, { rotulo: 'Prosseguir mesmo assim', valor: true, variante: 'btn-primary' }],
    });
    if (ok) seguirCom(arq, mesesCartao, comuns);
  }

  return {
    aceitar: cz.EXTENSOES_VENDAS.join(','),
    arquivoNome: vendas?.nome || null,
    info: vendas ? vendas.vendas.length + ' notas · ' + vendas.meses.map(cz.rotuloMes).join(', ') : '',
    lendo, escolher,
    aviso, fecharAviso: () => setAviso(null),
    voltar: s.anterior,
    podeContinuar: !!vendas,
    continuar: s.proxima,
  };
}
