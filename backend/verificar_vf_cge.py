#!/usr/bin/env python3
"""Verificar columnas de Visitas Fallidas CGE"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe

print('=' * 80)
print('VERIFICACIÓN: Visitas Fallidas Responsabilidad CGE')
print('=' * 80)

df = reload_dataframe()

# Filtrar solo visitas fallidas
vf_df = df[df['Resultado visita'] == 'Visita fallida'].copy()
print(f'\n1. Total Visitas Fallidas: {len(vf_df):,}')

# Ver columnas relacionadas con resultado
print('\n2. Columnas relacionadas con resultado/responsabilidad:')
resultado_cols = [col for col in df.columns if 'resultado' in col.lower() or 'responsab' in col.lower()]
for col in resultado_cols:
    print(f'   - {col}')

# Ver valores únicos de Resultado final
print('\n3. Valores únicos de "Resultado final" en VF:')
if 'Resultado final' in vf_df.columns:
    resultado_counts = vf_df['Resultado final'].value_counts()
    for resultado, count in resultado_counts.items():
        print(f'   {resultado}: {count:,}')

# Buscar las VF CGE pagables
print('\n4. Identificando VF CGE Pagables:')
print('   (Sitio Eriazo - Sin empalme - Sin acceso medidor)')

vf_cge_pagables = vf_df[
    vf_df['Resultado final'].isin(['Sitio eriazo', 'Sin empalme', 'Sin acceso medidor en altura'])
]

print(f'\n   Total VF CGE Pagables: {len(vf_cge_pagables):,}')
print(f'   - Sitio eriazo: {len(vf_df[vf_df["Resultado final"] == "Sitio eriazo"]):,}')
print(f'   - Sin empalme: {len(vf_df[vf_df["Resultado final"] == "Sin empalme"]):,}')
print(f'   - Sin acceso medidor en altura: {len(vf_df[vf_df["Resultado final"] == "Sin acceso medidor en altura"]):,}')

# Calcular totales
total_cnr = len(df[df['Resultado visita'] == 'CNR'])
total_normal = len(df[df['Resultado visita'] == 'Normal'])
total_vf = len(vf_df)
total_vf_cge_pagables = len(vf_cge_pagables)

print('\n5. Resumen de Efectividad:')
print(f'   Normal: {total_normal:,}')
print(f'   CNR: {total_cnr:,}')
print(f'   VF CGE Pagables: {total_vf_cge_pagables:,}')
print(f'   ────────────────────────')
print(f'   VISITAS EFECTIVAS (con VF CGE): {total_normal + total_cnr + total_vf_cge_pagables:,}')
print(f'   VF No Efectivas: {total_vf - total_vf_cge_pagables:,}')

# Ver columna kWh
print('\n6. Columnas de kWh:')
kwh_cols = [col for col in df.columns if 'kwh' in col.lower()]
for col in kwh_cols:
    print(f'   - {col}')
    if col in df.columns:
        total_kwh = df[col].sum()
        print(f'     Total: {total_kwh:,.0f} kWh')

print('\n' + '=' * 80)
