#!/usr/bin/env python3
"""Transform the Pipedrive export into SalesDesk data files.
Usage: python3 -I tools/transform.py <export.json> <outdir>
Outputs: history.json (all deals, compact), orgs.json (consolidated organizations), plans.json (goals/company plans/roster), seed/ (DB seed docs).
"""
import json, sys, re, collections, os, unicodedata
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))
deals = d["deals"]
BRAND_KEY = {"R.Brooks":"rbrooks","Cortez":"cortez","Dynamic":"dynamic","Altman Pipeline":"altman","Altman Maintenance":"altman","Weber":"weber","Altstadt":"altstadt","Perfection":"perfection"}
BRANDS = {
 "rbrooks":{"name":"R. Brooks Mechanical","short":"R. Brooks"},
 "cortez":{"name":"Cortez Heating & Air","short":"Cortez"},
 "dynamic":{"name":"Dynamic Air Solutions","short":"Dynamic"},
 "altman":{"name":"Altman Air Conditioning","short":"Altman"},
 "weber":{"name":"Weber","short":"Weber"},
 "altstadt":{"name":"Altstadt Plumbing","short":"Altstadt"},
 "perfection":{"name":"Perfection Heating & Air","short":"Perfection"},
}
STOP = {"inc","llc","co","corp","corporation","company","ltd","the","of","and","&","group","services","service","solutions","properties","property","management","mgmt","partners","holdings","lp","l.p.","l.l.c.","incorporated","international","usa","us"}
def norm(name):
    s = unicodedata.normalize("NFKD", name or "").encode("ascii","ignore").decode()
    s = s.lower().replace("&"," and ")
    s = re.sub(r"[^a-z0-9 ]"," ",s)
    toks = [t for t in s.split() if t not in STOP and t!="and"]
    return " ".join(toks)
def key(name):
    n = norm(name)
    toks = n.split()
    return " ".join(toks[:2]) if len(toks)>=2 else n
# --- organizations: group raw names into clusters by normalized key ---
raw = collections.defaultdict(list)   # raw org name -> deals
for x in deals:
    o = (x.get("or") or "").strip()
    if not o: o = "(no organization)"
    raw[o].append(x)
clusters = collections.defaultdict(list)
for o in raw:
    clusters[key(o) or o.lower()].append(o)
orgs=[]; org_of_raw={}
for k, names in clusters.items():
    names = sorted(names, key=lambda n: -len(raw[n]))
    all_deals = [dd for n in names for dd in raw[n]]
    oid = "org_" + re.sub(r"[^a-z0-9]+","-",k)[:40].strip("-") or "org_blank"
    if oid == "org_": oid = "org_blank"
    base = oid; i=2
    while any(o["id"]==oid for o in orgs): oid=f"{base}-{i}"; i+=1
    brands = sorted({BRAND_KEY.get(dd["b"],dd["b"]) for dd in all_deals})
    won = [dd for dd in all_deals if dd["s"]=="Won"]
    openv = sum(dd["v"] for dd in all_deals if dd["s"]=="Open")
    orgs.append({"id":oid,"name":names[0],"aliases":names[1:],"brands":brands,
        "deals":len(all_deals),"won":len(won),"wonValue":round(sum(dd["v"] for dd in won),2),
        "openValue":round(openv,2),"lastActivity":max((dd.get("ec") or f"{dd.get('cy')}-{str(dd.get('cm') or 1).zfill(2)}-01") for dd in all_deals),
        "pipedriveOrgIds":sorted({dd["oi"] for dd in all_deals if dd.get("oi")}),
        "mergeStatus":"proposed" if len(names)>1 else "single"})
    for n in names: org_of_raw[n]=oid
# --- deals: compact history ---
def stage_from_ratio(x):
    v=x["v"] or 0; w=x["w"] or 0
    if x["s"]!="Open": return None
    r = (w/v) if v else 0
    if r>=0.75: return "verbal"
    if r>=0.5: return "proposal"
    if r>=0.4: return "quoted"
    if r>=0.2: return "qualified"
    return "lead"
