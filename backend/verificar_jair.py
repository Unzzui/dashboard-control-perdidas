#!/usr/bin/env python3
"""Verificar datos de Jair Eleazar Perez Mardones"""

import sys
sys.path.insert(0, '.')

from app.dependencies import reload_dataframe
from app.services.tecnicos import calculate_tecnicos

print('=' * 80)
print('VERIFICACIÓN: Jair Eleazar Perez Mardones')
print('=' * 80)

# Cargar datos
df = reload_dataframe()
print(f'\n1. Total registros: {len(df):,}')

# Buscar el técnico
nombre_buscar = 'Jair Eleazar Perez Mardones'
mask = df['Nombre asignado'].str.contains(nombre_buscar, case=False, na=False)
jair_df = df[mask].copy()

print(f'\n2. Registros de {nombre_buscar}: {len(jair_df)}')

if len(jair_df) > 0:
    # Ver distribución por zonas
    print('\n3. Distribución por zona_tecnico (zona de origen):')
    zona_tecnico_dist = jair_df.groupby('zona_tecnico').size()
    for zona, count in zona_tecnico_dist.items():
        print(f'   {zona}: {count} inspecciones')

    print('\n4. Distribución por zona_inspeccion (donde trabajó):')
    zona_inspeccion_dist = jair_df.groupby('zona_inspeccion').size()
    for zona, count in zona_inspeccion_dist.items():
        print(f'   {zona}: {count} inspecciones')

    # Ver si hay diferencias (convertir a string para comparar)
    print('\n5. ¿Trabajó en zonas diferentes a su zona de origen?')
    jair_df['zona_tecnico_str'] = jair_df['zona_tecnico'].astype(str)
    jair_df['zona_inspeccion_str'] = jair_df['zona_inspeccion'].astype(str)
    zonas_diferentes = jair_df[jair_df['zona_tecnico_str'] != jair_df['zona_inspeccion_str']]
    if len(zonas_diferentes) > 0:
        print(f'   SÍ - {len(zonas_diferentes)} inspecciones en otras zonas')
        for zona in zonas_diferentes['zona_inspeccion'].unique():
            count = len(zonas_diferentes[zonas_diferentes['zona_inspeccion'] == zona])
            print(f'      {zona}: {count} inspecciones')
    else:
        print('   NO - Todas las inspecciones en su zona de origen')

    # Ver resumen de resultados
    print('\n6. Resumen de resultados:')
    resultados = jair_df['Resultado visita'].value_counts()
    for resultado, count in resultados.items():
        print(f'   {resultado}: {count}')

    # Ver cuál es su zona_tecnico principal
    zona_tecnico_principal = jair_df['zona_tecnico'].mode()[0]
    print(f'\n7. Zona de origen (zona_tecnico): {zona_tecnico_principal}')

# Ahora ver cómo aparece en el servicio de tecnicos
print('\n' + '=' * 80)
print('8. Cómo aparece en calculate_tecnicos():')
print('=' * 80)

tecnicos_result = calculate_tecnicos(df)
jair_tecnicos = [t for t in tecnicos_result if nombre_buscar.lower() in t['nombre'].lower()]

print(f'\n   Aparece {len(jair_tecnicos)} vez/veces en el resultado:')
for i, tec in enumerate(jair_tecnicos, 1):
    print(f'\n   {i}. Zona donde trabajó: {tec["zona"]}')
    print(f'      Zona de origen: {tec["zona_origen"]}')
    print(f'      Efectivas: {tec["efectivas"]}')
    print(f'      CNR: {tec["cnr"]}')
    print(f'      Días trabajados: {tec["dias_trabajados"]}')
    print(f'      Es zona de origen: {tec["es_zona_origen"]}')
    print(f'      Está apoyando: {tec["esta_apoyando"]}')

print('\n' + '=' * 80)
