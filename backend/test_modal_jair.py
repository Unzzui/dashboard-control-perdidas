#!/usr/bin/env python3
"""Test del modal de detalle para Jair"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.detalle_tecnico import calculate_detalle_tecnico_diario

print('=' * 80)
print('TEST: Modal de Detalle de Jair Eleazar Perez Mardones')
print('=' * 80)

df = reload_dataframe()

# Llamar al servicio de detalle
nombre = 'Jair Eleazar Perez Mardones'
zona = '07. RANCAGUA'

detalle = calculate_detalle_tecnico_diario(df, nombre, zona)

print(f'\n1. Datos básicos:')
print(f'   Nombre: {detalle["nombre"]}')
print(f'   Zona: {detalle["zona"]}')
print(f'   Total días trabajados: {detalle["total_dias"]}')

print(f'\n2. Indicadores de apoyo:')
print(f'   Zonas trabajadas: {len(detalle["zonas_trabajadas"])}')
print(f'   Lista de zonas: {detalle["zonas_trabajadas"]}')
print(f'   Trabajó en otras zonas: {detalle["trabajo_en_otras_zonas"]}')

print(f'\n3. Desglose por zonas:')
if len(detalle['desglose_zonas']) > 0:
    print('\n   ┌──────────────────────────┬──────┬───────────┬─────────┬──────┬─────┬───────┐')
    print('   │ Zona                     │ Días │ Efectivas │ Visitas │ %Ef  │ CNR │  kWh  │')
    print('   ├──────────────────────────┼──────┼───────────┼─────────┼──────┼─────┼───────┤')
    for zona in detalle['desglose_zonas']:
        print(f'   │ {zona["zona"]:24} │ {zona["dias_trabajados"]:4} │ {zona["efectivas"]:9} │ {zona["visitas_totales"]:7} │ {zona["pct_efectivas"]:5.1f} │ {zona["cnr"]:3} │ {zona["kwh_estimado"]:5} │')
    print('   └──────────────────────────┴──────┴───────────┴─────────┴──────┴─────┴───────┘')

    # Totales
    total_dias = sum(z['dias_trabajados'] for z in detalle['desglose_zonas'])
    total_efectivas = sum(z['efectivas'] for z in detalle['desglose_zonas'])
    total_visitas = sum(z['visitas_totales'] for z in detalle['desglose_zonas'])
    total_cnr = sum(z['cnr'] for z in detalle['desglose_zonas'])
    total_kwh = sum(z['kwh_estimado'] for z in detalle['desglose_zonas'])

    print(f'\n   TOTALES:')
    print(f'   - Días trabajados: {total_dias}')
    print(f'   - Efectivas: {total_efectivas}')
    print(f'   - Visitas totales: {total_visitas}')
    print(f'   - CNR: {total_cnr}')
    print(f'   - kWh: {total_kwh:,}')
else:
    print('   ✗ NO HAY DESGLOSE DE ZONAS')

print('\n' + '=' * 80)
print('✓ TEST COMPLETADO')
print('=' * 80)
