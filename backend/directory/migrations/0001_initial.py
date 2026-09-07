from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="Skill",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=60, unique=True)),
                ("slug", models.SlugField(max_length=70, unique=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Profile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(blank=True, max_length=100, unique=True)),
                ("professional_title", models.CharField(max_length=100)),
                ("introduction", models.TextField(max_length=800)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("linkedin_url", models.URLField(blank=True)),
                ("portfolio_url", models.URLField(blank=True)),
                ("visible_contacts", models.JSONField(default=list)),
                ("country", models.CharField(blank=True, max_length=80)),
                ("region", models.CharField(blank=True, max_length=100)),
                ("city", models.CharField(blank=True, max_length=100)),
                ("work_modes", models.JSONField(default=list)),
                ("palette", models.CharField(choices=[("ink", "Tinta"), ("ocean", "Océano"), ("orchid", "Orquídea"), ("moss", "Musgo"), ("sunset", "Atardecer")], default="ink", max_length=20)),
                ("font", models.CharField(choices=[("sans", "Sans editorial"), ("serif", "Serif contemporánea"), ("geometric", "Geométrica")], default="sans", max_length=20)),
                ("layout", models.CharField(choices=[("classic", "Clásico"), ("centered", "Centrado"), ("compact", "Compacto")], default="classic", max_length=20)),
                ("alignment", models.CharField(choices=[("left", "Izquierda"), ("center", "Centrado")], default="left", max_length=10)),
                ("is_published", models.BooleanField(default=False)),
                ("is_reviewed", models.BooleanField(default=False)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("reviewed_content_updated_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="profile", to=settings.AUTH_USER_MODEL)),
                ("skills", models.ManyToManyField(blank=True, related_name="profiles", to="directory.skill")),
            ],
            options={"ordering": ["user__last_name", "user__first_name"]},
        ),
    ]
