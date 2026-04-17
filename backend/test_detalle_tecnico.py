#!/usr/bin/env python3
"""Test del servicio de detalle de técnico con nuevas columnas de zona"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.detalle_tecnico import calculate_detalle_tecnico_diario

print('=' * 80)
print('TEST: Detalle de Técnico con zona_tecnico')
print('=' * 80)

# Cargar datos
print('\n1. Cargando DataFrame...')
df = reload_dataframe()
print(f'   ✓ {len(df):,} registros cargados')

# Verificar columnas
print('\n2. Verificando columnas necesarias...')
required_cols = ['zona_tecnico', 'zona_inspeccion', 'Nombre asignado']
for col in required_cols:
    if col in df.columns:
        print(f'   ✓ {col}')
    else:
        print(f'   ✗ {col} NO ENCONTRADA')

# Buscar un técnico que trabaje en múltiples zonas
print('\n3. Buscando técnico que trabaje en múltiples zonas...')
tecnicos_multizona = df.groupby('Nombre asignado').agg({
    'zona_tecnico': 'first',
    'zona_inspeccion': lambda x: x.nunique()
}).reset_index()
tecnicos_multizona.columns = ['nombre', 'zona_tecnico', 'num_zonas']
tecnicos_multizona = tecnicos_multizona[tecnicos_multizona['num_zonas'] > 1]

if len(tecnicos_multizona) > 0:
    # Tomar el primero
    tecnico_test = tecnicos_multizona.iloc[0]
    nombre_test = tecnico_test['nombre']
    zona_test = tecnico_test['zona_tecnico']

    print(f'   ✓ Técnico encontrado: {nombre_test}')
    print(f'   ✓ Zona técnico: {zona_test}')
    print(f'   ✓ Trabaja en {int(tecnico_test["num_zonas"])} zonas diferentes')

    # Test detalle
    print('\n4. Probando calculate_detalle_tecnico_diario...')
    try:
        detalle = calculate_detalle_tecnico_diario(df, nombre_test, zona_test)
        print(f'   ✓ Detalle calculado exitosamente')
        print(f'   ✓ Nombre: {detalle["nombre"]}')
        print(f'   ✓ Zona (zona de origen): {detalle["zona"]}')
        print(f'   ✓ Total días trabajados: {detalle["total_dias"]}')
        print(f'   ✓ Zonas trabajadas: {len(detalle["zonas_trabajadas"])}')
        print(f'   ✓ Trabajó en otras zonas: {detalle["trabajo_en_otras_zonas"]}')

        if len(detalle["desglose_zonas"]) > 0:
            print(f'\n   Desglose por zona:')
            for i, zona in enumerate(detalle["desglose_zonas"], 1):
                print(f'   {i}. {zona["zona"]}: {zona["efectivas"]} efectivas en {zona["dias_trabajados"]} días')

        if len(detalle["calendario"]) > 0:
            dias_trabajados = sum(1 for d in detalle["calendario"] if d["trabajo"])
            print(f'\n   ✓ Calendario generado: {len(detalle["calendario"])} días')
            print(f'   ✓ Días trabajados en calendario: {dias_trabajados}')
    except Exception as e:
        print(f'   ✗ Error: {e}')
        import traceback
        traceback.print_exc()
else:
    print('   ✗ No se encontraron técnicos que trabajen en múltiples zonas')
    print('   Probando con un técnico cualquiera...')

    # Tomar cualquier técnico
    tecnico_test = df[df['Nombre asignado'].notna()].iloc[0]
    nombre_test = tecnico_test['Nombre asignado']
    zona_test = tecnico_test['zona_tecnico']

    print(f'   ✓ Técnico: {nombre_test}')
    print(f'   ✓ Zona: {zona_test}')

    try:
        detalle = calculate_detalle_tecnico_diario(df, nombre_test, zona_test)
        print(f'   ✓ Detalle calculado exitosamente')
        print(f'   ✓ Total días: {detalle["total_dias"]}')
        print(f'   ✓ Zonas trabajadas: {len(detalle["zonas_trabajadas"])}')
    except Exception as e:
        print(f'   ✗ Error: {e}')
        import traceback
        traceback.print_exc()

print('\n' + '=' * 80)
print('✓ PRUEBAS COMPLETADAS')
print('=' * 80)
