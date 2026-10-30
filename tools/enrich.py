#!/usr/bin/env python3
"""Enrich data/history.json and data/orgs.json from the full Pipedrive deals export (CSV, 100+ columns).
Usage: python3 -I tools/enrich.py data/import/deals_all_entities.csv data
Our Oct-30 export wins for status/value/close/owner; the full export supplies stage names, contacts, lost reasons,
lead comments, vertical, parent organization, service address, probability, proposal/start dates, man hours.
"""
import csv, json, sys, re, collections
src, out = sys.argv[1], sys.argv[2]
hist = json.load(open(f"{out}/history.json")); orgs = json.load(open(f"{out}/orgs.json"))
byid = {d["id"]: d for d in hist["deals"]}; orgById = {o["id"]: o for o in orgs["orgs"]}
rows = list(csv.DictReader(open(src, newline='', encoding='utf-8-sig')))
hdr = list(rows[0].keys()) if rows else []
def col(*names):
    low = {h.lower().strip(): h for h in hdr}
    for n in names:
        if n.lower() in low: return low[n.lower()]
    for n in names:
        for h in hdr:
            if n.lower() in h.lower(): return h
    return None
C = {k: col(*v) for k, v in {
 "id":["ID","Deal - ID"], "stage":["Stage","Deal - Stage"], "pipeline":["Pipeline"], "status":["Status"], "contact":["Contact person"], "contactId":["Contact person ID"],
 "lost":["Lost reason"], "comments":["LEAD COMMENTS","Lead comments"], "leadType":["LEAD TYPE"], "vertical":["Vertical Market"], "parent":["Parent Organization"],
 "addr":["Service Address","Deal Address"], "prob":["Probability"], "propDate":["Proposal Date"], "start":["Project Start Date"], "dur":["Project Duration"],
 "manHours":["Estimated Man Hours"], "laborHours":["Forecasted Labor Hours"], "gm":["Gross Margin %","Gross Margin"], "label":["Label"], "origin":["Lead Origin"],
 "lastStage":["Last stage change"], "nextAct":["Next activity date"], "lastAct":["Last activity date"], "todo":["Activities to do"], "done":["Done activities"],
 "estimator":["RBrooks Estimator","Estimator"], "serviceType":["Service Type"], "cls":["Class"], "renewal":["Renewal Date"], "agrStart":["Agreement Start"], "agrTerm":["Agreement Term"],
 "region":["Sales Region"], "jobNo":["Job #"], "st":["Entered into Service Titan"], "org":["Organization"], "title":["Title"], "updated":["Update time"]}.items()}
print("columns resolved:", {k: v for k, v in C.items() if v})
def g(r, k):
    c = C.get(k); v = (r.get(c) or "").strip() if c else ""
    return v
def guess_stage(name):
    n = name.lower()
    if "won" in n: return None
    if "lost" in n: return None
    if re.search(r"verbal|pending|negotiat|award|commit", n): return "verbal"
    if re.search(r"propos|submitted|sent|submit a bid", n): return "proposal"
    if re.search(r"quot|estimat|bid|pricing|survey", n): return "quoted"
    if re.search(r"qualif|site|discover|scope|rfp", n): return "qualified"
    if re.search(r"lead|new|prospect|contact", n): return "lead"
    return None
