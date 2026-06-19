from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.mqtt_integration import FieldMapping, MqttCondition, MqttIntegration
from app.models.user import User
from app.services.mqtt_integration_service import ENTITY_SCHEMA, dry_run

router = APIRouter(prefix="/mqtt-integrations", tags=["mqtt-integrations"])


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class FieldMappingBody(BaseModel):
    source_path: str
    target_field: str
    transform: Optional[str] = None
    default_value: Optional[Any] = None
    required: bool = False


class MqttConditionBody(BaseModel):
    field: str
    operator: str
    value: Optional[Any] = None


class CreateIntegrationBody(BaseModel):
    name: str
    description: Optional[str] = None
    topic_pattern: str
    qos: int = 1
    outlet_id_source: str = "fixed:default"
    target_entity: str
    target_operation: str = "upsert"
    field_mappings: list[FieldMappingBody] = []
    conditions: list[MqttConditionBody] = []
    post_actions: list[str] = []
    is_active: bool = True


class UpdateIntegrationBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    topic_pattern: Optional[str] = None
    qos: Optional[int] = None
    outlet_id_source: Optional[str] = None
    target_entity: Optional[str] = None
    target_operation: Optional[str] = None
    field_mappings: Optional[list[FieldMappingBody]] = None
    conditions: Optional[list[MqttConditionBody]] = None
    post_actions: Optional[list[str]] = None
    is_active: Optional[bool] = None


class DryRunBody(BaseModel):
    topic: str
    payload: dict


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/entity-schema")
async def get_entity_schema(current_user: User = Depends(get_current_user)):
    """Return available target fields per entity type, for the mapping UI."""
    return ENTITY_SCHEMA


@router.get("")
async def list_integrations(
    target_entity: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
):
    filters = [MqttIntegration.dealer_group_id == current_user.dealer_group_id]
    if target_entity:
        filters.append(MqttIntegration.target_entity == target_entity)
    if is_active is not None:
        filters.append(MqttIntegration.is_active == is_active)

    return (
        await MqttIntegration.find(*filters)
        .sort(MqttIntegration.name)
        .to_list()
    )


@router.post("", status_code=201)
async def create_integration(
    body: CreateIntegrationBody,
    current_user: User = Depends(get_current_user),
):
    if body.target_entity not in ENTITY_SCHEMA:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown target_entity '{body.target_entity}'. Valid: {list(ENTITY_SCHEMA.keys())}",
        )

    integration = MqttIntegration(
        dealer_group_id=current_user.dealer_group_id,
        name=body.name,
        description=body.description,
        topic_pattern=body.topic_pattern,
        qos=body.qos,
        outlet_id_source=body.outlet_id_source,
        target_entity=body.target_entity,
        target_operation=body.target_operation,
        field_mappings=[FieldMapping(**m.model_dump()) for m in body.field_mappings],
        conditions=[MqttCondition(**c.model_dump()) for c in body.conditions],
        post_actions=body.post_actions,
        is_active=body.is_active,
        created_by=str(current_user.id),
    )
    await integration.insert()
    return integration


@router.get("/{integration_id}")
async def get_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
):
    integration = await MqttIntegration.get(integration_id)
    if not integration or integration.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@router.patch("/{integration_id}")
async def update_integration(
    integration_id: str,
    body: UpdateIntegrationBody,
    current_user: User = Depends(get_current_user),
):
    integration = await MqttIntegration.get(integration_id)
    if not integration or integration.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Integration not found")

    updates = body.model_dump(exclude_none=True)

    if "target_entity" in updates and updates["target_entity"] not in ENTITY_SCHEMA:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown target_entity '{updates['target_entity']}'",
        )

    if "field_mappings" in updates:
        integration.field_mappings = [FieldMapping(**m) for m in updates.pop("field_mappings")]
    if "conditions" in updates:
        integration.conditions = [MqttCondition(**c) for c in updates.pop("conditions")]

    for key, value in updates.items():
        setattr(integration, key, value)

    integration.updated_at = datetime.utcnow()
    await integration.save()
    return integration


@router.delete("/{integration_id}", status_code=204)
async def delete_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
):
    integration = await MqttIntegration.get(integration_id)
    if not integration or integration.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Integration not found")
    # Soft-delete: deactivate rather than remove, preserving audit trail
    integration.is_active = False
    integration.updated_at = datetime.utcnow()
    await integration.save()


@router.post("/{integration_id}/toggle")
async def toggle_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
):
    integration = await MqttIntegration.get(integration_id)
    if not integration or integration.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Integration not found")
    integration.is_active = not integration.is_active
    integration.updated_at = datetime.utcnow()
    await integration.save()
    return {"id": str(integration.id), "is_active": integration.is_active}


@router.post("/{integration_id}/test")
async def test_integration(
    integration_id: str,
    body: DryRunBody,
    current_user: User = Depends(get_current_user),
):
    """
    Dry-run an integration against a sample topic and payload.
    No data is written to the database.
    Returns a detailed per-field mapping report.
    """
    integration = await MqttIntegration.get(integration_id)
    if not integration or integration.dealer_group_id != current_user.dealer_group_id:
        raise HTTPException(status_code=404, detail="Integration not found")

    result = dry_run(integration, body.topic, body.payload)
    return result
