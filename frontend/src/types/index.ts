export interface Filters {
  año: number | null;
  mes: string | null;
  dia: number | null;
  zona: string | null;
  regional: string | null;
  supervisor: string | null;
  estado: string | null;
  tratamiento: string | null;
  tipo_campana: string | null;
  nombre_asignado: string | null;
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
  zona: string;
  nombre: string;
  cnr: number;
  promedio_cnr: number;
  efectivas: number;
  promedio_efectivas: number;
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
  mensual: MensualStats[];
  tecnicos: TecnicoRanking[];
  campanas: CampanaStats[];
  normalizaciones: NormalizacionStats[];
  visitas_fallidas_responsabilidad: VisitaFallidaResponsabilidad[];
  produccion: ProduccionZona[];
  resultados_fallidos: ResultadoFallido[];
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
