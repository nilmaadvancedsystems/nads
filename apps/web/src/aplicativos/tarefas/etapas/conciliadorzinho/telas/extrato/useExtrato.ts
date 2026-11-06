// ViewModel da etapa Extrato de uma bandeira: um ou vários arquivos (Data, Valor Bruto, Taxa),
// as competências achadas, a conta contábil da bandeira e a confirmação.
// Origem: conciliadorZINHO.html wireBrandStep (~L1300), renderBrandFileList (~L1265),
// renderBrandMonthsSummary (~L1287), checkBrandContinue (~L1295).
import { conciliadorzinho as cz } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { transacoesDa, useSessao, type ArquivoExtrato } from '../../casca/sessao';

export interface FalhaArquivo { nome: string; motivo: string }

let proximoId = 1;

function tamanho(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export function useExtrato(b: cz.IdBandeira) {
  const s = useSessao();
  const { modal, toast } = useRetorno();
  const [falhas, setFalhas] = useState<FalhaArquivo[]>([]);
  const rotulo = cz.bandeira(b).rotulo;
  const dados = s.estado.dados[b] || { arquivos: [], conta: '' };
  const transacoes = transacoesDa(s.estado, b);
  const meses = cz.contarMeses(transacoes);
  const i = s.estado.bandeiras.indexOf(b);
  const proxima = s.estado.bandeiras[i + 1];

  const mudarDados = (f: (d: typeof dados) => typeof dados) =>
    s.mudar(e => ({ ...e, dados: { ...e.dados, [b]: f(e.dados[b] || { arquivos: [], conta: '' }) } }));

  async function adicionar(arquivos: File[]) {
    setFalhas([]);
    const lidos: ArquivoExtrato[] = [];
    const erros: FalhaArquivo[] = [];
    for (const f of arquivos) {
      if (!cz.extensaoValida(f.name, cz.EXTENSOES_EXTRATO)) { erros.push({ nome: f.name, motivo: 'formato não suportado.' }); continue; }
      const r = cz.lerExtrato(await f.arrayBuffer());
      if (!r) { erros.push({ nome: f.name, motivo: 'confira se segue o padrão coluna A = Data, coluna B = Valor Bruto, coluna C = Valor da Taxa.' }); continue; }
      lidos.push({ id: proximoId++, nome: f.name, tamanho: f.size, transacoes: r.transacoes });
    }
    if (lidos.length) mudarDados(d => ({ ...d, arquivos: [...d.arquivos, ...lidos] }));
    setFalhas(erros);
  }

  async function continuar() {
    const conta = dados.conta.trim();
    const ok = await modal<boolean>({
      icone: 'landmark', titulo: 'Confirmar extrato da ' + rotulo,
      html: 'Foram lidos <b>' + transacoes.length + ' lançamentos</b> em ' + dados.arquivos.length + ' arquivo(s), referentes a: <b>' + meses.map(cz.rotuloMes).join(', ') + '</b>, na conta <b>' + escapar(conta) + '</b>. Confirma?',
      botoes: [{ rotulo: 'Revisar', valor: false, variante: 'btn-outline' }, { rotulo: 'Sim, confirmar', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    toast(rotulo + ' confirmada — ' + meses.length + (meses.length === 1 ? ' competência' : ' competências') + ', ' + transacoes.length + ' lançamentos');
    s.proxima();
  }

  return {
    rotulo,
    aceitar: cz.EXTENSOES_EXTRATO.join(','),
    arquivos: dados.arquivos.map(a => ({ id: a.id, nome: a.nome, info: tamanho(a.tamanho) + ' · ' + a.transacoes.length + ' lançamentos' })),
    adicionar,
    remover: (id: number) => mudarDados(d => ({ ...d, arquivos: d.arquivos.filter(a => a.id !== id) })),
    falhas, fecharFalhas: () => setFalhas([]),
    meses: meses.map(m => ({ rotulo: cz.rotuloMes(m), qtd: m.qtd })),
    conta: dados.conta,
    setConta: (v: string) => mudarDados(d => ({ ...d, conta: v })),
    podeContinuar: transacoes.length > 0 && !!dados.conta.trim(),
    textoContinuar: proxima ? 'Continuar para ' + cz.bandeira(proxima).rotulo : 'Continuar para notas fiscais',
    continuar,
    voltar: s.anterior,
  };
}

function escapar(t: string): string {
  return t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}
