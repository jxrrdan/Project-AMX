"""
Notification service.

Renders Jinja2 templates and delivers them via email (SES/SMTP) or SMS (SNS/Twilio).
Falls back to logging when providers are not configured.
"""
import logging
from datetime import datetime
from typing import Optional

import httpx
from jinja2 import Environment, BaseLoader

from app.core.config import get_settings
from app.models.notification import NotificationTemplate, NotificationLog
from app.models.wip import WIP
from app.models.vhc import VHC
from app.models.customer import Customer

logger = logging.getLogger(__name__)
_jinja_env = Environment(loader=BaseLoader(), autoescape=False)


# ---------------------------------------------------------------------------
# Core send function
# ---------------------------------------------------------------------------

async def send_notification(
    dealer_group_id: str,
    outlet_id: str,
    template_code: str,
    channel: str,
    recipient_email: Optional[str],
    recipient_phone: Optional[str],
    customer_id: Optional[str],
    reference_type: str,
    reference_id: str,
    context: dict,
) -> NotificationLog:
    """
    Load a NotificationTemplate, render the Jinja2 body with context, deliver
    the message via the configured provider, and persist a NotificationLog.
    """
    settings = get_settings()

    # Try outlet-specific template first, then group-wide fallback
    template = await NotificationTemplate.find_one(
        NotificationTemplate.dealer_group_id == dealer_group_id,
        NotificationTemplate.template_code == template_code,
        NotificationTemplate.channel == channel,
        NotificationTemplate.outlet_id == outlet_id,
        NotificationTemplate.is_active == True,
    )
    if not template:
        template = await NotificationTemplate.find_one(
            NotificationTemplate.dealer_group_id == dealer_group_id,
            NotificationTemplate.template_code == template_code,
            NotificationTemplate.channel == channel,
            NotificationTemplate.outlet_id == None,
            NotificationTemplate.is_active == True,
        )

    log = NotificationLog(
        dealer_group_id=dealer_group_id,
        outlet_id=outlet_id,
        template_code=template_code,
        channel=channel,
        recipient_email=recipient_email,
        recipient_phone=recipient_phone,
        customer_id=customer_id,
        reference_type=reference_type,
        reference_id=reference_id,
        context=context,
        status="pending",
    )

    if not template:
        logger.warning(
            "No active template found for %s / %s / %s — notification not sent",
            dealer_group_id, template_code, channel,
        )
        log.status = "failed"
        log.error_message = f"Template not found: {template_code}/{channel}"
        await log.insert()
        return log

    try:
        rendered_body = _jinja_env.from_string(template.body).render(**context)
        rendered_subject = (
            _jinja_env.from_string(template.subject).render(**context)
            if template.subject
            else template_code
        )

        if channel == "email":
            provider_msg_id = await _send_email(
                settings,
                recipient_email or "",
                rendered_subject,
                rendered_body,
            )
        else:  # sms
            provider_msg_id = await _send_sms(settings, recipient_phone or "", rendered_body)

        log.status = "sent"
        log.provider_message_id = provider_msg_id
        log.sent_at = datetime.utcnow()

    except Exception as exc:
        logger.exception("Failed to send %s notification for %s", channel, reference_id)
        log.status = "failed"
        log.error_message = str(exc)

    await log.insert()
    return log


async def _send_email(settings, to_address: str, subject: str, body: str) -> Optional[str]:
    """Dispatch an email via SES or log it depending on EMAIL_PROVIDER."""
    if not to_address:
        raise ValueError("No recipient email address provided")

    provider = settings.EMAIL_PROVIDER

    if provider == "ses":
        url = f"https://email.{settings.AWS_SES_REGION}.amazonaws.com/"
        # Simple HTTP form-encoded SES request (assumes IAM role or credentials in env)
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                url,
                data={
                    "Action": "SendEmail",
                    "Source": settings.EMAIL_FROM,
                    "Destination.ToAddresses.member.1": to_address,
                    "Message.Subject.Data": subject,
                    "Message.Body.Text.Data": body,
                },
            )
            response.raise_for_status()
            # Parse MessageId from response XML (simplified)
            import re
            match = re.search(r"<MessageId>(.+?)</MessageId>", response.text)
            return match.group(1) if match else None

    else:
        # Log provider — output to logger for local dev / testing
        logger.info(
            "[EMAIL LOG] To=%s Subject=%s\n%s",
            to_address, subject, body[:500],
        )
        return f"log-{datetime.utcnow().timestamp()}"


