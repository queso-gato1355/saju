from fastapi.testclient import TestClient

from app.main import app

c = TestClient(app)
BASE = {"calendar": "solar", "date": "2004-02-21", "time": "10:12", "gender": "M",
        "longitude": 126.98, "reference_date": "2026-11-17"}


def test_health():
    assert c.get("/api/health").json() == {"status": "ok"}


def test_analyze_solar():
    r = c.post("/api/analyze", json=BASE)
    assert r.status_code == 200
    d = r.json()
    assert [p["ganji"] for p in d["pillars"]] == ["辛巳", "庚午", "丙寅", "甲申"]
    assert d["meta"]["correction_minutes"] == -32
    assert d["gyeok"]["name"] == "편재격"
    assert {s["key"] for s in d["scenarios"]} == {"natal", "daewoon", "sewoon"}
    assert len(d["luck"]["pillars"]) == 10


def test_analyze_lunar_same_as_solar():
    r = c.post("/api/analyze", json={**BASE, "calendar": "lunar", "date": "2004-02-02"})
    assert [p["ganji"] for p in r.json()["pillars"]] == ["辛巳", "庚午", "丙寅", "甲申"]


def test_unknown_time():
    d = c.post("/api/analyze", json={**BASE, "time": None}).json()
    assert d["pillars"][0] is None


def test_invalid_lunar_date_is_422():
    r = c.post("/api/analyze", json={**BASE, "calendar": "lunar", "date": "2023-01-30", "is_leap": True})
    assert r.status_code == 422
    assert "음력" in r.json()["detail"]


def test_out_of_range_is_422():
    assert c.post("/api/analyze", json={**BASE, "date": "1850-01-01"}).status_code == 422


def test_extra_field_rejected():
    assert c.post("/api/analyze", json={**BASE, "name": "홍길동"}).status_code == 422


def test_calendar_and_now_and_search():
    cal = c.get("/api/calendar/2026/11").json()
    assert len(cal["days"]) == 30 and cal["year_ganji"] == "丙午"
    assert c.get("/api/now").status_code == 200
    s = c.get("/api/search", params={"q": "甲子日", "around": "2026-11-17"}).json()
    assert all(h["ganji"] == "甲子" for h in s["hits"])
    assert c.get("/api/search", params={"q": "가나다"}).status_code == 422


def test_slot_power_and_meanings():
    d = c.post("/api/analyze", json=BASE).json()
    sp = {s["id"]: s for s in d["slot_power"]}
    assert set(sp) == {"hs", "hb", "ds", "db", "ms", "mb", "ys", "yb"}
    # 寅申충을 맞은 월지·년지는 '매우 약'
    assert sp["mb"]["level"] == "매우 약" and sp["yb"]["level"] == "매우 약"
    assert [t["role"] for t in sp["mb"]["ten_gods"]] == ["여기", "중기", "정기"]
    assert len(d["ten_god_meanings"]) == 10
    m = {x["ten_god"]: x for x in d["ten_god_meanings"]}
    assert m["정재"]["yukchin"].startswith("아내")          # 남명
    f = c.post("/api/analyze", json={**BASE, "gender": "F"}).json()
    assert {x["ten_god"]: x for x in f["ten_god_meanings"]}["정관"]["yukchin"] == "남편"


def test_each_luck_has_its_own_sewoon():
    d = c.post("/api/analyze", json=BASE).json()
    for lp in d["luck"]["pillars"]:
        years = [s["year"] for s in lp["sewoon"]]
        assert years == list(range(lp["start_year"], lp["start_year"] + 10))
    assert any(i["strength"] > 0 for lp in d["luck"]["pillars"] for i in lp["interactions"])
