"""Start each exported clip at zero without resampling its native motion keys.

Blender's direct-curve exporter retains frame 1 / FPS despite slide-to-zero.
The viewer uses a 0..100% interval. Shift only the animation time accessors;
leave geometry and TRS values byte-for-byte unchanged.
"""
import json,struct

def normalize_motion_time(path):
    with path.open('r+b') as file:
        magic,version,size=struct.unpack('<III',file.read(12))
        assert magic==0x46546c67 and version==2 and size==path.stat().st_size
        json_size,json_type=struct.unpack('<II',file.read(8));assert json_type==0x4e4f534a
        document=json.loads(file.read(json_size))
        binary_size,binary_type=struct.unpack('<II',file.read(8));assert binary_type==0x004e4942
        binary_start=file.tell();assert binary_start+binary_size==size
        inputs={sampler['input'] for animation in document.get('animations',[]) for sampler in animation['samplers']}
        replacements={}
        for index in inputs:
            accessor=document['accessors'][index]
            assert accessor['componentType']==5126 and accessor['type']=='SCALAR' and 'sparse' not in accessor
            view=document['bufferViews'][accessor['bufferView']];assert view.get('buffer',0)==0
            stride=view.get('byteStride',4)
            key=(view.get('byteOffset',0)+accessor.get('byteOffset',0),accessor['count'],stride)
            if key not in replacements:
                start,count,stride=key;values=[]
                for i in range(count):
                    file.seek(binary_start+start+i*stride);values.append(struct.unpack('<f',file.read(4))[0])
                assert values and all(b>=a for a,b in zip(values,values[1:]))
                first=values[0]
                replacements[key]=[struct.pack('<f',value-first) for value in values]
            accessor['min']=[0.0];accessor['max']=[struct.unpack('<f',replacements[key][-1])[0]]
        encoded=json.dumps(document,separators=(',',':'),ensure_ascii=False).encode('utf8')
        assert len(encoded)<=json_size, 'Preserve the existing GLB chunk offsets'
        # All validation completes before the candidate file is changed.
        for (start,count,stride),values in replacements.items():
            for i,value in enumerate(values):file.seek(binary_start+start+i*stride);file.write(value)
        file.seek(20);file.write(encoded+b' '*(json_size-len(encoded)))
    return len(inputs)
