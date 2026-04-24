export interface Filters {
  año: number | null;
  mes: string[];
  dia: number[];
  zona: string[];
  regional: string[];
  supervisor: string[];
  estado: string[];
  tratamiento: string[];
  tipo_campana: string[];
  nombre_asignado: string[];
}

export interface ZonaStats {
  zona: string;
  normal: number;
  cnr: number;
  pct_cnr: number;
  visita_fallida: number;
  pct_visita_fallida: number;
  efectivas: number;
  pct_efectivas: number;
}

export interface DailyStats {
  fecha: string;
  dia: number;
  cnr: number;
  normal: number;
  visita_fallida: number;
}

export interface TecnicoRanking {
  zona: string;  // Zona donde trabajó (zona_inspeccion)
  zona_origen: string;  // Zona de origen del técnico (zona_tecnico)
  nombre: string;
  dias_trabajados: number;
  acciones_diarias: number;

  // Visitas - Orden: Total - Normales - VF CGE - VF No Efectiva - CNR - kWh
  visitas_totales: number;
  normal: number;
  vf_cge_pagable: number;  // VF efectivas (CGE pagables)
  vf_no_efectiva: number;  // VF no efectivas
  cnr: number;

  // Efectividad (CNR + Normal + VF CGE Pagables)
  visitas_efectivas: number;
  efectivas: number;
  pct_efectivas: number;
  pct_vf_no_efectivas: number;

  // Promedios
  promedio_cnr: number;
  promedio_efectivas: number;

  // CNR detalle
  pct_hurto: number;
  pct_falla: number;

  // kWh
  kwh_recuperado: number;
  kwh_estimado: number;  // Compatibilidad

  // Zona
  es_zona_origen: boolean;  // True si está trabajando en su zona
  esta_apoyando: boolean;  // True si está apoyando en otra zona

  // Totales Globales (para técnicos que trabajan en múltiples zonas)
  efectivas_global: number;  // Total efectivas en TODAS las zonas
  cnr_global: number;  // Total CNR en TODAS las zonas
  normal_global: number;  // Total Normal en TODAS las zonas
  visitas_totales_global: number;  // Total visitas en TODAS las zonas
  kwh_global: number;  // Total kWh en TODAS las zonas
  dias_global: number;  // Total días trabajados en TODAS las zonas
  promedio_efectivas_global: number;  // Promedio efectivas diario global
  promedio_cnr_global: number;  // Promedio CNR diario global
  cumple_meta_global: boolean;  // True si cumple meta global (≥8 efectivas/día)
  cantidad_zonas: number;  // Número de zonas donde trabaja
}

export interface CampanaStats {
  descripcion: string;
  normal: number;
  cnr: number;
  pct_cnr: number;
  efectivas: number;
  pct_efectivas: number;
  visita_fallida: number;
  pct_visita_fallida: number;
  cnr_falla: number;
  pct_cnr_falla: number;
  cnr_hurto: number;
  pct_cnr_hurto: number;
}

export interface MensualStats {
  mes: string;
  normal: number;
  cnr_falla: number;
  pct_cnr_falla: number;
  cnr_hurto: number;
  pct_cnr_hurto: number;
  cnr: number;
  pct_cnr: number;
  efectivas: number;
  pct_efectivas: number;
  visita_fallida: number;
  pct_visita_fallida: number;
}

export interface KPIData {
  total_registros: number;
  total_normal: number;
  total_cnr: number;
  pct_cnr: number;
  total_visita_fallida: number;
  pct_visita_fallida: number;
  total_efectivas: number;
  pct_efectivas: number;
  cnr_falla: number;
  pct_cnr_falla: number;
  cnr_hurto: number;
  pct_cnr_hurto: number;
  kwh_recuperado: number;
}

export interface NormalizacionStats {
  zona: string;
  no_normalizado: number;
  pct_no_normalizado: number;
  normalizado: number;
  pct_normalizado: number;
  total: number;
}

export interface VisitaFallidaResponsabilidad {
  descripcion: string;
  responsabilidad_cge: number;
  pct_cge: number;
  responsabilidad_contratista: number;
  pct_contratista: number;
  total: number;
}

