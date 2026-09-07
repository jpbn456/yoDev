import os
from django.conf import settings
from django.core.mail import send_mail


def send_contact_notification(*, recipient, sender_name, sender_email, message):
    subject = f"Nuevo contacto en yoDev de {sender_name}"
    plain_text = f"{sender_name} ({sender_email}) te escribió desde yoDev:\n\n{message}"
    api_key = os.getenv("RESEND_API_KEY")
    if api_key:
        import resend
        resend.api_key = api_key
        resend.Emails.send({"from": settings.DEFAULT_FROM_EMAIL, "to": [recipient], "subject": subject, "html": f"<p><strong>{sender_name}</strong> ({sender_email}) te escribió desde yoDev:</p><p>{message}</p>", "reply_to": sender_email})
        return
    send_mail(subject=subject, message=plain_text, from_email=None, recipient_list=[recipient], fail_silently=True)