async def _send_sms(settings, to_number: str, body: str) -> Optional[str]:
    """Dispatch an SMS via SNS or Twilio depending on SMS_PROVIDER."""
    if not to_number:
        raise ValueError("No recipient phone number provided")

    provider = settings.SMS_PROVIDER

    if provider == "sns":
        # AWS SNS HTTP API
        url = f"https://sns.{settings.AWS_SNS_SMS_REGION}.amazonaws.com/"
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                url,
                data={
                    "Action": "Publish",
                    "PhoneNumber": to_number,
                    "Message": body,
                },
            )
            response.raise_for_status()
            import re
            match = re.search(r"<MessageId>(.+?)</MessageId>", response.text)
            return match.group(1) if match else None

    elif provider == "twilio":
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            raise ValueError("Twilio credentials not configured")
        url = (
            f"https://api.twilio.com/2010-04-01/Accounts/"
            f"{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        )
        async with httpx.AsyncClient(
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            timeout=10,
        ) as client:
            response = await client.post(
                url,
                data={
                    "From": settings.TWILIO_FROM_NUMBER,
                    "To": to_number,
                    "Body": body,
                },
            )
            response.raise_for_status()
            return response.json().get("sid")

    else:
        logger.info("[SMS LOG] To=%s\n%s", to_number, body[:300])
        return f"log-{datetime.utcnow().timestamp()}"


# ---------------------------------------------------------------------------
# Convenience wrappers
# ---------------------------------------------------------------------------

async def notify_booking_confirmed(wip_id: str, dealer_group_id: str) -> None:
    """Send booking_confirmation notification to the customer on a WIP."""
    wip = await WIP.get(wip_id)
    if not wip:
        logger.warning("notify_booking_confirmed: WIP %s not found", wip_id)
        return

    customer = await Customer.get(wip.customer_id) if wip.customer_id else None
    if not customer:
        logger.warning("notify_booking_confirmed: no customer on WIP %s", wip_id)
        return

    context = {
        "customer_name": f"{customer.first_name} {customer.last_name}",
        "vehicle_registration": wip.vehicle_registration or "",
        "booking_time": wip.booking_date.strftime("%d/%m/%Y %H:%M") if wip.booking_date else "",
        "wip_ref": wip.oem_wip_ref or str(wip.id),
    }

    if customer.email:
        await send_notification(
            dealer_group_id=dealer_group_id,
            outlet_id=wip.outlet_id,
            template_code="booking_confirmation",
            channel="email",
            recipient_email=customer.email,
            recipient_phone=None,
            customer_id=str(customer.id),
            reference_type="wip",
            reference_id=str(wip.id),
            context=context,
        )

    if customer.mobile:
        await send_notification(
            dealer_group_id=dealer_group_id,
            outlet_id=wip.outlet_id,
            template_code="booking_confirmation",
            channel="sms",
            recipient_email=None,
            recipient_phone=customer.mobile,
            customer_id=str(customer.id),
            reference_type="wip",
            reference_id=str(wip.id),
            context=context,
        )


async def notify_vehicle_ready(wip_id: str, dealer_group_id: str) -> None:
    """Send vehicle_ready notification to the customer on a WIP."""
    wip = await WIP.get(wip_id)
    if not wip:
        logger.warning("notify_vehicle_ready: WIP %s not found", wip_id)
        return

    customer = await Customer.get(wip.customer_id) if wip.customer_id else None
    if not customer:
        logger.warning("notify_vehicle_ready: no customer on WIP %s", wip_id)
        return

    context = {
        "customer_name": f"{customer.first_name} {customer.last_name}",
        "vehicle_registration": wip.vehicle_registration or "",
        "wip_ref": wip.oem_wip_ref or str(wip.id),
    }

    if customer.email:
        await send_notification(
            dealer_group_id=dealer_group_id,
            outlet_id=wip.outlet_id,
            template_code="vehicle_ready",
            channel="email",
            recipient_email=customer.email,
            recipient_phone=None,
            customer_id=str(customer.id),
            reference_type="wip",
            reference_id=str(wip.id),
            context=context,
        )

    if customer.mobile:
        await send_notification(
            dealer_group_id=dealer_group_id,
            outlet_id=wip.outlet_id,
            template_code="vehicle_ready",
            channel="sms",
            recipient_email=None,
            recipient_phone=customer.mobile,
            customer_id=str(customer.id),
            reference_type="wip",
            reference_id=str(wip.id),
            context=context,
        )


async def notify_vhc_results(vhc_id: str, dealer_group_id: str) -> None:
    """Send vhc_results notification for a completed VHC inspection."""
    vhc = await VHC.get(vhc_id)
    if not vhc:
        logger.warning("notify_vhc_results: VHC %s not found", vhc_id)
        return

    customer = await Customer.get(vhc.customer_id) if vhc.customer_id else None
    if not customer:
        logger.warning("notify_vhc_results: no customer on VHC %s", vhc_id)
        return

    context = {
        "customer_name": f"{customer.first_name} {customer.last_name}",
        "vehicle_registration": vhc.vehicle_registration or "",
        "pass_count": vhc.pass_count,
        "advisory_count": vhc.advisory_count,
        "fail_count": vhc.fail_count,
        "requires_authorisation": vhc.requires_authorisation,
        "vhc_id": str(vhc.id),
    }

    if customer.email:
        await send_notification(
            dealer_group_id=dealer_group_id,
            outlet_id=vhc.outlet_id,
            template_code="vhc_results",
            channel="email",
            recipient_email=customer.email,
            recipient_phone=None,
            customer_id=str(customer.id),
            reference_type="vhc",
            reference_id=str(vhc.id),
            context=context,
        )

    if customer.mobile:
        await send_notification(
            dealer_group_id=dealer_group_id,
            outlet_id=vhc.outlet_id,
            template_code="vhc_results",
            channel="sms",
            recipient_email=None,
            recipient_phone=customer.mobile,
            customer_id=str(customer.id),
            reference_type="vhc",
            reference_id=str(vhc.id),
            context=context,
        )


async def notify_recall(
    recall_vehicle_id: str,
    dealer_group_id: str,
    method: str = "email",
) -> None:
    """Send a recall_contact notification for a RecallVehicle record."""
    from app.models.recall import RecallVehicle

    rv = await RecallVehicle.get(recall_vehicle_id)
    if not rv:
        logger.warning("notify_recall: RecallVehicle %s not found", recall_vehicle_id)
        return

    customer = await Customer.get(rv.customer_id) if rv.customer_id else None

    context = {
        "customer_name": (
            f"{customer.first_name} {customer.last_name}" if customer else "Valued Customer"
        ),
        "vehicle_registration": rv.vehicle_registration or "",
        "vehicle_make": rv.vehicle_make or "",
        "vehicle_model": rv.vehicle_model or "",
        "recall_vehicle_id": str(rv.id),
        "campaign_id": rv.campaign_id,
    }

    recipient_email = customer.email if customer else None
    recipient_phone = customer.mobile if customer else None

    if method == "email" and recipient_email:
        await send_notification(
            dealer_group_id=dealer_group_id,
            outlet_id=rv.outlet_id,
            template_code="recall_contact",
            channel="email",
            recipient_email=recipient_email,
            recipient_phone=None,
            customer_id=rv.customer_id,
            reference_type="recall",
            reference_id=str(rv.id),
            context=context,
        )
    elif method == "sms" and recipient_phone:
        await send_notification(
            dealer_group_id=dealer_group_id,
            outlet_id=rv.outlet_id,
            template_code="recall_contact",
            channel="sms",
            recipient_email=None,
            recipient_phone=recipient_phone,
            customer_id=rv.customer_id,
            reference_type="recall",
            reference_id=str(rv.id),
            context=context,
        )
    else:
        logger.warning(
            "notify_recall: cannot send via %s for recall_vehicle %s",
            method, recall_vehicle_id,
        )
