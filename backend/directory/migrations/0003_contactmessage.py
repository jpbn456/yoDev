from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("directory", "0002_profile_is_owner_featured")]

    operations = [
        migrations.CreateModel(
            name="ContactMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sender_name", models.CharField(max_length=100)),
                ("sender_email", models.EmailField(max_length=254)),
                ("message", models.TextField(max_length=2000)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="contact_messages", to="directory.profile")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