stage_counter = collections.Counter(); enriched = 0; contacts = {}; parents = collections.Counter(); unmatched = 0
for r in rows:
    pid = g(r, "id")
    if not pid: continue
    d = byid.get(f"pd_{pid}")
    if not d: unmatched += 1; continue
    st = g(r, "stage"); stage_counter[st] += 1
    e = {}
    if st: e["pdStageName"] = st
    if st and st.lower() == "paused": e["paused"] = True
    if d["status"] == "open" and st and guess_stage(st):
        gs = guess_stage(st); ps = d.get("stage")  # ps = stage inferred from the Oct-30 weighted probability
        if ps and ps != gs and d.get("prob") is not None:
            e["stageConflict"] = True; e["stageSource"] = "probability"   # keep probability stage; June name stays as caption
        else:
            e["stage"] = gs; e["stageSource"] = "pipedrive"
    for k, key in [("contact","contact"),("lost","lostReason"),("vertical","vertical"),("addr","address"),("leadType","leadType"),("origin","source"),("estimator","estimator"),("serviceType","serviceType"),("region","region"),("jobNo","jobName"),("label","pdLabel"),("parent","parentOrg")]:
        v = g(r, k)
        if v: e[key] = v
    if g(r, "comments"): e["notes"] = g(r, "comments")
    for k, key in [("propDate","proposalDate"),("start","installStart"),("lastStage","stageChangedAt"),("nextAct","nextDate"),("lastAct","lastActivityAt"),("renewal","renewalDate"),("agrStart","agreementStart")]:
        v = g(r, k)
        if v and re.match(r"\d{4}-\d{2}-\d{2}", v): e[key] = v[:10]
    for k, key in [("manHours","estManHours"),("laborHours","forecastLaborHours"),("gm","pdGm"),("dur","projectDuration"),("agrTerm","agreementTerm")]:
        v = g(r, k).replace("%","").replace(",","")
        try:
            if v: e[key] = float(v)
        except ValueError: pass
    if e.get("pdGm") is not None:
        if e["pdGm"] > 1 and e["pdGm"] <= 100: e["pdGm"] = e["pdGm"] / 100
        if e["pdGm"] > 1 or e["pdGm"] <= 0: e.pop("pdGm")
    if "lastActivityAt" in e: e["lastActivityAt"] = e["lastActivityAt"] + "T12:00:00Z"
    if d["status"] != "open": e.pop("nextDate", None)
    if e:
        d.update(e); enriched += 1
    if g(r, "contact"):
        cid = g(r, "contactId") or re.sub(r"[^a-z0-9]+", "-", g(r, "contact").lower())
        d["contactId"] = f"c_pd{cid}"
        contacts.setdefault(f"c_pd{cid}", {"id": f"c_pd{cid}", "name": g(r, "contact"), "orgId": d["org"], "source": "pipedrive", "pdId": g(r, "contactId") or None})
    par = g(r, "parent")
    if par and d["org"] in orgById:
        on = orgById[d["org"]]["name"].lower()
        if par.lower() not in ("flow service partners", "fsp", on) and par.lower() not in [a.lower() for a in orgById[d["org"]].get("aliases", [])]:
            parents[(d["org"], par)] += 1
        else:
            d.pop("parentOrg", None)
# parent organization hints onto orgs
for (oid, parent), n in parents.items():
    o = orgById[oid]; o.setdefault("parentHint", parent)
def exp_stage(r): return 'verbal' if r>=.75 else 'proposal' if r>=.5 else 'quoted' if r>=.4 else 'qualified' if r>=.2 else 'lead'
for d in hist["deals"]:
    nd = d.get("nextDate")
    if nd and (nd < "2026-06-01" or d["status"] != "open"): d.pop("nextDate")
    if d.get("stageConflict") and d.get("prob") is not None and exp_stage(d["prob"]) != d.get("stage"): d["stage"] = exp_stage(d["prob"])
hist["enrichedFrom"] = "Deals All Entities.csv (Pipedrive, 2026-06-23)"
json.dump(hist, open(f"{out}/history.json", "w"), separators=(",", ":"))
json.dump(orgs, open(f"{out}/orgs.json", "w"), separators=(",", ":"))
json.dump(list(contacts.values()), open(f"{out}/seed/contacts_pd.json", "w"))
print(f"rows {len(rows)} enriched {enriched} unmatched {unmatched} contacts {len(contacts)} parents {len(parents)}")
print("stages:", stage_counter.most_common(30))
