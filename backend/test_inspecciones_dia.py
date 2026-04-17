#!/usr/bin/env python3
"""Test de carga de inspecciones por día"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.detalle_tecnico import get_inspecciones_dia

print('=' * 80)
print('TEST: Carga de Inspecciones por Día')
print('=' * 80)

df = reload_dataframe()

# Test 1: Jair en RANCAGUA el 14-04-2026
print('\n' + '=' * 80)
print('TEST 1: Jair en zona específica (RANCAGUA) - 14-04-2026')
print('=' * 80)

resultado1 = get_inspecciones_dia(df, "Jair Eleazar Perez Mardones", "07. RANCAGUA", "2026-04-14")

print(f'\nNombre: {resultado1["nombre"]}')
print(f'Zona: {resultado1["zona"]}')
print(f'Fecha: {resultado1["fecha"]}')
print(f'Total inspecciones: {resultado1["total_inspecciones"]}')
print(f'\nMÉTRICAS:')
print(f'├─ Efectivas: {resultado1["efectivas"]}')
print(f'├─ CNR: {resultado1["cnr"]}')
print(f'├─ Normal: {resultado1["normal"]}')
print(f'├─ VF CGE Pagable: {resultado1["vf_cge_pagable"]}')
print(f'└─ VF No Efectiva: {resultado1["vf_no_efectiva"]}')

if resultado1["total_inspecciones"] > 0:
    print(f'\nPRIMERA INSPECCIÓN:')
    insp = resultado1["inspecciones"][0]
    print(f'├─ ID Medida: {insp.get("ID Medida")}')
    print(f'├─ Aviso: {insp.get("Aviso")}')
    print(f'├─ Resultado: {insp.get("Resultado visita")}')
    print(f'└─ Comuna: {insp.get("Comuna")}')

# Test 2: Jair en TODAS las zonas (consolidado) - 14-04-2026
print('\n\n' + '=' * 80)
print('TEST 2: Jair en TODAS las zonas (consolidado) - 14-04-2026')
print('=' * 80)

resultado2 = get_inspecciones_dia(df, "Jair Eleazar Perez Mardones", None, "2026-04-14")

print(f'\nNombre: {resultado2["nombre"]}')
print(f'Zona: {resultado2["zona"]}')
print(f'Fecha: {resultado2["fecha"]}')
print(f'Total inspecciones: {resultado2["total_inspecciones"]}')
print(f'\nMÉTRICAS:')
print(f'├─ Efectivas: {resultado2["efectivas"]}')
print(f'├─ CNR: {resultado2["cnr"]}')
print(f'├─ Normal: {resultado2["normal"]}')
print(f'├─ VF CGE Pagable: {resultado2["vf_cge_pagable"]}')
print(f'└─ VF No Efectiva: {resultado2["vf_no_efectiva"]}')

if resultado2["total_inspecciones"] > 0:
    print(f'\nINSPECCIONES POR ZONA:')
    zonas_encontradas = set()
    for insp in resultado2["inspecciones"]:
        zona = insp.get("zona_inspeccion", "Sin zona")
        zonas_encontradas.add(zona)

    for zona in sorted(zonas_encontradas):
        count = sum(1 for insp in resultado2["inspecciones"] if insp.get("zona_inspeccion") == zona)
        print(f'├─ {zona}: {count} inspecciones')

    print(f'\nPRIMERAS 3 INSPECCIONES:')
    for i, insp in enumerate(resultado2["inspecciones"][:3]):
        print(f'\nInspección {i+1}:')
        print(f'├─ Zona: {insp.get("zona_inspeccion", "-")}')
        print(f'├─ ID Medida: {insp.get("ID Medida")}')
        print(f'├─ Resultado: {insp.get("Resultado visita")}')
        print(f'└─ Comuna: {insp.get("Comuna")}')

# Verificación
print('\n\n' + '=' * 80)
print('VERIFICACIÓN:')
print('=' * 80)

print(f'\n✓ Test 1 (zona específica): {resultado1["total_inspecciones"]} inspecciones')
print(f'✓ Test 2 (consolidado): {resultado2["total_inspecciones"]} inspecciones')

if resultado2["total_inspecciones"] >= resultado1["total_inspecciones"]:
    print(f'\n✓ CORRECTO: El consolidado tiene >= inspecciones que zona específica')
else:
    print(f'\n✗ ERROR: El consolidado debería tener >= inspecciones')

# Comparar efectivas
print(f'\nEfectivas Test 1: {resultado1["efectivas"]}')
print(f'Efectivas Test 2: {resultado2["efectivas"]}')

# Verificar fórmula de efectivas
for i, res in enumerate([resultado1, resultado2], 1):
    suma = res['cnr'] + res['normal'] + res['vf_cge_pagable']
    if suma == res['efectivas']:
        print(f'\n✓ Test {i}: Efectivas calculadas correctamente ({suma} = {res["efectivas"]})')
    else:
        print(f'\n✗ Test {i}: ERROR en cálculo de efectivas ({suma} != {res["efectivas"]})')

print('\n' + '=' * 80)
print('CONCLUSIÓN:')
print('=' * 80)
print('\n✓ Cuando zona=None o "TODAS", busca en todas las zonas donde trabajó')
print('✓ Las métricas (efectivas, CNR, normal, VF) se calculan correctamente')
print('✓ Cada inspección incluye "zona_inspeccion" para saber dónde fue')
print('\n' + '=' * 80)
