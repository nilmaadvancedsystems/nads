// O razão do banco pelo robô do Alterdata do servidor (19/11/2026). Dados fictícios.
import { describe, expect, it } from 'vitest';
import { comRazaoDoServidor, razaoDaContaDoServidor } from './regras/razaoDoServidor';
import { montarRegistro } from './regras/registro';
import { configVazia } from './regras/mudancas';

const robo = [
  { conta: '10503', data: '2026-09-05', historico: 'PIX RECEBIDO CLIENTE', contra: '11201', documento: '', debito: 1250.5, credito: 0 },
  { conta: '10503', data: '2026-09-06', historico: 'TARIFA', contra: '81012', documento: '', debito: 0, credito: 45.9 },
  { conta: '10503', data: '2026-10-01', historico: 'OUTRO MÊS', contra: '81012', documento: '', debito: 0, credito: 1 },
  { conta: '11201', data: '2026-09-05', historico: 'PIX RECEBIDO CLIENTE', contra: '10503', documento: '', debito: 0, credito: 1250.5 },
];

describe('o razão do banco pelo robô do Alterdata (19/11/2026: "atualizar… chamar o alterdata do servidor")', () => {
  it('só a conta do banco no mês, em centavos, no jeito do Alterdata (+ saiu, − entrou), com a contrapartida', () => {
    expect(razaoDaContaDoServidor(robo, '10503', '2026-09')).toEqual([
      { data: '2026-09-05', valor: -125050, historico: 'PIX RECEBIDO CLIENTE', conta: '11201' },
      { data: '2026-09-06', valor: 4590, historico: 'TARIFA', conta: '81012' },
    ]);
    expect(razaoDaContaDoServidor(robo, '', '2026-09')).toEqual([]);
  });

  it('toma o lugar do razão do Extrator: o que já está lá fica "no razão", com a conta do Alterdata', () => {
    const extrato = [{ data: '2026-09-05', valor: 125050, historico: 'PIX RECEBIDO CLIENTE' }, { data: '2026-09-06', valor: -4590, historico: 'TARIFA PACOTE' }, { data: '2026-09-09', valor: -1000, historico: 'PIX EMIT' }];
    const doExtrator = { extrato, razaoDoMes: [], modelos: [{ data: '2026-08-02', valor: -1000, historico: 'PIX EMIT', conta: '21101' }], razaoInvertido: false };
    const dados = comRazaoDoServidor(doExtrator, razaoDaContaDoServidor(robo, '10503', '2026-09'));
    expect(dados.razaoInvertido).toBe(true);
    expect(dados.modelos.find(m => m.conta === '21101')?.valor).toBe(1000);
    const linhas = montarRegistro({ dados, banco: 'sicoob', contaDoBanco: '10503', config: configVazia(), decisoes: {}, plano: null });
    expect(linhas.map(l => [l.situacao, l.conta])).toEqual([['no-razao', '11201'], ['no-razao', '81012'], [expect.any(String), expect.anything()]]);
 
    // o lançamento do razão que levou à conciliação (19/11/2026: "quero ver o lançamento do razão em que levou a conciliação")
    expect(linhas[0].doRazao).toEqual({ data: '2026-09-05', valor: 125050, conta: '11201', historico: 'PIX RECEBIDO CLIENTE' });
    expect(linhas[2].doRazao).toBeUndefined();
  });

  it('no razão da conciliação do Alterdata, o texto vem do complemento (o histórico é o nome da conta)', () => {
    const extrato = [{ data: '2026-09-05', valor: -4590, historico: 'TARIFA PACOTE' }];
    const razaoDoMes = [{ data: '2026-09-05', valor: 4590, historico: 'TARIFAS BANCARIAS', conta: '81012', complemento: 'Tarifa pacote serviços' }];
    const [l] = montarRegistro({ dados: { extrato, razaoDoMes, modelos: razaoDoMes, razaoInvertido: true }, banco: 'sicoob', contaDoBanco: '10503', config: configVazia(), decisoes: {}, plano: null });
    expect(l.doRazao).toEqual({ data: '2026-09-05', valor: 4590, conta: '81012', historico: 'Tarifa pacote serviços' });
  });
});
