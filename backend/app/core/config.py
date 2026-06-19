from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    APP_NAME: str = "AMX Agent Management System"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Multi-tenancy
    DEALER_GROUP_ID: str = "default"

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "amx"

    # Security
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ALGORITHM: str = "HS256"

    # MQTT
    MQTT_BROKER_HOST: str = "localhost"
    MQTT_BROKER_PORT: int = 1883
    MQTT_USERNAME: str | None = None
    MQTT_PASSWORD: str | None = None
    MQTT_USE_TLS: bool = False
    MQTT_CLIENT_ID: str = "amx-backend"
    MQTT_TOPIC_PREFIX: str = "amx"

    # DVLA Vehicle Enquiry Service
    DVLA_API_KEY: str | None = None

    # Feature flags
    MQTT_ENABLED: bool = True
    WEBSOCKET_ENABLED: bool = True

    # Email delivery
    # "log" = print to logger (dev default), "ses" = AWS SES HTTP API, "smtp" = SMTP relay
    EMAIL_PROVIDER: str = "log"
    EMAIL_FROM: str = "noreply@amx.local"
    AWS_SES_REGION: str = "eu-west-1"

    # SMS delivery
    # "log" = print to logger (dev default), "sns" = AWS SNS, "twilio" = Twilio REST API
    SMS_PROVIDER: str = "log"
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_FROM_NUMBER: str | None = None
    AWS_SNS_SMS_REGION: str = "eu-west-1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