export interface ProduccionZona {
  zona: string;
  brigadas_activas: number;
  meta_produccion: number;
  produccion: number;
  pct_produccion: number;
  cnr: number;
  monto_cnr: number;
  promedio_monto_cnr: number;
}

export interface CalendarioMes {
  mes: string;
  año: number;
  numero_mes: number;
  dias_en_mes: number;
  sabados: number[];
  domingos: number[];
  feriados: number[];
  total_habiles: number;
}

export interface PagoTecnico {
  nombre: string;
  eecc: string;
  ctta_tusan: string;
  tipo_brigada: string;
  regional: string;
  zona: string;
  zona_precios: string;
  comuna: string;
  normales_mes: number;
  cnr_medida_mes: number;
  cnr_intervencion_mes: number;
  vf_cge_mes: number;
  efectivas_mes: number;
  pct_efectividad: number;
  normales_sabado: number;
  cnr_medida_sabado: number;
  cnr_intervencion_sabado: number;
  vf_cge_sabado: number;
  efectivas_sabado: number;
  efectivas_habiles: number;
  concatenar: string;
  precio_base: number;
  monto_habil: number;
  monto_sabado: number;
  total_pago: number;
  cumple_meta: boolean;
  dias_trabajados: number[];
  dias_trabajados_count: number;
  sabados_trabajados_count: number;
}

export interface FilterOptions {
  años: number[];
  meses: string[];
  dias: number[];
  zonas: string[];
  regionales: string[];
  supervisores: string[];
  estados: string[];
  tratamientos: string[];
  tipos_campana: string[];
  nombres_asignados: string[];
}

export interface DashboardData {
  kpis: KPIData;
  zonas: ZonaStats[];
  daily: DailyStats[];
  daily_por_zona: Record<string, DailyStats[]>;
  mensual: MensualStats[];
  tecnicos: TecnicoRanking[];
  campanas: CampanaStats[];
  normalizaciones: NormalizacionStats[];
  visitas_fallidas_responsabilidad: VisitaFallidaResponsabilidad[];
  produccion: ProduccionZona[];
  pago_tecnicos: PagoTecnico[];
  resultados_fallidos: ResultadoFallido[];
  resultados_fallidos_por_zona: Record<string, ResultadoFallido[]>;
  calendario_mes: CalendarioMes | null;
}

export interface ResultadoFallido {
  resultado: string;
  cantidad: number;
}

export interface AtrasoZona {
  zona: string;
  dentro_plazo: number;
  entre_3_7: number;
  mas_7: number;
  total: number;
}

export interface ResponsableRetiro {
  zona: string;
  id_medida: number;
  aviso: number;
  tecnico: string;
  estado_envio: string;
  control_atraso: string;
  dias_atraso: number;
}

export interface RetiroDiario {
  fecha: string;
  dia: number;
  cantidad: number;
}

export interface RetiroMedidoresData {
  atraso_por_zona: AtrasoZona[];
  responsables: ResponsableRetiro[];
  retiro_diario: RetiroDiario[];
}

export interface DetalleAvisoRegistro {
  [key: string]: string | number | null;
}

export interface CampanaComuna {
  comuna: string;
  cantidad: number;
}

