from apps.core.viewsets import OwnerModelViewSet

from .models import Skill, SkillCategory
from .serializers import SkillCategorySerializer, SkillSerializer


class SkillCategoryAdminViewSet(OwnerModelViewSet):
    queryset = SkillCategory.objects.all()
    serializer_class = SkillCategorySerializer


class SkillAdminViewSet(OwnerModelViewSet):
    queryset = Skill.objects.select_related("category")
    serializer_class = SkillSerializer
    filterset_fields = ["category"]
    search_fields = ["name"]
