import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_seed_sequences"),
    ]

    operations = [
        migrations.AddField(
            model_name="sequence",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True, db_index=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="sequence",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
