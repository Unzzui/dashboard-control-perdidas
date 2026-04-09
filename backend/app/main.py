from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import dashboard, filters, geo, retiro_medidores, detalle_aviso

app = FastAPI(
    title="Control de Pérdidas API",
    description="API para el dashboard de Control de Pérdidas OCA Global - TUSAN",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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


@app.get("/")
def root():
    return {
        "message": "Control de Pérdidas API",
        "version": "1.0.0",
        "docs": "/docs"
    }
