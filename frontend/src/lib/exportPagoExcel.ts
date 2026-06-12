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
  mesCierre?: string;         // "YYYY-MM": modo cierre EDP CGE (26 mes-1 → 25 mes)
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
    mesCierre,
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

  // Etiqueta visible en los banners. Cuando Cierre EDP está activo se muestra
  // el rango real "26 <mes-1> – 25 <mes destino>" en vez de solo el mes.
  const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const rangoCierreEdpLabel = (mc: string): string => {
    const m = Number(mc.split('-')[1]);
    if (!m || m < 1 || m > 12) return mc;
    const mesAnt = m === 1 ? 12 : m - 1;
    return `26 ${MESES_ES[mesAnt - 1]} – 25 ${MESES_ES[m - 1]}`;
  };
  const periodoLabel = mesCierre
    ? `Cierre EDP CGE · ${rangoCierreEdpLabel(mesCierre)}`
    : periodo;

  const escZona = (s: string) => s.replace(/"/g, '""');

  // ---------------------------------------------------------------------------
  // Detalle Técnicos es ahora la ÚNICA hoja con cálculo por técnico.
  // No hay capa intermedia "Raw Tecnicos": los conteos se obtienen
  // directamente con COUNTIFS sobre la hoja "Raw Parquet" (1 fila por inspección).
  //
  // Layout fijo (filas 1-4 = títulos/headers; data y subheaders desde la 5):
  //   - Por cada zona: 1 subheader + N filas (una por técnico).
  //   - Total filas usadas = nZonas + nTécnicos. Last = 4 + ese total.
  //   - Subheaders tienen texto sólo en col A (merge): SUMIF/COUNTIF las ignoran
  //     en las columnas numéricas (B-Y) ya que quedan vacías.
  //
  // Columnas Detalle Técnicos:
  //   A=Técnico, B=EECC, C=Ctta, D=Brigada, E=Regional, F=Zona, G=Comuna,
  //   H=Normales(COUNTIFS), I=CNR Med(COUNTIFS), J=CNR Int(COUNTIFS), K=VF CGE(COUNTIFS),
  //   L=Efectivas(form.), M=%Efect (dato), N=Norm Sáb(COUNTIFS), O=CNR Med Sáb(COUNTIFS),
  //   P=CNR Int Sáb(COUNTIFS), Q=VF CGE Sáb(COUNTIFS), R=Efect Sáb(form.),
  //   S=Precio Base (dato), T=Hábiles(form.), U=Monto Hábil(form.),
  //   V=Monto Sábado(form.), W=Total Pago(form.), X=Brecha(form.), Y=Ef. Faltan(form.)
  // ---------------------------------------------------------------------------
  const DET_SHEET = 'Detalle Técnicos';
  const DET_FIRST = 5;

  // Agrupar por zona y predeterminar la fila de cada técnico en Detalle Técnicos.
  // Esto permite que Raw Parquet (si se renderiza) pueda ser referenciado y que
  // Resumen pueda formular sus rangos antes de escribir Detalle.
  const grupos = new Map<string, PagoTecnico[]>();
  pagoTecnicos.forEach((t) => {
    const z = t.zona || '(sin zona)';
    if (!grupos.has(z)) grupos.set(z, []);
    grupos.get(z)!.push(t);
  });
  const zonasOrdenadas = Array.from(grupos.keys()).sort();
  const detRowOf = new Map<PagoTecnico, number>();
  {
    let rr = DET_FIRST;
    zonasOrdenadas.forEach((zona) => {
      rr++; // subheader de zona
      grupos.get(zona)!.slice().sort((a, b) => b.total_pago - a.total_pago).forEach((t) => {
        detRowOf.set(t, rr);
        rr++;
      });
    });
  }
  const DET_LAST = Math.max(DET_FIRST, DET_FIRST + zonasOrdenadas.length + pagoTecnicos.length - 1);
  const DET_TOTAL_ROW = DET_LAST + 1;
  const detRng = (col: string) => `'${DET_SHEET}'!${col}${DET_FIRST}:${col}${DET_LAST}`;

  // ---------------------------------------------------------------------------
  // FUENTE VERDADERA: Raw Parquet (una fila por inspección). Se carga aquí
  // arriba para que Raw Tecnicos pueda derivar sus conteos por COUNTIFS.
  // ---------------------------------------------------------------------------
  type RawParquet = {
    total: number;
    columnas: string[];
    rows: Record<string, string | number | boolean | null>[];
    rango?: { desde: string; hasta: string } | null;
  };
  let rawData: RawParquet | null = null;
  if (filters) {
    try {
      rawData = (await getProduccionRaw(filters, mesCierre)) as RawParquet;
    } catch (err) {
      console.error('No se pudo cargar Raw Parquet:', err);
    }
  }

  const RP_SHEET = 'Raw Parquet';
  const RP_HEADER_ROW = 1;        // fila 1 = headers (sin banner)
  const RP_FIRST = RP_HEADER_ROW + 1;
  const RP_LAST = rawData ? RP_HEADER_ROW + rawData.rows.length : 0;

  const _colLetter = (n: number): string => {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  // Resuelve la letra de columna de Raw Parquet por nombre original del backend.
  const rpColLetter = (name: string): string | null => {
    if (!rawData) return null;
    const i = rawData.columnas.indexOf(name);
    return i >= 0 ? _colLetter(i + 1) : null;
  };
  // Helpers añadidos al final del header de Raw Parquet:
  // 1ª extra = "Categoría", 2ª extra = "Es Sábado".
  const rpExtraStart = rawData ? rawData.columnas.length + 1 : 0;
  const RP_CAT = rawData ? _colLetter(rpExtraStart) : null;     // Categoría
  const RP_SAB = rawData ? _colLetter(rpExtraStart + 1) : null; // Es Sábado

  const RP_NOM = rpColLetter('Nombre asignado');
  const RP_RV  = rpColLetter('Resultado visita');
  const RP_RF  = rpColLetter('Resultado final');
  const RP_TCN = rpColLetter('Tipo_CNR.Tipo de CNR');
  const RP_FEC = rpColLetter('Fecha ejecución');

  const rpRange = (col: string) =>
    `'${RP_SHEET}'!$${col}$${RP_FIRST}:$${col}$${RP_LAST}`;

  // ¿Podemos derivar conteos desde Raw Parquet?
  const haveRP =
    !!rawData && rawData.rows.length > 0 &&
    !!RP_NOM && !!RP_RV && !!RP_TCN && !!RP_RF && !!RP_FEC &&
    !!RP_CAT && !!RP_SAB;

  // ---------------------------------------------------------------------------
  // PARÁMETROS — todas las reglas del cálculo en un solo lugar.
  // Las fórmulas (Categoría, Es Sábado, COUNTIFS, Monto Hábil, Cumplen, etc.)
  // referencian estas celdas en vez de literales. Si una regla cambia, basta
  // con editar la celda en la hoja "Parámetros" y todo se recalcula.
  // ---------------------------------------------------------------------------
  const PARAM_SHEET = 'Parámetros';
  const P = (col: string, row: number) => `'${PARAM_SHEET}'!$${col}$${row}`;

  // Filas en la hoja Parámetros (col B = valor editable, col C = nota).
  // Filas 1=título, 2=sect, 3=head; datos comienzan en 4.
  const P_NORM_RV     = P('B', 4);   // "Normal"
  const P_CNR_RV      = P('B', 5);   // "CNR"
  const P_CNR_FALLA   = P('B', 6);   // "CNR Falla"
  const P_CNR_HURTO   = P('B', 7);   // "CNR Hurto"
  const P_VF_RV       = P('B', 8);   // "Visita fallida"
  // Whitelist VF CGE — Resultado final (alineada con el EP modelo del jefe).
  const P_VF_RF1      = P('B', 9);   // "Casa deshabitada"
  const P_VF_RF2      = P('B', 10);  // "Desconectado en BT/MT"
  const P_VF_RF3      = P('B', 11);  // "Condición insegura (Física del empalme)"
  const P_VF_RF4      = P('B', 12);  // "Sitio eriazo"
  const P_VF_RF5      = P('B', 13);  // "Sin empalme"
  const P_VF_RF6      = P('B', 14);  // "Sin acceso por caja tortuga"
  const P_MANT_RV     = P('B', 15);  // "Mantenimiento Medidor"

  // Calendario del mes (desglose visible para auditoría).
  // Filas 16=sect, 17=head; valores 18..24.
  const P_MES         = P('B', 18);  // texto: nombre del mes
  const P_ANIO        = P('B', 19);  // número: año
  const P_DIAS_MES    = P('B', 20);  // total de días del mes
  const P_SABADOS_N   = P('B', 21);  // cantidad de sábados
  const P_DOMINGOS_N  = P('B', 22);  // cantidad de domingos
  const P_FERIADOS_N  = P('B', 23);  // cantidad de feriados
  const P_DIASHAB     = P('B', 24);  // = B20 - B21 - B22 - B23

  // Filas 25=sect, 26=head; valores 27..29.
  const P_EFXDIA      = P('B', 27);  // 8
  const P_META        = P('B', 28);  // = B27 * B24  (sin auto-referencia)
  const P_SABADO_DOW  = P('B', 29);  // 6 (WEEKDAY modo 2)

  // Filas 30=sect, 31=head; valores 32..37.
  const P_LBL_NORMAL  = P('B', 32);
  const P_LBL_CNRMED  = P('B', 33);
  const P_LBL_CNRINT  = P('B', 34);
  const P_LBL_VFCGE   = P('B', 35);
  const P_LBL_MANT    = P('B', 36);
  const P_LBL_OTRA    = P('B', 37);

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

  // -------------------------------------------------------------------------
  // Hoja: PARÁMETROS (primera pestaña — reglas del cálculo en un solo lugar)
  // -------------------------------------------------------------------------
  const wsParam = wb.addWorksheet(PARAM_SHEET, {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
    properties: { defaultRowHeight: 18 },
  });
  // A=label / Zona Precios · B=valor / Comuna · C=nota / Concatenar · D=Precio Base
  [34, 26, 44, 16].forEach((w, i) => { wsParam.getColumn(i + 1).width = w; });

  type PRow =
    | { kind: 'title'; text: string }
    | { kind: 'sect'; text: string }
    | { kind: 'head'; cols: [string, string, string] }
    | { kind: 'param'; label: string; value: string | number; nota: string; isFormula?: boolean };

  const sabadosCountP = calendarioMes?.sabados.length ?? 0;
  const domingosCountP = calendarioMes?.domingos.length ?? 0;
  const feriadosCountP = calendarioMes?.feriados.length ?? 0;
  const diasMesP = calendarioMes?.dias_en_mes ?? 0;
  const totalHabilesP = diasMesP - sabadosCountP - domingosCountP - feriadosCountP;

  const pRows: PRow[] = [
    // Fila 1: título  · Fila 2: sect  · Fila 3: head
    { kind: 'title', text: 'Parámetros del cálculo de pago' },
    { kind: 'sect',  text: 'Clasificación de inspecciones (categoría)' },
    { kind: 'head',  cols: ['Concepto', 'Valor', 'Cómo se usa'] },
    // Filas 4–13 → P_NORM_RV .. P_MANT_RV
    { kind: 'param', label: 'Resultado visita para "Normal"',                value: 'Normal',                  nota: 'Define qué inspección cuenta como Normal.' },
    { kind: 'param', label: 'Resultado visita para "CNR"',                   value: 'CNR',                     nota: 'Filtro de inicio para CNR Medida y CNR Intervención.' },
    { kind: 'param', label: 'Tipo CNR para "CNR Medida"',                    value: 'CNR Falla',               nota: 'Si Resultado=CNR + Tipo=este → CNR Medida.' },
    { kind: 'param', label: 'Tipo CNR para "CNR Intervención"',              value: 'CNR Hurto',               nota: 'Si Resultado=CNR + Tipo=este → CNR Intervención.' },
    { kind: 'param', label: 'Resultado visita para "VF CGE"',                value: 'Visita fallida',                            nota: 'Filtro de inicio para Visita Fallida CGE.' },
    { kind: 'param', label: 'Resultado final VF CGE (1)',                    value: 'Casa deshabitada',                          nota: 'Whitelist por Resultado final (alineada con EP modelo del jefe).' },
    { kind: 'param', label: 'Resultado final VF CGE (2)',                    value: 'Desconectado en BT/MT',                     nota: 'idem.' },
    { kind: 'param', label: 'Resultado final VF CGE (3)',                    value: 'Condición insegura (Física del empalme)',   nota: 'idem.' },
    { kind: 'param', label: 'Resultado final VF CGE (4)',                    value: 'Sitio eriazo',                              nota: 'idem.' },
    { kind: 'param', label: 'Resultado final VF CGE (5)',                    value: 'Sin empalme',                               nota: 'idem.' },
    { kind: 'param', label: 'Resultado final VF CGE (6)',                    value: 'Sin acceso por caja tortuga',               nota: 'idem.' },
    { kind: 'param', label: 'Resultado visita para "Mantenimiento Medidor"', value: 'Mantenimiento Medidor',                     nota: 'Cuenta como efectiva (alineado con detalle_tecnico.py y tecnicos.py).' },
    // Fila 14: sect  · 15: head  · 16–22: calendario
    { kind: 'sect',  text: 'Calendario del mes — auditoría de días hábiles' },
    { kind: 'head',  cols: ['Concepto', 'Valor', 'Cómo se calcula'] },
    { kind: 'param', label: 'Mes visualizado',                               value: calendarioMes?.mes ?? '',  nota: 'Último mes del período filtrado con datos.' },
    { kind: 'param', label: 'Año',                                           value: calendarioMes?.año ?? 0,   nota: 'Año calendario.' },
    { kind: 'param', label: 'Días totales del mes',                          value: diasMesP,                  nota: 'Cantidad de días en el calendario del mes.' },
    { kind: 'param', label: 'Sábados',                                       value: sabadosCountP,             nota: 'Sábados en el mes (DOW = 6).' },
    { kind: 'param', label: 'Domingos',                                      value: domingosCountP,            nota: 'Domingos en el mes (DOW = 7).' },
    { kind: 'param', label: 'Feriados',                                      value: feriadosCountP,            nota: 'Feriados oficiales chilenos en el mes.' },
    { kind: 'param', label: 'Días hábiles del mes',                          value: 'B20-B21-B22-B23',         nota: `Total − Sáb − Dom − Fer = ${totalHabilesP} (debería coincidir con ${diasHabiles}).`, isFormula: true },
    // Fila 25: sect  · 26: head  · 27–29: cálculo de pago
    { kind: 'sect',  text: 'Cálculo de pago' },
    { kind: 'head',  cols: ['Concepto', 'Valor', 'Cómo se calcula'] },
    { kind: 'param', label: 'Efectivas esperadas por día',                   value: EFECTIVAS_POR_DIA,         nota: 'Productividad base por brigada por día hábil.' },
    { kind: 'param', label: 'Meta efectivas / mes',                          value: 'B27*B24',                 nota: 'Ef/día × Días hábiles. Tope del Monto Hábil.', isFormula: true },
    { kind: 'param', label: 'Día de la semana = sábado (WEEKDAY modo 2)',    value: 6,                         nota: 'Marca de Es Sábado en Raw Parquet.' },
    // Fila 30: sect  · 31: head  · 32–37: etiquetas
    { kind: 'sect',  text: 'Etiquetas de salida (lo que escribe la columna Categoría)' },
    { kind: 'head',  cols: ['Concepto', 'Valor', 'Cómo se usa'] },
    { kind: 'param', label: 'Etiqueta "Normal"',                             value: 'Normal',                  nota: 'Texto que escribe Raw Parquet!Categoría y filtra COUNTIFS de Detalle.' },
    { kind: 'param', label: 'Etiqueta "CNR Medida"',                         value: 'CNR Falla',               nota: 'idem.' },
    { kind: 'param', label: 'Etiqueta "CNR Intervención"',                   value: 'CNR Hurto',               nota: 'idem.' },
    { kind: 'param', label: 'Etiqueta "VF CGE"',                             value: 'VF CGE',                  nota: 'idem.' },
    { kind: 'param', label: 'Etiqueta "Mantenimiento Medidor"',              value: 'Mantenimiento Medidor',   nota: 'idem.' },
    { kind: 'param', label: 'Etiqueta "Otra"',                               value: 'Otra',                    nota: 'Inspecciones que no caen en ninguna categoría efectiva.' },
  ];

  let pr = 1;
  pRows.forEach((row) => {
    if (row.kind === 'title') {
      wsParam.mergeCells(pr, 1, pr, 3);
      const c = wsParam.getCell(pr, 1);
      c.value = row.text;
      c.font = { name: 'Inter', size: 18, bold: true, color: { argb: COLORS.white } };
      c.fill = headerFill(COLORS.primary);
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      c.border = border('medium', COLORS.primary);
      wsParam.getRow(pr).height = 32;
    } else if (row.kind === 'sect') {
      wsParam.mergeCells(pr, 1, pr, 3);
      const c = wsParam.getCell(pr, 1);
      c.value = row.text.toUpperCase();
      c.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
      c.fill = headerFill(COLORS.slate800);
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      c.border = border('thin', COLORS.slate800);
      wsParam.getRow(pr).height = 22;
    } else if (row.kind === 'head') {
      row.cols.forEach((h, i) => {
        const c = wsParam.getCell(pr, i + 1);
        c.value = h;
        c.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate500 } };
        c.fill = headerFill(COLORS.slate50);
        c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        c.border = border('thin', COLORS.slate200);
      });
      wsParam.getRow(pr).height = 18;
    } else {
      // param
      const cL = wsParam.getCell(pr, 1);
      cL.value = row.label;
      cL.font = { name: 'Inter', size: 10, color: { argb: COLORS.slate800 } };
      cL.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cL.border = border('thin', COLORS.slate100);

      const cV = wsParam.getCell(pr, 2);
      if (row.isFormula && typeof row.value === 'string') {
        // El resultado precomputado depende de la fórmula:
        //   - "B18-B19-B20-B21" → días hábiles del mes
        //   - "B25*B22"          → meta efectivas / mes
        let res = 0;
        if (row.value === 'B18-B19-B20-B21') res = totalHabilesP;
        else if (row.value === 'B25*B22')    res = EFECTIVAS_POR_DIA * totalHabilesP;
        cV.value = { formula: row.value, result: res };
      } else {
        cV.value = row.value;
      }
      cV.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.primary } };
      cV.fill = headerFill(COLORS.slate50);
      cV.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cV.border = border('thin', COLORS.slate200);

      const cN = wsParam.getCell(pr, 3);
      cN.value = row.nota;
      cN.font = { name: 'Inter', size: 9, italic: true, color: { argb: COLORS.slate500 } };
      cN.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
      cN.border = border('thin', COLORS.slate100);

      wsParam.getRow(pr).height = 22;
    }
    pr += 1;
  });

  // ---------------------------------------------------------------------------
  // PRECIOS POR BRIGADA — tabla maestra de tarifas usada por cada técnico.
  // Detalle Técnicos!U (Precio Base) hace INDEX/MATCH sobre esta tabla.
  // Una fila por combinación única (Zona Precios, Comuna). La columna
  // "Concatenar" replica el key del backend ("OCA GLOBAL1F" + Zona + Comuna)
  // y es la que usa el MATCH desde Detalle Técnicos.
  // ---------------------------------------------------------------------------
  type PrecioRow = { key: string; zona_precios: string; comuna: string; precio: number };
  const preciosUniqueMap = new Map<string, PrecioRow>();
  pagoTecnicos.forEach((t) => {
    if (!preciosUniqueMap.has(t.concatenar)) {
      preciosUniqueMap.set(t.concatenar, {
        key: t.concatenar,
        zona_precios: t.zona_precios || '',
        comuna: t.comuna || '',
        precio: t.precio_base,
      });
    }
  });
  const preciosList = Array.from(preciosUniqueMap.values()).sort((a, b) => {
    const k = `${a.zona_precios}|${a.comuna}`.localeCompare(`${b.zona_precios}|${b.comuna}`);
    return k !== 0 ? k : a.key.localeCompare(b.key);
  });

  // Banner de sección (col A-D)
  wsParam.mergeCells(pr, 1, pr, 4);
  {
    const c = wsParam.getCell(pr, 1);
    c.value = 'PRECIOS POR BRIGADA (TARIFAS USADAS EN EL CÁLCULO)';
    c.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
    c.fill = headerFill(COLORS.slate800);
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    c.border = border('thin', COLORS.slate800);
    wsParam.getRow(pr).height = 22;
  }
  pr += 1;

  // Header de la tabla de precios
  const PRICE_HEADER = ['Zona Precios', 'Comuna', 'Concatenar (key)', 'Precio Base'];
  PRICE_HEADER.forEach((h, i) => {
    const c = wsParam.getCell(pr, i + 1);
    c.value = h;
    c.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate500 } };
    c.fill = headerFill(COLORS.slate50);
    c.alignment = { vertical: 'middle', horizontal: i === 3 ? 'right' : 'left', indent: 1 };
    c.border = border('thin', COLORS.slate200);
  });
  wsParam.getRow(pr).height = 18;
  pr += 1;

  const PRICE_FIRST = pr;
  preciosList.forEach((p) => {
    const cA = wsParam.getCell(pr, 1);
    cA.value = p.zona_precios;
    cA.font = { name: 'Inter', size: 10, color: { argb: COLORS.slate800 } };
    cA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cA.border = border('thin', COLORS.slate100);

    const cB = wsParam.getCell(pr, 2);
    cB.value = p.comuna;
    cB.font = { name: 'Inter', size: 10, color: { argb: COLORS.slate800 } };
    cB.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cB.border = border('thin', COLORS.slate100);

    // Concatenar: fórmula = EECC & Brigada & Zona Precios & Comuna,
    // que reproduce exactamente el key del backend ("OCA GLOBAL" + "1F" + zona + comuna).
    const cC = wsParam.getCell(pr, 3);
    cC.value = {
      formula: `"OCA GLOBAL"&"1F"&A${pr}&B${pr}`,
      result: p.key,
    };
    cC.font = { name: 'Consolas', size: 9, color: { argb: COLORS.slate500 } };
    cC.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cC.border = border('thin', COLORS.slate100);

    const cD = wsParam.getCell(pr, 4);
    cD.value = p.precio;
    cD.numFmt = moneyFmt;
    cD.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.primary } };
    cD.alignment = { vertical: 'middle', horizontal: 'right' };
    cD.fill = headerFill(COLORS.slate50);
    cD.border = border('thin', COLORS.slate200);

    wsParam.getRow(pr).height = 20;
    pr += 1;
  });
  const PRICE_LAST = pr - 1;

  // Rangos de la tabla de tarifas (zona+comuna → precio).
  const PRICE_KEY_RANGE = `'${PARAM_SHEET}'!$C$${PRICE_FIRST}:$C$${PRICE_LAST}`;
  const PRICE_VAL_RANGE = `'${PARAM_SHEET}'!$D$${PRICE_FIRST}:$D$${PRICE_LAST}`;

  // ---------------------------------------------------------------------------
  // ASIGNACIÓN DE BRIGADAS — un row por técnico que mapea
  //   Brigada → (Zona Origen, Zona Precios, Comuna, Concatenar, Precio Base).
  // Detalle Técnicos!F, G y U leen DESDE acá vía VLOOKUP.
  // Concatenar y Precio Base son fórmulas: el primero compone el key, el segundo
  // hace INDEX/MATCH sobre la tabla de tarifas anterior. Cambiar acá la zona o
  // la comuna asignada a una brigada y se recalcula su tarifa automáticamente.
  // ---------------------------------------------------------------------------
  pr += 1;  // separación visual entre tablas
  wsParam.mergeCells(pr, 1, pr, 6);
  {
    const c = wsParam.getCell(pr, 1);
    c.value = 'ASIGNACIÓN DE BRIGADAS (ZONA ORIGEN · ZONA PRECIOS · COMUNA · TARIFA)';
    c.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
    c.fill = headerFill(COLORS.slate800);
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    c.border = border('thin', COLORS.slate800);
    wsParam.getRow(pr).height = 22;
  }
  pr += 1;

  const ASIG_HEADER = ['Brigada (Nombre)', 'Zona Origen', 'Zona Precios', 'Comuna', 'Concatenar (key)', 'Precio Base'];
  ASIG_HEADER.forEach((h, i) => {
    const c = wsParam.getCell(pr, i + 1);
    c.value = h;
    c.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate500 } };
    c.fill = headerFill(COLORS.slate50);
    c.alignment = { vertical: 'middle', horizontal: i === 5 ? 'right' : 'left', indent: 1 };
    c.border = border('thin', COLORS.slate200);
  });
  wsParam.getRow(pr).height = 18;
  pr += 1;

  // Dedupe por Nombre (cada brigada aparece una sola vez en la asignación).
  const asignacionUnique = new Map<string, PagoTecnico>();
  pagoTecnicos.forEach((t) => {
    if (!asignacionUnique.has(t.nombre)) asignacionUnique.set(t.nombre, t);
  });
  const asignacionList = Array.from(asignacionUnique.values())
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const ASIG_FIRST = pr;
  asignacionList.forEach((t) => {
    const cA = wsParam.getCell(pr, 1);
    cA.value = t.nombre;
    cA.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
    cA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cA.border = border('thin', COLORS.slate100);

    const cB = wsParam.getCell(pr, 2);
    cB.value = t.zona || '';
    cB.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
    cB.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cB.border = border('thin', COLORS.slate100);

    const cC = wsParam.getCell(pr, 3);
    cC.value = t.zona_precios || '';
    cC.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
    cC.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cC.border = border('thin', COLORS.slate100);

    const cD = wsParam.getCell(pr, 4);
    cD.value = t.comuna || '';
    cD.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
    cD.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cD.border = border('thin', COLORS.slate100);

    // Concatenar (fórmula): EECC & Brigada & Zona Precios & Comuna
    const cE = wsParam.getCell(pr, 5);
    cE.value = { formula: `"OCA GLOBAL"&"1F"&C${pr}&D${pr}`, result: t.concatenar };
    cE.font = { name: 'Consolas', size: 9, color: { argb: COLORS.slate500 } };
    cE.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cE.border = border('thin', COLORS.slate100);

    // Precio Base (fórmula): INDEX/MATCH sobre la tabla de tarifas usando el Concatenar.
    const cF = wsParam.getCell(pr, 6);
    cF.value = {
      formula: `IFERROR(INDEX(${PRICE_VAL_RANGE},MATCH(E${pr},${PRICE_KEY_RANGE},0)),0)`,
      result: t.precio_base,
    };
    cF.numFmt = moneyFmt;
    cF.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.primary } };
    cF.alignment = { vertical: 'middle', horizontal: 'right' };
    cF.fill = headerFill(COLORS.slate50);
    cF.border = border('thin', COLORS.slate200);

    wsParam.getRow(pr).height = 18;
    pr += 1;
  });
  const ASIG_LAST = Math.max(ASIG_FIRST, pr - 1);

  // Ancho para la 5ª y 6ª columnas de Parámetros (Concatenar / Precio Base) que
  // solo existen en la tabla de Asignación. Ajustamos sin afectar widths previos.
  wsParam.getColumn(5).width = 44;
  wsParam.getColumn(6).width = 16;

  // Rangos de la tabla de asignación. Detalle!F, G y U hacen VLOOKUP contra acá.
  // ASIG_RANGE cubre cols A..F (6 cols) para VLOOKUP con índices: 2=Zona, 4=Comuna, 6=Precio.
  const ASIG_RANGE = `'${PARAM_SHEET}'!$A$${ASIG_FIRST}:$F$${ASIG_LAST}`;
  // Helper: VLOOKUP por nombre de brigada (literal en celda A{r} del Detalle).
  const vlookupAsig = (refCellA: string, colIdx: 2 | 4 | 6): string =>
    `IFERROR(VLOOKUP(${refCellA},${ASIG_RANGE},${colIdx},FALSE),"")`;

  // ---------------------------------------------------------------------------
  // MAPEO ZONA ORIGEN → ZONA PRECIOS. Espejo de ZONA_DATASET_TO_PRECIOS del backend.
  // Permite que el Precio Base en Detalle Técnicos se exprese como una fórmula
  // que toma F (Zona Origen) y G (Comuna) directamente — la auditoría se ve en
  // el formulario de cada brigada, no se "oculta" en otra hoja.
  // ---------------------------------------------------------------------------
  pr += 1;
  wsParam.mergeCells(pr, 1, pr, 6);
  {
    const c = wsParam.getCell(pr, 1);
    c.value = 'MAPEO ZONA ORIGEN → ZONA PRECIOS';
    c.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
    c.fill = headerFill(COLORS.slate800);
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    c.border = border('thin', COLORS.slate800);
    wsParam.getRow(pr).height = 22;
  }
  pr += 1;

  const ZONA_MAP_HEADER = ['Zona Origen (dataset)', 'Zona Precios'];
  ZONA_MAP_HEADER.forEach((h, i) => {
    const c = wsParam.getCell(pr, i + 1);
    c.value = h;
    c.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate500 } };
    c.fill = headerFill(COLORS.slate50);
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    c.border = border('thin', COLORS.slate200);
  });
  wsParam.getRow(pr).height = 18;
  pr += 1;

  // Espejo exacto de backend/app/config.py:ZONA_DATASET_TO_PRECIOS
  const ZONA_DATASET_TO_PRECIOS: Array<[string, string]> = [
    ['01. ARICA',                       'Arica-Iquique'],
    ['01. IQUIQUE',                     'Arica-Iquique'],
    ['02. ANTOFAGASTA',                 'Atacama'],
    ['03. ATACAMA',                     'Atacama'],
    ['04. COQUIMBO',                    'Coquimbo'],
    ['05. QUINTA MELIPILLA',            'Quinta-Melipilla'],
    ['06. METROPOLITANA',               'Quinta-Melipilla'],
    ['07. RANCAGUA',                    'Rancagua'],
    ['08. COLCHAGUA - CARDENAL CARO',   'Colchagua-Cardenal Caro'],
    ['09. MAULE NORTE',                 'Maule Norte'],
    ['10. MAULE SUR',                   'Maule Sur'],
    ['11. CONCEPCION',                  'Bio Bio'],
  ];

  const ZONA_MAP_FIRST = pr;
  ZONA_DATASET_TO_PRECIOS.forEach(([origen, precios]) => {
    const cA = wsParam.getCell(pr, 1);
    cA.value = origen;
    cA.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
    cA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cA.border = border('thin', COLORS.slate100);

    const cB = wsParam.getCell(pr, 2);
    cB.value = precios;
    cB.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.primary } };
    cB.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cB.fill = headerFill(COLORS.slate50);
    cB.border = border('thin', COLORS.slate200);

    wsParam.getRow(pr).height = 18;
    pr += 1;
  });
  const ZONA_MAP_LAST = pr - 1;
  const ZONA_MAP_RANGE = `'${PARAM_SHEET}'!$A$${ZONA_MAP_FIRST}:$B$${ZONA_MAP_LAST}`;

  // Helper para Detalle!U: dada una fila r, compone el key de tarifa usando
  //   "OCA GLOBAL"&"1F" + VLOOKUP(F{r} → Zona Precios) + G{r} (Comuna)
  // y resuelve el precio con INDEX/MATCH en la tabla de tarifas. El comuna
  // del precio queda explícito en la fórmula (G{r}).
  const precioFormulaFromFG = (rowIdx: number): string =>
    `IFERROR(INDEX(${PRICE_VAL_RANGE},MATCH(` +
      `"OCA GLOBAL"&"1F"&VLOOKUP(F${rowIdx},${ZONA_MAP_RANGE},2,FALSE)&G${rowIdx},` +
      `${PRICE_KEY_RANGE},0)),0)`;

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
    `Período: ${periodoLabel}  ·  Meta dinámica ${META} ef. (${EFECTIVAS_POR_DIA} ef/día × ${diasHabiles} días hábiles${calendarioMes ? ` de ${periodoMes}` : ''})  ·  OCA Global · 1F`;
  wsResumen.getCell('A2').font = { name: 'Inter', size: 10, italic: true, color: { argb: COLORS.slate500 } };
  wsResumen.getCell('A2').fill = headerFill(COLORS.slate50);
  wsResumen.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsResumen.getRow(2).height = 18;

  // Métrica destacada: la única tarjeta grande del top, muestra el total a pago
  wsResumen.mergeCells('A3:G3');
  wsResumen.getRow(3).height = 8;  // separador

  wsResumen.mergeCells('A4:C6');
  const cTotal = wsResumen.getCell('A4');
  cTotal.value = { formula: `SUM(${detRng('Y')})`, result: totalPago };
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
  cBrecha.value = { formula: `SUM(${detRng('Z')})`, result: brechaTotal };
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
  // Cumplen = filas donde Efectivas (L) ≥ Meta. Como Meta es la misma para todos
  // los técnicos del período, usamos la constante META directamente.
  wsResumen.mergeCells('F4:G6');
  const cCumpl = wsResumen.getCell('F4');
  cCumpl.value = {
    formula: `IFERROR(ROUND(SUMPRODUCT((${detRng('M')}>=${P_META})*1)/COUNTA(${detRng('B')})*100,0),0)`,
    result: Math.round(pctCumplen),
  };
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
  type KpiSpec = { label: string; value: number; fmt: string; red?: boolean; formula?: string };
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
        vc.value = kpi.formula
          ? { formula: kpi.formula, result: kpi.value }
          : kpi.value;
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

  const totalMant = sumar('mantenimiento_mes');

  renderSection('Resumen de Pago', [
    { label: 'Pago Potencial', value: pagoPotencial, fmt: moneyFmt, formula: `SUM(${detRng('U')})+SUM(${detRng('X')})` },
    { label: 'Monto Hábil',    value: totalMontoH,   fmt: moneyFmt, formula: `SUM(${detRng('W')})` },
    { label: 'Monto Sábado',   value: totalMontoS,   fmt: moneyFmt, formula: `SUM(${detRng('X')})` },
  ]);

  renderSection('Cumplimiento', [
    { label: 'Técnicos',            value: pagoTecnicos.length, fmt: numFmt, formula: `COUNTA(${detRng('B')})` },
    { label: 'Cumplen Meta',        value: cumplen,             fmt: numFmt, formula: `SUMPRODUCT((${detRng('M')}>=${P_META})*1)` },
    { label: 'No Cumplen',          value: noCumplen,           fmt: numFmt, formula: `COUNTA(${detRng('B')})-SUMPRODUCT((${detRng('M')}>=${P_META})*1)` },
    { label: 'Efectivas Faltantes', value: efFaltantes,         fmt: numFmt, red: efFaltantes > 0, formula: `SUM(${detRng('AA')})` },
  ]);

  renderSection('Efectivas', [
    { label: 'Total Efectivas',   value: totalEf,  fmt: numFmt, formula: `SUM(${detRng('M')})` },
    { label: 'Efectivas Hábiles', value: totalHab, fmt: numFmt, formula: `SUM(${detRng('V')})` },
    { label: 'Efectivas Sábado',  value: totalSab, fmt: numFmt, formula: `SUM(${detRng('T')})` },
  ]);

  renderSection('Desglose por Categoría', [
    { label: 'Normales',         value: totalNorm,  fmt: numFmt, formula: `SUM(${detRng('H')})` },
    { label: 'CNR Medida',       value: totalCnrM,  fmt: numFmt, formula: `SUM(${detRng('I')})` },
    { label: 'CNR Intervención', value: totalCnrI,  fmt: numFmt, formula: `SUM(${detRng('J')})` },
    { label: 'VF CGE',           value: totalVfCge, fmt: numFmt, formula: `SUM(${detRng('K')})` },
    { label: 'Mant. Medidor',    value: totalMant,  fmt: numFmt, formula: `SUM(${detRng('L')})` },
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

  // (grupos y zonasOrdenadas ya fueron computados arriba)

  zonasOrdenadas.forEach((z) => {
    const items = grupos.get(z)!;
    const c = items.filter((t) => t.cumple_meta).length;
    const ef = items.reduce((a, t) => a + t.efectivas_mes, 0);
    const pago = items.reduce((a, t) => a + t.total_pago, 0);
    const potencial = items.reduce((a, t) => a + t.precio_base + t.monto_sabado, 0);
    const brecha = Math.max(0, potencial - pago);
    const pct = items.length > 0 ? Math.round((c / items.length) * 100) : 0;
    const zSafe = escZona(z);

    type CellVal = string | number | { formula: string; result: number };
    const vals: Array<[CellVal, string | undefined, boolean?]> = [
      [z, undefined],
      [{ formula: `COUNTIF(${detRng('F')},"${zSafe}")`, result: items.length }, numFmt],
      [{ formula: `SUMPRODUCT((${detRng('F')}="${zSafe}")*(${detRng('M')}>=${P_META}))`, result: c }, numFmt],
      [{ formula: `IFERROR(ROUND(C${row}/B${row}*100,0),0)`, result: pct }, pctFmt],
      [{ formula: `SUMIF(${detRng('F')},"${zSafe}",${detRng('M')})`, result: ef }, numFmt],
      [{ formula: `SUMIF(${detRng('F')},"${zSafe}",${detRng('Y')})`, result: pago }, moneyFmt],
      [{ formula: `SUMIF(${detRng('F')},"${zSafe}",${detRng('Z')})`, result: brecha }, moneyFmt, true],
    ];
    vals.forEach(([v, fmt, highlight], i) => {
      const cell = wsResumen.getCell(row, i + 1);
      cell.value = v as ExcelJS.CellValue;
      if (fmt) cell.numFmt = fmt;
      const numVal = typeof v === 'object' && v !== null && 'result' in v ? v.result : (v as number);
      cell.font = {
        name: 'Inter', size: 10,
        bold: !!highlight && numVal > 0,
        color: { argb: highlight && numVal > 0 ? COLORS.red : COLORS.slate800 },
      };
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
      cell.border = border();
      if (highlight && numVal > 0) cell.fill = headerFill(COLORS.redSoft);
    });
    row += 1;
  });

  // Fila total resumen por zona
  type TotVal = string | { formula: string; result: number };
  const totRowIdx = row;
  const totVals: Array<[TotVal, string | undefined, boolean?]> = [
    ['TOTAL', undefined],
    [{ formula: `COUNTA(${detRng('B')})`, result: pagoTecnicos.length }, numFmt],
    [{ formula: `SUMPRODUCT((${detRng('M')}>=${P_META})*1)`, result: cumplen }, numFmt],
    [{ formula: `IFERROR(ROUND(C${totRowIdx}/B${totRowIdx}*100,0),0)`, result: Math.round(pctCumplen) }, pctFmt],
    [{ formula: `SUM(${detRng('M')})`, result: totalEf }, numFmt],
    [{ formula: `SUM(${detRng('Y')})`, result: totalPago }, moneyFmt],
    [{ formula: `SUM(${detRng('Z')})`, result: brechaTotal }, moneyFmt, true],
  ];
  totVals.forEach(([v, fmt, highlight], i) => {
    const cell = wsResumen.getCell(row, i + 1);
    cell.value = v as ExcelJS.CellValue;
    if (fmt) cell.numFmt = fmt;
    const numVal = typeof v === 'object' && v !== null && 'result' in v ? v.result : 0;
    cell.font = {
      name: 'Inter', size: 10, bold: true,
      color: { argb: COLORS.white },
    };
    cell.fill = headerFill(highlight && numVal > 0 ? COLORS.red : COLORS.slate800);
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
  ws.getCell('A2').value = `${periodoLabel} · ${pagoTecnicos.length} técnicos · Total ${formatMoney(totalPago)}`;
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
  // Identidad (7) + Mes (7: norm, cnrM, cnrI, vfCge, mant, ef, %) +
  // Sábado (6: norm, cnrM, cnrI, vfCge, mant, ef) +
  // Pago (5: precio, hábiles, hábil, sábado, total) + Brecha (2) = 27 columnas
  const grupos3Real: Array<[string, number, string]> = [
    ['Identidad', 7, COLORS.slate800],
    ['Mes',       7, COLORS.primary],   // +1 por Mant.
    ['Sábado',    6, COLORS.slate500],  // +1 por Mant. Sáb
    ['Pago',      5, COLORS.slate800],
    ['Brecha',    2, COLORS.red],
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
  // Columnas (27 en total):
  //   A  B  C  D  E  F  G  H  I  J  K  L      M           N
  //   Téc EECC Ctta Brig Reg Zona Com Norm CNR-M CNR-I VFCGE Mant Efectivas %Ef
  //   O  P  Q  R  S         T          U  V  W  X  Y     Z      AA
  //   N-S M-S I-S V-S MantSáb  EfectSáb  Pr Hb MH MS Total Brecha EfFaltan
  const headers = [
    'Técnico', 'EECC', 'Ctta', 'Brigada', 'Regional', 'Zona', 'Comuna',          // A–G
    'Normales', 'CNR Med', 'CNR Int', 'VF CGE', 'Mant.', 'Efectivas', '% Efect.', // H–N
    'Norm Sáb', 'CNR Med Sáb', 'CNR Int Sáb', 'VF CGE Sáb', 'Mant. Sáb', 'Efect Sáb', // O–T
    'Precio Base', 'Hábiles', 'Monto Hábil', 'Monto Sábado', 'Total a Pago',      // U–Y
    'Brecha', 'Ef. Faltan',                                                       // Z–AA
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

      // --- Conteos: COUNTIFS sobre Raw Parquet usando el nombre del técnico
      //     (en A{r}) y la etiqueta de Categoría desde Parámetros.
      const cif = (lblRef: string, sab = false) =>
        `COUNTIFS(${rpRange(RP_NOM!)},A${r},${rpRange(RP_CAT!)},${lblRef}` +
        (sab ? `,${rpRange(RP_SAB!)},1` : '') + `)`;

      // Visitas Totales del técnico (denominador del % Efectividad):
      //   suma de COUNTIFS sobre Raw Parquet para cada Resultado visita que
      //   "cuenta" en el universo de visitas (Normal + CNR + Visita fallida + Mant.).
      //   Las etiquetas vienen de Parámetros para que sigan auditables.
      const cifByRV = (rvLbl: string) =>
        `COUNTIFS(${rpRange(RP_NOM!)},A${r},${rpRange(RP_RV!)},${rvLbl})`;
      const fVisitasTotales = haveRP
        ? `${cifByRV(P_NORM_RV)}+${cifByRV(P_CNR_RV)}+${cifByRV(P_VF_RV)}+${cifByRV(P_MANT_RV)}`
        : '';

      // Columnas Detalle (post-shift por Mant.):
      //   H..L = Normales/CNR-M/CNR-I/VFCGE/Mant
      //   M = Efectivas, N = %Efect
      //   O..S = Norm-Sáb/CNR-M-Sáb/CNR-I-Sáb/VFCGE-Sáb/Mant-Sáb
      //   T = Efect-Sáb, U = Precio Base, V = Hábiles
      //   W = Monto Hábil, X = Monto Sábado, Y = Total a Pago
      //   Z = Brecha, AA = Ef. Faltan
      const fEfec  = `H${r}+I${r}+J${r}+K${r}+L${r}`;
      const fEfSab = `O${r}+P${r}+Q${r}+R${r}+S${r}`;
      const fHab   = `M${r}-T${r}`;
      const fMontH = `MIN(U${r},U${r}/${P_META}*V${r})`;
      const fMontS = `U${r}/${P_META}*T${r}`;
      const fTotal = `W${r}+X${r}`;
      const fBrech = `MAX(0,U${r}+X${r}-Y${r})`;
      const fFalt  = `MAX(0,${P_META}-V${r})`;
      // % Efectividad = Efectivas / Visitas Totales × 100, redondeado a entero.
      const fPctEf = haveRP
        ? `IFERROR(ROUND(M${r}/(${fVisitasTotales})*100,0),0)`
        : '';

      type CellRawVal = string | number | { formula: string; result: string | number };
      type CellSpec = {
        v: CellRawVal;
        fmt?: string; bold?: boolean; color?: string; bg?: string;
      };
      const vals: CellSpec[] = [
        // Identidad (datos puros)
        { v: t.nombre },
        { v: t.eecc },
        { v: t.ctta_tusan },
        { v: t.tipo_brigada },
        { v: t.regional },
        // Zona (col F): VLOOKUP desde Asignación de Brigadas en Parámetros
        { v: { formula: vlookupAsig(`A${r}`, 2), result: t.zona || '(sin zona)' } },
        // Comuna (col G): VLOOKUP desde Asignación de Brigadas en Parámetros
        { v: { formula: vlookupAsig(`A${r}`, 4), result: t.comuna || '' } },
        // Conteos por categoría — COUNTIFS sobre Raw Parquet
        haveRP
          ? { v: { formula: cif(P_LBL_NORMAL),  result: t.normales_mes },         fmt: numFmt }
          : { v: t.normales_mes,         fmt: numFmt },
        haveRP
          ? { v: { formula: cif(P_LBL_CNRMED),  result: t.cnr_medida_mes },       fmt: numFmt }
          : { v: t.cnr_medida_mes,       fmt: numFmt },
        haveRP
          ? { v: { formula: cif(P_LBL_CNRINT),  result: t.cnr_intervencion_mes }, fmt: numFmt }
          : { v: t.cnr_intervencion_mes, fmt: numFmt },
        haveRP
          ? { v: { formula: cif(P_LBL_VFCGE),   result: t.vf_cge_mes },           fmt: numFmt }
          : { v: t.vf_cge_mes,           fmt: numFmt },
        haveRP
          ? { v: { formula: cif(P_LBL_MANT),    result: t.mantenimiento_mes },    fmt: numFmt }
          : { v: t.mantenimiento_mes,    fmt: numFmt },
        // Total Efectivas (col M) = H+I+J+K+L
        { v: { formula: fEfec, result: t.efectivas_mes }, fmt: numFmt, bold: true, color: t.cumple_meta ? COLORS.green : COLORS.slate800 },
        // % Efectividad (col N) — fórmula: Efectivas / Visitas Totales × 100.
        // Cuando no hay Raw Parquet usamos el valor del backend como fallback.
        haveRP
          ? { v: { formula: fPctEf, result: Math.round(t.pct_efectividad) }, fmt: pctFmt, color: t.pct_efectividad >= 70 ? COLORS.green : t.pct_efectividad >= 50 ? COLORS.amber : COLORS.red }
          : { v: Math.round(t.pct_efectividad), fmt: pctFmt, color: t.pct_efectividad >= 70 ? COLORS.green : t.pct_efectividad >= 50 ? COLORS.amber : COLORS.red },
        // Sábados (cols O..S)
        haveRP
          ? { v: { formula: cif(P_LBL_NORMAL, true), result: t.normales_sabado },         fmt: numFmt }
          : { v: t.normales_sabado,         fmt: numFmt },
        haveRP
          ? { v: { formula: cif(P_LBL_CNRMED, true), result: t.cnr_medida_sabado },       fmt: numFmt }
          : { v: t.cnr_medida_sabado,       fmt: numFmt },
        haveRP
          ? { v: { formula: cif(P_LBL_CNRINT, true), result: t.cnr_intervencion_sabado }, fmt: numFmt }
          : { v: t.cnr_intervencion_sabado, fmt: numFmt },
        haveRP
          ? { v: { formula: cif(P_LBL_VFCGE,  true), result: t.vf_cge_sabado },           fmt: numFmt }
          : { v: t.vf_cge_sabado,           fmt: numFmt },
        haveRP
          ? { v: { formula: cif(P_LBL_MANT,   true), result: t.mantenimiento_sabado },    fmt: numFmt }
          : { v: t.mantenimiento_sabado,    fmt: numFmt },
        // Efect Sáb (col T)
        { v: { formula: fEfSab, result: t.efectivas_sabado }, fmt: numFmt },
        // Precio Base (col U) — fórmula explícita: usa F (Zona Origen) y G (Comuna)
        //   de la misma fila para componer el key y buscarlo en Tarifas. Así, al
        //   leer la fórmula se ve directamente "el precio depende de la comuna G{r}".
        { v: { formula: precioFormulaFromFG(r), result: t.precio_base }, fmt: moneyFmt },
        // Hábiles (col V)
        { v: { formula: fHab, result: t.efectivas_habiles }, fmt: numFmt },
        // Pago: Monto Hábil (W), Sábado (X), Total (Y), Brecha (Z), Ef. Faltan (AA)
        { v: { formula: fMontH, result: t.monto_habil },  fmt: moneyFmt },
        { v: { formula: fMontS, result: t.monto_sabado }, fmt: moneyFmt },
        { v: { formula: fTotal, result: t.total_pago },   fmt: moneyFmt, bold: true, color: COLORS.slate800, bg: t.cumple_meta ? COLORS.greenSoft : COLORS.redSoft },
        { v: { formula: fBrech, result: brecha },          fmt: moneyFmt, bold: brecha > 0, color: brecha > 0 ? COLORS.red : COLORS.slate500, bg: brecha > 0 ? COLORS.redSoft : undefined },
        { v: { formula: fFalt,  result: falt },            fmt: numFmt,   color: falt > 0 ? COLORS.amber : COLORS.slate500 },
      ];
      vals.forEach((spec, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = spec.v as ExcelJS.CellValue;
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

  // Fila TOTAL: cada columna agrega el rango local de Detalle Técnicos.
  // % Efectividad del total = promedio simple de Raw!P (compromiso: no hay raw visitas en la hoja).
  const pctEfectTot = Math.round(
    totalEf > 0
      ? (totalEf /
          pagoTecnicos.reduce(
            (a, t) => a + (t.pct_efectividad > 0 ? t.efectivas_mes / (t.pct_efectividad / 100) : 0),
            0,
          )) * 100
      : 0,
  );
  // Mapeo Detalle→Raw para SUM en fila TOTAL
  // Fila TOTAL Detalle: SUM sobre el rango local (5 .. DET_LAST). Las filas
  // de subheader de zona quedan vacías en columnas numéricas y SUM las ignora.
  // Mapa de columnas Detalle post-shift por Mant.:
  //   H=Norm  I=CNRMed  J=CNRInt  K=VFCge  L=Mant  M=Efec  N=%Ef
  //   O=NSab  P=CMS     Q=CIS     R=VFS    S=MantSáb  T=EfSab
  //   U=Pr   V=Hab     W=MH       X=MS     Y=Tot     Z=Brec   AA=Falt
  const totalMantMes = sumar('mantenimiento_mes');
  const totalMantSab = sumar('mantenimiento_sabado');
  type TotCol = [number, string | number | { formula: string; result: number }, string, boolean?];
  const totalsByCol: TotCol[] = [
    [8,  { formula: `SUM(${detRng('H')})`,  result: totalNorm },                           numFmt],
    [9,  { formula: `SUM(${detRng('I')})`,  result: totalCnrM },                           numFmt],
    [10, { formula: `SUM(${detRng('J')})`,  result: totalCnrI },                           numFmt],
    [11, { formula: `SUM(${detRng('K')})`,  result: totalVfCge },                          numFmt],
    [12, { formula: `SUM(${detRng('L')})`,  result: totalMantMes },                        numFmt],
    [13, { formula: `SUM(${detRng('M')})`,  result: totalEf },                             numFmt],
    [14, { formula: `IFERROR(ROUND(AVERAGE(${detRng('N')}),0),0)`, result: pctEfectTot },  pctFmt],
    [15, { formula: `SUM(${detRng('O')})`,  result: sumar('normales_sabado') },            numFmt],
    [16, { formula: `SUM(${detRng('P')})`,  result: sumar('cnr_medida_sabado') },          numFmt],
    [17, { formula: `SUM(${detRng('Q')})`,  result: sumar('cnr_intervencion_sabado') },    numFmt],
    [18, { formula: `SUM(${detRng('R')})`,  result: sumar('vf_cge_sabado') },              numFmt],
    [19, { formula: `SUM(${detRng('S')})`,  result: totalMantSab },                        numFmt],
    [20, { formula: `SUM(${detRng('T')})`,  result: totalSab },                            numFmt],
    [21, { formula: `SUM(${detRng('U')})`,  result: sumar('precio_base') },                moneyFmt],
    [22, { formula: `SUM(${detRng('V')})`,  result: totalHab },                            numFmt],
    [23, { formula: `SUM(${detRng('W')})`,  result: totalMontoH },                         moneyFmt],
    [24, { formula: `SUM(${detRng('X')})`,  result: totalMontoS },                         moneyFmt],
    [25, { formula: `SUM(${detRng('Y')})`,  result: totalPago },                           moneyFmt],
    [26, { formula: `SUM(${detRng('Z')})`,  result: brechaTotal },                         moneyFmt, true],
    [27, { formula: `SUM(${detRng('AA')})`, result: efFaltantes },                         numFmt, true],
  ];
  totalsByCol.forEach(([col, val, fmt, highlight]) => {
    const c = ws.getCell(totalRow, col);
    c.value = val as ExcelJS.CellValue;
    c.numFmt = fmt;
    c.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
    c.fill = headerFill(highlight ? COLORS.red : COLORS.slate800);
    c.alignment = { vertical: 'middle', horizontal: 'right' };
    c.border = border('medium', COLORS.slate800);
  });
  ws.getRow(totalRow).height = 22;

  // Anchos (27 cols)
  const widths = [
    32, 12, 8, 10, 12, 26, 22,  // A-G identidad
    9, 9, 9, 9, 9, 11, 9,       // H-N normales..efectivas..%efect
    10, 11, 11, 11, 10, 11,     // O-T sábados..efect sáb
    14, 10, 14, 14, 16,         // U-Y pago
    14, 10,                     // Z-AA brecha, faltan
  ];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Auto filter sobre header
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };

  // -------------------------------------------------------------------------
  // Hoja: RAW PARQUET (FUENTE ÚNICA — TODA la data cruda del parquet del
  // backend para las filas filtradas. + 2 columnas auxiliares calculadas
  // por fórmula que clasifican cada inspección y marcan los sábados.)
  // Va inmediatamente después de Detalle Técnicos para que el usuario
  // pueda verificar manualmente cualquier conteo (filtrando por técnico
  // y categoría) y reproducir el cálculo a mano.
  // -------------------------------------------------------------------------
  if (rawData) {
    const wsParquet = wb.addWorksheet(RP_SHEET, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const totalDataCols = rawData.columnas.length + 2; // +Categoría +Es Sábado

    // Fila 1: headers — datos crudos + helpers (sin banner contextual)
    rawData.columnas.forEach((colName, i) => {
      const cell = wsParquet.getCell(1, i + 1);
      cell.value = colName;
      cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
      cell.fill = headerFill(COLORS.slate500);
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = border('thin', COLORS.slate200);
    });
    // Helpers
    [
      ['Categoría',  COLORS.primary],
      ['Es Sábado',  COLORS.amber],
    ].forEach(([h, color], k) => {
      const cell = wsParquet.getCell(1, rawData!.columnas.length + 1 + k);
      cell.value = h as string;
      cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
      cell.fill = headerFill(color as string);
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate200);
    });
    wsParquet.getRow(1).height = 18;

    // Filas: data cruda + 2 fórmulas helper (data desde fila 2)
    rawData.rows.forEach((row, idx) => {
      const r = idx + 2;
      rawData!.columnas.forEach((colName, i) => {
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

      if (RP_RV && RP_TCN && RP_RF && RP_FEC && RP_CAT && RP_SAB) {
        const rv  = `${RP_RV}${r}`;
        const tc  = `${RP_TCN}${r}`;
        const rf  = `${RP_RF}${r}`;
        const fec = `${RP_FEC}${r}`;

        // Categoría: réplica exacta de pago_tecnicos.py — todo parametrizado
        // contra la hoja "Parámetros" para que se pueda ajustar sin tocar código.
        // VF CGE: whitelist de 6 items por Resultado final (alineada con EP del jefe).
        const fCat =
          `IF(${rv}=${P_NORM_RV},${P_LBL_NORMAL},` +
            `IF(AND(${rv}=${P_CNR_RV},${tc}=${P_CNR_FALLA}),${P_LBL_CNRMED},` +
              `IF(AND(${rv}=${P_CNR_RV},${tc}=${P_CNR_HURTO}),${P_LBL_CNRINT},` +
                `IF(AND(${rv}=${P_VF_RV},` +
                    `OR(${rf}=${P_VF_RF1},${rf}=${P_VF_RF2},${rf}=${P_VF_RF3},` +
                       `${rf}=${P_VF_RF4},${rf}=${P_VF_RF5},${rf}=${P_VF_RF6})),${P_LBL_VFCGE},` +
                  `IF(${rv}=${P_MANT_RV},${P_LBL_MANT},${P_LBL_OTRA})))))`;
        const VF_CGE_WHITELIST = new Set([
          'Casa deshabitada',
          'Desconectado en BT/MT',
          'Condición insegura (Física del empalme)',
          'Sitio eriazo',
          'Sin empalme',
          'Sin acceso por caja tortuga',
        ]);
        const rv_v = String(row['Resultado visita'] ?? '');
        const tc_v = String(row['Tipo_CNR.Tipo de CNR'] ?? '');
        const rf_v = String(row['Resultado final'] ?? '');
        let catVal = 'Otra';
        if (rv_v === 'Normal') catVal = 'Normal';
        else if (rv_v === 'CNR' && tc_v === 'CNR Falla') catVal = 'CNR Falla';
        else if (rv_v === 'CNR' && tc_v === 'CNR Hurto') catVal = 'CNR Hurto';
        else if (rv_v === 'Visita fallida' && VF_CGE_WHITELIST.has(rf_v)) catVal = 'VF CGE';
        else if (rv_v === 'Mantenimiento Medidor') catVal = 'Mantenimiento Medidor';

        const catCell = wsParquet.getCell(r, rawData!.columnas.length + 1);
        catCell.value = { formula: fCat, result: catVal };
        catCell.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
        catCell.alignment = { vertical: 'middle', horizontal: 'left' };
        catCell.border = border('thin', COLORS.slate100);

        // Es Sábado: parse manual YYYY-MM-DD (a prueba de locale).
        const fSab =
          `IFERROR(IF(WEEKDAY(DATE(VALUE(LEFT(${fec},4)),VALUE(MID(${fec},6,2)),VALUE(MID(${fec},9,2))),2)=6,1,0),0)`;
        const fec_v = String(row['Fecha ejecución'] ?? '');
        const sabVal = (() => {
          if (!fec_v || fec_v.length < 10) return 0;
          const d = new Date(fec_v + 'T00:00:00');
          return isNaN(d.getTime()) ? 0 : d.getDay() === 6 ? 1 : 0;
        })();
        const sabCell = wsParquet.getCell(r, rawData!.columnas.length + 2);
        sabCell.value = { formula: fSab, result: sabVal };
        sabCell.numFmt = numFmt;
        sabCell.font = { name: 'Inter', size: 9, color: { argb: COLORS.slate800 } };
        sabCell.alignment = { vertical: 'middle', horizontal: 'center' };
        sabCell.border = border('thin', COLORS.slate100);
      }
    });

    // Anchos: heurística por nombre de columna
    rawData.columnas.forEach((colName, i) => {
      const lower = colName.toLowerCase();
      let w = 14;
      if (lower.includes('nombre') || lower.includes('direcc')) w = 28;
      else if (lower.includes('comuna') || lower.includes('zona') || lower.includes('regional')) w = 18;
      else if (lower.includes('aviso') || lower.includes('id medida')) w = 14;
      else if (lower.includes('hora')) w = 8;
      else if (lower.includes('kwh')) w = 10;
      else if (lower.includes('resultado') || lower.includes('tipo')) w = 22;
      else if (lower.includes('fecha')) w = 12;
      else if (lower.includes('correo')) w = 24;
      wsParquet.getColumn(i + 1).width = w;
    });
    wsParquet.getColumn(rawData.columnas.length + 1).width = 12; // Categoría
    wsParquet.getColumn(rawData.columnas.length + 2).width = 10; // Es Sábado

    wsParquet.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: totalDataCols },
    };
  }

  // -------------------------------------------------------------------------
  // Hoja 3: CALENDARIO BRIGADAS
  // -------------------------------------------------------------------------
  if (calendarioMes) {
    const wsCal = wb.addWorksheet('Calendario Brigadas', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }],
      properties: { defaultRowHeight: 14 },
    });

    // Feriados chilenos (ISO YYYY-MM-DD). Mirror del backend (config.py FERIADOS_CL).
    // Necesario para clasificar días en modo Cierre EDP que abarca DOS meses.
    const FERIADOS_ISO = new Set<string>([
      // 2025
      '2025-01-01','2025-04-18','2025-04-19','2025-05-01','2025-05-21',
      '2025-06-20','2025-06-29','2025-07-16','2025-08-15',
      '2025-09-18','2025-09-19','2025-10-12','2025-10-31','2025-11-01',
      '2025-12-08','2025-12-14','2025-12-25',
      // 2026
      '2026-01-01','2026-04-03','2026-04-04','2026-05-01','2026-05-21',
      '2026-06-29','2026-07-16','2026-08-15',
      '2026-09-18','2026-09-19','2026-10-12','2026-10-31','2026-11-01',
      '2026-12-08','2026-12-25',
    ]);

    type TipoDia = 'habil' | 'sabado' | 'domingo' | 'feriado';
    type DiaCel = { iso: string; numDia: number; tipo: TipoDia };

    const padDate = (n: number) => String(n).padStart(2, '0');
    const tipoFromDate = (año: number, mes: number, dia: number): TipoDia => {
      const iso = `${año}-${padDate(mes)}-${padDate(dia)}`;
      const dow = new Date(año, mes - 1, dia).getDay();  // 0 Dom, 6 Sáb
      if (dow !== 0 && dow !== 6 && FERIADOS_ISO.has(iso)) return 'feriado';
      if (dow === 6) return 'sabado';
      if (dow === 0) return 'domingo';
      return 'habil';
    };

    // Construye las celdas del calendario según modo.
    //   - Cierre EDP: rango 26 (mes-1) → 25 (mes destino).
    //   - Normal: 1 → dias_en_mes del mes visualizado.
    let diasCel: DiaCel[];
    let calTitulo: string;
    let calSubtituloRange: string;
    if (mesCierre) {
      const [añoMc, mesMc] = mesCierre.split('-').map(Number);
      const inicio = mesMc === 1
        ? new Date(añoMc - 1, 11, 26)
        : new Date(añoMc, mesMc - 2, 26);
      const fin = new Date(añoMc, mesMc - 1, 25);
      diasCel = [];
      const cur = new Date(inicio);
      while (cur <= fin) {
        const año = cur.getFullYear();
        const mes = cur.getMonth() + 1;
        const dia = cur.getDate();
        diasCel.push({
          iso: `${año}-${padDate(mes)}-${padDate(dia)}`,
          numDia: dia,
          tipo: tipoFromDate(año, mes, dia),
        });
        cur.setDate(cur.getDate() + 1);
      }
      calTitulo = `Calendario Operativo — Cierre EDP CGE ${rangoCierreEdpLabel(mesCierre)} ${añoMc}`;
      calSubtituloRange = rangoCierreEdpLabel(mesCierre);
    } else {
      const sabSet = new Set(calendarioMes.sabados);
      const domSet = new Set(calendarioMes.domingos);
      const ferSet = new Set(calendarioMes.feriados);
      diasCel = Array.from({ length: calendarioMes.dias_en_mes }, (_, i) => {
        const d = i + 1;
        const iso = `${calendarioMes.año}-${padDate(calendarioMes.numero_mes)}-${padDate(d)}`;
        let tipo: TipoDia = 'habil';
        if (ferSet.has(d)) tipo = 'feriado';
        else if (sabSet.has(d)) tipo = 'sabado';
        else if (domSet.has(d)) tipo = 'domingo';
        return { iso, numDia: d, tipo };
      });
      calTitulo = `Calendario Operativo — ${calendarioMes.mes} ${calendarioMes.año}`;
      calSubtituloRange = `${calendarioMes.mes} ${calendarioMes.año}`;
    }

    const bgPorTipo = (tipo: TipoDia): string => {
      switch (tipo) {
        case 'sabado': return COLORS.amberSoft;
        case 'domingo': return COLORS.slate100;
        case 'feriado': return COLORS.violetSoft;
        default: return COLORS.white;
      }
    };

    const colorMarca = (tipo: TipoDia): string => {
      switch (tipo) {
        case 'sabado': return COLORS.amber;
        case 'feriado': return COLORS.violet;
        case 'domingo': return COLORS.slate500;
        default: return COLORS.primary;
      }
    };

    const totalCols = 2 + diasCel.length + 3;

    // Días hábiles / sábados TRANSCURRIDOS dentro del rango representado.
    // Cierre EDP: el rango entero es histórico → todos cuentan.
    // Mes normal: se descuentan los días futuros respecto a "hoy".
    const hoy = new Date();
    const hoyIso = `${hoy.getFullYear()}-${padDate(hoy.getMonth() + 1)}-${padDate(hoy.getDate())}`;
    let diasHabilesTranscurridos = 0;
    let sabadosTranscurridos = 0;
    let totalHabilesRange = 0;
    diasCel.forEach((dc) => {
      if (dc.tipo === 'habil') totalHabilesRange += 1;
      if (dc.iso <= hoyIso) {
        if (dc.tipo === 'sabado') sabadosTranscurridos += 1;
        else if (dc.tipo === 'habil') diasHabilesTranscurridos += 1;
      }
    });

    // Fila 1: título
    wsCal.mergeCells(1, 1, 1, totalCols);
    wsCal.getCell(1, 1).value = calTitulo;
    wsCal.getCell(1, 1).font = { name: 'Inter', size: 14, bold: true, color: { argb: COLORS.slate800 } };
    wsCal.getRow(1).height = 22;

    // Fila 2: subtítulo
    wsCal.mergeCells(2, 1, 2, totalCols);
    const brigadasOp = pagoTecnicos.filter((t) =>
      (t.fechas_trabajadas?.length ?? t.dias_trabajados_count ?? 0) > 0
    ).length;
    wsCal.getCell(2, 1).value = `Período: ${periodoLabel} · ${brigadasOp} brigadas operativas · ${diasHabilesTranscurridos}/${totalHabilesRange} días hábiles transcurridos`;
    wsCal.getCell(2, 1).font = { name: 'Inter', size: 9, color: { argb: COLORS.slate500 } };
    wsCal.getRow(2).height = 14;

    // Fila 3: agrupadores
    wsCal.mergeCells(3, 1, 3, 2);
    wsCal.getCell(3, 1).value = 'Identidad';
    wsCal.mergeCells(3, 3, 3, 2 + diasCel.length);
    wsCal.getCell(3, 3).value = mesCierre
      ? `Días del cierre EDP — ${calSubtituloRange} (${diasCel.length})`
      : `Días del mes (${diasCel.length})`;
    wsCal.mergeCells(3, 3 + diasCel.length, 3, totalCols);
    wsCal.getCell(3, 3 + diasCel.length).value = 'Totales';
    [1, 3, 3 + diasCel.length].forEach((c) => {
      const cell = wsCal.getCell(3, c);
      cell.font = { name: 'Inter', size: 10, bold: true, color: { argb: COLORS.white } };
      cell.fill = headerFill(COLORS.slate800);
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border('thin', COLORS.slate800);
    });
    wsCal.getRow(3).height = 18;

    // Fila 4: números de día + headers identidad/totales.
    // En modo Cierre EDP marcamos el límite de mes con borde grueso a la izquierda
    // de la primera celda de cada mes posterior al primero (visualmente: cambia de mes).
    wsCal.getCell(4, 1).value = 'Brigada';
    wsCal.getCell(4, 2).value = 'Zona';
    let prevMes = -1;
    diasCel.forEach((dc, i) => {
      const cell = wsCal.getCell(4, 3 + i);
      cell.value = dc.numDia;
      cell.fill = headerFill(bgPorTipo(dc.tipo));
      cell.font = { name: 'Inter', size: 8, bold: true, color: { argb: COLORS.slate500 } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      const isoMes = Number(dc.iso.slice(5, 7));
      const cambiaMes = prevMes !== -1 && isoMes !== prevMes;
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.slate100 } },
        bottom: { style: 'thin', color: { argb: COLORS.slate100 } },
        right: { style: 'thin', color: { argb: COLORS.slate100 } },
        left: cambiaMes
          ? { style: 'medium', color: { argb: COLORS.slate800 } }
          : { style: 'thin', color: { argb: COLORS.slate100 } },
      };
      prevMes = isoMes;
    });
    ['Días Trab', 'Sáb Trab', 'Faltas'].forEach((label, i) => {
      const cell = wsCal.getCell(4, 3 + diasCel.length + i);
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

    // Fila 5: inicial día semana (+ marca de mes al cambiar en cierre EDP)
    const INICIAL = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const MESES_ABREV = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    wsCal.getCell(5, 1).value = '';
    wsCal.getCell(5, 2).value = '';
    let prevMesRow5 = -1;
    diasCel.forEach((dc, i) => {
      const cell = wsCal.getCell(5, 3 + i);
      const [añoIso, mesIso, diaIso] = dc.iso.split('-').map(Number);
      const dow = new Date(añoIso, mesIso - 1, diaIso).getDay(); // 0=Dom..6=Sáb
      const dowMon0 = (dow + 6) % 7;  // 0=Lun..6=Dom
      // Cuando cambia el mes en cierre EDP, mostramos abreviación del mes en vez de inicial DOW
      const cambiaMes = prevMesRow5 !== -1 && mesIso !== prevMesRow5;
      cell.value = cambiaMes ? MESES_ABREV[mesIso - 1] : INICIAL[dowMon0];
      cell.fill = headerFill(cambiaMes ? COLORS.slate100 : bgPorTipo(dc.tipo));
      cell.font = {
        name: 'Inter', size: cambiaMes ? 7 : 8,
        bold: cambiaMes,
        color: { argb: cambiaMes ? COLORS.slate800 : COLORS.slate500 },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.slate100 } },
        bottom: { style: 'thin', color: { argb: COLORS.slate100 } },
        right: { style: 'thin', color: { argb: COLORS.slate100 } },
        left: cambiaMes
          ? { style: 'medium', color: { argb: COLORS.slate800 } }
          : { style: 'thin', color: { argb: COLORS.slate100 } },
      };
      prevMesRow5 = mesIso;
    });
    for (let c = 3 + diasCel.length; c <= totalCols; c++) {
      wsCal.getCell(5, c).fill = headerFill(COLORS.slate50);
      wsCal.getCell(5, c).border = border('thin', COLORS.slate100);
    }
    wsCal.getRow(5).height = 14;

    // Helper: obtiene el set de ISO trabajadas de un técnico.
    // Si el backend no entrega fechas_trabajadas (legacy), reconstruye desde
    // dias_trabajados asumiendo el mes de calendarioMes (sólo válido en modo
    // mes-único, donde dias_trabajados siempre apunta al mismo mes).
    const fechasISOSet = (t: PagoTecnico): Set<string> => {
      if (t.fechas_trabajadas && t.fechas_trabajadas.length > 0) {
        return new Set(t.fechas_trabajadas);
      }
      const fallback = new Set<string>();
      const y = calendarioMes.año;
      const m = calendarioMes.numero_mes;
      (t.dias_trabajados ?? []).forEach((d) => {
        fallback.add(`${y}-${padDate(m)}-${padDate(d)}`);
      });
      return fallback;
    };

    // Conteos por técnico, calculados sobre el rango representado.
    const conteoTec = (t: PagoTecnico): { diasHabTrab: number; sabTrab: number; totalTrab: number } => {
      const fs = fechasISOSet(t);
      let diasHabTrab = 0;
      let sabTrab = 0;
      let totalTrab = 0;
      diasCel.forEach((dc) => {
        if (fs.has(dc.iso)) {
          totalTrab += 1;
          if (dc.tipo === 'habil') diasHabTrab += 1;
          else if (dc.tipo === 'sabado') sabTrab += 1;
        }
      });
      return { diasHabTrab, sabTrab, totalTrab };
    };

    // Agrupar técnicos por zona
    const grupos = new Map<string, PagoTecnico[]>();
    pagoTecnicos.forEach((t) => {
      const z = t.zona || '(sin zona)';
      if (!grupos.has(z)) grupos.set(z, []);
      grupos.get(z)!.push(t);
    });
    const zonasOrdenadas = Array.from(grupos.keys()).sort();

    // Acumuladores globales para la fila de totales.
    let sumTrabGlobal = 0;
    let sumSabGlobal = 0;
    let sumAusGlobal = 0;

    let r = 6;
    zonasOrdenadas.forEach((zona) => {
      const items = grupos.get(zona)!.slice();
      // Pre-calcula conteos para ordenar y agregados de zona
      const conteoPorItem = new Map<PagoTecnico, ReturnType<typeof conteoTec>>();
      items.forEach((t) => conteoPorItem.set(t, conteoTec(t)));
      items.sort((a, b) => (conteoPorItem.get(b)!.totalTrab) - (conteoPorItem.get(a)!.totalTrab));

      const operZ = items.filter((t) => conteoPorItem.get(t)!.totalTrab > 0).length;
      const diasOpSetZ = new Set<string>();
      items.forEach((t) => fechasISOSet(t).forEach((iso) => diasOpSetZ.add(iso)));
      const diasOpZ = diasOpSetZ.size;
      const totDiasBrigZ = items.reduce((a, t) => a + conteoPorItem.get(t)!.totalTrab, 0);
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

        const fs = fechasISOSet(t);
        const { diasHabTrab, sabTrab } = conteoPorItem.get(t)!;
        let prevMesCell = -1;
        diasCel.forEach((dc, i) => {
          const cell = wsCal.getCell(r, 3 + i);
          const trabajo = fs.has(dc.iso);
          if (trabajo) {
            cell.value = '●';
            cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: colorMarca(dc.tipo) } };
          } else {
            cell.value = '';
          }
          cell.fill = headerFill(bgPorTipo(dc.tipo));
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          const isoMes = Number(dc.iso.slice(5, 7));
          const cambiaMes = prevMesCell !== -1 && isoMes !== prevMesCell;
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.slate100 } },
            bottom: { style: 'thin', color: { argb: COLORS.slate100 } },
            right: { style: 'thin', color: { argb: COLORS.slate100 } },
            left: cambiaMes
              ? { style: 'medium', color: { argb: COLORS.slate800 } }
              : { style: 'thin', color: { argb: COLORS.slate100 } },
          };
          prevMesCell = isoMes;
        });

        // Ausencias: solo hasta "hoy"; en cierre EDP el rango entero es histórico
        const ausH = Math.max(0, diasHabilesTranscurridos - diasHabTrab);
        sumTrabGlobal += diasHabTrab;
        sumSabGlobal += sabTrab;
        sumAusGlobal += ausH;

        const totales: Array<[number, string]> = [
          [diasHabTrab, COLORS.slate800],
          [sabTrab, COLORS.amber],
          [ausH, ausH === 0 ? COLORS.slate500 : ausH <= 3 ? COLORS.amber : COLORS.red],
        ];
        totales.forEach(([v, color], i) => {
          const cell = wsCal.getCell(r, 3 + diasCel.length + i);
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

    const operPorIso = new Map<string, number>();
    pagoTecnicos.forEach((t) => {
      fechasISOSet(t).forEach((iso) => {
        operPorIso.set(iso, (operPorIso.get(iso) ?? 0) + 1);
      });
    });
    let prevMesFooter = -1;
    diasCel.forEach((dc, i) => {
      const cell = wsCal.getCell(r, 3 + i);
      cell.value = operPorIso.get(dc.iso) ?? 0;
      cell.numFmt = numFmt;
      cell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate800 } };
      cell.fill = headerFill(bgPorTipo(dc.tipo));
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      const isoMes = Number(dc.iso.slice(5, 7));
      const cambiaMes = prevMesFooter !== -1 && isoMes !== prevMesFooter;
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.slate200 } },
        bottom: { style: 'thin', color: { argb: COLORS.slate200 } },
        right: { style: 'thin', color: { argb: COLORS.slate200 } },
        left: cambiaMes
          ? { style: 'medium', color: { argb: COLORS.slate800 } }
          : { style: 'thin', color: { argb: COLORS.slate200 } },
      };
      prevMesFooter = isoMes;
    });
    // Totales columnas — Trab y Faltas comparten denominador (hábiles) y son complementarios.
    const posibleHab = brigadasOp * diasHabilesTranscurridos;
    const posibleSab = brigadasOp * sabadosTranscurridos;
    const pctTrabGlobal = posibleHab > 0 ? (sumTrabGlobal / posibleHab) * 100 : 0;
    const pctSabGlobal = posibleSab > 0 ? (sumSabGlobal / posibleSab) * 100 : 0;
    const pctAusGlobal = posibleHab > 0 ? (sumAusGlobal / posibleHab) * 100 : 0;

    const totTrabCell = wsCal.getCell(r, 3 + diasCel.length);
    totTrabCell.value = `${sumTrabGlobal}/${posibleHab}`;
    totTrabCell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    totTrabCell.fill = headerFill(COLORS.slate800);
    totTrabCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totTrabCell.border = border('medium', COLORS.slate800);

    const totSabCell = wsCal.getCell(r, 3 + diasCel.length + 1);
    totSabCell.value = `${sumSabGlobal}/${posibleSab}`;
    totSabCell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    totSabCell.fill = headerFill(COLORS.amber);
    totSabCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totSabCell.border = border('medium', COLORS.slate800);

    const totAusCell = wsCal.getCell(r, 3 + diasCel.length + 2);
    totAusCell.value = `${sumAusGlobal}/${posibleHab}`;
    totAusCell.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.white } };
    totAusCell.fill = headerFill(COLORS.red);
    totAusCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totAusCell.border = border('medium', COLORS.slate800);
    wsCal.getRow(r).height = 18;
    r += 1;

    // Fila final 2: cobertura % + promedios por brigada
    wsCal.mergeCells(r, 1, r, 2 + diasCel.length);
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
    const cellTrabProm = wsCal.getCell(r, 3 + diasCel.length);
    cellTrabProm.value = `${Math.round(pctTrabGlobal)}% · ${promTrab.toFixed(1)}`;
    cellTrabProm.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.slate800 } };
    cellTrabProm.fill = headerFill(COLORS.slate50);
    cellTrabProm.alignment = { vertical: 'middle', horizontal: 'right' };
    cellTrabProm.border = border('thin', COLORS.slate200);

    const cellSabProm = wsCal.getCell(r, 3 + diasCel.length + 1);
    cellSabProm.value = `${Math.round(pctSabGlobal)}% · ${promSab.toFixed(1)}`;
    cellSabProm.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.amber } };
    cellSabProm.fill = headerFill(COLORS.slate50);
    cellSabProm.alignment = { vertical: 'middle', horizontal: 'right' };
    cellSabProm.border = border('thin', COLORS.slate200);

    const cellAusProm = wsCal.getCell(r, 3 + diasCel.length + 2);
    cellAusProm.value = `${Math.round(pctAusGlobal)}% · ${promAus.toFixed(1)}`;
    cellAusProm.font = { name: 'Inter', size: 9, bold: true, color: { argb: COLORS.red } };
    cellAusProm.fill = headerFill(COLORS.slate50);
    cellAusProm.alignment = { vertical: 'middle', horizontal: 'right' };
    cellAusProm.border = border('thin', COLORS.slate200);

    wsCal.getRow(r).height = 16;

    // Anchos de columna
    wsCal.getColumn(1).width = 30;
    wsCal.getColumn(2).width = 22;
    for (let i = 0; i < diasCel.length; i++) {
      wsCal.getColumn(3 + i).width = 3.2;
    }
    wsCal.getColumn(3 + diasCel.length).width = 10;
    wsCal.getColumn(3 + diasCel.length + 1).width = 10;
    wsCal.getColumn(3 + diasCel.length + 2).width = 10;
  }

  // Nota: la hoja "Raw Tecnicos" fue eliminada. Detalle Técnicos deriva sus
  // conteos directamente desde Raw Parquet (COUNTIFS). Raw Parquet ya se
  // renderizó arriba (justo después de Detalle Técnicos) para máxima visibilidad.


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
    { title: '1. Categorías clasificadas como efectivas (5 categorías)' },
    { text: '   • Normales:              Resultado visita = "Normal".' },
    { text: '   • CNR Medida:            Resultado visita = "CNR" + Tipo CNR = "CNR Falla".' },
    { text: '   • CNR Intervención:      Resultado visita = "CNR" + Tipo CNR = "CNR Hurto".' },
    { text: '   • VF CGE:                Resultado visita = "Visita fallida" + Resultado final ∈ whitelist (Casa deshabitada, Desconectado en BT/MT, Condición insegura, Sitio eriazo, Sin empalme, Sin acceso por caja tortuga).' },
    { text: '   • Mantenimiento Medidor: Resultado visita = "Mantenimiento Medidor". (Cuenta como efectiva — criterio alineado con detalle_tecnico.py y tecnicos.py.)' },
    { text: '   • Todo lo demás cae en "Otra" y NO suma a Efectivas.' },
    { text: '   • Estas reglas están parametrizadas en la hoja "Parámetros" (cols B5–B14). Editar ahí recalcula todo.' },
    { text: '' },
    { title: '2. Meta dinámica del mes (parametrizada)' },
    { text: `   • Fórmula: Meta = Efectivas/día × Días hábiles. Ambos valores en "Parámetros" (B17, B18).` },
    {
      text: calendarioMes
        ? `   • ${periodoMes}: ${diasMes} días − ${sabadosCount} sáb − ${calendarioMes.domingos.length} dom − ${feriadosCount} feriado(s) = ${diasHabiles} días hábiles.`
        : `   • Días hábiles del periodo cargado: ${diasHabiles}.`,
    },
    { text: `   • Meta efectivas/mes = ${EFECTIVAS_POR_DIA} × ${diasHabiles} = ${META}. (Parámetros!B19 con fórmula = B17*B18.)` },
    { text: `   • Cumple Meta cuando Efectivas Mes ≥ Meta.` },
    { text: '   • La meta se recalcula cada mes según el calendario real (sábados, domingos y feriados chilenos oficiales).' },
    { text: '' },
    { title: '3. Fórmulas de cálculo' },
    { text: `   • Efectivas Mes = Normales + CNR Medida + CNR Intervención + VF CGE + Mantenimiento Medidor.` },
    { text: `   • Efectivas Sábado = mismo cálculo restringido a sábados (dayofweek = 5 en pandas / WEEKDAY=6 en Excel).` },
    { text: `   • Efectivas Hábiles = Efectivas Mes − Efectivas Sábado.` },
    { text: `   • Valor por efectiva = Precio Base / Meta.` },
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
    { title: '7. Flujo de datos del libro' },
    { text: '   • Raw Parquet (única fuente cruda): un row por inspección. 2 columnas auxiliares (Categoría, Es Sábado) calculadas por fórmula.' },
    { text: '   • Detalle Técnicos: un row por técnico. Conteos = COUNTIFS sobre Raw Parquet; pago = fórmulas locales por fila.' },
    { text: '   • Resumen: KPIs y tabla por zona = SUM / SUMIF / COUNTIF / SUMPRODUCT sobre Detalle Técnicos.' },
    { text: '   • Precio Base por técnico (Detalle!U) = INDEX/MATCH sobre la tabla "Precios por Brigada" de Parámetros. Editar el precio ahí recalcula todo el libro.' },
    {
      text: mesCierre
        ? `   • El "Cierre EDP CGE" está activo (mes destino ${mesCierre}): Raw Parquet se recorta al periodo del 26 del mes anterior al 25 del mes destino (ciclo comercial mensual de CGE).`
        : '   • Si activas "Cierre EDP CGE" en la vista, Raw Parquet se recorta al periodo 26 mes-1 → 25 mes destino.',
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

  // -------------------------------------------------------------------------
  // Hoja: COMPARACIÓN CON MODELO EP DEL JEFE
  // Explica los desvíos esperados vs el EP "EP OCA GLOBAL ... NVO_Modelo.xlsx".
  // Mantenerlo accesible facilita el reconcilio mensual.
  // -------------------------------------------------------------------------
  const wsComp = wb.addWorksheet('Comparación EP', {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  });
  wsComp.getColumn(1).width = 110;

  const comparacion: Array<{ title?: string; text?: string }> = [
    { title: 'Comparación con el modelo EP del jefe' },
    { text: 'Por qué nuestro Total a Pago puede diferir levemente del EP "EP OCA GLOBAL ... NVO_Modelo.xlsx".' },
    { text: '' },
    { title: '1. Definición de VF CGE — alineada con el EP modelo del jefe' },
    { text: '   • Criterio actual (idéntico al jefe): whitelist por Resultado final.' },
    { text: '       VF CGE = Visita fallida con Resultado final ∈ {Casa deshabitada, Desconectado en BT/MT,' },
    { text: '                Condición insegura (Física del empalme), Sitio eriazo, Sin empalme,' },
    { text: '                Sin acceso por caja tortuga}.' },
    { text: '       VF Ctta (no se paga) = resto de VF: Cliente no permite revisión, Casa cerrada, No ubicado,' },
    { text: '                No existe persona responsable, Zona peligrosa, Sin acceso medidor en altura.' },
    { text: '   • Por qué NO usamos la columna "Responsabilidad" del raw: tiene errores puntuales que' },
    { text: '     desalinean con el EP. Ej.: aviso 120035720630 ("Casa deshabitada") aparece como' },
    { text: '     "Responsabilidad Contratista" en el raw, pero el EP lo trata como Responsabilidad CGE.' },
    { text: '     Otros desfases: "Condición insegura" marcada toda como Contratista en raw (32);' },
    { text: '     "Sin acceso por caja tortuga" marcada como CGE en raw (46) pero el EP solo paga 2.' },
    { text: '   • La whitelist por Resultado final es estable y reproduce exactamente el EP del jefe.' },
    { text: '' },
    { title: '2. Volumen de filas: por qué nuestro raw tiene más inspecciones' },
    { text: '   • Periodo 26-abr → 25-may 2026: nuestro raw = 13.090 filas; Base del jefe = 9.510 filas. Diferencia: 3.580.' },
    { text: '   • Componentes esperados de la diferencia:' },
    { text: '       - 2.079  "Cierre por anulación"        → el jefe las excluye (no son inspección real).' },
    { text: '       - 117    "Mantenimiento Medidor"        → no aparece en su modelo.' },
    { text: '       - 1.384  Estados aún no cerrados        → "En tratamiento" (954), "Asignado a contratista" (475),' },
    { text: '                                                 "Cierre - Anulado" (81), "Ejecutado Pre Cierre" (5).' },
    { text: '   • Nuestro sistema cuenta TODAS las inspecciones con Fecha ejecución en el rango, incluso si el aviso' },
    { text: '     todavía no llega a Estado = "Cierre". El jefe sólo carga lo ya cerrado.' },
    { text: '   • Esto NO altera el pago al técnico significativamente: las VF CGE y efectivas pagadas' },
    { text: '     dependen del Resultado visita ya registrado, no del Estado administrativo posterior.' },
    { text: '' },
    { title: '3. Casos con asignación de zona distinta (donde trabajó vs donde está asignado)' },
    { text: '   • Regla por defecto: cobra por la ZONA DONDE MÁS TRABAJÓ la brigada (modo de zona_inspeccion).' },
    { text: '   • Excepciones (HONRAR_ZONA_ADMINISTRATIVA en pago_tecnicos.py): cobran por su zona_tecnico' },
    { text: '     aunque hayan trabajado en otra zona — son acuerdos puntuales de apoyo entre zonas.' },
    { text: '   • Caso vigente en EDP 26-abr → 25-may: Kevin Vergara — pertenece a Coquimbo, prestó apoyo' },
    { text: '     en Atacama. Por acuerdo cobra a la tarifa de Coquimbo. Aplicado por la excepción.' },
    { text: '   • Mantener la lista actualizada mes a mes: agregar/quitar nombres según los acuerdos vigentes.' },
    { text: '' },
    { title: '4. Categorías idénticas (no generan diferencia)' },
    { text: '   • Normales = Resultado visita "Normal" — igual en ambos modelos.' },
    { text: '   • CNR Medida = CNR + Tipo CNR Falla; CNR Intervención = CNR + Tipo CNR Hurto — igual en ambos.' },
    { text: '   • Meta = 8 × días hábiles del periodo — coincide (19 hábiles en EDP 26-abr → 25-may → meta 152).' },
    { text: '   • Cálculo de pago: Precio Base × (Efectivas Hábiles / Meta), con tope = Precio Base; Sábado sin tope.' },
    { text: '' },
    { title: '5. Cómo reconciliar manualmente' },
    { text: '   • Tomar nuestra hoja "Detalle Técnicos" y el "Resumen de EP CGE 1F" del jefe.' },
    { text: '   • Comparar columna por columna: Normales, CNR Medida, CNR Intervención, VF CGE.' },
    { text: '   • Los tres primeros deben coincidir 1:1. Las diferencias se concentran en VF CGE (sec. 1).' },
    { text: '   • Para auditar una VF puntual: ir a Raw Parquet, filtrar por brigada y "Resultado visita" = "Visita fallida",' },
    { text: '     y revisar manualmente "Resultado final" y "Responsabilidad" caso por caso.' },
  ];

  let cr = 1;
  comparacion.forEach(({ title, text }) => {
    const c = wsComp.getCell(cr, 1);
    if (title) {
      c.value = title;
      c.font = { name: 'Inter', size: 11, bold: true, color: { argb: COLORS.slate800 } };
    } else {
      c.value = text;
      c.font = { name: 'Inter', size: 10, color: { argb: COLORS.slate500 } };
    }
    c.alignment = { vertical: 'middle', wrapText: true };
    cr += 1;
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
