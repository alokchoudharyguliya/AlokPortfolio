from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('skills', '0002_skillcategory_exhibit'),
    ]

    operations = [
        migrations.AlterField(
            model_name='skillcategory',
            name='exhibit',
            field=models.CharField(blank=True, choices=[('hardware', 'Hardware: motherboard to registers'), ('cuda', 'CUDA: GPU to a single thread')], help_text='Optional 3D-mode exhibit this group links to (a scroll-driven zoom through the topic)', max_length=24),
        ),
    ]
