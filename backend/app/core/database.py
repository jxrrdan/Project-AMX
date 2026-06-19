from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.core.config import get_settings
from app.models.customer import Customer, CustomerVehicle
from app.models.vehicle import Vehicle
from app.models.order import Order
from app.models.wip import WIP
from app.models.parts import Part, StockLevel, StockTransaction
from app.models.vhc import VHC
from app.models.outlet import Outlet
from app.models.user import User
from app.models.mqtt_event import MqttEvent
from app.models.financial import GLAccount, PostingGroup, Invoice, GLEntry, InvoiceTemplate

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    global _client
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=_client[settings.MONGODB_DB_NAME],
        document_models=[
            Customer,
            CustomerVehicle,
            Vehicle,
            Order,
            WIP,
            Part,
            StockLevel,
            StockTransaction,
            VHC,
            Outlet,
            User,
            MqttEvent,
            GLAccount,
            PostingGroup,
            Invoice,
            GLEntry,
            InvoiceTemplate,
        ],
    )


async def disconnect_db() -> None:
    global _client
    if _client:
        _client.close()
        _client = None
