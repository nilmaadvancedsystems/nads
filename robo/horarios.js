// Os horários de cada robô (10/11/2026, Central dos robôs › Ajustes › Horários), no documento config/robosHorarios:
//   { robos: { sieg: { ativo: true, dias: [1,2,3,4,5], de: '07:00', ate: '19:00', intervaloMin: 120 } } }
// Sem documento, sem o robô na lista, ou com qualquer valor que não fecha, o robô segue como sempre: horário errado nunca
// para um robô. Os robôs de fila usam a pausa que já existe (quem aplica é a central, robo/central.js); o do Gmail olha aqui
// antes da leitura automática. A hora é sempre a de Brasília, em qualquer máquina.
'use strict';

let catalogo = { robos: [] };
try { catalogo = require('../packages/core/src/robos/catalogo.json'); } catch (e) { /* cópia só do robo/: nenhum robô com horário */ }

const HORA_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIA_EM_MIN = 24 * 60;
const LER_A_CADA_MS = 5 * 60 * 1000;
const { janelaMinimaMin: JANELA_MINIMA, intervaloMin: INTERVALO_MIN, intervaloMax: INTERVALO_MAX } = (catalogo.limites || {}).horarios || { janelaMinimaMin: 60, intervaloMin: 30, intervaloMax: 720 };
const DIA_DA_SEMANA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const minutosDe = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const suporte = robo => (catalogo.robos.find(r => r.id === robo) || {}).horario || null;

/** O horário de um robô como o robô usa; null = sem horário (desligado, robô que não aceita, ou valor que não fecha). */
function lerHorario(robo, bruto) {
  const pode = suporte(robo);
  if (!pode || !bruto || typeof bruto !== 'object' || bruto.ativo !== true) return null;
  const dias = [...new Set((Array.isArray(bruto.dias) ? bruto.dias : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
  if (!dias.length || !HORA_OK.test(String(bruto.de)) || !HORA_OK.test(String(bruto.ate))) return null;
  const de = minutosDe(bruto.de);
  const ate = minutosDe(bruto.ate);
  if ((ate - de + DIA_EM_MIN) % DIA_EM_MIN < JANELA_MINIMA) return null;
  const h = { dias, de, ate };
  const intervalo = Number(bruto.intervaloMin);
  if (pode.intervalo && Number.isInteger(intervalo) && intervalo >= INTERVALO_MIN && intervalo <= INTERVALO_MAX) h.intervaloMin = intervalo;
  return h;
}

/** O dia da semana (0 = domingo) e o minuto do dia em Brasília. */
function naHoraDeBrasilia(ms) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))) p[x.type] = x.value;
  return { dia: DIA_DA_SEMANA[p.weekday], minuto: Number(p.hour) * 60 + Number(p.minute) };
}

/** Está dentro da janela? A que vira a noite (22:00 às 06:00) pertence ao dia em que começou. */
function dentroDoHorario(h, ms) {
  if (!h) return true;
  const { dia, minuto } = naHoraDeBrasilia(ms);
  if (h.de < h.ate) return h.dias.includes(dia) && minuto >= h.de && minuto < h.ate;
  if (minuto >= h.de) return h.dias.includes(dia);
  return minuto < h.ate && h.dias.includes((dia + 6) % 7);
}

/** O documento, relido no máximo a cada 5 min; sem conseguir ler, fica o que já tinha. */
function criarLeitor(db, log) {
  let robos = {};
  let lidoEm = 0;
  return {
    async atualizar(agora = Date.now()) {
      if (agora - lidoEm < LER_A_CADA_MS) return;
      lidoEm = agora;
      try { robos = ((await db.collection('config').doc('robosHorarios').get()).data() || {}).robos || {}; }
      catch (err) { if (log) log('horários: não consegui ler -', String((err && err.message) || err)); }
    },
    horario: robo => lerHorario(robo, robos[robo]),
    intervalo(robo, padraoMin) { const h = lerHorario(robo, robos[robo]); return (h && h.intervaloMin) || padraoMin; },
    /** A tarefa automática deve rodar agora? Sem horário: de `padraoMin` em `padraoMin` minutos, como sempre foi. */
    deveRodar(robo, ultimaEm, padraoMin, agora = Date.now()) {
      const h = lerHorario(robo, robos[robo]);
      const intervalo = (h && h.intervaloMin) || padraoMin;
      return agora - ultimaEm >= intervalo * 60000 && dentroDoHorario(h, agora);
    },
  };
}

module.exports = { lerHorario, dentroDoHorario, criarLeitor, LER_A_CADA_MS };
