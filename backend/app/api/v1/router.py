from fastapi import APIRouter

from app.api.v1 import auth, customers, vehicles, orders, wips, parts, vhcs, dashboard
from app.api.v1.invoices import router as invoices_router, gl_router
from app.api.v1 import diary, technicians, purchase_orders, used_vehicles, recalls, warranty
from app.api.v1 import reports, admin, credit_notes
from app.api.v1 import mqtt_integrations

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
api_router.include_router(diary.router)
api_router.include_router(technicians.router)
api_router.include_router(purchase_orders.router)
api_router.include_router(used_vehicles.router)
api_router.include_router(recalls.router)
api_router.include_router(warranty.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)
api_router.include_router(credit_notes.router)
api_router.include_router(mqtt_integrations.router)
