from fastapi import APIRouter

from app.api.v1 import auth, customers, vehicles, orders, wips, parts, vhcs, dashboard
from app.api.v1.invoices import router as invoices_router, gl_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(customers.router)
api_router.include_router(vehicles.router)
api_router.include_router(orders.router)
api_router.include_router(wips.router)
api_router.include_router(parts.router)
api_router.include_router(vhcs.router)
api_router.include_router(dashboard.router)
api_router.include_router(invoices_router)
api_router.include_router(gl_router)
