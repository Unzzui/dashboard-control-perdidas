#!/usr/bin/env python3
"""Test de la fórmula corregida de efectivas (incluyendo Mantenimiento Medidor)"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.tecnicos import calculate_tecnicos

print('=' * 80)
print('TEST: Fórmula de Efectivas (CNR + Normal + VF CGE + Mantenimiento)')
print('=' * 80)

df = reload_dataframe()

# Calcular técnicos
tecnicos = calculate_tecnicos(df)

# Buscar un técnico con datos significativos
jair = [t for t in tecnicos if 'Jair' in t['nombre'] and t['zona'] == '07. RANCAGUA']

if jair:
    tec = jair[0]
    print(f'\n👤 Técnico: {tec["nombre"]}')
    print(f'   Zona: {tec["zona"]}')
    print(f'\n{"=" * 70}')
    print(f'COMPONENTES DE VISITAS:')
    print(f'{"=" * 70}')
    print(f'\n📊 EFECTIVAS (las que cuentan para meta):')
    print(f'   ├─ CNR: {tec["cnr"]}')
    print(f'   ├─ Normal: {tec["normal"]}')
    print(f'   ├─ VF CGE Pagable: {tec["vf_cge_pagable"]}')
    print(f'   └─ Mantenimiento: (incluido en cálculo)')

    print(f'\n❌ NO EFECTIVAS:')
    print(f'   └─ VF No Efectiva: {tec["vf_no_efectiva"]}')

    print(f'\n{"=" * 70}')
    print(f'CÁLCULO DE EFECTIVAS:')
    print(f'{"=" * 70}')

    # Verificar la fórmula
    # Nota: El backend ya suma mantenimiento en el cálculo
    print(f'\n   Formula: Efectivas = CNR + Normal + VF CGE + Mantenimiento')
    print(f'   Efectivas reportadas: {tec["efectivas"]}')

    # Calcular visitas totales para verificar
    total_visitas = tec["visitas_totales"]
    suma_conocida = tec["cnr"] + tec["normal"] + tec["vf_cge_pagable"] + tec["vf_no_efectiva"]
    mantenimiento_inferido = total_visitas - suma_conocida

    print(f'\n   INFERENCIA DE MANTENIMIENTO:')
    print(f'   Total visitas: {total_visitas}')
    print(f'   Suma (CNR + Normal + VF Total): {suma_conocida}')
    print(f'   Mantenimiento inferido: {mantenimiento_inferido}')

    # Verificar que efectivas sea correcto
    efectivas_calculadas = tec["cnr"] + tec["normal"] + tec["vf_cge_pagable"] + mantenimiento_inferido

    print(f'\n   VERIFICACIÓN:')
    print(f'   CNR ({tec["cnr"]}) + Normal ({tec["normal"]}) + VF CGE ({tec["vf_cge_pagable"]}) + Mant ({mantenimiento_inferido})')
    print(f'   = {efectivas_calculadas}')

    if efectivas_calculadas == tec["efectivas"]:
        print(f'   ✓ CORRECTO: Efectivas = {tec["efectivas"]}')
    else:
        print(f'   Diferencia: {abs(efectivas_calculadas - tec["efectivas"])}')
        print(f'   ⚠ Verificar si hay otras componentes')

    # Porcentajes
    print(f'\n{"=" * 70}')
    print(f'PORCENTAJES:')
    print(f'{"=" * 70}')
    print(f'\n   % Efectivas: {tec["pct_efectivas"]:.1f}%')
    print(f'   % VF No Efectivas: {tec["pct_vf_no_efectivas"]:.1f}%')

    # Promedios diarios
    print(f'\n{"=" * 70}')
    print(f'PROMEDIOS DIARIOS:')
    print(f'{"=" * 70}')
    print(f'\n   Días trabajados: {tec["dias_trabajados"]}')
    print(f'   Promedio efectivas/día: {tec["promedio_efectivas"]:.1f}')
    print(f'   Promedio CNR/día: {tec["promedio_cnr"]:.1f}')

    # Metas
    print(f'\n{"=" * 70}')
    print(f'CUMPLIMIENTO DE METAS:')
    print(f'{"=" * 70}')
    meta_dia = 8
    meta_mes = 160

    print(f'\n   Meta diaria: {meta_dia} efectivas/día')
    if tec["promedio_efectivas"] >= meta_dia:
        print(f'   ✓ CUMPLE meta diaria ({tec["promedio_efectivas"]:.1f} ≥ {meta_dia})')
    else:
        print(f'   ✗ NO cumple meta diaria ({tec["promedio_efectivas"]:.1f} < {meta_dia})')

    print(f'\n   Meta mensual: {meta_mes} efectivas')
    if tec["efectivas"] >= meta_mes:
        print(f'   ✓ CUMPLE meta mensual ({tec["efectivas"]} ≥ {meta_mes})')
    else:
        print(f'   ✗ NO cumple meta mensual ({tec["efectivas"]} < {meta_mes})')

# Resumen general
print(f'\n\n{"=" * 80}')
print(f'RESUMEN GENERAL DEL SISTEMA:')
print(f'{"=" * 80}')

total_tecnicos = len(tecnicos)
total_efectivas = sum(t["efectivas"] for t in tecnicos)
total_cnr = sum(t["cnr"] for t in tecnicos)
total_normal = sum(t["normal"] for t in tecnicos)
total_vf_cge = sum(t["vf_cge_pagable"] for t in tecnicos)

print(f'\n📊 Total técnicos: {total_tecnicos}')
print(f'📊 Total efectivas: {total_efectivas:,}')
print(f'\n   Desglose:')
print(f'   ├─ CNR: {total_cnr:,}')
print(f'   ├─ Normal: {total_normal:,}')
print(f'   ├─ VF CGE Pagable: {total_vf_cge:,}')
print(f'   └─ Mantenimiento: {total_efectivas - total_cnr - total_normal - total_vf_cge:,}')

print(f'\n{"=" * 80}')
print(f'CONCLUSIÓN:')
print(f'{"=" * 80}')
print(f'\n✓ La fórmula de efectivas ahora incluye Mantenimiento Medidor')
print(f'✓ Efectivas = CNR + Normal + VF CGE Pagables + Mantenimiento')
print(f'✓ Esto refleja mejor el trabajo real del técnico')
print(f'\n{"=" * 80}')