export interface DetalleAvisoData {
  registros: DetalleAvisoRegistro[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  campanas_comuna: CampanaComuna[];
}

export interface GeoPoint {
  lat: number;
  lng: number;
  resultado: string;
  zona: string;
  aviso: string;
}

// Análisis Comparativo
export interface ComparativoZona {
  zona: string;
  actual: {
    cnr: number;
    efectivas: number;
    visita_fallida: number;
    pct_cnr: number;
    pct_efectivas: number;
  };
  anterior: {
    cnr: number;
    efectivas: number;
    visita_fallida: number;
    pct_cnr: number;
    pct_efectivas: number;
  };
  variacion: {
    cnr: number;
    efectivas: number;
    visita_fallida: number;
    pct_cnr: number;
    pct_efectivas: number;
  };
}

export interface ComparativoTecnico {
  zona: string;
  nombre: string;
  actual_cnr: number;
  anterior_cnr: number;
  variacion_cnr: number;
  actual_efectivas: number;
  anterior_efectivas: number;
  variacion_efectivas: number;
  actual_pct_efectivas: number;
  anterior_pct_efectivas: number;
  variacion_pct_efectivas: number;
  tendencia: 'mejorando' | 'estable' | 'cayendo';
}

export interface AnalisisComparativoData {
  periodo_actual: string;
  periodo_anterior: string;
  resumen: {
    total_cnr_actual: number;
    total_cnr_anterior: number;
    variacion_cnr: number;
    total_efectivas_actual: number;
    total_efectivas_anterior: number;
    variacion_efectivas: number;
    total_vf_actual: number;
    total_vf_anterior: number;
    variacion_vf: number;
  };
  zonas: ComparativoZona[];
  tecnicos_mejorando: ComparativoTecnico[];
  tecnicos_cayendo: ComparativoTecnico[];
}

// Análisis de Jornada
export interface ActividadPorHora {
  hora: number;
  cnr: number;
  normal: number;
  visita_fallida: number;
  total: number;
}

export interface JornadaTecnico {
  zona: string;
  tecnico: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  actividades: number;
  cnr: number;
  efectivas: number;
  productividad_hora: number;
}

export interface AnalisisJornadaData {
  fecha: string;
  actividad_por_hora: ActividadPorHora[];
  jornadas: JornadaTecnico[];
  resumen: {
    duracion_promedio: number;
    hora_pico_cnr: number;
    hora_pico_vf: number;
    tecnicos_jornada_corta: number;
    productividad_promedio: number;
  };
}

// Control Diario - Producción del día anterior
export interface ProduccionDiaria {
  etiqueta: string;
  es_zona: boolean;
  cnr: number;
  mantenimiento_medidor: number;
  normal: number;
  visita_fallida: number;
  produccion: number;
  q_efectivo: number;
  pct_cnr: number;
  pct_visita_fallida: number;
}

export interface CierreActividades {
  zona: string;
  tecnico: string;
  primera_actividad: string;
  ultima_actividad: string;
  total_actividades: number;
  duracion_jornada: string;
}

export interface DetalleCNR {
  zona: string;
  tipo_cnr: string;
  responsable: string;
  cantidad: number;
  pct_del_total: number;
}

export interface CampanaCNR {
  zona: string;
  descripcion_aviso: string;
  cnr: number;
  normal: number;
  total: number;
  pct_cnr: number;
}

export interface ControlDiarioData {
  fecha_reporte: string;
  fecha_iso: string;  // Fecha en formato ISO YYYY-MM-DD
  produccion: ProduccionDiaria[];
  cierre_actividades: CierreActividades[];
  detalle_cnr: DetalleCNR[];
  campanas_cnr: CampanaCNR[];
  resultados_fallidos?: ResultadoFallido[];
  resumen: {
    total_produccion: number;
    total_cnr: number;
    total_normal: number;
    total_visita_fallida: number;
    total_kwh: number;
    pct_cnr_general: number;
    pct_visita_fallida_general: number;
  };
}

// Detalle Técnico Diario
export interface DetalleDiaTecnico {
  fecha: string;
  dia_semana: string;

  // Orden: Total visitas - Normales - VF CGE - VF No Efectiva - CNR - kWh
  visitas_totales: number;
  normal: number;
  vf_cge_pagable: number;  // Fallida Efectiva CGE
  vf_no_efectiva: number;  // Fallida No efectiva
  cnr: number;
  kwh_recuperado: number;

  // Campos adicionales
  efectivas: number;
  no_efectivas: number;
  mantenimiento: number;

  // Porcentajes
  pct_cnr: number;
  pct_efectivas: number;

  // Compatibilidad
  visita_fallida: number;  // Total VF
  kwh_estimado: number;
}

export interface CalendarioDia {
  fecha: string;
  dia: number;
  dia_semana: string;
  trabajo: boolean;
  es_habil: boolean;
  es_futuro: boolean;
  es_feriado: boolean;
}

export interface DesglosePorZona {
  zona: string;
  dias_trabajados: number;

