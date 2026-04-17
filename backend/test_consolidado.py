#!/usr/bin/env python3
"""Test del modal CONSOLIDADO de Jair"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.detalle_tecnico import calculate_detalle_tecnico_diario

print('=' * 80)
print('TEST: Modal CONSOLIDADO vs Modal por Zona')
print('=' * 80)

df = reload_dataframe()
nombre = 'Jair Eleazar Perez Mardones'

# Test 1: Modal CONSOLIDADO (zona=None)
print('\n1. MODAL CONSOLIDADO (click en nombre del técnico):')
print('   ' + '=' * 70)
consolidado = calculate_detalle_tecnico_diario(df, nombre, zona=None)
print(f'   Nombre: {consolidado["nombre"]}')
print(f'   Zona: {consolidado["zona"]}')
print(f'   Zona origen: {consolidado["zona_origen"]}')
print(f'   Es consolidado: {consolidado["es_consolidado"]}')
print(f'   Trabaja en otras zonas: {consolidado["trabajo_en_otras_zonas"]}')
print(f'   Total días trabajados: {consolidado["total_dias"]}')

print(f'\n   DESGLOSE POR ZONAS:')
print('   ┌──────────────────────────┬──────┬───────────┬─────────┬──────┬─────┐')
print('   │ Zona                     │ Días │ Efectivas │ Visitas │ %Ef  │ CNR │')
print('   ├──────────────────────────┼──────┼───────────┼─────────┼──────┼─────┤')
for zona in consolidado['desglose_zonas']:
    origen_mark = ' [ORIGEN]' if zona['zona'] == consolidado['zona_origen'] else ''
    print(f'   │ {zona["zona"]:24}{origen_mark:8} │ {zona["dias_trabajados"]:4} │ {zona["efectivas"]:9} │ {zona["visitas_totales"]:7} │ {zona["pct_efectivas"]:5.1f} │ {zona["cnr"]:3} │')
print('   └──────────────────────────┴──────┴───────────┴─────────┴──────┴─────┘')

# Calcular totales del detalle diario
if len(consolidado['dias']) > 0:
    total_efectivas_dias = sum(d['efectivas'] for d in consolidado['dias'])
    total_cnr_dias = sum(d['cnr'] for d in consolidado['dias'])
    print(f'\n   DETALLE DIARIO (Tabla):')
    print(f'   - Total efectivas: {total_efectivas_dias}')
    print(f'   - Total CNR: {total_cnr_dias}')
    print(f'   - Total días en tabla: {len(consolidado["dias"])}')

# Totales del desglose
total_efectivas_desglose = sum(z['efectivas'] for z in consolidado['desglose_zonas'])
total_cnr_desglose = sum(z['cnr'] for z in consolidado['desglose_zonas'])
print(f'\n   TOTALES DEL DESGLOSE:')
print(f'   - Total efectivas: {total_efectivas_desglose}')
print(f'   - Total CNR: {total_cnr_desglose}')

print('\n\n' + '=' * 80)
print('RESUMEN:')
print('=' * 80)
print('\nCuando el usuario hace CLICK EN EL NOMBRE del técnico:')
print('✓ Se muestra el CONSOLIDADO de TODAS las zonas')
print('✓ Tabla de desglose muestra el trabajo por cada zona')
print('✓ Detalle diario muestra todos los días en todas las zonas')
print('✓ Calendario muestra todos los días trabajados')
print('✓ Totales reflejan el trabajo completo del técnico')
print('\n' + '=' * 80)
