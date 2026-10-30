#!/usr/bin/env python3
"""Assemble a snapshot of the shared database into data/live.json so a direct visit to the published page
(outside the claude.ai frame, where the database is not available) still shows all live data.
Usage: python3 -I tools/live_export.py data/dbdump data/live.json
Input: <dumpdir>/<collection>/<doc_id>.json as written by the ArtifactData tool's out_dir option."""
import json, os, sys, datetime
dump, out = sys.argv[1], sys.argv[2]
live = {}
for coll in sorted(os.listdir(dump)):
    d = os.path.join(dump, coll)
    if not os.path.isdir(d): continue
    live[coll] = {}
    for f in sorted(os.listdir(d)):
        if not f.endswith('.json'): continue
        doc = json.load(open(os.path.join(d, f)))
        if isinstance(doc, dict) and 'data' in doc and 'id' in doc and isinstance(doc['data'], dict): doc = {**doc['data'], 'id': doc['data'].get('id', doc['id'])}
        live[coll][f[:-5]] = doc
json.dump({"exportedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "collections": live}, open(out, 'w'), separators=(',', ':'))
print({k: len(v) for k, v in live.items()}, os.path.getsize(out), 'bytes')
