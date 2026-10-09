from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('skills', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='skillcategory',
            name='exhibit',
            field=models.CharField(blank=True, choices=[('hardware', 'Hardware: motherboard to registers')], help_text='Optional 3D-mode exhibit this group links to (a scroll-driven zoom through the topic)', max_length=24),
        ),
    ]
