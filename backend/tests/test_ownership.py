from __future__ import annotations

from datetime import date

from .conftest import create_plant, register, upload


def test_users_cannot_see_or_change_each_others_records(client, make_client):
    register(client, "owner@example.com")
    plant = create_plant(client)
    photo = upload(client, plant["id"]).json()
    analysis = client.post("/api/analyses", json={"photo_id": photo["id"]}).json()
    entry = client.post(
        "/api/journal",
        json={"plant_id": plant["id"], "entry_date": str(date.today()), "body": "private note"},
    ).json()
    reminder = client.post(
        "/api/reminders",
        json={
            "kind": "water",
            "title": "Water",
            "due_on": str(date.today()),
            "plant_id": plant["id"],
        },
    ).json()

    intruder = make_client()
    register(intruder, "intruder@example.com")
    checks = [
        ("get", f"/api/plants/{plant['id']}"),
        ("patch", f"/api/plants/{plant['id']}"),
        ("delete", f"/api/plants/{plant['id']}"),
        ("get", f"/api/photos/{photo['id']}"),
        ("get", f"/api/photos/{photo['id']}/file"),
        ("get", f"/api/photos/{photo['id']}/file?variant=thumb"),
        ("delete", f"/api/photos/{photo['id']}"),
        ("get", f"/api/analyses/{analysis['id']}"),
        ("post", f"/api/analyses/{analysis['id']}/journal"),
        ("get", f"/api/journal/{entry['id']}"),
        ("patch", f"/api/journal/{entry['id']}"),
        ("delete", f"/api/journal/{entry['id']}"),
        ("patch", f"/api/reminders/{reminder['id']}"),
        ("post", f"/api/reminders/{reminder['id']}/complete"),
        ("delete", f"/api/reminders/{reminder['id']}"),
    ]
    for method, path in checks:
        kwargs = {"json": {}} if method in ("patch", "post") else {}
        r = getattr(intruder, method)(path, **kwargs)
        assert r.status_code == 404, (method, path, r.status_code)

    # Listing endpoints never include another user's rows.
    assert intruder.get("/api/plants").json() == []
    assert intruder.get("/api/journal").json()["total"] == 0
    assert intruder.get("/api/analyses").json()["total"] == 0
    assert intruder.get("/api/reminders").json() == []
    # Writing into someone else's plant is refused.
    assert upload(intruder, plant["id"]).status_code == 404
    r = intruder.post(
        "/api/journal", json={"plant_id": plant["id"], "entry_date": str(date.today()), "body": "x"}
    )
    assert r.status_code == 404
    r = intruder.post("/api/analyses", json={"photo_id": photo["id"]})
    assert r.status_code == 404

    # The owner still has everything.
    assert client.get(f"/api/journal/{entry['id']}").json()["body"] == "private note"
    assert client.get(f"/api/photos/{photo['id']}/file").status_code == 200


def test_cover_photo_must_belong_to_same_plant(client):
    register(client)
    a = create_plant(client, nickname="A")
    b = create_plant(client, nickname="B")
    photo_b = upload(client, b["id"]).json()
    r = client.patch(f"/api/plants/{a['id']}", json={"cover_photo_id": photo_b["id"]})
    assert r.status_code == 422
