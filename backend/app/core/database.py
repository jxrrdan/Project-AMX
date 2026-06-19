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
from app.models.mqtt_integration import MqttIntegration
from app.models.financial import GLAccount, PostingGroup, Invoice, GLEntry, InvoiceTemplate, CreditNote
from app.models.diary import DiarySlot
from app.models.technician import Technician, TimeEntry
from app.models.purchase_order import Supplier, PurchaseOrder
from app.models.notification import NotificationTemplate, NotificationLog
from app.models.used_vehicle import UsedVehicle, Appraisal
from app.models.recall import RecallCampaign, RecallVehicle
from app.models.warranty import WarrantyClaim

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
            MqttIntegration,
            GLAccount,
            PostingGroup,
            Invoice,
            GLEntry,
            InvoiceTemplate,
            CreditNote,
            DiarySlot,
            Technician,
            TimeEntry,
            Supplier,
            PurchaseOrder,
            NotificationTemplate,
            NotificationLog,
            UsedVehicle,
            Appraisal,
            RecallCampaign,
            RecallVehicle,
            WarrantyClaim,
        ],
    )


async def disconnect_db() -> None:
    global _client
    if _client:
        _client.close()
        _client = None
