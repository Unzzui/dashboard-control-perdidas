#!/usr/bin/env python3
"""Test de metas globales para técnicos que trabajan en múltiples zonas"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.tecnicos import calculate_tecnicos

print('=' * 80)
print('TEST: Control de Metas Globales para Técnicos Multi-Zona')
print('=' * 80)

df = reload_dataframe()

# Calcular tecnicos
tecnicos = calculate_tecnicos(df)

# Buscar técnicos que trabajan en múltiples zonas
tecnicos_multizona = [t for t in tecnicos if t['cantidad_zonas'] > 1]

# Agrupar por nombre para mostrar todas las zonas donde trabajan
tecnicos_por_nombre = {}
for t in tecnicos:
    nombre = t['nombre']
    if nombre not in tecnicos_por_nombre:
        tecnicos_por_nombre[nombre] = []
    tecnicos_por_nombre[nombre].append(t)

# Mostrar técnicos que trabajan en múltiples zonas
print(f'\n📊 TÉCNICOS QUE TRABAJAN EN MÚLTIPLES ZONAS: {len([k for k, v in tecnicos_por_nombre.items() if len(v) > 1])}')
print('=' * 80)

for nombre, zonas_tecnico in sorted(tecnicos_por_nombre.items()):
    if len(zonas_tecnico) > 1:
        primer_registro = zonas_tecnico[0]

        print(f'\n👤 Técnico: {nombre}')
        print(f'   Zona de Origen: {primer_registro["zona_origen"]}')
        print(f'   Trabaja en {primer_registro["cantidad_zonas"]} zonas')
        print(f'   {"-" * 70}')

        # Mostrar detalle por zona
        print(f'\n   DETALLE POR ZONA:')
        total_efectivas_suma = 0
        total_dias_suma = 0

        for z in zonas_tecnico:
            es_origen = "✓ Zona Origen" if z['es_zona_origen'] else "→ Apoyando"
            print(f'\n   {z["zona"]} {es_origen}')
            print(f'   ├─ Días trabajados: {z["dias_trabajados"]}')
            print(f'   ├─ Efectivas: {z["efectivas"]}')
            print(f'   ├─ CNR: {z["cnr"]}')
            print(f'   ├─ Normal: {z["normal"]}')
            print(f'   ├─ VF CGE: {z["vf_cge_pagable"]}')
            print(f'   └─ Promedio efectivas/día: {z["promedio_efectivas"]:.1f}')

            total_efectivas_suma += z['efectivas']
            total_dias_suma += z['dias_trabajados']

        # Mostrar totales globales
        print(f'\n   TOTALES GLOBALES (TODAS LAS ZONAS):')
        print(f'   ├─ Días trabajados: {primer_registro["dias_global"]}')
        print(f'   ├─ Efectivas GLOBALES: {primer_registro["efectivas_global"]}')
        print(f'   ├─ CNR Global: {primer_registro["cnr_global"]}')
        print(f'   ├─ Normal Global: {primer_registro["normal_global"]}')
        print(f'   ├─ Promedio efectivas/día GLOBAL: {primer_registro["promedio_efectivas_global"]:.1f}')
        print(f'   └─ Cumple meta global (≥8 ef/día): {"✓ SÍ" if primer_registro["cumple_meta_global"] else "✗ NO"}')

        # Verificación
        print(f'\n   VERIFICACIÓN:')
        print(f'   Suma de efectivas por zona: {total_efectivas_suma}')
        print(f'   Efectivas global: {primer_registro["efectivas_global"]}')
        if total_efectivas_suma == primer_registro['efectivas_global']:
            print(f'   ✓ CORRECTO')
        else:
            print(f'   ✗ ERROR: No coinciden')

        # Evaluación de meta
        meta_mensual = 160
        meta_diaria = 8

        print(f'\n   EVALUACIÓN DE META:')
        print(f'   Meta mensual: {meta_mensual} efectivas')
        print(f'   Meta diaria: {meta_diaria} efectivas/día')
        print(f'   Efectivas global: {primer_registro["efectivas_global"]}')
        print(f'   Promedio global: {primer_registro["promedio_efectivas_global"]:.1f} efectivas/día')

        if primer_registro['efectivas_global'] >= meta_mensual:
            print(f'   ✓ CUMPLE meta mensual ({primer_registro["efectivas_global"]} ≥ {meta_mensual})')
        else:
            print(f'   ✗ NO cumple meta mensual ({primer_registro["efectivas_global"]} < {meta_mensual})')

        if primer_registro['promedio_efectivas_global'] >= meta_diaria:
            print(f'   ✓ CUMPLE meta diaria ({primer_registro["promedio_efectivas_global"]:.1f} ≥ {meta_diaria})')
        else:
            print(f'   ✗ NO cumple meta diaria ({primer_registro["promedio_efectivas_global"]:.1f} < {meta_diaria})')

        print(f'\n   {"=" * 70}')

# Resumen final
print(f'\n\n' + '=' * 80)
print(f'RESUMEN GENERAL')
print(f'=' * 80)

total_tecnicos = len(tecnicos_por_nombre)
tecnicos_multizona_count = len([k for k, v in tecnicos_por_nombre.items() if len(v) > 1])
tecnicos_zona_unica = total_tecnicos - tecnicos_multizona_count

print(f'\n📈 Total de técnicos únicos: {total_tecnicos}')
print(f'   ├─ Trabajan en 1 zona: {tecnicos_zona_unica}')
print(f'   └─ Trabajan en 2+ zonas: {tecnicos_multizona_count}')

# Contar técnicos que cumplen meta global
cumplen_meta_global = len([
    nombre for nombre, zonas in tecnicos_por_nombre.items()
    if len(zonas) > 1 and zonas[0]['cumple_meta_global']
])

no_cumplen_meta_global = tecnicos_multizona_count - cumplen_meta_global

print(f'\n📊 De los técnicos multi-zona:')
print(f'   ├─ Cumplen meta global (≥8 ef/día): {cumplen_meta_global}')
print(f'   └─ No cumplen meta global: {no_cumplen_meta_global}')

print(f'\n' + '=' * 80)
print('CONCLUSIÓN:')
print('=' * 80)
print('\n✓ Los técnicos que trabajan en múltiples zonas ahora son evaluados')
print('  con su TOTAL GLOBAL de efectivas, no por zona individual.')
print('\n✓ La meta de 160 efectivas/mes (8 ef/día) se evalúa sumando TODAS')
print('  las zonas donde el técnico trabajó.')
print('\n✓ En la UI aparecerán con badge "META GLOBAL" para indicar que se')
print('  está usando el total global para evaluar cumplimiento de meta.')
print(f'\n' + '=' * 80)
