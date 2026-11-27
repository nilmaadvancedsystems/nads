// Os lotes do minimum (27/11/2026, a regra final do Vitor: "Vai ser, empresa, lote, ano os parametros"; "pode ter o mesmo numero de
// lote em empresas diferente e em anos diferentes"; "o nads tendo controle sobre isso ta tranquilo"). Cada planilha que o minimum
// exporta para o SCI pega aqui o próximo número da empresa no ano, numa transação (duas pessoas exportando ao mesmo tempo não pegam
// o mesmo):
//   lotesDoMinimum/{empresa}-{ano}              {codigo, ano, ultimo, em, por, porUid}: o último número usado
//   lotesDoMinimum/{empresa}-{ano}/lotes/{lote} {lote, codigo, empresa, ano, lancamentos, origem, arquivo, em, por, porUid}
// O lote é M + o número com 6 algarismos (sci.loteDaSequencia): M000001, M000002…
import { sci } from '@nads/core';
import { getAuth } from 'firebase/auth';
import { doc, runTransaction } from 'firebase/firestore';
import { abrirBancoDoEntregas } from './conexaoEntregas.firestore';
import { appDoEntregas } from './driveDasFerramentas.firestore';

export interface PedidoDeLote {
  codigo: number;
  empresa: string;
  ano: number;
  /** quantos lançamentos vão na aba Importar */
  lancamentos: number;
  /** de onde saiu: 'lançamentos', 'baixa no caixa', 'extrato Sicoob'… */
  origem: string;
}

/** Reserva o próximo lote da empresa no ano e registra a planilha. Devolve o lote (M000001). */
export async function reservarLoteDoMinimum(p: PedidoDeLote): Promise<string> {
  const u = getAuth(appDoEntregas()).currentUser;
  if (!u) throw new Error('Entre com a conta do escritório para exportar: o lote é controlado pelo nads.');
  if (!Number.isInteger(p.codigo) || p.codigo <= 0) throw new Error('A empresa não tem código: sem ele não dá para controlar o lote.');
  if (!Number.isInteger(p.ano) || p.ano < 2000 || p.ano > 2100) throw new Error('Ano da planilha inválido: ' + p.ano);
  const db = abrirBancoDoEntregas(appDoEntregas());
  const ref = doc(db, 'lotesDoMinimum', p.codigo + '-' + p.ano);
  const por = (u.displayName || (u.email || '').split('@')[0] || 'nads').slice(0, 120);
  return runTransaction(db, async t => {
    const s = await t.get(ref);
    const ultimo = s.exists() ? Number(s.data().ultimo) || 0 : 0;
    const n = ultimo + 1;
    const lote = sci.loteDaSequencia(n);
    const em = new Date().toISOString();
    t.set(ref, { codigo: p.codigo, ano: p.ano, ultimo: n, em, por, porUid: u.uid });
    t.set(doc(ref, 'lotes', lote), {
      lote, codigo: p.codigo, empresa: p.empresa.slice(0, 200), ano: p.ano, lancamentos: Math.max(0, Math.trunc(p.lancamentos)),
      origem: p.origem.slice(0, 120), em, por, porUid: u.uid,
    });
    return lote;
  });
}
