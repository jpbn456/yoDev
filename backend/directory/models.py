from django.contrib.auth.models import User
from django.db import models
from django.utils.text import slugify


class Skill(models.Model):
    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=70, unique=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Profile(models.Model):
    class WorkMode(models.TextChoices):
        REMOTE = "remote", "Remoto"
        HYBRID = "hybrid", "Híbrido"
        ONSITE = "onsite", "In-site"

    class ContactMethod(models.TextChoices):
        EMAIL = "email", "Correo"
        LINKEDIN = "linkedin", "LinkedIn"

    class Palette(models.TextChoices):
        INK = "ink", "Tinta"
        OCEAN = "ocean", "Océano"
        ORCHID = "orchid", "Orquídea"
        MOSS = "moss", "Musgo"
        SUNSET = "sunset", "Atardecer"

    class Font(models.TextChoices):
        SANS = "sans", "Sans editorial"
        SERIF = "serif", "Serif contemporánea"
        GEOMETRIC = "geometric", "Geométrica"

    class Layout(models.TextChoices):
        CLASSIC = "classic", "Clásico"
        CENTERED = "centered", "Centrado"
        COMPACT = "compact", "Compacto"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    professional_title = models.CharField(max_length=100)
    introduction = models.TextField(max_length=800)
    email = models.EmailField(blank=True)
    linkedin_url = models.URLField(blank=True)
    portfolio_url = models.URLField(blank=True)
    visible_contacts = models.JSONField(default=list)
    country = models.CharField(max_length=80, blank=True)
    region = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    work_modes = models.JSONField(default=list)
    skills = models.ManyToManyField(Skill, blank=True, related_name="profiles")
    palette = models.CharField(max_length=20, choices=Palette.choices, default=Palette.INK)
    font = models.CharField(max_length=20, choices=Font.choices, default=Font.SANS)
    layout = models.CharField(max_length=20, choices=Layout.choices, default=Layout.CLASSIC)
    alignment = models.CharField(max_length=10, choices=[("left", "Izquierda"), ("center", "Centrado")], default="left")
    is_owner_featured = models.BooleanField(default=False, help_text="Fija este perfil primero cuando coincide con la búsqueda.")
    is_published = models.BooleanField(default=False)
    is_reviewed = models.BooleanField(default=False)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_content_updated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__last_name", "user__first_name"]

    def save(self, *args, **kwargs):
        if not self.slug and self.user_id:
            base = slugify(f"{self.user.first_name}-{self.user.last_name}") or f"developer-{self.user_id}"
            candidate, sequence = base, 2
            while Profile.objects.exclude(pk=self.pk).filter(slug=candidate).exists():
                candidate = f"{base}-{sequence}"
                sequence += 1
            self.slug = candidate
        super().save(*args, **kwargs)
        if self.is_owner_featured:
            Profile.objects.exclude(pk=self.pk).filter(is_owner_featured=True).update(is_owner_featured=False)

    @property
    def needs_review_attention(self):
        return bool(self.is_reviewed and self.reviewed_at and self.updated_at > self.reviewed_at)

    def __str__(self):
        return f"{self.user.get_full_name()} — {self.professional_title}"


class ContactMessage(models.Model):
    recipient = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="contact_messages")
    sender_name = models.CharField(max_length=100)
    sender_email = models.EmailField()
    message = models.TextField(max_length=2_000)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Mensaje para {self.recipient} de {self.sender_email}"
