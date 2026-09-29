export type ReferenceModelHotspot = {
  id: string;
  label: string;
  description: string;
  position: [number, number, number];
};

export type ReferenceModelDefinition = {
  id: string;
  label: string;
  assetUrl: string;
  sourceUrl: string;
  sourceLabel: string;
  license: string;
  lessonHotspotIds: string[];
  hotspots: ReferenceModelHotspot[];
};

export const referenceModels: Record<string, ReferenceModelDefinition> = {
  'wright-1903-engine': {
    id: 'wright-1903-engine',
    label: '1903 Wright Flyer engine',
    assetUrl: './wright-1903-engine.glb?v=20260929-smithsonian-medium',
    sourceUrl: 'https://airandspace.si.edu/collection-objects/1903-wright-flyer/nasm_A19610048000',
    sourceLabel: 'Smithsonian National Air and Space Museum',
    license: 'CC0',
    lessonHotspotIds: ['magneto', 'valve', 'crankcase'],
    hotspots: [
      {
        id: 'magneto',
        label: 'Magneto',
        description: 'The ignition magneto supplied high-voltage current without relying on a battery in flight.',
        position: [-27.4804567, -31.0524163, -71.9050751],
      },
      {
        id: 'valve',
        label: 'Valve',
        description: 'One of the exposed valve mechanisms serving the engine’s four inline cylinders.',
        position: [-3.4664779, -4.7900186, -40.4502107],
      },
      {
        id: 'crankcase',
        label: 'Cast-aluminium crankcase',
        description: 'The unusually light cast-aluminium crankcase was central to meeting the Flyer’s weight target.',
        position: [-53.5493818, -10.0742283, -16.1144613],
      },
      {
        id: 'engine',
        label: 'Four-cylinder engine',
        description: 'The complete inline four-cylinder engine produced the power used on the first Wright Flyer.',
        position: [-40.3678868, -8.6396178, -12.6260955],
      },
      {
        id: 'revolution-counter',
        label: 'Revolution counter',
        description: 'The revolution counter provided an engine-speed reference during operation and testing.',
        position: [-46.1110966, -17.7575759, 10.1611368],
      },
      {
        id: 'bearings',
        label: 'Bearings',
        description: 'The bearing locations supported the rotating shaft within the early lightweight engine structure.',
        position: [-11.2661911, -24.9888547, -20.8326146],
      },
    ],
  },
};

