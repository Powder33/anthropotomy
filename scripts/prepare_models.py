"""Build the curated atlas from checksum-pinned, openly licensed source meshes.

Standard-library only. Source files are cached outside the checkout. No Blender
or proprietary tools are required. See public/ATTRIBUTION.md for asset licenses.
"""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get('ANTHROPOTOMY_MODEL_CACHE', '/tmp/anthropotomy-sources'))
COMMIT = '7d04bf3c4de2bd9cb234dd51d7e6857c099afafd'
BASE = f'https://raw.githubusercontent.com/JohanBellander/BodyExplorer/{COMMIT}/public/'
HASHES = {
    'anatomy.glb': '6e84529b60b64cc8f8d5cef665fda932e359e828b66d0c2dd44ec1bd9d0bd01f',
    'skeleton.glb': '894ed0e98a266b727a7e290f0d4123bb087c4afe84a48d55af71d1a351ca99a5',
    'mesh_mapping.json': '231a4e8c52cfeab8144e62d6a8ccbfb27ae04361b3a8d0b4f03e50668ce94596',
}


def source(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        path.write_bytes(urllib.request.urlopen(BASE + name, timeout=120).read())
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != HASHES[name]:
        raise ValueError(f'Checksum mismatch: {name}. Remove the cached file and retry.')
    return data


def glb(name):
    raw = source(name)
    magic, version, length = struct.unpack_from('<III', raw)
    assert magic == 0x46546C67 and version == 2 and length == len(raw)
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(raw[20:20 + size])
    binary_size, kind = struct.unpack_from('<II', raw, 20 + size)
    assert kind == 0x004E4942
    return doc, raw[28 + size:28 + size + binary_size]


def attribute(doc, binary, index):
    acc = doc['accessors'][index]
    view = doc['bufferViews'][acc['bufferView']]
    types = {5123: 'H', 5125: 'I', 5126: 'f'}
    components = {'SCALAR': 1, 'VEC3': 3}[acc['type']]
    assert view.get('byteStride', struct.calcsize(types[acc['componentType']]) * components) == struct.calcsize(types[acc['componentType']]) * components
    count = acc['count'] * components
    offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    return struct.unpack_from('<' + types[acc['componentType']] * count, binary, offset)


def pack(doc, binary, mapping, definitions, bone=False):
    output = bytearray()
    parts = []

    def append(fmt, values):
        while len(output) % 4:
            output.append(0)
        offset = len(output)
        output.extend(struct.pack('<' + fmt * len(values), *values))
        return offset

    for node in doc['nodes']:
        if 'mesh' not in node:
            continue
        name = node['name']
        matches = [m for m in definitions if re.search(m['pattern'], name, re.I)] if not bone else []
        assert len(matches) <= 1, f'Ambiguous muscle mapping: {name}'
        if not bone and not matches:
            continue
        assert not any(k in node for k in ['matrix', 'translation', 'rotation', 'scale'])
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            positions = attribute(doc, binary, primitive['attributes']['POSITION'])
            normals = attribute(doc, binary, primitive['attributes']['NORMAL'])
            indices = attribute(doc, binary, primitive['indices'])
            # Native meshes are millimeters, Z up, -Y anterior. Preserve right/left.
            transformed = []
            packed_normals = []
            for i in range(0, len(positions), 3):
                x, y, z = positions[i:i + 3]
                transformed.extend((x / 1000, (z + 80) / 1000, -(y + 100) / 1000))
                nx, ny, nz = normals[i:i + 3]
                packed_normals.extend(round(max(-1, min(1, v)) * 32767) for v in (nx, nz, -ny))
            metadata = mapping.get(name, {})
            parts.append({
                'name': name,
                'muscleId': None if bone else matches[0]['id'],
                'side': 'left' if 'left' in name else 'right' if 'right' in name else 'center',
                'source': metadata.get('source', 'bp3d'),
                'fmaId': metadata.get('fmaId', ''),
                'vertexCount': len(positions) // 3,
                'indexCount': len(indices),
                'positions': append('f', transformed),
                'normals': append('h', packed_normals),
                'indices': append('I', indices),
            })
    return bytes(output), parts


def main():
    definitions = json.loads((ROOT / 'src/muscles.json').read_text())
    mapping = {x['name']: x for x in json.loads(source('mesh_mapping.json'))}
    directory = ROOT / 'public/models'
    directory.mkdir(exist_ok=True, parents=True)
    manifest = {'sourceCommit': COMMIT, 'formatVersion': 1}
    for name, bone in [('muscles', False), ('skeleton', True)]:
        doc, binary = glb('skeleton.glb' if bone else 'anatomy.glb')
        data, parts = pack(doc, binary, mapping, definitions, bone)
        compressed = gzip.compress(data, compresslevel=9, mtime=0)
        # A custom suffix prevents static servers from implicitly decoding gzip;
        # the browser decodes it explicitly, consistently across static hosts.
        filename = f'{name}.mesh'
        (directory / filename).write_bytes(compressed)
        manifest[name] = {'url': filename, 'bytes': len(data), 'compressedBytes': len(compressed),
                          'sha256': hashlib.sha256(compressed).hexdigest(), 'parts': parts}
        print(f'{name}: {len(parts)} meshes, {len(compressed) / 1e6:.2f} MB compressed')
    represented = {p['muscleId'] for p in manifest['muscles']['parts']}
    assert represented == {m['id'] for m in definitions}, 'Every learning entry must have actual geometry'
    (directory / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
