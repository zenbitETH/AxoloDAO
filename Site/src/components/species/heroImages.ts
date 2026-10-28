export const HERO_IMAGE_FILE: Record<string, string> = {
  andersoni: 'andersoni.png',
  dumerilii: 'dumerilii.png',
  mexicanum: 'mexicanum.png',
  velasci: 'velasci.png',
  annulatum: 'gen-annulatum.jpg',
  californiense: 'gen-californiense.jpg',
  gracile: 'gen-gracile.jpg',
  jeffersonianum: 'gen-jeffersonianum.jpg',
  laterale: 'gen-laterale.jpg',
  maculatum: 'gen-maculatum.jpg',
  talpoideum: 'gen-talpoideum.jpg',
  texanum: 'gen-texanum.jpg',
  rosaceum: 'gen-rosaceum.jpg',
  taylori: 'gen-taylori.jpg',
  lermaense: 'gen-lermaense.jpg',
  mavortium: 'gen-mavortium.jpg',
  granulosum: 'gen-granulosum.jpg',
  silvense: 'gen-silvense.jpg',
  rivulare: 'gen-rivulare.jpg',
  amblycephalum: 'gen-amblycephalum.jpg',
  bombypellum: 'gen-bombypellum.jpg',
  ordinarium: 'gen-ordinarium.jpg',
  altamirani: 'gen-altamirani.jpg',
  flavipiperatum: 'gen-flavipiperatum.jpg',
  leorae: 'gen-leorae.jpg',
  tigrinum: 'gen-tigrinum.jpg',
  macrodactylum: 'gen-macrodactylum.jpg',
  opacum: 'gen-opacum.jpg',
  barbouri: 'gen-barbouri.jpg',
  cingulatum: 'gen-cingulatum.jpg',
  bishopi: 'gen-bishopi.jpg',
  mabeei: 'gen-mabeei.jpg',
};

// vertical focus of each generated illustration (object-position y, %), so the animal sits inside the short sheet banner
export const HERO_FOCUS_Y: Record<string, number> = {
  annulatum: 79, californiense: 64, gracile: 92, jeffersonianum: 80, laterale: 83,
  maculatum: 70, talpoideum: 80, texanum: 70, rosaceum: 85, lermaense: 40, taylori: 35, mavortium: 54, granulosum: 45, silvense: 76, rivulare: 65, amblycephalum: 70, bombypellum: 63, ordinarium: 86, altamirani: 83, flavipiperatum: 40, leorae: 58, tigrinum: 30, macrodactylum: 72, opacum: 87, barbouri: 48, mabeei: 83,
  cingulatum: 62,
  bishopi: 52,
};

// horizontal focus (object-position x, %) for very wide images whose head sits near the left edge
export const HERO_FOCUS_X: Record<string, number> = { lermaense: 0, taylori: 0, flavipiperatum: 0, granulosum: 0 };
