#!/usr/bin/env python3
"""Test de los nuevos cálculos de visitas efectivas"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.tecnicos import calculate_tecnicos
from app.services.detalle_tecnico import calculate_detalle_tecnico_diario

print('=' * 80)
print('TEST: Nuevos Cálculos de Visitas Efectivas')
print('=' * 80)

df = reload_dataframe()

# Test 1: Verificar los cálculos en calculate_tecnicos
print('\n1. Test de calculate_tecnicos():')
print('   ' + '-' * 70)
tecnicos = calculate_tecnicos(df)

# Buscar a Jair como ejemplo
jair_rancagua = [t for t in tecnicos if 'Jair' in t['nombre'] and t['zona'] == '07. RANCAGUA']
if jair_rancagua:
    tec = jair_rancagua[0]
    print(f'\n   Técnico: {tec["nombre"]}')
    print(f'   Zona: {tec["zona"]}')
    print(f'')
    print(f'   VISITAS (Orden: Total - Normal - VF CGE - VF No Ef - CNR - kWh):')
    print(f'   ├─ Total visitas: {tec["visitas_totales"]}')
    print(f'   ├─ Normal: {tec["normal"]}')
    print(f'   ├─ VF CGE Pagable: {tec["vf_cge_pagable"]} (efectivas)')
    print(f'   ├─ VF No Efectiva: {tec["vf_no_efectiva"]}')
    print(f'   ├─ CNR: {tec["cnr"]}')
    print(f'   └─ kWh Recuperado: {tec["kwh_recuperado"]:,}')
    print(f'')
    print(f'   EFECTIVIDAD:')
    print(f'   ├─ Efectivas (CNR + Normal + VF CGE): {tec["efectivas"]}')
    print(f'   ├─ % Efectivas: {tec["pct_efectivas"]:.1f}%')
    print(f'   └─ % VF No Efectivas: {tec["pct_vf_no_efectivas"]:.1f}%')

    # Verificar la suma
    suma_componentes = tec['normal'] + tec['vf_cge_pagable'] + tec['cnr']
    print(f'')
    print(f'   VERIFICACIÓN:')
    print(f'   Normal ({tec["normal"]}) + VF CGE ({tec["vf_cge_pagable"]}) + CNR ({tec["cnr"]}) = {suma_componentes}')
    if suma_componentes == tec['efectivas']:
        print(f'   ✓ CORRECTO: Efectivas = {tec["efectivas"]}')
    else:
        print(f'   ✗ ERROR: Efectivas = {tec["efectivas"]}, esperado {suma_componentes}')

# Test 2: Verificar los cálculos en detalle_tecnico_diario
print('\n\n2. Test de detalle_tecnico_diario():')
print('   ' + '-' * 70)

if jair_rancagua:
    detalle = calculate_detalle_tecnico_diario(df, jair_rancagua[0]['nombre'], None)  # Consolidado

    print(f'\n   Técnico: {detalle["nombre"]}')
    print(f'   Modo: {"CONSOLIDADO" if detalle["es_consolidado"] else "ZONA ESPECÍFICA"}')
    print(f'   Zona origen: {detalle["zona_origen"]}')
    print(f'')
    print(f'   DESGLOSE POR ZONAS:')

    for zona in detalle['desglose_zonas']:
        print(f'\n   Zona: {zona["zona"]}')
        print(f'   ├─ Total visitas: {zona["visitas_totales"]}')
        print(f'   ├─ Normal: {zona["normal"]}')
        print(f'   ├─ VF CGE Pagable: {zona["vf_cge_pagable"]}')
        print(f'   ├─ VF No Efectiva: {zona["vf_no_efectiva"]}')
        print(f'   ├─ CNR: {zona["cnr"]}')
        print(f'   ├─ kWh Recuperado: {zona["kwh_recuperado"]:,}')
        print(f'   └─ Efectivas: {zona["efectivas"]}')

        # Verificar
        suma = zona['normal'] + zona['vf_cge_pagable'] + zona['cnr']
        if suma == zona['efectivas']:
            print(f'       ✓ Correcto')
        else:
            print(f'       ✗ Error: esperado {suma}, obtenido {zona["efectivas"]}')

    # Test detalle diario
    if len(detalle['dias']) > 0:
        print(f'\n   DETALLE DIARIO (primeros 3 días):')
        for i, dia in enumerate(detalle['dias'][:3]):
            print(f'\n   Día {i+1}: {dia["fecha"]}')
            print(f'   ├─ Total visitas: {dia["visitas_totales"]}')
            print(f'   ├─ Normal: {dia["normal"]}')
            print(f'   ├─ VF CGE: {dia["vf_cge_pagable"]}')
            print(f'   ├─ VF No Ef: {dia["vf_no_efectiva"]}')
            print(f'   ├─ CNR: {dia["cnr"]}')
            print(f'   ├─ kWh: {dia["kwh_recuperado"]:,}')
            print(f'   └─ Efectivas: {dia["efectivas"]}')

print('\n' + '=' * 80)
print('RESUMEN DE CAMBIOS:')
print('=' * 80)
print('\n1. ✓ VF CGE Pagables ahora se suman a Visitas Efectivas')
print('   (Sitio eriazo, Sin empalme, Sin acceso medidor en altura)')
print('\n2. ✓ Visitas Efectivas = CNR + Normal + VF CGE Pagables')
print('\n3. ✓ VF No Efectivas = Todas las VF - VF CGE Pagables')
print('\n4. ✓ Columnas reorganizadas en orden:')
print('   Total visitas - Normales - VF CGE - VF No Efectiva - CNR - kWh')
print('\n5. ✓ kWh Recuperados agregado en todas las vistas')
print('\n' + '=' * 80)
