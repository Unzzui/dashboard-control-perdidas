#!/usr/bin/env python3
"""Calcula el impacto de agregar VF CGE Pagables a las visitas efectivas"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe

print('=' * 80)
print('IMPACTO DE VF CGE PAGABLES EN VISITAS EFECTIVAS')
print('=' * 80)

df = reload_dataframe()

# Filtrar datos válidos
mask = df['Resultado visita'].notna()
df_valido = df[mask].copy()

# Calcular componentes
total_registros = len(df_valido)
total_cnr = (df_valido['Resultado visita'] == 'CNR').sum()
total_normal = (df_valido['Resultado visita'] == 'Normal').sum()
total_vf = (df_valido['Resultado visita'] == 'Visita fallida').sum()

# VF CGE Pagables
vf_cge_mask = (
    (df_valido['Resultado visita'] == 'Visita fallida') &
    (
        df_valido['Resultado final'].isin(['Sitio eriazo', 'Sin empalme']) |
        df_valido['Resultado final'].str.contains('Sin acceso medidor', case=False, na=False)
    )
)
total_vf_cge_pagable = vf_cge_mask.sum()

# VF No Efectivas
total_vf_no_efectiva = total_vf - total_vf_cge_pagable

# CÁLCULO ANTES (Fórmula antigua)
efectivas_antes = total_cnr + total_normal
pct_efectivas_antes = (efectivas_antes / total_registros * 100) if total_registros > 0 else 0

# CÁLCULO DESPUÉS (Fórmula nueva)
efectivas_despues = total_cnr + total_normal + total_vf_cge_pagable
pct_efectivas_despues = (efectivas_despues / total_registros * 100) if total_registros > 0 else 0

# DIFERENCIA
diferencia_absoluta = efectivas_despues - efectivas_antes
diferencia_porcentual = pct_efectivas_despues - pct_efectivas_antes

print(f'\nDATOS GENERALES:')
print(f'  Total de registros: {total_registros:,}')
print(f'  CNR: {total_cnr:,}')
print(f'  Normal: {total_normal:,}')
print(f'  VF Total: {total_vf:,}')

print(f'\n' + '-' * 80)
print(f'DESGLOSE DE VISITAS FALLIDAS:')
print(f'  VF CGE Pagables (efectivas): {total_vf_cge_pagable:,}')
print(f'  VF No Efectivas: {total_vf_no_efectiva:,}')

# Desglose de VF CGE por tipo
sitio_eriazo = (
    (df_valido['Resultado visita'] == 'Visita fallida') &
    (df_valido['Resultado final'] == 'Sitio eriazo')
).sum()

sin_empalme = (
    (df_valido['Resultado visita'] == 'Visita fallida') &
    (df_valido['Resultado final'] == 'Sin empalme')
).sum()

sin_acceso_medidor = (
    (df_valido['Resultado visita'] == 'Visita fallida') &
    (df_valido['Resultado final'].str.contains('Sin acceso medidor', case=False, na=False))
).sum()

print(f'\n  Detalle VF CGE Pagables:')
print(f'    - Sitio eriazo: {sitio_eriazo:,}')
print(f'    - Sin empalme: {sin_empalme:,}')
print(f'    - Sin acceso medidor: {sin_acceso_medidor:,}')

print(f'\n' + '=' * 80)
print(f'COMPARACIÓN: ANTES vs DESPUÉS')
print(f'=' * 80)

print(f'\n┌─────────────────────────────────────────────────────────────┐')
print(f'│                    FÓRMULA ANTIGUA                          │')
print(f'├─────────────────────────────────────────────────────────────┤')
print(f'│  Efectivas = CNR + Normal                                   │')
print(f'│  Efectivas = {total_cnr:,} + {total_normal:,}')
print(f'│  Efectivas = {efectivas_antes:,}')
print(f'│  % Efectivas = {pct_efectivas_antes:.2f}%')
print(f'└─────────────────────────────────────────────────────────────┘')

print(f'\n┌─────────────────────────────────────────────────────────────┐')
print(f'│                    FÓRMULA NUEVA                            │')
print(f'├─────────────────────────────────────────────────────────────┤')
print(f'│  Efectivas = CNR + Normal + VF CGE Pagables                 │')
print(f'│  Efectivas = {total_cnr:,} + {total_normal:,} + {total_vf_cge_pagable:,}')
print(f'│  Efectivas = {efectivas_despues:,}')
print(f'│  % Efectivas = {pct_efectivas_despues:.2f}%')
print(f'└─────────────────────────────────────────────────────────────┘')

print(f'\n' + '=' * 80)
print(f'⬆️  AUMENTO EN VISITAS EFECTIVAS')
print(f'=' * 80)

print(f'\n  📈 AUMENTO ABSOLUTO: +{diferencia_absoluta:,} visitas efectivas')
print(f'  📊 AUMENTO PORCENTUAL: +{diferencia_porcentual:.2f} puntos porcentuales')
print(f'  💡 REPRESENTAN: {(total_vf_cge_pagable / total_vf * 100):.1f}% del total de VF')

print(f'\n' + '-' * 80)
print(f'RESUMEN:')
print(f'  Al incluir las VF CGE Pagables como efectivas, el indicador de')
print(f'  efectividad aumenta de {pct_efectivas_antes:.2f}% a {pct_efectivas_despues:.2f}%')
print(f'  ({diferencia_absoluta:,} visitas adicionales consideradas efectivas)')
print(f'=' * 80)
