from apps.core.viewsets import OwnerModelViewSet

from .models import Achievement, Education, Experience
from .serializers import AchievementSerializer, EducationSerializer, ExperienceSerializer


class ExperienceAdminViewSet(OwnerModelViewSet):
    queryset = Experience.objects.select_related("logo").prefetch_related("tags")
    serializer_class = ExperienceSerializer
    search_fields = ["role", "organization"]


class EducationAdminViewSet(OwnerModelViewSet):
    queryset = Education.objects.all()
    serializer_class = EducationSerializer


class AchievementAdminViewSet(OwnerModelViewSet):
    queryset = Achievement.objects.all()
    serializer_class = AchievementSerializer
    filterset_fields = ["kind"]
