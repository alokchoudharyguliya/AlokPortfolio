"""
Uniform error envelope for every API error:

    {"error": {"status": 400, "code": "invalid", "message": "...", "fields": {...}}}

The frontend's API client (`frontend/src/api/client.ts`) relies on this shape
to show form-field errors and toast messages consistently in every mode.
"""

from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    fields = None
    message = None
    code = getattr(exc, "default_code", "error")

    if isinstance(data, dict):
        if "detail" in data and len(data) == 1:
            message = str(data["detail"])
            code = getattr(data["detail"], "code", code)
        else:
            fields = {k: _flatten(v) for k, v in data.items() if k != "non_field_errors"}
            non_field = data.get("non_field_errors")
            message = _flatten(non_field)[0] if non_field else "Please correct the errors below."
            code = "invalid"
    elif isinstance(data, list):
        message = " ".join(_flatten(data))
        code = "invalid"

    response.data = {
        "error": {
            "status": response.status_code,
            "code": str(code),
            "message": message or "Request failed.",
            "fields": fields or {},
        }
    }
    return response


def _flatten(value):
    if isinstance(value, list):
        out = []
        for v in value:
            out.extend(_flatten(v))
        return out
    if isinstance(value, dict):
        return [f"{k}: {', '.join(_flatten(v))}" for k, v in value.items()]
    return [str(value)]
