#!/usr/bin/env python3
"""Verificar KPIs de efectividad ajustada sin CGE."""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.kpis import calculate_kpis

print('=' * 80)
print('VERIFICACIÓN: KPIs efectividad ajustada (sin CGE)')
print('=' * 80)

df = reload_dataframe()
kpis = calculate_kpis(df)

required = [
    'total_visita_fallida_cge',
    'pct_efectivas_sin_cge_excluida',
    'pct_efectivas_sin_cge_reclasificada',
]
for k in required:
    if k not in kpis:
        print(f'FAIL: falta el campo "{k}" en KPIs')
        sys.exit(1)

print(f'\nTotal registros: {kpis["total_registros"]:,}')
print(f'Total efectivas: {kpis["total_efectivas"]:,}')
print(f'Total visita fallida: {kpis["total_visita_fallida"]:,}')
print(f'Total visita fallida CGE: {kpis["total_visita_fallida_cge"]:,}')
print()
print(f'Efectividad real:                       {kpis["pct_efectivas"]:.2f}%')
print(f'Efectividad sin CGE (excluida):         {kpis["pct_efectivas_sin_cge_excluida"]:.2f}%')
print(f'Efectividad sin CGE (reclasificada):    {kpis["pct_efectivas_sin_cge_reclasificada"]:.2f}%')
print()

# Validaciones lógicas
ok = True

if kpis['total_visita_fallida_cge'] > kpis['total_visita_fallida']:
    print('FAIL: total_visita_fallida_cge > total_visita_fallida')
    ok = False

if kpis['total_visita_fallida_cge'] > 0:
    if kpis['pct_efectivas_sin_cge_excluida'] < kpis['pct_efectivas']:
        print('FAIL: efectividad excluida debería ser >= efectividad real')
        ok = False
    if kpis['pct_efectivas_sin_cge_reclasificada'] < kpis['pct_efectivas']:
        print('FAIL: efectividad reclasificada debería ser >= efectividad real')
        ok = False

# Recálculo independiente
import pandas as pd
total = len(df)
total_cge = int(((df['Resultado visita'] == 'Visita fallida') & (df['Responsabilidad'] == 'Responsabilidad CGE')).sum())
total_efectivas = int(df['Resultado visita'].isin(['Normal', 'CNR']).sum())

esperado_excluida = (total_efectivas / (total - total_cge) * 100) if (total - total_cge) > 0 else 0
esperado_reclasificada = ((total_efectivas + total_cge) / total * 100) if total > 0 else 0

if abs(kpis['pct_efectivas_sin_cge_excluida'] - esperado_excluida) > 0.001:
    print(f'FAIL: pct_efectivas_sin_cge_excluida={kpis["pct_efectivas_sin_cge_excluida"]} esperado={esperado_excluida}')
    ok = False
if abs(kpis['pct_efectivas_sin_cge_reclasificada'] - esperado_reclasificada) > 0.001:
    print(f'FAIL: pct_efectivas_sin_cge_reclasificada={kpis["pct_efectivas_sin_cge_reclasificada"]} esperado={esperado_reclasificada}')
    ok = False

if total_cge == 0:
    print(f'FAIL: total_visita_fallida_cge = 0, dataset vacío o sin responsabilidad CGE — datos sospechosos')
    ok = False

print('=' * 80)
print('RESULTADO:', 'TODOS OK' if ok else 'HAY ERRORES')
print('=' * 80)
sys.exit(0 if ok else 1)