hist=[]
for x in deals:
    o=(x.get("or") or "").strip() or "(no organization)"
    hist.append({"id":f"pd_{x['id']}","pd":x["id"],"brand":BRAND_KEY.get(x["b"],x["b"]),"pipeline":x["b"],
        "title":x["tt"],"org":org_of_raw[o],"orgRaw":o,"owner":x["o"],"status":x["s"].lower(),"line":x["t"].lower(),
        "value":x["v"],"weighted":x["w"],"prob":round((x["w"]/x["v"]),2) if x["v"] else None,
        "created":f"{x['cy']}-{str(x['cm']).zfill(2)}" if x.get("cy") else None,
        "won":f"{x['wy']}-{str(x['wm']).zfill(2)}" if x.get("wy") else None,
        "lostYear":x.get("ly"),"close":x.get("ec"),"stage":stage_from_ratio(x)})
flags=[]
for h in hist:
    if h["status"]=="open" and h["value"]>=50_000_000: flags.append({"deal":h["id"],"issue":"value_outlier","note":f"${h['value']:,.0f} open deal; likely data entry error"})
    if h["status"]=="open" and h["close"] and h["close"]<"2026-10-01": flags.append({"deal":h["id"],"issue":"stale_close","note":f"expected close {h['close']} already passed"})
    if h["status"]=="open" and not h["close"]: flags.append({"deal":h["id"],"issue":"no_close_date","note":"no expected close date"})
# --- plans ---
plans={"year":d["currentYear"],"reviewMonth":d["reviewMonth"],"goals":[{"rep":g["r"],"brand":BRAND_KEY.get(g["c"],g["c"]),"line":g["l"].lower(),"month":g["m"],"ordersPlan":g["op"],"quotesPlan":g["qp"],"closeRate":g["cr"],"version":g["v"]} for g in d["goals"]],
 "companyPlans":[{"brand":BRAND_KEY.get(g["c"],g["c"]),"line":g["l"].lower(),"month":g["m"],"ordersPlan":g["op"],"quotesPlan":g["qp"],"closeRate":g["cr"],"version":g["v"]} for g in d["companyPlans"]],
 "roster":[{"rep":r["r"],"brand":BRAND_KEY.get(r["c"],r["c"]),"line":r["l"].lower(),"startMonth":r["startMonth"],"endMonth":r["endMonth"]} for r in d["roster"]]}
# --- reps (users) ---
owners=collections.Counter(); ob=collections.defaultdict(collections.Counter)
for h in hist:
    owners[h["owner"]]+=1; ob[h["owner"]][h["brand"]]+=1
roster_names={r["r"] for r in d["roster"]}
reps=[]
for o,c in owners.most_common():
    openc=sum(1 for h in hist if h["owner"]==o and h["status"]=="open")
    reps.append({"id":"rep_"+re.sub(r"[^a-z0-9]+","-",o.lower()).strip("-"),"name":o,"brand":ob[o].most_common(1)[0][0],"brands":sorted(ob[o]),
        "role":"sales","active":openc>0 or o in roster_names,"openDeals":openc,"totalDeals":c,"email":None,"groups":[]})
os.makedirs(out,exist_ok=True); os.makedirs(f"{out}/seed",exist_ok=True)
json.dump({"generated":d["dealsSyncedAt"],"source":"pipedrive-export-2026-10-30","brands":BRANDS,"deals":hist},open(f"{out}/history.json","w"),separators=(",",":"))
json.dump({"generated":d["dealsSyncedAt"],"orgs":orgs},open(f"{out}/orgs.json","w"),separators=(",",":"))
json.dump(plans,open(f"{out}/plans.json","w"),separators=(",",":"))
json.dump({"flags":flags},open(f"{out}/quality.json","w"),separators=(",",":"))
json.dump(reps,open(f"{out}/seed/reps.json","w"),indent=0)
open_deals=[h for h in hist if h["status"]=="open"]
json.dump(open_deals,open(f"{out}/seed/open_deals.json","w"),indent=0)
multi=[o for o in orgs if o["mergeStatus"]=="proposed"]
print(f"deals {len(hist)} open {len(open_deals)} orgs {len(orgs)} (proposed merges {len(multi)}, raw names {len(raw)}) reps {len(reps)} flags {len(flags)}")
print("sizes:",{f:os.path.getsize(f'{out}/{f}') for f in ['history.json','orgs.json','plans.json','quality.json']})
print("sample merges:")
for o in sorted(multi,key=lambda o:-len(o['aliases']))[:12]: print(" ",o["name"],"<=",o["aliases"][:5])
