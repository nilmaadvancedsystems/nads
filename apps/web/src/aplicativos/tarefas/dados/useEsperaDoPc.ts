// Por que o pedido ao robô do PC está parado na fila (17/11/2026, Vitor: "robo bugou": o Contábil estava aberto duas vezes no PC
// dele, o robô não pegava nada e o botão ficava "na fila" sem dizer o porquê). Lê o estado que o robô do PC publica em
// robo/alterdata (maquinas.<pc>: contabil, fiscal, em) e, com um pedido esperando na fila do PC, diz o que fazer.
import { useEffect, useState } from 'react';
import { ouvirMaquinaDoPc, roboDePcDoUsuario } from './notasDoFiscal.firestore';

interface Maquina { contabil: string; fiscal: string; em: string }

const QUIETO_MS = 6 * 60 * 1000;   // o robô publica a cada 5 min sem mudança: passou disso, está desligado

/** null enquanto não há motivo para mostrar. doFiscal: o pedido usa o Alterdata Fiscal (as notas), não o Contábil. */
export function useEsperaDoPc(pedido: { status: string } | null, doFiscal = false): string {
  const doPc = roboDePcDoUsuario();
  const esperando = !!doPc && pedido?.status === 'pendentePc';
  const [m, setM] = useState<Maquina | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!esperando || !doPc) return;
    const t = setInterval(() => setAgora(Date.now()), 30000);
    const parar = ouvirMaquinaDoPc(doPc.maquina, setM);
    return () => { clearInterval(t); parar(); };
  }, [esperando, doPc?.maquina]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!esperando || !doPc || !m) return '';
  const pc = 'no PC de ' + doPc.rotulo;
  if (m.em && agora - Date.parse(m.em) > QUIETO_MS) return 'O robô ' + pc + ' está desligado: ligue o PC (ou o robô) e o pedido segue.';
  const qual = doFiscal ? 'Fiscal' : 'Contábil';
  const st = doFiscal ? m.fiscal : m.contabil;
  if (st === 'dois') return 'O Alterdata ' + qual + ' está aberto duas vezes ' + pc + ': feche um e o robô continua.';
  if (st === 'login') return 'O Alterdata ' + qual + ' ' + pc + ' está na tela de login: entre e o robô continua.';
  if (st === 'fechado') return 'O Alterdata ' + qual + ' ' + pc + ' está fechado: abra e entre, e o robô continua.';
  if (st === 'abrindo') return 'O Alterdata ' + qual + ' ' + pc + ' ainda está abrindo.';
  if (st === 'erro') return 'O robô ' + pc + ' não consegue ver o Alterdata ' + qual + '.';
  return '';
}
