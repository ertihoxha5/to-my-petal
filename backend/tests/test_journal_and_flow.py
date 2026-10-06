from __future__ import annotations

import io
import json
import zipfile
from datetime import date, timedelta

from app.storage import media_root

from .conftest import PASSWORD, create_plant, leaf_jpeg, logits_for, register, upload

TODAY = date.today()


def test_core_upload_to_journal_flow(client, fake_model):
    register(client)
    plant = create_plant(client, "tomato", "Balcony tomato")
    fake_model(logits_for("Tomato___Septoria_leaf_spot"))

    photo = upload(client, plant["id"]).json()
    analysis = client.post(
        "/api/analyses", json={"photo_id": photo["id"], "watering": "weekly"}
    ).json()
    assert analysis["outcome"] == "possible_issue"
    assert analysis["journal_entry_id"] is None

    r = client.post(
        f"/api/analyses/{analysis['id']}/journal", json={"note": "Removed two lower leaves."}
    )
    assert r.status_code == 201
    entry = r.json()
    assert entry["kind"] == "analysis"
    assert entry["photo"]["id"] == photo["id"]
    assert entry["analysis"]["condition"] == "Septoria leaf spot"
    # Saving twice is idempotent.
    assert (
        client.post(f"/api/analyses/{analysis['id']}/journal", json={"note": ""}).status_code == 200
    )

    journal = client.get("/api/journal", params={"plant_id": plant["id"]}).json()
    assert journal["total"] == 1 and journal["items"][0]["body"] == "Removed two lower leaves."
    assert client.get(f"/api/analyses/{analysis['id']}").json()["journal_entry_id"] == entry["id"]

    dash = client.get("/api/dashboard").json()
    assert dash["latest_analysis"]["id"] == analysis["id"]
    assert dash["stories"][0]["entry_count"] == 1
    assert dash["stories"][0]["plant"]["nickname"] == "Balcony tomato"


def test_follow_up_photos_and_compare_listing(client):
    register(client)
    plant = create_plant(client)
    for days in (14, 7, 0):
        p = client.post(
            "/api/photos",
            data={"plant_id": str(plant["id"]), "taken_on": str(TODAY - timedelta(days))},
            files={"file": ("a.jpg", leaf_jpeg(seed=days), "image/jpeg")},
        ).json()
        client.post(
            "/api/journal",
            json={
                "plant_id": plant["id"],
                "kind": "photo",
                "photo_id": p["id"],
                "entry_date": p["taken_on"],
                "body": f"{days} days ago",
            },
        )
    photos = client.get("/api/photos", params={"plant_id": plant["id"]}).json()
    assert [p["taken_on"] for p in photos] == sorted((p["taken_on"] for p in photos), reverse=True)
    story = client.get("/api/dashboard").json()["stories"][0]
    # Two most recent non-cover photos, oldest first.
    assert [p["taken_on"] for p in story["recent_photos"]] == [
        str(TODAY - timedelta(7)),
        str(TODAY),
    ]


def test_journal_crud_filters_and_pagination(client):
    register(client)
    a = create_plant(client, nickname="A")
    b = create_plant(client, nickname="B", species_key="monstera")
    for i in range(5):
        client.post(
            "/api/journal",
            json={"plant_id": a["id"], "entry_date": str(TODAY - timedelta(i)), "body": f"a{i}"},
        )
    client.post("/api/journal", json={"plant_id": b["id"], "entry_date": str(TODAY), "body": "b0"})

    page = client.get("/api/journal", params={"limit": 2, "offset": 0}).json()
    assert page["total"] == 6 and len(page["items"]) == 2
    only_a = client.get(
        "/api/journal", params={"plant_id": a["id"], "date_from": str(TODAY - timedelta(2))}
    ).json()
    assert [e["body"] for e in only_a["items"]] == ["a0", "a1", "a2"]

    eid = only_a["items"][0]["id"]
    r = client.patch(
        f"/api/journal/{eid}", json={"body": "edited", "entry_date": str(TODAY - timedelta(10))}
    )
    assert r.json()["body"] == "edited"
    assert (
        client.patch(
            f"/api/journal/{eid}", json={"entry_date": str(TODAY + timedelta(3))}
        ).status_code
        == 422
    )
    assert client.delete(f"/api/journal/{eid}").status_code == 204
    assert client.get(f"/api/journal/{eid}").status_code == 404

    r = client.post(
        "/api/journal", json={"plant_id": a["id"], "entry_date": str(TODAY), "body": "  "}
    )
    assert r.status_code == 422  # empty observation


