// ViewModel da nota original (23/10/2026: "eu queria realmente ver a nota, com produtos e tal, a nota original"): o
// resumo do SIEG não guarda a descrição dos produtos, então o XML inteiro vem na hora, pelo mesmo pedido do ".zip das
// notas que faltam no Alterdata" com uma chave só (o robô do PC pega no SIEG pela chave, ou no .zip do mês no Drive, e
// entrega o .zip; o nads abre, lê o XML e monta a DANFE, core tarefas.sieg.danfeDoXml). A nota já aberta fica guardada
// nesta aba. Nos exemplos, um XML montado do resumo (com descrições inventadas), só para ver a tela. Enquanto o pedido
// espera, a tela diz o que o robô está fazendo e quantos pedidos há na fila, ou que ele está fora do ar (26/10/2026: "ta
// bugado ou demora muito para puxar a nota"; a nota passa na frente da fila no robô).
import { tarefas as t } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { lerXmlsDosArquivos } from '../../../dados/arquivosXml';
import { useSieg } from '../../../dados/repo';

const jaAbertas = new Map<string, { xml: string; danfe: t.sieg.Danfe }>();

/** a competência da nota pela data dela (dd/mm/aaaa), quando quem chama não diz */
/** o que dizer enquanto o pedido espera o robô pegar: fora do ar (sem sinal há 3 min), ocupado com outro pedido, ou já vai */
function esperandoORobo(r: { carregado: boolean; ligado: boolean; em: string; situacao: string; naFila: number }): string {
  if (!r.carregado) return 'Pedindo a nota ao robô…';
  const sinal = Date.parse(r.em);
  if (!r.ligado || !sinal || Date.now() - sinal > 3 * 60_000) {
    return 'O robô do SIEG está fora do ar' + (sinal ? ' desde ' + new Date(sinal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '') + ': a nota vem quando ele voltar.';
  }
  if (r.situacao && r.situacao !== 'livre') return 'Na fila: o robô está ' + r.situacao + '. A nota é a próxima.';
  return 'Pedindo a nota ao robô…';
}

const competenciaDaData = (data: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(data); return m ? m[3] + '-' + m[2] : ''; };

/** nos exemplos: um XML do resumo, com descrições inventadas */
function xmlDeExemplo(n: t.sieg.NotaDoSieg): string {
  const itens = (n.itens?.length ? n.itens : [{ ncm: '00000000', cfop: n.cfop || '5102', cst: '000', cest: '', valor: n.valor }]).map((i, k) =>
    `<det nItem="${k + 1}"><prod><cProd>EX-${k + 1}</cProd><xProd>PRODUTO DE EXEMPLO ${k + 1}</xProd><NCM>${i.ncm}</NCM><CFOP>${i.cfop}</CFOP><uCom>UN</uCom><qCom>1</qCom><vUnCom>${i.valor}</vUnCom><vProd>${i.valor}</vProd></prod><imposto><ICMS><ICMS00><orig>0</orig><CST>${i.cst.slice(-2)}</CST><vICMS>${i.icms || 0}</vICMS></ICMS00></ICMS></imposto></det>`).join('');
  return `<nfeProc><NFe><infNFe Id="NFe${n.chave}"><ide><natOp>VENDA (EXEMPLO)</natOp><mod>55</mod><serie>${n.serie}</serie><nNF>${n.numero}</nNF><dhEmi>${n.data.split('/').reverse().join('-')}T10:00:00-03:00</dhEmi><tpNF>1</tpNF></ide>`
    + `<emit><CNPJ>${n.emitente.doc}</CNPJ><xNome>${n.emitente.nome}</xNome></emit><dest><CNPJ>${n.destinatario.doc}</CNPJ><xNome>${n.destinatario.nome}</xNome></dest>${itens}`
    + `<total><ICMSTot><vProd>${n.valor}</vProd><vFrete>${n.frete || 0}</vFrete><vDesc>${n.desconto || 0}</vDesc><vNF>${n.valor}</vNF></ICMSTot></total><transp><modFrete>9</modFrete></transp><infAdic><infCpl>Nota de exemplo.</infCpl></infAdic></infNFe></NFe></nfeProc>`;
}

export function useNotaOriginal(nota: t.sieg.NotaDoSieg, codigo: string | number | null | undefined, competencia?: string) {
  const sieg = useSieg();
  const comp = competencia || competenciaDaData(nota.data);
  const cod = codigo == null ? '' : String(codigo);
  const [estado, setEstado] = useState<{ fase: 'parado' | 'pedindo' | 'pronta' | 'erro'; erro?: string; desde?: number }>(() => (jaAbertas.has(nota.chave) ? { fase: 'pronta' } : { fase: 'parado' }));
  const [aberta, setAberta] = useState(false);
  const lendo = useRef('');
  const pedido = estado.fase === 'pedindo' && cod && comp ? sieg.pedido(cod, comp, 'zipFaltam') : null;
  // o pedido é o desta nota quando foi criado depois do clique (o mais novo do tipo para a empresa e o mês)
  const meu = pedido && estado.desde && Date.parse(pedido.em) >= estado.desde - 5000 ? pedido : null;

  useEffect(() => {
    if (!meu) return;
    if (meu.status === 'erro') { setEstado({ fase: 'erro', erro: meu.erro || 'o robô não conseguiu pegar a nota' }); return; }
    if (meu.status !== 'concluido' || !meu.zip || lendo.current === meu.id) return;
    lendo.current = meu.id || 'x';
    (async () => {
      try {
        const bytes = await sieg.baixarZip(meu.zip!);
        const { xmls } = await lerXmlsDosArquivos([new File([bytes.slice().buffer], 'nota.zip')]);
        const xml = xmls.find(x => x.includes(nota.chave)) || xmls[0];
        const danfe = xml ? t.sieg.danfeDoXml(xml) : null;
        if (!xml || !danfe) throw new Error('o XML desta nota não veio no .zip');
        jaAbertas.set(nota.chave, { xml, danfe });
        setEstado({ fase: 'pronta' });
        setAberta(true);
      } catch (e) { setEstado({ fase: 'erro', erro: e instanceof Error ? e.message : String(e) }); }
    })();
  }, [meu, sieg, nota.chave]);

  const guardada = jaAbertas.get(nota.chave) || null;
  return {
    /** dá para pedir: tem a empresa, a competência e a chave da NF-e/NFC-e */
    pode: !!cod && !!comp && (sieg.exemplos || /^\d{44}$/.test(nota.chave)) && (nota.tipo === 'NF-e' || nota.tipo === 'NFC-e'),
    fase: estado.fase,
    erro: estado.erro || '',
    andamento: meu?.andamento || (estado.fase === 'pedindo' ? esperandoORobo(sieg.robo()) : ''),
    danfe: guardada?.danfe || null,
    aberta: aberta && !!guardada,
    async abrir() {
      if (jaAbertas.has(nota.chave)) { setEstado({ fase: 'pronta' }); setAberta(true); return; }
      if (sieg.exemplos) {
        const xml = xmlDeExemplo(nota);
        const danfe = t.sieg.danfeDoXml(xml);
        if (danfe) { jaAbertas.set(nota.chave, { xml, danfe }); setEstado({ fase: 'pronta' }); setAberta(true); }
        return;
      }
      setEstado({ fase: 'pedindo', desde: Date.now() });
      try { await sieg.pedirZipFaltam(cod, comp, [nota.chave]); }
      catch (e) { setEstado({ fase: 'erro', erro: e instanceof Error ? e.message : String(e) }); }
    },
    fechar: () => setAberta(false),
    /** o XML original, para baixar */
    xml: guardada?.xml || '',
  };
}
