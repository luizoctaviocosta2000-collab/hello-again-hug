#!/usr/bin/env python3
"""IMOBFY staging-only real-Auth and PostgREST smoke test.

Never touches production. Requires two previously-created disposable Auth users,
their credentials, and the staging publishable/anon key in environment variables.
All created records use random UUIDs and are deleted by ID in a finally block.

Use --check to validate the script without signing in or writing data.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen

STAGING_REF = "etcdlxkpidiqbgdayiol"
STAGING_URL = f"https://{STAGING_REF}.supabase.co"
REQUIRED = (
    "IMOBFY_STAGING_PUBLISHABLE_KEY",
    "IMOBFY_STAGING_USER_A_EMAIL",
    "IMOBFY_STAGING_USER_A_PASSWORD",
    "IMOBFY_STAGING_USER_B_EMAIL",
    "IMOBFY_STAGING_USER_B_PASSWORD",
)


class HttpFailure(RuntimeError):
    def __init__(self, status: int, path: str):
        self.status = status
        self.path = path
        super().__init__(f"HTTP {status} at {path}")


class Client:
    def __init__(self, key: str):
        self.key = key

    def request(self, method: str, path: str, payload=None, token=None,
                prefer: str | None = None):
        if not path.startswith("/") or "://" in path:
            raise ValueError("Expected a relative API path")
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"apikey": self.key, "Accept": "application/json"}
        if payload is not None:
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = "Bearer " + token
        if prefer:
            headers["Prefer"] = prefer
        req = Request(STAGING_URL + path, body, headers, method=method)
        try:
            with urlopen(req, timeout=20) as resp:
                raw = resp.read(2_000_000)
                if not raw:
                    return None
                return json.loads(raw)
        except HTTPError as err:
            # Deliberately do not log response payloads, JWTs, email, or password.
            raise HttpFailure(err.code, path.split("?")[0]) from None
        except URLError as err:
            raise RuntimeError("Staging API connection failed") from None

    def login(self, email: str, password: str):
        result = self.request("POST", "/auth/v1/token?grant_type=password",
                              {"email": email, "password": password})
        if not isinstance(result, dict) or not result.get("access_token"):
            raise RuntimeError("Staging Auth did not issue an access token")
        token = result["access_token"]
        user = self.request("GET", "/auth/v1/user", token=token)
        if not isinstance(user, dict) or not user.get("id"):
            raise RuntimeError("Staging Auth user validation failed")
        return token, str(uuid.UUID(user["id"]))

    def table(self, method: str, table: str, token: str, record_id: str | None = None,
              payload=None, return_rows: bool = False):
        allowed = {"properties", "clients", "visits", "visit_properties"}
        if table not in allowed:
            raise ValueError("Table is not in the fixture allowlist")
        path = "/rest/v1/" + table
        if record_id:
            path += "?" + urlencode({"id": "eq." + str(uuid.UUID(record_id))})
        prefer = "return=representation" if return_rows else None
        return self.request(method, path, payload, token, prefer=prefer)

    def rpc(self, token: str, name: str, args):
        if name not in {"save_visit_journey", "finish_visit_journey"}:
            raise ValueError("RPC outside the fixture allowlist")
        return self.request("POST", "/rest/v1/rpc/" + name, args, token)


def assert_denied(fn, desc: str):
    try:
        fn()
    except HttpFailure as err:
        if err.status in (401, 403, 404):
            return
        raise AssertionError(f"{desc}: unexpected HTTP {err.status}") from None
    raise AssertionError(f"{desc}: foreign-tenant write unexpectedly succeeded")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="No network, no authentication, no writes")
    args = parser.parse_args()
    if args.check:
        assert urlsplit(STAGING_URL).hostname == STAGING_REF + ".supabase.co"
        print("PASS: staging-only URL, bounded fixture operations, explicit opt-in")
        print("NOT RUN: actual Auth/REST/Storage. Requires disposable user credentials.")
        return 0

    if os.getenv("IMOBFY_E2E_CONFIRM_STAGING") != "1":
        raise SystemExit("Refusing to run: set IMOBFY_E2E_CONFIRM_STAGING=1")
    missing = [name for name in REQUIRED if not os.getenv(name)]
    if missing:
        raise SystemExit("Missing staging test inputs: " + ", ".join(missing))
    if os.environ["IMOBFY_STAGING_USER_A_EMAIL"] == os.environ["IMOBFY_STAGING_USER_B_EMAIL"]:
        raise SystemExit("Two distinct disposable Auth users are required")

    api = Client(os.environ["IMOBFY_STAGING_PUBLISHABLE_KEY"])
    token_a, uid_a = api.login(os.environ["IMOBFY_STAGING_USER_A_EMAIL"],
                               os.environ["IMOBFY_STAGING_USER_A_PASSWORD"])
    token_b, uid_b = api.login(os.environ["IMOBFY_STAGING_USER_B_EMAIL"],
                               os.environ["IMOBFY_STAGING_USER_B_PASSWORD"])
    if uid_a == uid_b:
        raise AssertionError("The two Supabase login identities must differ")

    property_id, client_id, forged_id = (str(uuid.uuid4()) for _ in range(3))
    marker = "imobfy-e2e-" + str(uuid.uuid4())
    visit_id = None
    created_property = created_client = False
    succeeded = False
    cleanup_errors = []
    try:
        api.table("POST", "properties", token_a,
                  payload={"id": property_id, "user_id": uid_a, "title": marker})
        created_property = True
        own = api.table("GET", "properties", token_a, property_id)
        foreign = api.table("GET", "properties", token_b, property_id)
        if not isinstance(own, list) or len(own) != 1 or foreign != []:
            raise AssertionError("Property read isolation failed")

        assert_denied(lambda: api.table("POST", "properties", token_b,
                      payload={"id": forged_id, "user_id": uid_a,
                               "title": marker + "-foreign"}), "Foreign-property insert")

        api.table("POST", "clients", token_a,
                  payload={"id": client_id, "user_id": uid_a, "name": marker})
        created_client = True
        start = datetime.now(timezone.utc) + timedelta(days=1)
        raw_visit = api.rpc(token_a, "save_visit_journey", {
            "p_visit_id": None, "p_client_id": client_id, "p_deal_id": None,
            "p_starts_at": start.isoformat(), "p_ends_at": (start + timedelta(hours=1)).isoformat(),
            "p_property_ids": [property_id], "p_location": "teste automatizado",
            "p_notes": "fixture de homologacao",
        })
        visit_id = str(uuid.UUID(raw_visit))
        assert_denied(lambda: api.rpc(token_b, "finish_visit_journey", {
            "p_visit_id": visit_id, "p_status": "done",
            "p_visited_property_ids": [property_id],
        }), "Foreign visit completion")

        result = api.rpc(token_a, "finish_visit_journey", {
            "p_visit_id": visit_id, "p_status": "done",
            "p_visited_property_ids": [property_id],
        })
        # Retry must be idempotent.
        api.rpc(token_a, "finish_visit_journey", {
            "p_visit_id": visit_id, "p_status": "done",
            "p_visited_property_ids": [property_id],
        })
        visit = api.table("GET", "visits", token_a, visit_id)
        other_visit = api.table("GET", "visits", token_b, visit_id)
        if not isinstance(visit, list) or len(visit) != 1 or visit[0]["status"] != "completed":
            raise AssertionError("Visit final status mismatch")
        if other_visit != []:
            raise AssertionError("Other tenant can read visit")

        succeeded = True
        print("PASS: issued Auth sessions, own-property CRUD, cross-tenant RLS, visits, retry")
    finally:
        # Delete only the randomly created fixture IDs, never arbitrary rows.
        if visit_id:
            for table, row_id in (("visit_properties", None), ("visits", visit_id)):
                try:
                    if table == "visit_properties":
                        api.request("DELETE", "/rest/v1/visit_properties?" + urlencode(
                            {"visit_id": "eq." + visit_id}), token=token_a)
                    else:
                        api.table("DELETE", table, token_a, row_id)
                except Exception:
                    cleanup_errors.append(table)
        # If a foreign-owner insert was unexpectedly accepted, owner A can
        # still remove its exact fixture id. Never leave a spoofed test row.
        try:
            api.table("DELETE", "properties", token_a, forged_id)
        except Exception:
            cleanup_errors.append("forged_property")
        if created_client:
            try:
                api.table("DELETE", "clients", token_a, client_id)
            except Exception:
                cleanup_errors.append("clients")
        if created_property:
            try:
                api.table("DELETE", "properties", token_a, property_id)
            except Exception:
                cleanup_errors.append("properties")
        if cleanup_errors:
            # Operator must inspect and manually clean *only* this run's UUIDs.
            print("WARNING: fixture cleanup failed for " + ", ".join(cleanup_errors),
                  file=sys.stderr)
            print("Fixture IDs for manual cleanup: " + json.dumps({
                "property_id": property_id, "forged_id": forged_id,
                "client_id": client_id, "visit_id": visit_id
            }), file=sys.stderr)
    if cleanup_errors or not succeeded:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
