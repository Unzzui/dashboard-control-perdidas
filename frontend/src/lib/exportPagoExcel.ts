import ExcelJS from 'exceljs';
import { PagoTecnico, CalendarioMes, Filters } from '@/types';
import { getProduccionRaw } from '@/lib/api/produccion';

// Fallback estático. La meta real es dinámica: 8 ef/día × días hábiles del mes.
const META_FALLBACK = 160;
const EFECTIVAS_POR_DIA = 8;

// Paleta alineada al CLAUDE.md
const COLORS = {
  primary: 'FF294D6D',   // OCA blue
  slate800: 'FF1E293B',
  slate500: 'FF64748B',
  slate200: 'FFE2E8F0',
  slate100: 'FFF1F5F9',
  slate50:  'FFF8FAFC',
  white:    'FFFFFFFF',
  green:    'FF10B981',
  red:      'FFDE473C',
  amber:    'FFF59E0B',
  amberSoft: 'FFFEF3C7',
  violet:    'FF8B5CF6',
  violetSoft:'FFEDE9FE',
  greenSoft: 'FFECFDF5',
  redSoft:   'FFFEF2F2',
};

const headerFill = (color: string): ExcelJS.Fill => ({
  type: 'pattern', pattern: 'solid', fgColor: { argb: color },
});

const border = (style: ExcelJS.BorderStyle = 'thin', color = COLORS.slate200): Partial<ExcelJS.Borders> => ({
  top: { style, color: { argb: color } },
  bottom: { style, color: { argb: color } },
  left: { style, color: { argb: color } },
  right: { style, color: { argb: color } },
});

const moneyFmt = '"$"#,##0';
const numFmt = '#,##0';
const pctFmt = '0"%"';

export interface ExportOptions {
  scope?: 'global' | 'zona';
  zonaNombre?: string;
  periodo?: string;
  calendarioMes?: CalendarioMes | null;
  filters?: Filters;          // si se pasa, se usa para fetchear la hoja Raw Parquet
  diaMax?: number;            // si se pasa, recorta el raw a días <= diaMax (cierre EDP)
}

