from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.permissions import IsOwner
from apps.core.utils import visitor_hash

from . import services
from .models import Game, Score
from .serializers import (
    GameSerializer,
    LeaderboardEntrySerializer,
    PublicGameSerializer,
    ScoreAdminSerializer,
    ScoreSubmitSerializer,
)

LEADERBOARD_SIZE = 10


def leaderboard(game):
    return Score.objects.filter(game=game, is_hidden=False).order_by("-score", "created_at")[
        :LEADERBOARD_SIZE
    ]


class GamePublicViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = PublicGameSerializer
    lookup_field = "slug"
    pagination_class = None

    def get_queryset(self):
        return Game.objects.filter(is_enabled=True)

    def get_throttles(self):
        if self.action == "session":
            self.throttle_scope = "game_session"
            return [ScopedRateThrottle()]
        if self.action == "scores":
            self.throttle_scope = "game_score"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    @extend_schema(responses=LeaderboardEntrySerializer(many=True))
    @action(detail=True, methods=["get"])
    def leaderboard(self, request, slug=None):
        game = self.get_object()
        return Response(LeaderboardEntrySerializer(leaderboard(game), many=True).data)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=True, methods=["post"])
    def session(self, request, slug=None):
        game = self.get_object()
        return Response({"token": services.start_session(game)})

    @extend_schema(request=ScoreSubmitSerializer, responses={201: dict})
    @action(detail=True, methods=["post"])
    def scores(self, request, slug=None):
        game = self.get_object()
        serializer = ScoreSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            nonce = services.validate_submission(
                game, data["token"], data["score"], data["duration_ms"]
            )
            with transaction.atomic():
                score = Score.objects.create(
                    game=game,
                    nickname=data["nickname"].strip(),
                    score=data["score"],
                    duration_ms=data["duration_ms"],
                    session_nonce=nonce,
                    visitor_hash=visitor_hash(request, daily=False),
                )
        except services.ScoreRejected as exc:
            return _rejected(str(exc))
        except IntegrityError:
            return _rejected("This game session was already submitted.")

        rank = Score.objects.filter(game=game, is_hidden=False, score__gt=score.score).count() + 1
        return Response(
            {
                "rank": rank,
                "leaderboard": LeaderboardEntrySerializer(leaderboard(game), many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


def _rejected(message):
    return Response(
        {"error": {"status": 400, "code": "score_rejected", "message": message, "fields": {}}},
        status=status.HTTP_400_BAD_REQUEST,
    )


class GameAdminViewSet(
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Owner: enable/disable games, tune the plausibility rate, reset leaderboards."""

    permission_classes = [IsOwner]
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    pagination_class = None

    @extend_schema(request=None, responses={200: dict})
    @action(detail=True, methods=["post"])
    def reset(self, request, pk=None):
        game = get_object_or_404(Game, pk=pk)
        deleted, _ = Score.objects.filter(game=game).delete()
        return Response({"deleted": deleted})


class ScoreAdminViewSet(
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsOwner]
    queryset = Score.objects.select_related("game")
    serializer_class = ScoreAdminSerializer
    filterset_fields = {"game__slug": ["exact"], "is_hidden": ["exact"]}
    search_fields = ["nickname"]
