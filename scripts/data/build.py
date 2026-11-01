"""Deterministic source-preserving GIS build. Requires tippecanoe 2.79.0."""
from pathlib import Path
import json, hashlib, os, subprocess, tempfile, xml.etree.ElementTree as ET
import geopandas as gpd
from shapely import union_all, to_geojson
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'peta_sls_202515202.geojson'
OUT=ROOT/'public/data'; OUT.mkdir(parents=True,exist_ok=True)
def write(path, obj):
    path.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'),sort_keys=True))
version=hashlib.sha256(SOURCE.read_bytes()+Path(__file__).read_bytes()).hexdigest()[:12]
build=OUT/version; build.mkdir(exist_ok=True)
x=gpd.read_file(SOURCE)
assert len(x)==4630 and x.crs.to_epsg()==4326
assert x.geometry.is_valid.all() and not x.geometry.is_empty.any()
assert x.idsubsls.is_unique
assert ET.parse(ROOT/'peta_sls_20260202.qmd').findtext('./crs/spatialrefsys/authid')=='EPSG:4326'
nodes={}; geoms={}; rows={}
for _,row in x.iterrows():
    p=row.to_dict(); geom=p.pop('geometry'); fid=p['idsubsls']
    chain=[('kabupaten','5202',p['nmkab']),('kecamatan','52'+p['kdkab']+p['kdkec'],p['nmkec']),('desa',p['iddesa'],p['nmdesa']),('sls',p['idsls'],p['nmsls'])]
    if p['kdsubsls']!='00': chain.append(('subsls',fid,'Sub-SLS '+p['kdsubsls']))
    parent=None
    for level,code,name in chain:
        id=level+':'+code
        if id not in nodes:
            nodes[id]=dict(id=id,sourceCode=code,level=level,name=name.title() if level!='subsls' else name,parentId=parent,childIds=[],sourceFeatureIds=[],qualityFlags=[],aliases=[])
            rows[id]=[]
        n=nodes[id]
        assert n['parentId']==parent, f'Conflicting parent: {id}'
        if name not in n['aliases']: n['aliases'].append(name)
        n['sourceFeatureIds'].append(fid); rows[id].append(geom)
        if parent and id not in nodes[parent]['childIds']: nodes[parent]['childIds'].append(id)
        parent=id
report=[]
for id,n in nodes.items():
    if n['level']=='desa' and len(n['sourceCode'])!=10:
        assert n['sourceCode']=='52020300016', f'Unknown anomalous desa {id}'
        n['qualityFlags'].append('nonstandard-source-code')
    if len(n['aliases'])>1:
        assert id=='sls:52020300141001', f'Unknown name conflict {id}'
        n['qualityFlags'].append('ambiguous-source-id'); n['name']='SLS '+n['sourceCode']+' — nama ambigu'
    if n['qualityFlags']: report.append(dict(id=id,flags=n['qualityFlags'],names=sorted(n['aliases'])))
    n['sourceFeatureIds']=sorted(n['sourceFeatureIds']); n['aliases']=sorted(n['aliases'])
    n['childIds']=sorted(n['childIds'],key=lambda k:(nodes[k]['name'],k))
    geom=union_all(rows[id]); assert geom.is_valid
    geoms[id]=geom; n['bbox']=list(geom.bounds)
    ancestor=n
    while ancestor['parentId'] and ancestor['level']!='kecamatan': ancestor=nodes[ancestor['parentId']]
    shard=ancestor['id'].replace(':','-') if ancestor['level']=='kecamatan' else 'overview'
    n['geometryRef']=f'/data/{version}/detail-{shard}.json'
    parent=nodes.get(n['parentId']); n['path']=n['name'] if not parent else ''
for n in nodes.values():
    a=n; names=[]; ancestors=[]
    while a:
        names.append(a['name']); ancestors.append(a['id']); a=nodes.get(a['parentId'])
    n['path']=' → '.join(reversed(names)); n['ancestors']=list(reversed(ancestors))
    if n['childIds']:
        assert set(n['sourceFeatureIds'])==set(f for c in n['childIds'] for f in nodes[c]['sourceFeatureIds'])
        assert geoms[n['id']].symmetric_difference(union_all([geoms[c] for c in n['childIds']])).area<1e-12
# No independent geometry simplification. Shared-node-aware tile simplification by tippecanoe.
shards={}
for id,n in sorted(nodes.items()):
    shards.setdefault(n['geometryRef'].split('/')[-1],[]).append(dict(type='Feature',properties={'id':id,'name':n['name'],'level':n['level'],'parent':n['parentId'] or ''},geometry=json.loads(to_geojson(geoms[id]))))
for name,features in shards.items(): write(build/name,dict(type='FeatureCollection',features=features))
write(build/'regions.json',nodes)
tool=os.environ.get('TIPPECANOE','tippecanoe')
assert '2.79.0' in subprocess.check_output([tool,'--version'],stderr=subprocess.STDOUT,text=True)
with tempfile.TemporaryDirectory() as tmp:
    lines=Path(tmp)/'tiles.jsonl'
    with lines.open('w') as f:
        for id,n in sorted(nodes.items()):
            feature=dict(type='Feature',properties={'id':id,'name':n['name'],'parent':n['parentId'] or ''},geometry=json.loads(to_geojson(geoms[id])),tippecanoe={'layer':n['level']})
            f.write(json.dumps(feature,separators=(',',':'))+'\n')
    result=subprocess.run([tool,'-f','-o',str(build/'boundaries.pmtiles'),'-Z','8','-z','14','--no-feature-limit','--no-tile-size-limit','--detect-shared-borders',str(lines)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-8000:])
write(build/'quality.json',{'sourceFeatureCount':len(x),'issues':report,'note':'Batas hasil agregasi data SLS; bukan penetapan batas resmi.'})
write(OUT/'manifest.json',{'schemaVersion':1,'version':version,'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'regions':f'/data/{version}/regions.json','tiles':f'/data/{version}/boundaries.pmtiles','quality':f'/data/{version}/quality.json'})
(ROOT/'data/reports').mkdir(parents=True,exist_ok=True)
write(ROOT/'data/reports/quality.json',{'sourceFeatureCount':len(x),'issues':report})
print(f'Built {len(nodes)} nodes, {len(shards)} export shards, version {version}')