export async function exportPagoExcel(
  pagoTecnicos: PagoTecnico[],
  options: ExportOptions = {}
): Promise<void> {
  const {
    scope = 'global',
    zonaNombre = '',
    periodo = 'Todo el período',
    calendarioMes = null,
    filters,
    diaMax,
  } = options;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Control de Pérdidas';
  wb.created = new Date();
  wb.title = scope === 'zona' ? `Pago ${zonaNombre}` : 'Pago Técnicos';

  // Meta dinámica: viene del backend (8 ef/día × días hábiles del mes visualizado).
  // Todos los técnicos comparten la misma meta dentro del mismo periodo.
  const META =
    pagoTecnicos[0]?.meta_efectivas ||
    calendarioMes?.meta_efectivas ||
    META_FALLBACK;
  const diasHabiles = calendarioMes?.total_habiles ?? Math.round(META / EFECTIVAS_POR_DIA);
  const periodoMes = calendarioMes ? `${calendarioMes.mes} ${calendarioMes.año}` : periodo;

  // -------------------------------------------------------------------------
  // Hoja 1: RESUMEN
  // -------------------------------------------------------------------------
  const sumar = (k: keyof PagoTecnico) =>
    pagoTecnicos.reduce((a, t) => a + (t[k] as number), 0);

  const totalPago = sumar('total_pago');
  const totalEf = sumar('efectivas_mes');
  const totalSab = sumar('efectivas_sabado');
  const totalHab = sumar('efectivas_habiles');
  const totalNorm = sumar('normales_mes');
  const totalCnrM = sumar('cnr_medida_mes');
  const totalCnrI = sumar('cnr_intervencion_mes');
  const totalVfCge = sumar('vf_cge_mes');
  const totalMontoH = sumar('monto_habil');
  const totalMontoS = sumar('monto_sabado');
  const cumplen = pagoTecnicos.filter((t) => t.cumple_meta).length;
  const noCumplen = pagoTecnicos.length - cumplen;
  const pctCumplen = pagoTecnicos.length > 0 ? (cumplen / pagoTecnicos.length) * 100 : 0;

  // Brecha = (Precio Base + Sábado) − Total a Pago
  const pagoPotencial = pagoTecnicos.reduce((a, t) => a + t.precio_base + t.monto_sabado, 0);
  const brechaTotal = Math.max(0, pagoPotencial - totalPago);
  const pctBrecha = pagoPotencial > 0 ? (brechaTotal / pagoPotencial) * 100 : 0;
  const efFaltantes = pagoTecnicos.reduce(
    (a, t) => a + Math.max(0, (t.meta_efectivas || META) - t.efectivas_habiles),
    0,
  );

  const wsResumen = wb.addWorksheet('Resumen', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    properties: { defaultRowHeight: 18 },
  });

  // Título (banda superior con acento)
  wsResumen.mergeCells('A1:G1');
  wsResumen.getCell('A1').value = scope === 'zona'
    ? `Cálculo de Pago Mensual — ${zonaNombre}`
    : 'Cálculo de Pago Mensual — Resumen Global';
  wsResumen.getCell('A1').font = { name: 'Inter', size: 18, bold: true, color: { argb: COLORS.white } };
  wsResumen.getCell('A1').fill = headerFill(COLORS.primary);
  wsResumen.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsResumen.getCell('A1').border = border('medium', COLORS.primary);
  wsResumen.getRow(1).height = 36;

  wsResumen.mergeCells('A2:G2');
  wsResumen.getCell('A2').value =
    `Período: ${periodo}  ·  Meta dinámica ${META} ef. (${EFECTIVAS_POR_DIA} ef/día × ${diasHabiles} días hábiles${calendarioMes ? ` de ${periodoMes}` : ''})  ·  OCA Global · 1F`;
  wsResumen.getCell('A2').font = { name: 'Inter', size: 10, italic: true, color: { argb: COLORS.slate500 } };
  wsResumen.getCell('A2').fill = headerFill(COLORS.slate50);
  wsResumen.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsResumen.getRow(2).height = 18;

  // Métrica destacada: la única tarjeta grande del top, muestra el total a pago
  wsResumen.mergeCells('A3:G3');
  wsResumen.getRow(3).height = 8;  // separador

  wsResumen.mergeCells('A4:C6');
  const cTotal = wsResumen.getCell('A4');
  cTotal.value = totalPago;
  cTotal.numFmt = moneyFmt;
  cTotal.font = { name: 'Inter', size: 28, bold: true, color: { argb: COLORS.slate800 } };
  cTotal.alignment = { vertical: 'middle', horizontal: 'center' };
  cTotal.fill = headerFill(COLORS.slate50);
  cTotal.border = border('thin', COLORS.slate200);

  wsResumen.mergeCells('A7:C7');
  const cTotalLbl = wsResumen.getCell('A7');
  cTotalLbl.value = 'TOTAL A PAGO';
  cTotalLbl.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate500 } };
  cTotalLbl.alignment = { vertical: 'middle', horizontal: 'center' };
  cTotalLbl.fill = headerFill(COLORS.slate50);
  cTotalLbl.border = border('thin', COLORS.slate200);

  // Brecha (destacada al lado, en rojo)
  wsResumen.mergeCells('D4:E6');
  const cBrecha = wsResumen.getCell('D4');
  cBrecha.value = brechaTotal;
  cBrecha.numFmt = moneyFmt;
  cBrecha.font = { name: 'Inter', size: 20, bold: true, color: { argb: COLORS.red } };
  cBrecha.alignment = { vertical: 'middle', horizontal: 'center' };
  cBrecha.fill = headerFill(COLORS.redSoft);
  cBrecha.border = border('thin', COLORS.red);

  wsResumen.mergeCells('D7:E7');
  const cBrechaLbl = wsResumen.getCell('D7');
  cBrechaLbl.value = `BRECHA NO PAGADA · ${Math.round(pctBrecha)}%`;
  cBrechaLbl.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.red } };
  cBrechaLbl.alignment = { vertical: 'middle', horizontal: 'center' };
  cBrechaLbl.fill = headerFill(COLORS.redSoft);
  cBrechaLbl.border = border('thin', COLORS.red);

  // % Cumplimiento (verde si alto)
  wsResumen.mergeCells('F4:G6');
  const cCumpl = wsResumen.getCell('F4');
  cCumpl.value = Math.round(pctCumplen);
  cCumpl.numFmt = pctFmt;
  const cumplColor = pctCumplen >= 70 ? COLORS.green : pctCumplen >= 50 ? COLORS.amber : COLORS.red;
  const cumplBg = pctCumplen >= 70 ? COLORS.greenSoft : pctCumplen >= 50 ? COLORS.amberSoft : COLORS.redSoft;
  cCumpl.font = { name: 'Inter', size: 20, bold: true, color: { argb: cumplColor } };
  cCumpl.alignment = { vertical: 'middle', horizontal: 'center' };
  cCumpl.fill = headerFill(cumplBg);
  cCumpl.border = border('thin', cumplColor);

  wsResumen.mergeCells('F7:G7');
  const cCumplLbl = wsResumen.getCell('F7');
  cCumplLbl.value = `% CUMPLIMIENTO · ${cumplen}/${pagoTecnicos.length} téc`;
  cCumplLbl.font = { name: 'Inter', size: 9, bold: true, color: { argb: cumplColor } };
  cCumplLbl.alignment = { vertical: 'middle', horizontal: 'center' };
  cCumplLbl.fill = headerFill(cumplBg);
  cCumplLbl.border = border('thin', cumplColor);

  let row = 9;

  // Helper: renderiza una sección con banda de título y grilla de KPIs (3 por fila)
  type KpiSpec = { label: string; value: number; fmt: string; red?: boolean };
  const renderSection = (title: string, items: KpiSpec[]) => {
    // Banda de sección
    wsResumen.mergeCells(row, 1, row, 7);
    const cSec = wsResumen.getCell(row, 1);
    cSec.value = title.toUpperCase();
    cSec.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
    cSec.fill = headerFill(COLORS.slate800);
    cSec.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cSec.border = border('thin', COLORS.slate800);
    wsResumen.getRow(row).height = 20;
    row += 1;

    // Cards en filas de 3 (cols 1-2, 3-4, 5-6 — col 7 queda vacía)
    // Cada card son 2 filas: label arriba, valor abajo
    for (let i = 0; i < items.length; i += 3) {
      const slice = items.slice(i, i + 3);
      const labelRow = row;
      const valueRow = row + 1;

      slice.forEach((kpi, idx) => {
        const col = idx * 2 + 1;  // 1, 3, 5
        const fg = kpi.red ? COLORS.red : COLORS.slate800;
        const bg = kpi.red ? COLORS.redSoft : COLORS.slate50;
        const borderColor = kpi.red ? COLORS.red : COLORS.slate200;

        // Label (fila de arriba)
        wsResumen.mergeCells(labelRow, col, labelRow, col + 1);
        const lc = wsResumen.getCell(labelRow, col);
        lc.value = kpi.label.toUpperCase();
        lc.font = { name: 'Inter', size: 8, bold: true, color: { argb: kpi.red ? COLORS.red : COLORS.slate500 } };
        lc.fill = headerFill(bg);
        lc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        lc.border = {
          top: { style: 'thin', color: { argb: borderColor } },
          left: { style: 'thin', color: { argb: borderColor } },
          right: { style: 'thin', color: { argb: borderColor } },
        };

        // Value (fila de abajo)
        wsResumen.mergeCells(valueRow, col, valueRow, col + 1);
        const vc = wsResumen.getCell(valueRow, col);
        vc.value = kpi.value;
        vc.numFmt = kpi.fmt;
        vc.font = { name: 'Inter', size: 16, bold: true, color: { argb: fg } };
        vc.fill = headerFill(bg);
        vc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        vc.border = {
          bottom: { style: 'thin', color: { argb: borderColor } },
          left: { style: 'thin', color: { argb: borderColor } },
          right: { style: 'thin', color: { argb: borderColor } },
        };
      });

      // Rellenar slots vacíos (si items no son múltiplo de 3) con celdas blancas
      for (let idx = slice.length; idx < 3; idx++) {
        const col = idx * 2 + 1;
        wsResumen.mergeCells(labelRow, col, labelRow, col + 1);
        wsResumen.mergeCells(valueRow, col, valueRow, col + 1);
      }

      wsResumen.getRow(labelRow).height = 14;
      wsResumen.getRow(valueRow).height = 26;
      row += 2;
    }

    // Separador debajo
    row += 1;
  };

  renderSection('Resumen de Pago', [
    { label: 'Pago Potencial', value: pagoPotencial, fmt: moneyFmt },
    { label: 'Monto Hábil',    value: totalMontoH,   fmt: moneyFmt },
    { label: 'Monto Sábado',   value: totalMontoS,   fmt: moneyFmt },
  ]);

  renderSection('Cumplimiento', [
    { label: 'Técnicos',            value: pagoTecnicos.length, fmt: numFmt },
    { label: 'Cumplen Meta',        value: cumplen,             fmt: numFmt },
    { label: 'No Cumplen',          value: noCumplen,           fmt: numFmt },
    { label: 'Efectivas Faltantes', value: efFaltantes,         fmt: numFmt, red: efFaltantes > 0 },
  ]);

  renderSection('Efectivas', [
    { label: 'Total Efectivas',   value: totalEf,  fmt: numFmt },
    { label: 'Efectivas Hábiles', value: totalHab, fmt: numFmt },
    { label: 'Efectivas Sábado',  value: totalSab, fmt: numFmt },
  ]);

  renderSection('Desglose por Categoría', [
    { label: 'Normales',         value: totalNorm,  fmt: numFmt },
    { label: 'CNR Medida',       value: totalCnrM,  fmt: numFmt },
    { label: 'CNR Intervención', value: totalCnrI,  fmt: numFmt },
    { label: 'VF CGE',           value: totalVfCge, fmt: numFmt },
  ]);

  // Resumen por zona
  wsResumen.mergeCells(row, 1, row, 6);
  wsResumen.getCell(row, 1).value = 'Resumen por Zona';
  wsResumen.getCell(row, 1).font = { name: 'Inter', size: 12, bold: true, color: { argb: COLORS.slate800 } };
  wsResumen.getRow(row).height = 24;
  row += 1;

  const zonaHeader = ['Zona', 'Técnicos', 'Cumplen', '% Cumplen', 'Efectivas', 'Total a Pago', 'Brecha'];
  zonaHeader.forEach((h, i) => {
    const c = wsResumen.getCell(row, i + 1);
    c.value = h;
    c.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    c.fill = headerFill(i === zonaHeader.length - 1 ? COLORS.red : COLORS.slate800);
    c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    c.border = border();
  });
  wsResumen.getRow(row).height = 22;
  row += 1;

  // Agrupar
  const grupos = new Map<string, PagoTecnico[]>();
  pagoTecnicos.forEach((t) => {
    const z = t.zona || '(sin zona)';
    if (!grupos.has(z)) grupos.set(z, []);
    grupos.get(z)!.push(t);
  });
  const zonasOrdenadas = Array.from(grupos.keys()).sort();

  zonasOrdenadas.forEach((z) => {
    const items = grupos.get(z)!;
    const c = items.filter((t) => t.cumple_meta).length;
    const ef = items.reduce((a, t) => a + t.efectivas_mes, 0);
    const pago = items.reduce((a, t) => a + t.total_pago, 0);
    const potencial = items.reduce((a, t) => a + t.precio_base + t.monto_sabado, 0);
    const brecha = Math.max(0, potencial - pago);
    const pct = items.length > 0 ? Math.round((c / items.length) * 100) : 0;

    const vals: Array<[string | number, string | undefined, boolean?]> = [
      [z, undefined], [items.length, numFmt], [c, numFmt],
      [pct, pctFmt], [ef, numFmt], [pago, moneyFmt],
      [brecha, moneyFmt, true], // brecha resaltada
    ];
    vals.forEach(([v, fmt, highlight], i) => {
      const cell = wsResumen.getCell(row, i + 1);
      cell.value = v;
      if (fmt) cell.numFmt = fmt;
      cell.font = {
        name: 'Inter', size: 10,
        bold: !!highlight && (v as number) > 0,
        color: { argb: highlight && (v as number) > 0 ? COLORS.red : COLORS.slate800 },
      };
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
      cell.border = border();
      if (highlight && (v as number) > 0) cell.fill = headerFill(COLORS.redSoft);
    });
    row += 1;
  });

  // Fila total resumen por zona
  const totVals: Array<[string | number, string | undefined, boolean?]> = [
    ['TOTAL', undefined],
    [pagoTecnicos.length, numFmt],
    [cumplen, numFmt],
    [Math.round(pctCumplen), pctFmt],
    [totalEf, numFmt],
    [totalPago, moneyFmt],
    [brechaTotal, moneyFmt, true],
  ];
  totVals.forEach(([v, fmt, highlight], i) => {
    const cell = wsResumen.getCell(row, i + 1);
    cell.value = v;
    if (fmt) cell.numFmt = fmt;
    cell.font = {
      name: 'Inter', size: 10, bold: true,
      color: { argb: highlight && (v as number) > 0 ? COLORS.white : COLORS.white },
    };
    cell.fill = headerFill(highlight && (v as number) > 0 ? COLORS.red : COLORS.slate800);
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    cell.border = border('medium', COLORS.slate800);
  });

  // Anchos
  wsResumen.getColumn(1).width = 32;
  wsResumen.getColumn(2).width = 14;
  wsResumen.getColumn(3).width = 14;
  wsResumen.getColumn(4).width = 14;
  wsResumen.getColumn(5).width = 16;
  wsResumen.getColumn(6).width = 18;
  wsResumen.getColumn(7).width = 18;

  // -------------------------------------------------------------------------
  // Hoja 2: DETALLE TÉCNICOS
  // -------------------------------------------------------------------------
  const ws = wb.addWorksheet('Detalle Técnicos', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }],
    properties: { defaultRowHeight: 16 },
  });

  // Título de la hoja
  ws.mergeCells('A1:X1');
  ws.getCell('A1').value = 'Detalle de Pago por Técnico';
  ws.getCell('A1').font = { name: 'Inter', size: 14, bold: true, color: { argb: COLORS.slate800 } };
  ws.getRow(1).height = 24;

  ws.mergeCells('A2:X2');
  ws.getCell('A2').value = `${periodo} · ${pagoTecnicos.length} técnicos · Total ${formatMoney(totalPago)}`;
  ws.getCell('A2').font = { name: 'Inter', size: 9, color: { argb: COLORS.slate500 } };
  ws.getRow(2).height = 14;

  // Header agrupado fila 3
  const grupos3: Array<[string, number, string]> = [
    ['Identidad', 7, COLORS.slate800],
    ['Mes',       6, COLORS.primary],
    ['Sábado',    5, COLORS.slate500],
    ['Pago',      4, COLORS.slate800],
    // Total será 22, mas concatenar = 23, y pct
  ];
  let curCol = 1;
  // Identidad (7) + Mes (6: norm, cnrM, cnrI, vfCge, ef, %) + Sábado (5: norm, cnrM, cnrI, vfCge, ef) +
  // Pago (4: precio, hábil, sábado, total) + Concatenar (1) = 23 columnas
  const grupos3Real: Array<[string, number, string]> = [
    ['Identidad', 7, COLORS.slate800],
    ['Mes',       6, COLORS.primary],
    ['Sábado',    5, COLORS.slate500],
    ['Pago',      5, COLORS.slate800],  // precio, hábiles, hábil, sábado, total
    ['Brecha',    2, COLORS.red],       // brecha monto, ef faltantes
  ];
  grupos3Real.forEach(([label, span, color]) => {
    ws.mergeCells(3, curCol, 3, curCol + span - 1);
    const c = ws.getCell(3, curCol);
    c.value = label;
    c.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
    c.fill = headerFill(color);
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = border('thin', COLORS.slate800);
    curCol += span;
  });
  ws.getRow(3).height = 22;

  // Header detallado fila 4
  const headers = [
    'Técnico', 'EECC', 'Ctta', 'Brigada', 'Regional', 'Zona', 'Comuna',
    'Normales', 'CNR Med', 'CNR Int', 'VF CGE', 'Efectivas', '% Efect.',
    'Norm Sáb', 'CNR Med Sáb', 'CNR Int Sáb', 'VF CGE Sáb', 'Efect Sáb',
    'Precio Base', 'Hábiles', 'Monto Hábil', 'Monto Sábado', 'Total a Pago',
    'Brecha', 'Ef. Faltan',
  ];
  headers.forEach((h, i) => {
    const c = ws.getCell(4, i + 1);
    c.value = h;
    c.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    c.fill = headerFill(COLORS.slate800);
    c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', wrapText: true };
    c.border = border('thin', COLORS.slate200);
  });
  ws.getRow(4).height = 28;

  // Filas
  let r = 5;
  zonasOrdenadas.forEach((zona) => {
    const items = grupos.get(zona)!.sort((a, b) => b.total_pago - a.total_pago);

    // Subheader de zona
    ws.mergeCells(r, 1, r, headers.length);
    const cZona = ws.getCell(r, 1);
    cZona.value = `${zona}  ·  ${items.length} técnicos  ·  ${formatMoney(items.reduce((a, b) => a + b.total_pago, 0))}`;
    cZona.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
    cZona.fill = headerFill(COLORS.primary);
    cZona.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cZona.border = border('thin', COLORS.slate200);
    ws.getRow(r).height = 20;
    r += 1;

    items.forEach((t) => {
      const brecha = Math.max(0, t.precio_base + t.monto_sabado - t.total_pago);
      const falt = Math.max(0, (t.meta_efectivas || META) - t.efectivas_habiles);
      const vals: Array<{ v: string | number; fmt?: string; bold?: boolean; color?: string; bg?: string }> = [
        { v: t.nombre },
        { v: t.eecc },
        { v: t.ctta_tusan },
        { v: t.tipo_brigada },
        { v: t.regional },
        { v: t.zona },
        { v: t.comuna },
        { v: t.normales_mes,        fmt: numFmt },
        { v: t.cnr_medida_mes,      fmt: numFmt },
        { v: t.cnr_intervencion_mes, fmt: numFmt },
        { v: t.vf_cge_mes,          fmt: numFmt },
        { v: t.efectivas_mes,       fmt: numFmt, bold: true, color: t.cumple_meta ? COLORS.green : COLORS.slate800 },
        { v: Math.round(t.pct_efectividad), fmt: pctFmt, color: t.pct_efectividad >= 70 ? COLORS.green : t.pct_efectividad >= 50 ? COLORS.amber : COLORS.red },
        { v: t.normales_sabado,     fmt: numFmt },
        { v: t.cnr_medida_sabado,   fmt: numFmt },
        { v: t.cnr_intervencion_sabado, fmt: numFmt },
        { v: t.vf_cge_sabado,       fmt: numFmt },
        { v: t.efectivas_sabado,    fmt: numFmt },
        { v: t.precio_base,         fmt: moneyFmt },
        { v: t.efectivas_habiles,   fmt: numFmt },
        { v: t.monto_habil,         fmt: moneyFmt },
        { v: t.monto_sabado,        fmt: moneyFmt },
        { v: t.total_pago,          fmt: moneyFmt, bold: true, color: COLORS.slate800, bg: t.cumple_meta ? COLORS.greenSoft : COLORS.redSoft },
        { v: brecha,                fmt: moneyFmt, bold: brecha > 0, color: brecha > 0 ? COLORS.red : COLORS.slate500, bg: brecha > 0 ? COLORS.redSoft : undefined },
        { v: falt,                  fmt: numFmt,   color: falt > 0 ? COLORS.amber : COLORS.slate500 },
      ];
      vals.forEach((spec, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = spec.v;
        if (spec.fmt) c.numFmt = spec.fmt;
        c.font = {
          name: 'Inter',
          size: 9,
          bold: spec.bold,
          color: { argb: spec.color || COLORS.slate800 },
        };
        c.alignment = { vertical: 'middle', horizontal: i < 7 ? 'left' : 'right' };
        c.border = border('thin', COLORS.slate100);
        if (spec.bg) c.fill = headerFill(spec.bg);
      });
      r += 1;
    });
  });

  // Fila TOTAL
  const totalRow = r;
  ws.mergeCells(totalRow, 1, totalRow, 7);
  const cTot = ws.getCell(totalRow, 1);
  cTot.value = `TOTAL · ${pagoTecnicos.length} técnicos`;
  cTot.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
  cTot.fill = headerFill(COLORS.slate800);
  cTot.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cTot.border = border('medium', COLORS.slate800);

  const totalsByCol: Array<[number, number, string, boolean?]> = [
    [8, totalNorm, numFmt],
    [9, totalCnrM, numFmt],
    [10, totalCnrI, numFmt],
    [11, totalVfCge, numFmt],
    [12, totalEf, numFmt],
    [13, Math.round(totalEf > 0 ? (totalEf / pagoTecnicos.reduce((a, t) => a + (t.pct_efectividad > 0 ? t.efectivas_mes / (t.pct_efectividad / 100) : 0), 0)) * 100 : 0), pctFmt],
    [14, sumar('normales_sabado'), numFmt],
    [15, sumar('cnr_medida_sabado'), numFmt],
    [16, sumar('cnr_intervencion_sabado'), numFmt],
    [17, sumar('vf_cge_sabado'), numFmt],
    [18, totalSab, numFmt],
    [19, sumar('precio_base'), moneyFmt],
    [20, totalHab, numFmt],
    [21, totalMontoH, moneyFmt],
    [22, totalMontoS, moneyFmt],
    [23, totalPago, moneyFmt],
    [24, brechaTotal, moneyFmt, true],  // brecha destacada
    [25, efFaltantes, numFmt, true],     // ef faltantes destacadas
  ];
  totalsByCol.forEach(([col, val, fmt, highlight]) => {
    const c = ws.getCell(totalRow, col);
    c.value = val;
    c.numFmt = fmt;
    c.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
    c.fill = headerFill(highlight ? COLORS.red : COLORS.slate800);
    c.alignment = { vertical: 'middle', horizontal: 'right' };
    c.border = border('medium', COLORS.slate800);
  });
  ws.getRow(totalRow).height = 22;

  // Anchos
  const widths = [32, 12, 8, 10, 12, 26, 22, 9, 9, 9, 9, 11, 9, 10, 11, 11, 11, 10, 14, 10, 14, 14, 16, 14, 10];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Auto filter sobre header
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };

  // -------------------------------------------------------------------------
  // Hoja 3: CALENDARIO BRIGADAS
  // -------------------------------------------------------------------------
  if (calendarioMes) {
    const wsCal = wb.addWorksheet('Calendario Brigadas', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }],
      properties: { defaultRowHeight: 14 },
    });

    const dias = Array.from({ length: calendarioMes.dias_en_mes }, (_, i) => i + 1);
    const sabadosSet = new Set(calendarioMes.sabados);
    const domingosSet = new Set(calendarioMes.domingos);
    const feriadosSet = new Set(calendarioMes.feriados);

    const tipoDia = (d: number): 'habil' | 'sabado' | 'domingo' | 'feriado' => {
      if (feriadosSet.has(d)) return 'feriado';
      if (sabadosSet.has(d)) return 'sabado';
      if (domingosSet.has(d)) return 'domingo';
      return 'habil';
    };

    const bgPorTipo = (tipo: 'habil' | 'sabado' | 'domingo' | 'feriado'): string => {
      switch (tipo) {
        case 'sabado': return COLORS.amberSoft;
        case 'domingo': return COLORS.slate100;
        case 'feriado': return COLORS.violetSoft;
        default: return COLORS.white;
      }
    };

    const colorMarca = (tipo: 'habil' | 'sabado' | 'domingo' | 'feriado'): string => {
      switch (tipo) {
        case 'sabado': return COLORS.amber;
        case 'feriado': return COLORS.violet;
        case 'domingo': return COLORS.slate500;
        default: return COLORS.primary;
      }
    };

    const totalCols = 2 + dias.length + 3;

    // Días hábiles y sábados TRANSCURRIDOS (excluye futuros dentro del mes actual)
    const hoy = new Date();
    const esMesActual =
      calendarioMes.año === hoy.getFullYear() &&
      calendarioMes.numero_mes === hoy.getMonth() + 1;
    const esMesPasado =
      calendarioMes.año < hoy.getFullYear() ||
      (calendarioMes.año === hoy.getFullYear() && calendarioMes.numero_mes < hoy.getMonth() + 1);
    const ultimoDiaRel = esMesActual
      ? hoy.getDate()
      : esMesPasado
      ? calendarioMes.dias_en_mes
      : 0;
    let diasHabilesTranscurridos = 0;
    let sabadosTranscurridos = 0;
    for (let d = 1; d <= ultimoDiaRel; d++) {
      if (sabadosSet.has(d)) sabadosTranscurridos += 1;
      else if (!domingosSet.has(d) && !feriadosSet.has(d)) diasHabilesTranscurridos += 1;
    }

    // Fila 1: título
    wsCal.mergeCells(1, 1, 1, totalCols);
    wsCal.getCell(1, 1).value = `Calendario Operativo — ${calendarioMes.mes} ${calendarioMes.año}`;
    wsCal.getCell(1, 1).font = { name: 'Inter', size: 14, bold: true, color: { argb: COLORS.slate800 } };
    wsCal.getRow(1).height = 22;

    // Fila 2: subtítulo
    wsCal.mergeCells(2, 1, 2, totalCols);
    const brigadasOp = pagoTecnicos.filter((t) => (t.dias_trabajados_count ?? 0) > 0).length;
    wsCal.getCell(2, 1).value = `Período: ${periodo} · ${brigadasOp} brigadas operativas · ${diasHabilesTranscurridos}/${calendarioMes.total_habiles} días hábiles transcurridos`;
    wsCal.getCell(2, 1).font = { name: 'Inter', size: 9, color: { argb: COLORS.slate500 } };
    wsCal.getRow(2).height = 14;

    // Fila 3: agrupadores
    wsCal.mergeCells(3, 1, 3, 2);
    wsCal.getCell(3, 1).value = 'Identidad';
    wsCal.mergeCells(3, 3, 3, 2 + dias.length);
    wsCal.getCell(3, 3).value = `Días del mes (${calendarioMes.dias_en_mes})`;
    wsCal.mergeCells(3, 3 + dias.length, 3, totalCols);
    wsCal.getCell(3, 3 + dias.length).value = 'Totales';
    [1, 3, 3 + dias.length].forEach((c) => {
      const cell = wsCal.getCell(3, c);
      cell.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
      cell.fill = headerFill(COLORS.slate800);
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate800);
    });
    wsCal.getRow(3).height = 18;

    // Fila 4: números de día + headers identidad/totales
    wsCal.getCell(4, 1).value = 'Brigada';
    wsCal.getCell(4, 2).value = 'Zona';
    dias.forEach((d, i) => {
      const cell = wsCal.getCell(4, 3 + i);
      cell.value = d;
      const tipo = tipoDia(d);
      cell.fill = headerFill(bgPorTipo(tipo));
      cell.font = { name: 'Inter', size: 8, bold: true, color: { argb: COLORS.slate500 } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate100);
    });
    ['Días Trab', 'Sáb Trab', 'Faltas'].forEach((label, i) => {
      const cell = wsCal.getCell(4, 3 + dias.length + i);
      cell.value = label;
      cell.fill = headerFill(COLORS.slate800);
      cell.font = { name: 'Inter', size: 8, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate800);
    });
    [1, 2].forEach((c) => {
      const cell = wsCal.getCell(4, c);
      cell.fill = headerFill(COLORS.slate800);
      cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = border('thin', COLORS.slate800);
    });
    wsCal.getRow(4).height = 18;

    // Fila 5: inicial día semana
    const INICIAL = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const dowMon0 = (d: number) => (new Date(calendarioMes.año, calendarioMes.numero_mes - 1, d).getDay() + 6) % 7;
    wsCal.getCell(5, 1).value = '';
    wsCal.getCell(5, 2).value = '';
    dias.forEach((d, i) => {
      const cell = wsCal.getCell(5, 3 + i);
      cell.value = INICIAL[dowMon0(d)];
      const tipo = tipoDia(d);
      cell.fill = headerFill(bgPorTipo(tipo));
      cell.font = { name: 'Inter', size: 8, color: { argb: COLORS.slate500 } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate100);
    });
    for (let c = 3 + dias.length; c <= totalCols; c++) {
      wsCal.getCell(5, c).fill = headerFill(COLORS.slate50);
      wsCal.getCell(5, c).border = border('thin', COLORS.slate100);
    }
    wsCal.getRow(5).height = 14;

    // Agrupar técnicos por zona
    const grupos = new Map<string, PagoTecnico[]>();
    pagoTecnicos.forEach((t) => {
      const z = t.zona || '(sin zona)';
      if (!grupos.has(z)) grupos.set(z, []);
      grupos.get(z)!.push(t);
    });
    const zonasOrdenadas = Array.from(grupos.keys()).sort();

    // Acumuladores globales para la fila de totales.
    // sumTrabGlobal = solo días HÁBILES trabajados (complementario de Faltas).
    let sumTrabGlobal = 0;
    let sumSabGlobal = 0;
    let sumAusGlobal = 0;

    let r = 6;
    zonasOrdenadas.forEach((zona) => {
      const items = grupos.get(zona)!.slice().sort(
        (a, b) => (b.dias_trabajados_count ?? 0) - (a.dias_trabajados_count ?? 0)
      );
      const operZ = items.filter((t) => (t.dias_trabajados_count ?? 0) > 0).length;
      // Días OPERADOS: días distintos en que alguna brigada de la zona trabajó
      const diasOpSetZ = new Set<number>();
      items.forEach((t) => (t.dias_trabajados ?? []).forEach((d) => diasOpSetZ.add(d)));
      const diasOpZ = diasOpSetZ.size;
      const totDiasBrigZ = items.reduce((a, t) => a + (t.dias_trabajados_count ?? 0), 0);
      const promZ = operZ > 0 ? totDiasBrigZ / operZ : 0;

      // Subheader zona
      wsCal.mergeCells(r, 1, r, totalCols);
      const cZona = wsCal.getCell(r, 1);
      cZona.value = `${zona}  ·  ${operZ} brigadas activas  ·  ${diasOpZ} días operados  ·  prom ${promZ.toFixed(1)} d/brigada`;
      cZona.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
      cZona.fill = headerFill(COLORS.primary);
      cZona.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cZona.border = border('thin', COLORS.primary);
      wsCal.getRow(r).height = 18;
      r += 1;

      items.forEach((t) => {
        wsCal.getCell(r, 1).value = t.nombre;
        wsCal.getCell(r, 2).value = t.zona;
        [1, 2].forEach((c) => {
          const cell = wsCal.getCell(r, c);
          cell.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = border('thin', COLORS.slate100);
        });

        const trabSet = new Set(t.dias_trabajados ?? []);
        let diasHabTrab = 0;
        dias.forEach((d, i) => {
          const tipo = tipoDia(d);
          const cell = wsCal.getCell(r, 3 + i);
          const trabajo = trabSet.has(d);
          if (trabajo) {
            cell.value = '●';
            cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: colorMarca(tipo) } };
            if (tipo === 'habil') diasHabTrab += 1;
          } else {
            cell.value = '';
          }
          cell.fill = headerFill(bgPorTipo(tipo));
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = border('thin', COLORS.slate100);
        });

        // Ausencias: solo hasta "hoy" — no cuenta días futuros
        const ausH = Math.max(0, diasHabilesTranscurridos - diasHabTrab);
        // Trab en los totales = solo HÁBILES trabajados (complementario de Faltas).
        sumTrabGlobal += diasHabTrab;
        sumSabGlobal += t.sabados_trabajados_count ?? 0;
        sumAusGlobal += ausH;

        // Per-brigade cell "Trab" también muestra hábiles (no total) para coherencia.
        const totales: Array<[number, string]> = [
          [diasHabTrab, COLORS.slate800],
          [t.sabados_trabajados_count ?? 0, COLORS.amber],
          [ausH, ausH === 0 ? COLORS.slate500 : ausH <= 3 ? COLORS.amber : COLORS.red],
        ];
        totales.forEach(([v, color], i) => {
          const cell = wsCal.getCell(r, 3 + dias.length + i);
          cell.value = v;
          cell.numFmt = numFmt;
          cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: color } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.border = border('thin', COLORS.slate100);
        });

        r += 1;
      });
    });

    // Fila final 1: brigadas operativas por día (conteo por columna)
    wsCal.mergeCells(r, 1, r, 2);
    const cTotLbl = wsCal.getCell(r, 1);
    cTotLbl.value = 'Brigadas operativas/día';
    cTotLbl.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    cTotLbl.fill = headerFill(COLORS.slate800);
    cTotLbl.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    cTotLbl.border = border('medium', COLORS.slate800);

    const operPorDia = new Array(calendarioMes.dias_en_mes + 1).fill(0);
    pagoTecnicos.forEach((t) => {
      (t.dias_trabajados ?? []).forEach((d) => {
        if (d >= 1 && d <= calendarioMes.dias_en_mes) operPorDia[d] += 1;
      });
    });
    dias.forEach((d, i) => {
      const cell = wsCal.getCell(r, 3 + i);
      cell.value = operPorDia[d];
      cell.numFmt = numFmt;
      const tipo = tipoDia(d);
      cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate800 } };
      cell.fill = headerFill(bgPorTipo(tipo));
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate200);
    });
    // Totales columnas — Trab y Faltas comparten denominador (hábiles) y son complementarios.
    const posibleHab = brigadasOp * diasHabilesTranscurridos;
    const posibleSab = brigadasOp * sabadosTranscurridos;
    const pctTrabGlobal = posibleHab > 0 ? (sumTrabGlobal / posibleHab) * 100 : 0;
    const pctSabGlobal = posibleSab > 0 ? (sumSabGlobal / posibleSab) * 100 : 0;
    const pctAusGlobal = posibleHab > 0 ? (sumAusGlobal / posibleHab) * 100 : 0;

    const totTrabCell = wsCal.getCell(r, 3 + dias.length);
    totTrabCell.value = `${sumTrabGlobal}/${posibleHab}`;
    totTrabCell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    totTrabCell.fill = headerFill(COLORS.slate800);
    totTrabCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totTrabCell.border = border('medium', COLORS.slate800);

    const totSabCell = wsCal.getCell(r, 3 + dias.length + 1);
    totSabCell.value = `${sumSabGlobal}/${posibleSab}`;
    totSabCell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    totSabCell.fill = headerFill(COLORS.amber);
    totSabCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totSabCell.border = border('medium', COLORS.slate800);

    const totAusCell = wsCal.getCell(r, 3 + dias.length + 2);
    totAusCell.value = `${sumAusGlobal}/${posibleHab}`;
    totAusCell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    totAusCell.fill = headerFill(COLORS.red);
    totAusCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totAusCell.border = border('medium', COLORS.slate800);
    wsCal.getRow(r).height = 18;
    r += 1;

    // Fila final 2: cobertura % + promedios por brigada
    wsCal.mergeCells(r, 1, r, 2 + dias.length);
    const cPromLbl = wsCal.getCell(r, 1);
    cPromLbl.value = 'Cobertura / Prom. por brigada';
    cPromLbl.font = { name: 'Inter', size: 9, italic: true, color: { argb: COLORS.slate500 } };
    cPromLbl.fill = headerFill(COLORS.slate50);
    cPromLbl.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    cPromLbl.border = border('thin', COLORS.slate200);

    const promTrab = brigadasOp > 0 ? sumTrabGlobal / brigadasOp : 0;
    const promSab = brigadasOp > 0 ? sumSabGlobal / brigadasOp : 0;
    const promAus = brigadasOp > 0 ? sumAusGlobal / brigadasOp : 0;

    // Trab: "X% · Y" (cobertura % y prom)
    const cellTrabProm = wsCal.getCell(r, 3 + dias.length);
    cellTrabProm.value = `${Math.round(pctTrabGlobal)}% · ${promTrab.toFixed(1)}`;
    cellTrabProm.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate800 } };
    cellTrabProm.fill = headerFill(COLORS.slate50);
    cellTrabProm.alignment = { vertical: 'middle', horizontal: 'right' };
    cellTrabProm.border = border('thin', COLORS.slate200);

    const cellSabProm = wsCal.getCell(r, 3 + dias.length + 1);
    cellSabProm.value = `${Math.round(pctSabGlobal)}% · ${promSab.toFixed(1)}`;
    cellSabProm.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.amber } };
    cellSabProm.fill = headerFill(COLORS.slate50);
    cellSabProm.alignment = { vertical: 'middle', horizontal: 'right' };
    cellSabProm.border = border('thin', COLORS.slate200);

    const cellAusProm = wsCal.getCell(r, 3 + dias.length + 2);
    cellAusProm.value = `${Math.round(pctAusGlobal)}% · ${promAus.toFixed(1)}`;
    cellAusProm.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.red } };
    cellAusProm.fill = headerFill(COLORS.slate50);
    cellAusProm.alignment = { vertical: 'middle', horizontal: 'right' };
    cellAusProm.border = border('thin', COLORS.slate200);

    wsCal.getRow(r).height = 16;

    // Anchos de columna
    wsCal.getColumn(1).width = 30;
    wsCal.getColumn(2).width = 22;
    for (let i = 0; i < dias.length; i++) {
      wsCal.getColumn(3 + i).width = 3.2;
    }
    wsCal.getColumn(3 + dias.length).width = 10;
    wsCal.getColumn(3 + dias.length + 1).width = 10;
    wsCal.getColumn(3 + dias.length + 2).width = 10;
  }

  // -------------------------------------------------------------------------
  // Hoja: RAW TÉCNICOS (un row por técnico con todos los campos del cálculo)
  // -------------------------------------------------------------------------
  const wsRaw = wb.addWorksheet('Raw Tecnicos', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  type RawCol = {
    key: string;
    header: string;
    fmt?: string;
    width: number;
    get: (t: PagoTecnico) => string | number | boolean;
  };

  const rawCols: RawCol[] = [
    { key: 'nombre',                  header: 'Técnico',                width: 30, get: (t) => t.nombre },
    { key: 'eecc',                    header: 'EECC',                   width: 12, get: (t) => t.eecc },
    { key: 'ctta_tusan',              header: 'Ctta/Tusan',             width: 10, get: (t) => t.ctta_tusan },
    { key: 'tipo_brigada',            header: 'Tipo Brigada',           width: 10, get: (t) => t.tipo_brigada },
    { key: 'regional',                header: 'Regional',               width: 14, get: (t) => t.regional },
    { key: 'zona',                    header: 'Zona',                   width: 26, get: (t) => t.zona },
    { key: 'zona_precios',            header: 'Zona Precios',           width: 22, get: (t) => t.zona_precios },
    { key: 'comuna',                  header: 'Comuna',                 width: 22, get: (t) => t.comuna },
    { key: 'normales_mes',            header: 'Normales',               fmt: numFmt,   width: 10, get: (t) => t.normales_mes },
    { key: 'cnr_medida_mes',          header: 'CNR Medida',             fmt: numFmt,   width: 10, get: (t) => t.cnr_medida_mes },
    { key: 'cnr_intervencion_mes',    header: 'CNR Intervención',       fmt: numFmt,   width: 12, get: (t) => t.cnr_intervencion_mes },
    { key: 'vf_cge_mes',              header: 'VF CGE',                 fmt: numFmt,   width: 10, get: (t) => t.vf_cge_mes },
    { key: 'efectivas_mes',           header: 'Efectivas Mes',          fmt: numFmt,   width: 12, get: (t) => t.efectivas_mes },
    { key: 'efectivas_habiles',       header: 'Efectivas Hábiles',      fmt: numFmt,   width: 14, get: (t) => t.efectivas_habiles },
    { key: 'efectivas_sabado',        header: 'Efectivas Sábado',       fmt: numFmt,   width: 12, get: (t) => t.efectivas_sabado },
    { key: 'pct_efectividad',         header: '% Efectividad',          fmt: '0.0"%"', width: 10, get: (t) => t.pct_efectividad },
    { key: 'normales_sabado',         header: 'Norm Sábado',            fmt: numFmt,   width: 10, get: (t) => t.normales_sabado },
    { key: 'cnr_medida_sabado',       header: 'CNR Med Sáb',            fmt: numFmt,   width: 10, get: (t) => t.cnr_medida_sabado },
    { key: 'cnr_intervencion_sabado', header: 'CNR Int Sáb',            fmt: numFmt,   width: 10, get: (t) => t.cnr_intervencion_sabado },
    { key: 'vf_cge_sabado',           header: 'VF CGE Sáb',             fmt: numFmt,   width: 10, get: (t) => t.vf_cge_sabado },
    { key: 'meta_efectivas',          header: 'Meta Efectivas Mes',     fmt: numFmt,   width: 14, get: (t) => t.meta_efectivas || META },
    { key: 'precio_base',             header: 'Precio Base',            fmt: moneyFmt, width: 14, get: (t) => t.precio_base },
    { key: 'valor_efectiva',          header: 'Valor por Efectiva',     fmt: moneyFmt, width: 14, get: (t) => Math.round(t.precio_base / (t.meta_efectivas || META)) },
    { key: 'monto_habil',             header: 'Monto Hábil',            fmt: moneyFmt, width: 14, get: (t) => t.monto_habil },
    { key: 'monto_sabado',            header: 'Monto Sábado',           fmt: moneyFmt, width: 14, get: (t) => t.monto_sabado },
    { key: 'total_pago',              header: 'Total a Pago',           fmt: moneyFmt, width: 16, get: (t) => t.total_pago },
    { key: 'cumple_meta',             header: 'Cumple Meta',            width: 12, get: (t) => (t.cumple_meta ? 'Sí' : 'No') },
    { key: 'brecha',                  header: 'Brecha No Pagada',       fmt: moneyFmt, width: 16, get: (t) => Math.max(0, t.precio_base + t.monto_sabado - t.total_pago) },
    { key: 'ef_faltantes',            header: 'Ef. Faltantes',          fmt: numFmt,   width: 12, get: (t) => Math.max(0, (t.meta_efectivas || META) - t.efectivas_habiles) },
    { key: 'dias_trabajados_count',   header: 'Días Trabajados',        fmt: numFmt,   width: 12, get: (t) => t.dias_trabajados_count ?? 0 },
    { key: 'sabados_trabajados_count',header: 'Sábados Trabajados',     fmt: numFmt,   width: 14, get: (t) => t.sabados_trabajados_count ?? 0 },
    { key: 'dias_trabajados',         header: 'Días Trab. (lista)',     width: 30, get: (t) => (t.dias_trabajados ?? []).join(', ') },
    { key: 'concatenar',              header: 'Concatenar',             width: 36, get: (t) => t.concatenar },
  ];

  // Header
  rawCols.forEach((col, i) => {
    const cell = wsRaw.getCell(1, i + 1);
    cell.value = col.header;
    cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    cell.fill = headerFill(COLORS.slate800);
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = border('thin', COLORS.slate200);
    wsRaw.getColumn(i + 1).width = col.width;
  });
  wsRaw.getRow(1).height = 22;

  // Filas
  pagoTecnicos.forEach((t, idx) => {
    const rr = idx + 2;
    rawCols.forEach((col, i) => {
      const cell = wsRaw.getCell(rr, i + 1);
      cell.value = col.get(t);
      if (col.fmt) cell.numFmt = col.fmt;
      cell.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
      cell.alignment = { vertical: 'middle', horizontal: typeof col.get(t) === 'number' ? 'right' : 'left' };
      cell.border = border('thin', COLORS.slate100);
    });
  });

  wsRaw.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: rawCols.length } };

  // -------------------------------------------------------------------------
  // Hoja: RAW PARQUET (inspecciones crudas del dataset, para auditoría)
  // -------------------------------------------------------------------------
  if (filters) {
    try {
      const rawData = await getProduccionRaw(filters, diaMax);
      const wsParquet = wb.addWorksheet('Raw Parquet', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
        views: [{ state: 'frozen', ySplit: 2 }],
      });

      // Fila 1: encabezado contextual
      const totalCols = Math.max(rawData.columnas.length, 1);
      wsParquet.mergeCells(1, 1, 1, totalCols);
      const cTitulo = wsParquet.getCell(1, 1);
      cTitulo.value = `Inspecciones crudas del parquet — ${rawData.total.toLocaleString('es-CL')} filas${
        rawData.dia_max ? ` · días 1–${rawData.dia_max} (cierre EDP)` : ' · mes completo'
      }`;
      cTitulo.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
      cTitulo.fill = headerFill(COLORS.slate800);
      cTitulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cTitulo.border = border('medium', COLORS.slate800);
      wsParquet.getRow(1).height = 22;

      // Fila 2: headers de columnas
      rawData.columnas.forEach((colName, i) => {
        const cell = wsParquet.getCell(2, i + 1);
        cell.value = colName;
        cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
        cell.fill = headerFill(COLORS.slate500);
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = border('thin', COLORS.slate200);
      });
      wsParquet.getRow(2).height = 18;

      // Filas: data
      rawData.rows.forEach((row, idx) => {
        const r = idx + 3;
        rawData.columnas.forEach((colName, i) => {
          const cell = wsParquet.getCell(r, i + 1);
          const val = row[colName];
          cell.value = val === null || val === undefined ? '' : val;
          cell.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
          cell.alignment = {
            vertical: 'middle',
            horizontal: typeof val === 'number' ? 'right' : 'left',
          };
          cell.border = border('thin', COLORS.slate100);
        });
      });

      // Anchos heurísticos por nombre
      rawData.columnas.forEach((colName, i) => {
        const lower = colName.toLowerCase();
        let w = 14;
        if (lower.includes('nombre') || lower.includes('direcc')) w = 28;
        else if (lower.includes('comuna') || lower.includes('zona') || lower.includes('regional')) w = 18;
        else if (lower.includes('aviso') || lower.includes('id medida')) w = 14;
        else if (lower.includes('hora')) w = 8;
        else if (lower.includes('kwh')) w = 10;
        else if (lower.includes('resultado') || lower.includes('tipo')) w = 22;
        wsParquet.getColumn(i + 1).width = w;
      });

      wsParquet.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: 2, column: rawData.columnas.length },
      };
    } catch (err) {
      console.error('No se pudo cargar Raw Parquet:', err);
      // No abortamos el export — el resto de hojas se entrega igual
    }
  }

  // -------------------------------------------------------------------------
  // Hoja: METODOLOGÍA
  // -------------------------------------------------------------------------
  const wsMeta = wb.addWorksheet('Metodología', {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  });
  wsMeta.getColumn(1).width = 100;

  const sabadosCount = calendarioMes?.sabados.length ?? 0;
  const feriadosCount = calendarioMes?.feriados.length ?? 0;
  const diasMes = calendarioMes?.dias_en_mes ?? 0;

  const explicaciones: Array<{ title?: string; text?: string }> = [
    { title: 'Cálculo de Pago Mensual — Metodología' },
    { text: `Periodo visualizado: ${periodoMes}` },
    { text: '' },
    { title: '1. Categorías clasificadas como efectivas' },
    { text: '   • Normales: Resultado de visita = "Normal".' },
    { text: '   • CNR Medida: Resultado = CNR, Tipo CNR = "CNR Falla".' },
    { text: '   • CNR Intervención: Resultado = CNR, Tipo CNR = "CNR Hurto".' },
    { text: '   • VF CGE: Visita Fallida cuyo Resultado Final esté en {Sitio eriazo, Sin empalme, Desconectado en BT/MT, Sin acceso medidor*}.' },
    { text: '' },
    { title: '2. Meta dinámica del mes' },
    { text: `   • Fórmula: Meta = ${EFECTIVAS_POR_DIA} efectivas/día × días hábiles del mes.` },
    {
      text: calendarioMes
        ? `   • ${periodoMes}: ${diasMes} días − ${sabadosCount} sáb − ${calendarioMes.domingos.length} dom − ${feriadosCount} feriado(s) = ${diasHabiles} días hábiles.`
        : `   • Días hábiles del periodo cargado: ${diasHabiles}.`,
    },
    { text: `   • Meta efectivas/mes = ${EFECTIVAS_POR_DIA} × ${diasHabiles} = ${META}.` },
    { text: `   • Cumple Meta cuando Efectivas Mes ≥ ${META}.` },
    { text: '   • La meta se recalcula automáticamente cada mes según su calendario real (sábados, domingos y feriados chilenos oficiales).' },
    { text: '' },
    { title: '3. Fórmulas de cálculo' },
    { text: `   • Efectivas Mes = Normales + CNR Medida + CNR Intervención + VF CGE.` },
    { text: `   • Efectivas Sábado = mismo cálculo restringido a sábados (dayofweek = 5).` },
    { text: `   • Efectivas Hábiles = Efectivas Mes − Efectivas Sábado.` },
    { text: `   • Valor por efectiva = Precio Base / Meta = Precio Base / ${META}.` },
    { text: `   • Monto Hábil = Valor por efectiva × Efectivas Hábiles, con tope en Precio Base.` },
    { text: `   • Monto Sábado = Valor por efectiva × Efectivas Sábado (sin tope: pago extra por trabajo en sábado).` },
    { text: `   • Total a Pago = Monto Hábil + Monto Sábado.` },
    { text: '' },
    { title: '4. Mapeo de zonas y precio' },
    { text: '   • EECC = OCA Global, Tipo de Brigada = 1F, Ctta para todos los técnicos (provisional).' },
    { text: '   • Precio Base se obtiene de precios_base.parquet usando (Zona origen del técnico, Comuna predominante en su zona).' },
    { text: '   • Si la comuna no se encuentra en la tabla de precios, se usa la mediana de la zona como fallback.' },
    { text: '' },
    { title: '5. Brecha por Incumplimiento' },
    { text: '   • Pago Potencial = Precio Base + Monto Sábado (asume que el técnico topea su monto hábil).' },
    { text: '   • Brecha NO Pagada = max(0, Pago Potencial − Total a Pago real).' },
    { text: `   • Equivale a: Precio Base − Monto Hábil actual (cuando Efectivas Hábiles < ${META}).` },
    { text: `   • Ef. Faltantes = max(0, ${META} − Efectivas Hábiles): efectivas adicionales necesarias para topear.` },
    { text: '   • Este indicador muestra cuánto NO se paga al contratista por no llegar al máximo mensual.' },
    { text: '' },
    { title: '6. Calendario Operativo de Brigadas' },
    { text: '   • Muestra, por brigada, qué días del mes trabajó (cualquier inspección registrada).' },
    { text: '   • Identifica sábados (ámbar), domingos (gris) y feriados (lila) como columnas destacadas.' },
    { text: '   • Totales por brigada: Días Trab (hábiles trabajados — L–V), Sáb Trab (sábados, métrica aparte) y Faltas (hábiles no trabajados). Trab + Faltas = hábiles transcurridos. Sábados NO cuentan como falta.' },
    { text: '   • Pie: número de brigadas operativas por cada día del mes visualizado.' },
    { text: '   • Mes visualizado: el último mes del período filtrado con al menos un registro.' },
    { text: '' },
    { title: '7. Hojas Raw (auditoría / cruces)' },
    { text: '   • Raw Tecnicos: un row por técnico con todos los campos del cálculo (sin formato ni agrupación).' },
    { text: '   • Raw Parquet: inspecciones crudas del dataset (un row por inspección). Permite reproducir el cálculo manualmente.' },
    {
      text: diaMax
        ? `   • El "Cierre EDP CGE (días 1–${diaMax})" está activo: ambas hojas reflejan SOLO esos días, lo que coincide con el cierre comercial mensual de CGE.`
        : '   • Si activas "Cierre EDP CGE" en la vista, ambas hojas se recortan a los primeros 25 días del mes.',
    },
  ];

  let mr = 1;
  explicaciones.forEach(({ title, text }) => {
    const c = wsMeta.getCell(mr, 1);
    if (title) {
      c.value = title;
      c.font = { name: 'Inter', size: 11, bold: true, color: { argb: COLORS.slate800 } };
    } else {
      c.value = text;
      c.font = { name: 'Inter', size: 10, color: { argb: COLORS.slate500 } };
    }
    c.alignment = { vertical: 'middle', wrapText: true };
    mr += 1;
  });

  // Generar y descargar
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fecha = new Date().toISOString().slice(0, 10);
  const sufijo = scope === 'zona' ? `-${zonaNombre.replace(/[^\w]+/g, '_')}` : '';
  a.href = url;
  a.download = `pago-tecnicos${sufijo}-${fecha}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatMoney(v: number): string {
  return `$${v.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
}