def test_reminders_complete_reschedule_and_log_care(client):
    register(client)
    plant = create_plant(client, species_key="monstera", nickname="Monty")
    r = client.post(
        "/api/reminders",
        json={
            "plant_id": plant["id"],
            "kind": "water",
            "title": "Water Monty",
            "due_on": str(TODAY),
            "repeat_days": 7,
        },
    ).json()
    done = client.post(f"/api/reminders/{r['id']}/complete", json={}).json()
    assert done["active"] is True and done["due_on"] == str(TODAY + timedelta(7))
    care = client.get("/api/journal", params={"kind": "care"}).json()["items"]
    assert care[0]["title"] == "Watered" and care[0]["care_kind"] == "water"

    moved = client.patch(
        f"/api/reminders/{r['id']}", json={"due_on": str(TODAY + timedelta(2))}
    ).json()
    assert moved["due_on"] == str(TODAY + timedelta(2))

    once = client.post(
        "/api/reminders", json={"kind": "wipe_leaves", "title": "Wipe", "due_on": str(TODAY)}
    ).json()
    assert client.post(f"/api/reminders/{once['id']}/complete", json={}).json()["active"] is False
    assert client.post(f"/api/reminders/{once['id']}/complete", json={}).status_code == 409
    assert [x["id"] for x in client.get("/api/reminders").json()] == [r["id"]]


def test_examples_are_marked_read_only_and_removable(client):
    register(client)
    assert client.post("/api/account/examples").json()["created_plants"] == 3
    assert client.post("/api/account/examples").json()["created_plants"] == 0  # no duplicates
    plants = client.get("/api/plants").json()
    assert len(plants) == 3 and all(p["is_example"] for p in plants)
    entries = client.get("/api/journal").json()["items"]
    assert entries and all(e["is_example"] for e in entries)
    assert client.get("/api/analyses").json()["total"] == 0  # no canned predictions
    ex = plants[0]
    assert upload(client, ex["id"]).status_code == 409
    assert client.patch(f"/api/plants/{ex['id']}", json={"nickname": "x"}).status_code == 409
    assert client.patch(f"/api/journal/{entries[0]['id']}", json={"body": "x"}).status_code == 409
    real = create_plant(client, nickname="Mine")
    assert client.get("/api/plants", params={"examples": False}).json()[0]["id"] == real["id"]
    assert client.delete("/api/account/examples").status_code == 204
    assert [p["id"] for p in client.get("/api/plants").json()] == [real["id"]]


def test_plant_archive_search_and_delete_cleans_files(client):
    register(client)
    p = create_plant(client, nickname="Fern on the stairs", species_key="other")
    upload(client, p["id"])
    assert client.get("/api/plants", params={"q": "stairs"}).json()[0]["id"] == p["id"]
    client.patch(f"/api/plants/{p['id']}", json={"archived": True})
    assert client.get("/api/plants").json() == []
    assert len(client.get("/api/plants", params={"state": "archived"}).json()) == 1
    user_dir = next(media_root().iterdir())
    assert len(list(user_dir.iterdir())) == 2  # full + thumbnail
    assert client.delete(f"/api/plants/{p['id']}").status_code == 204
    assert list(user_dir.iterdir()) == []


def test_export_and_account_deletion(client, make_client):
    register(client)
    plant = create_plant(client)
    photo = upload(client, plant["id"]).json()
    client.post("/api/analyses", json={"photo_id": photo["id"]})
    r = client.get("/api/account/export")
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    data = json.loads(zf.read("data.json"))
    assert data["account"]["email"] == "ada@example.com"
    assert "password_hash" not in json.dumps(data)
    assert f"photos/{photo['id']}.jpg" in zf.namelist()
    assert len(data["analyses"]) == 1

    assert (
        client.request("DELETE", "/api/account", json={"password": "wrong password"}).status_code
        == 403
    )
    assert client.request("DELETE", "/api/account", json={"password": PASSWORD}).status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert not any(media_root().iterdir())
    again = make_client()
    r = again.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert r.status_code == 401


def test_guide_is_searchable_and_sourced(client):
    articles = client.get("/api/guide", params={"q": "blight"}).json()["articles"]
    assert {a["slug"] for a in articles} >= {"early-blight", "late-blight"}
    for a in client.get("/api/guide").json()["articles"]:
        assert a["sources"] and a["reviewed_on"]
        assert all(s["url"].startswith("https://") for s in a["sources"])
    assert client.get("/api/guide/nope").status_code == 404
