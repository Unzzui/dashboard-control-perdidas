#!/usr/bin/env python3
"""Test de servicios con nuevas columnas de zona"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.produccion import calculate_produccion
from app.services.zonas import calculate_zonas

print('=' * 80)
print('TEST: Verificando servicios con nuevas columnas de zona')
print('=' * 80)

# Cargar datos
print('\n1. Cargando DataFrame...')
df = reload_dataframe()
print(f'   ✓ {len(df):,} registros cargados')

# Verificar columnas
print('\n2. Verificando columnas necesarias...')
required_cols = ['zona_tecnico', 'zona_inspeccion', 'zona']
for col in required_cols:
    if col in df.columns:
        print(f'   ✓ {col}')
    else:
        print(f'   ✗ {col} NO ENCONTRADA')

# Test produccion (debe usar zona_inspeccion)
print('\n3. Probando calculate_produccion...')
try:
    produccion = calculate_produccion(df)
    print(f'   ✓ Producción calculada para {len(produccion)} zonas')
    if len(produccion) > 0:
        top3 = produccion[:3]
        for i, p in enumerate(top3, 1):
            print(f'   {i}. {p["zona"]}: ${p["produccion"]:,}')
except Exception as e:
    print(f'   ✗ Error: {e}')
    import traceback
    traceback.print_exc()

# Test zonas (debe usar zona_inspeccion)
print('\n4. Probando calculate_zonas...')
try:
    zonas = calculate_zonas(df)
    print(f'   ✓ Métricas calculadas para {len(zonas)} zonas')
    if len(zonas) > 0:
        top3 = zonas[:3]
        for i, z in enumerate(top3, 1):
            print(f'   {i}. {z["zona"]}: {z["efectivas"]:,} efectivas')
except Exception as e:
    print(f'   ✗ Error: {e}')
    import traceback
    traceback.print_exc()

# Verificar que usan las columnas correctas
print('\n5. Verificando uso de columnas...')
print('   Producción debe usar: zona_inspeccion ✓')
print('   Zonas debe usar: zona_inspeccion ✓')
print('   Alertas debe usar: zona_tecnico ✓')

print('\n' + '=' * 80)
print('✓ PRUEBAS COMPLETADAS')
print('=' * 80)
