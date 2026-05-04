from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import dashboard, filters, geo, retiro_medidores, detalle_aviso, control_diario, detalle_tecnico, analistas, justificaciones
from app.dependencies import clear_filter_cache, reload_dataframe

app = FastAPI(
    title="Control de Pérdidas API",
    description="API para el dashboard de Control de Pérdidas OCA Global - TUSAN",
    version="1.0.0"
)

# CORS
# allow_origin_regex cubre localhost y rangos LAN privados (RFC1918):
#   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
# allow_origins mantiene los dominios ngrok ya configurados.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://noncomprehendible-stickiest-coral.ngrok-free.dev",
        "https://*.ngrok-free.dev",
        "https://*.ngrok.io",
    ],
    allow_origin_regex=(
        r"http://("
        r"localhost|127\.0\.0\.1|"
        r"10(\.\d{1,3}){3}|"
        r"192\.168(\.\d{1,3}){2}|"
        r"172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}"
        r")(:\d+)?"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(dashboard.router)
app.include_router(filters.router)
app.include_router(geo.router)
app.include_router(retiro_medidores.router)
app.include_router(detalle_aviso.router)
app.include_router(control_diario.router)
app.include_router(detalle_tecnico.router)
app.include_router(analistas.router)
app.include_router(justificaciones.router)


@app.get("/")
def root():
    return {
        "message": "Control de Pérdidas API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/api/v1/cache/clear")
def clear_cache():
    """Limpia el caché de filtros."""
    clear_filter_cache()
    return {"message": "Cache cleared"}


@app.post("/api/v1/data/reload")
def reload_data():
    """Recarga el DataFrame y limpia el caché."""
    reload_dataframe()
    return {"message": "Data reloaded"}
