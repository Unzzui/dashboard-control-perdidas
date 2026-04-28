#!/usr/bin/env python3
"""Verificar split CGE/OCA en calculate_resultados_fallidos."""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.resultados_fallidos import calculate_resultados_fallidos

print('=' * 80)
print('VERIFICACIÓN: calculate_resultados_fallidos con split CGE/OCA')
print('=' * 80)

df = reload_dataframe()
result = calculate_resultados_fallidos(df)

print(f'\nTop {len(result)} resultados fallidos:\n')
print(f'{"Resultado":<45} {"Total":>8} {"CGE":>8} {"OCA":>8}  Suma=Total?')
print('-' * 90)

ok = True
for r in result:
    suma = r['cantidad_cge'] + r['cantidad_oca']
    check = 'OK' if suma == r['cantidad'] else f'FAIL (suma={suma})'
    if suma != r['cantidad']:
        ok = False
    print(f'{r["resultado"][:45]:<45} {r["cantidad"]:>8,} {r["cantidad_cge"]:>8,} {r["cantidad_oca"]:>8,}  {check}')

print('\n' + ('=' * 80))
print('RESULTADO:', 'TODOS OK' if ok else 'HAY FILAS DONDE cantidad_cge + cantidad_oca != cantidad')
print('=' * 80)
sys.exit(0 if ok else 1)
