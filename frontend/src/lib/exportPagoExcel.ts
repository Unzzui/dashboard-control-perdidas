import ExcelJS from 'exceljs';
import { PagoTecnico, CalendarioMes } from '@/types';

const META = 160;

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
}

export async function exportPagoExcel(
  pagoTecnicos: PagoTecnico[],
  options: ExportOptions = {}
): Promise<void> {
  const { scope = 'global', zonaNombre = '', periodo = 'Todo el período', calendarioMes = null } = options;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Control de Pérdidas';
  wb.created = new Date();
  wb.title = scope === 'zona' ? `Pago ${zonaNombre}` : 'Pago Técnicos';

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
  const efFaltantes = pagoTecnicos.reduce((a, t) => a + Math.max(0, META - t.efectivas_habiles), 0);

  const wsResumen = wb.addWorksheet('Resumen', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    properties: { defaultRowHeight: 18 },
  });

  // Título
  wsResumen.mergeCells('A1:F1');
  wsResumen.getCell('A1').value = scope === 'zona'
    ? `Cálculo de Pago Mensual — ${zonaNombre}`
    : 'Cálculo de Pago Mensual — Resumen Global';
  wsResumen.getCell('A1').font = { name: 'Inter', size: 16, bold: true, color: { argb: COLORS.slate800 } };
  wsResumen.getCell('A1').alignment = { vertical: 'middle' };
  wsResumen.getRow(1).height = 28;

  wsResumen.mergeCells('A2:F2');
  wsResumen.getCell('A2').value = `Período: ${periodo} · Meta ${META} efectivas · OCA Global · 1F`;
  wsResumen.getCell('A2').font = { name: 'Inter', size: 10, color: { argb: COLORS.slate500 } };
  wsResumen.getRow(2).height = 16;

  // KPIs
  let row = 4;
  const kpis: Array<[string, string | number, string]> = [
    ['Total a Pago',        totalPago,         moneyFmt],
    ['Pago Potencial',      pagoPotencial,     moneyFmt],
    ['Brecha NO Pagada',    brechaTotal,       moneyFmt],
    ['% Brecha',            Math.round(pctBrecha), pctFmt],
    ['Efectivas Faltantes', efFaltantes,       numFmt],
    ['Técnicos',            pagoTecnicos.length, numFmt],
    ['Cumplen Meta',        cumplen,           numFmt],
    ['No Cumplen',          noCumplen,         numFmt],
    ['% Cumplimiento',      Math.round(pctCumplen), pctFmt],
    ['Total Efectivas',     totalEf,           numFmt],
    ['Efectivas Hábiles',   totalHab,          numFmt],
    ['Efectivas Sábado',    totalSab,          numFmt],
    ['Normales',            totalNorm,         numFmt],
    ['CNR Medida',          totalCnrM,         numFmt],
    ['CNR Intervención',    totalCnrI,         numFmt],
    ['VF CGE',              totalVfCge,        numFmt],
    ['Monto Hábil',         totalMontoH,       moneyFmt],
    ['Monto Sábado',        totalMontoS,       moneyFmt],
  ];

  // Pintar KPIs en grid 2 columnas (los de brecha destacados en rojo)
  for (let i = 0; i < kpis.length; i++) {
    const [label, val, fmt] = kpis[i];
    const isBrecha = label === 'Brecha NO Pagada' || label === '% Brecha';
    const r = 4 + Math.floor(i / 2) * 3;
    const c = (i % 2) * 3 + 1;
    const labelCell = wsResumen.getCell(r, c);
    const valueCell = wsResumen.getCell(r + 1, c);
    wsResumen.mergeCells(r, c, r, c + 1);
    wsResumen.mergeCells(r + 1, c, r + 1, c + 1);
    labelCell.value = label;
    labelCell.font = { name: 'Inter', size: 8, bold: true, color: { argb: isBrecha ? COLORS.red : COLORS.slate500 } };
    labelCell.alignment = { vertical: 'middle' };
    valueCell.value = val;
    valueCell.numFmt = fmt;
    valueCell.font = { name: 'Inter', size: 14, bold: true, color: { argb: isBrecha ? COLORS.red : COLORS.slate800 } };
    valueCell.alignment = { vertical: 'middle' };
    [labelCell, valueCell].forEach((c2) => {
      c2.fill = headerFill(isBrecha ? COLORS.redSoft : COLORS.slate50);
      c2.border = border();
    });
    wsResumen.getRow(r + 1).height = 24;
  }
  row = 4 + Math.ceil(kpis.length / 2) * 3 + 1;

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
      const falt = Math.max(0, META - t.efectivas_habiles);
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

    // Fila 1: título
    wsCal.mergeCells(1, 1, 1, totalCols);
    wsCal.getCell(1, 1).value = `Calendario Operativo — ${calendarioMes.mes} ${calendarioMes.año}`;
    wsCal.getCell(1, 1).font = { name: 'Inter', size: 14, bold: true, color: { argb: COLORS.slate800 } };
    wsCal.getRow(1).height = 22;

    // Fila 2: subtítulo
    wsCal.mergeCells(2, 1, 2, totalCols);
    const brigadasOp = pagoTecnicos.filter((t) => (t.dias_trabajados_count ?? 0) > 0).length;
    wsCal.getCell(2, 1).value = `Período: ${periodo} · ${brigadasOp} brigadas operativas · ${calendarioMes.total_habiles} días hábiles`;
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
    ['Días Trab', 'Sáb Trab', 'Aus.H'].forEach((label, i) => {
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

    let r = 6;
    zonasOrdenadas.forEach((zona) => {
      const items = grupos.get(zona)!.slice().sort(
        (a, b) => (b.dias_trabajados_count ?? 0) - (a.dias_trabajados_count ?? 0)
      );
      const operZ = items.filter((t) => (t.dias_trabajados_count ?? 0) > 0).length;
      const totDiasZ = items.reduce((a, t) => a + (t.dias_trabajados_count ?? 0), 0);
      const promZ = operZ > 0 ? totDiasZ / operZ : 0;

      // Subheader zona
      wsCal.mergeCells(r, 1, r, totalCols);
      const cZona = wsCal.getCell(r, 1);
      cZona.value = `${zona}  ·  ${operZ} brigadas activas  ·  ${totDiasZ} días trab  ·  prom ${promZ.toFixed(1)}`;
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

        const ausH = Math.max(0, calendarioMes.total_habiles - diasHabTrab);
        const totales: Array<[number, string]> = [
          [t.dias_trabajados_count ?? 0, COLORS.slate800],
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

    // Fila final: brigadas operativas por día
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
    [0, 1, 2].forEach((i) => {
      const cell = wsCal.getCell(r, 3 + dias.length + i);
      cell.fill = headerFill(COLORS.slate800);
      cell.border = border('medium', COLORS.slate800);
    });
    wsCal.getRow(r).height = 18;

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
  // Hoja 4: METODOLOGÍA
  // -------------------------------------------------------------------------
  const wsMeta = wb.addWorksheet('Metodología', {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  });
  wsMeta.getColumn(1).width = 100;

  const explicaciones: Array<{ title?: string; text?: string }> = [
    { title: 'Cálculo de Pago Mensual — Metodología' },
    { text: '' },
    { title: '1. Categorías clasificadas como efectivas' },
    { text: '   • Normales: Resultado de visita = "Normal".' },
    { text: '   • CNR Medida: Resultado = CNR, Tipo CNR = "CNR Falla".' },
    { text: '   • CNR Intervención: Resultado = CNR, Tipo CNR = "CNR Hurto".' },
    { text: '   • VF CGE: Visita Fallida cuyo Resultado Final esté en {Sitio eriazo, Sin empalme, Desconectado en BT/MT, Sin acceso medidor*}.' },
    { text: '' },
    { title: '2. Fórmulas' },
    { text: `   • Efectivas Mes = Normales + CNR Medida + CNR Intervención + VF CGE.` },
    { text: `   • Efectivas Sábado = mismo cálculo restringido a sábados (dayofweek = 5).` },
    { text: `   • Efectivas Hábiles = Efectivas Mes − Efectivas Sábado.` },
    { text: `   • Monto Hábil = Precio Base × (Efectivas Hábiles / ${META}), con tope en Precio Base.` },
    { text: `   • Monto Sábado = (Precio Base / ${META}) × Efectivas Sábado.` },
    { text: `   • Total a Pago = Monto Hábil + Monto Sábado.` },
    { text: '' },
    { title: '3. Mapeo de zonas y precio' },
    { text: '   • EECC = OCA Global, Tipo de Brigada = 1F, Ctta para todos los técnicos (provisional).' },
    { text: '   • Precio Base se obtiene de precios_base.parquet usando (Zona origen del técnico, Comuna predominante).' },
    { text: '' },
    { title: '4. Meta' },
    { text: `   • Meta mensual = ${META} efectivas (8 ef/día × 20 días hábiles).` },
    { text: '   • Cumple Meta cuando Efectivas Mes ≥ 160.' },
    { text: '' },
    { title: '5. Brecha por Incumplimiento' },
    { text: '   • Pago Potencial = Precio Base + Monto Sábado (asume que el técnico topea su monto hábil).' },
    { text: '   • Brecha NO Pagada = max(0, Pago Potencial − Total a Pago real).' },
    { text: '   • Equivale a: Precio Base − Monto Hábil actual (cuando Efectivas Hábiles < 160).' },
    { text: `   • Ef. Faltantes = max(0, ${META} − Efectivas Hábiles): número de efectivas adicionales necesarias para topear.` },
    { text: '   • Este indicador muestra cuánto NO se paga al contratista por no llegar al máximo mensual.' },
    { text: '' },
    { title: '6. Calendario Operativo de Brigadas' },
    { text: '   • Muestra, por brigada, qué días del mes trabajó (cualquier inspección registrada).' },
    { text: '   • Identifica sábados (ámbar), domingos (gris) y feriados (lila) como columnas destacadas.' },
    { text: '   • Totales por brigada: Días Trab, Sáb Trab y Ausencias Hábiles (Hábiles del mes − Días hábiles trabajados).' },
    { text: '   • Pie: número de brigadas operativas por cada día del mes visualizado.' },
    { text: '   • Mes visualizado: el último mes del período filtrado con al menos un registro.' },
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
