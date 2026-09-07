from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("directory", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="is_owner_featured",
            field=models.BooleanField(default=False, help_text="Fija este perfil primero cuando coincide con la búsqueda."),
        ),
    ]
