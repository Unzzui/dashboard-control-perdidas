#!/usr/bin/env python3
"""Test modal de detalle por zona específica"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.detalle_tecnico import calculate_detalle_tecnico_diario

print('=' * 80)
print('TEST: Modal de Detalle por Zona Específica')
print('=' * 80)

df = reload_dataframe()
nombre = 'Jair Eleazar Perez Mardones'

# Test 1: Detalle en RANCAGUA (su zona de origen)
print('\n1. Click en fila de RANCAGUA:')
print('   ' + '-' * 70)
detalle_rancagua = calculate_detalle_tecnico_diario(df, nombre, '07. RANCAGUA')
print(f'   Nombre: {detalle_rancagua["nombre"]}')
print(f'   Zona mostrada: {detalle_rancagua["zona"]}')
print(f'   Zona de origen: {detalle_rancagua["zona_origen"]}')
print(f'   Días trabajados: {detalle_rancagua["total_dias"]}')
print(f'   Está apoyando: {detalle_rancagua["esta_apoyando"]}')
print(f'   Trabaja en otras zonas: {detalle_rancagua["trabajo_en_otras_zonas"]}')
print(f'   Zonas donde trabaja: {detalle_rancagua["zonas_trabajadas"]}')

if len(detalle_rancagua['dias']) > 0:
    total_efectivas = sum(d['efectivas'] for d in detalle_rancagua['dias'])
    total_cnr = sum(d['cnr'] for d in detalle_rancagua['dias'])
    print(f'\n   Totales EN RANCAGUA:')
    print(f'   - Efectivas: {total_efectivas}')
    print(f'   - CNR: {total_cnr}')

# Test 2: Detalle en QUINTA MELIPILLA (apoyando)
print('\n\n2. Click en fila de QUINTA MELIPILLA:')
print('   ' + '-' * 70)
detalle_melipilla = calculate_detalle_tecnico_diario(df, nombre, '05. QUINTA MELIPILLA')
print(f'   Nombre: {detalle_melipilla["nombre"]}')
print(f'   Zona mostrada: {detalle_melipilla["zona"]}')
print(f'   Zona de origen: {detalle_melipilla["zona_origen"]}')
print(f'   Días trabajados: {detalle_melipilla["total_dias"]}')
print(f'   Está apoyando: {detalle_melipilla["esta_apoyando"]}')
print(f'   Trabaja en otras zonas: {detalle_melipilla["trabajo_en_otras_zonas"]}')
print(f'   Zonas donde trabaja: {detalle_melipilla["zonas_trabajadas"]}')

if len(detalle_melipilla['dias']) > 0:
    total_efectivas = sum(d['efectivas'] for d in detalle_melipilla['dias'])
    total_cnr = sum(d['cnr'] for d in detalle_melipilla['dias'])
    print(f'\n   Totales EN MELIPILLA:')
    print(f'   - Efectivas: {total_efectivas}')
    print(f'   - CNR: {total_cnr}')

print('\n' + '=' * 80)
print('RESUMEN:')
print('=' * 80)
print(f'\nEn la tabla de Control de Metas, Jair aparece en 2 filas:')
print(f'')
print(f'07. RANCAGUA')
print(f'  Jair Eleazar Perez Mardones  1368 efectivas')
print(f'')
print(f'05. QUINTA MELIPILLA 🔄')
print(f'  Jair Eleazar Perez Mardones    22 efectivas (Apoyando)')
print(f'')
print(f'Al hacer click en cada fila, el modal muestra:')
print(f'- Click en RANCAGUA → Detalle de {detalle_rancagua["total_dias"]} días trabajados EN RANCAGUA')
print(f'- Click en MELIPILLA → Detalle de {detalle_melipilla["total_dias"]} días trabajados EN MELIPILLA')
print('\n' + '=' * 80)