  // Orden: Total visitas - Efectivas - Normales - Mantenimiento - VF CGE - VF No Efectiva - CNR - kWh
  visitas_totales: number;
  efectivas: number;
  normal: number;
  mantenimiento: number;
  vf_cge_pagable: number;
  vf_no_efectiva: number;
  cnr: number;
  kwh_recuperado: number;

  // Campos adicionales
  pct_efectivas: number;

  // Compatibilidad
  kwh_estimado: number;
}

export interface DetalleTecnicoDiario {
  nombre: string;
  zona: string;  // Zona filtrada o "TODAS" para consolidado
  zona_origen: string;  // Zona de origen del técnico (zona_tecnico)
  dias: DetalleDiaTecnico[];
  total_dias: number;
  calendario: CalendarioDia[];
  desglose_zonas: DesglosePorZona[];  // Desglose de trabajo por zona
  zonas_trabajadas: string[];  // Lista de todas las zonas donde trabaja
  trabajo_en_otras_zonas: boolean;  // True si trabaja en múltiples zonas
  esta_apoyando: boolean;  // True si la zona actual no es su zona de origen
  es_consolidado: boolean;  // True si muestra todas las zonas
}

export interface InspeccionDia {
  'ID Medida': number | null;
  'Aviso': number | null;
  'Resultado visita': string | null;
  'Resultado final': string | null;
  'Tipo_CNR.Tipo de CNR': string | null;
  'Comuna': string | null;
  'Dirección Servicio': string | null;
  'Hora inicio': string | null;
  'Hora fin': string | null;
  'kWh CNR': number | null;
  'Descripción del aviso': string | null;
  'zona_inspeccion'?: string;  // Zona donde se hizo la inspección (para consolidado)
}

export interface InspeccionesDia {
  nombre: string;
  zona: string;  // "TODAS" si es consolidado
  fecha: string;
  total_inspecciones: number;
  efectivas: number;  // CNR + Normal + VF CGE Pagables + Mantenimiento
  cnr: number;
  normal: number;
  mantenimiento: number;
  vf_cge_pagable: number;
  vf_no_efectiva: number;
  inspecciones: InspeccionDia[];
}

// Alertas Operativas
export interface TecnicoInactivo {
  zona: string;
  tecnico: string;
  dias_trabajados: number;
  dias_no_trabajados: number;
  pct_ausentismo: number;
  ultima_actividad: string;
  fechas_trabajadas: string[];
  fecha_inicio: string;
  fecha_fin: string;
}

export interface MetaNoCompida {
  zona: string;
  tecnico: string;
  promedio_cnr: number;
  promedio_efectivas: number;
  dias_trabajados: number;
  problemas: string;
  gravedad: 'alta' | 'media';
}

export interface ProblemaJornada {
  zona: string;
  tecnico: string;
  promedio_inicio: string;
  promedio_fin: string;
  promedio_duracion: string;
  dias_inicio_tardio: number;
  dias_cierre_temprano: number;
  dias_jornada_corta: number;
  total_dias: number;
  problemas: string;
}

export interface AltaVisitaFallida {
  zona: string;
  tecnico: string;
  visitas_fallidas: number;
  total_visitas: number;
  pct_vf: number;
  gravedad: 'alta' | 'media';
}

export interface AlertaZona {
  zona: string;
  total_alertas: number;
  tecnicos_inactivos: number;
  metas_no_cumplidas: number;
  problemas_jornada: number;
  alta_visita_fallida: number;
  gravedad: 'critica' | 'alta' | 'media' | 'baja';
}

export interface AlertasOperativasData {
  periodo: string;
  dias_analizados: number;
  dias_habiles: number;
  resumen_alertas: {
    tecnicos_inactivos: number;
    metas_no_cumplidas: number;
    problemas_jornada: number;
    alta_visita_fallida: number;
  };
  alertas_por_zona: AlertaZona[];
  tecnicos_inactivos: TecnicoInactivo[];
  metas_no_cumplidas: MetaNoCompida[];
  problemas_jornada: ProblemaJornada[];
  alta_visita_fallida: AltaVisitaFallida[];
}
