/**
 * Lahore operational master data.
 *
 * Coordinates are WGS84 and sourced primarily from the Punjab hospital
 * registry / official institution listings. Sector and emergency-category
 * relations are deliberately left empty for administrators to assign later.
 */
export interface LahoreHospitalSeed {
  name: string;
  aliases?: string[];
  address: string;
  latitude: number;
  longitude: number;
}

export const LAHORE_HOSPITALS: LahoreHospitalSeed[] = [
  {
    name: 'Mayo Hospital',
    address: 'Anarkali Bazaar, Hospital Road, Lahore',
    latitude: 31.569667,
    longitude: 74.317306,
  },
  {
    name: 'Jinnah Hospital',
    address: 'Usmani Road, Faisal Town, Lahore',
    latitude: 31.4846,
    longitude: 74.2975,
  },
  {
    name: 'Services Hospital',
    address: 'Jail Road, Shadman, Lahore',
    latitude: 31.541275,
    longitude: 74.333054,
  },
  {
    name: 'Sir Ganga Ram Hospital',
    address: "Queen's Road, Lahore",
    latitude: 31.554419,
    longitude: 74.320673,
  },
  {
    name: 'Lahore General Hospital',
    aliases: ['General Hospital'],
    address: 'Ferozepur Road, near Chungi Amar Sidhu, Lahore',
    latitude: 31.456982,
    longitude: 74.350695,
  },
  {
    name: 'Shalamar Hospital',
    address: 'Shalimar Link Road, Lahore',
    latitude: 31.575111,
    longitude: 74.380694,
  },
  {
    name: 'Shaikh Zayed Hospital',
    aliases: ['Sheikh Zayed Hospital'],
    address: 'Khayaban-e-Jamia Punjab, Block D Muslim Town, Lahore',
    latitude: 31.51,
    longitude: 74.308556,
  },
  {
    name: 'Punjab Institute of Cardiology (PIC)',
    aliases: ['Punjab Institute of Cardiology'],
    address: 'Jail Road, Shadman, Lahore',
    latitude: 31.538685,
    longitude: 74.335889,
  },
  {
    name: "The Children's Hospital",
    aliases: ["Children's Hospital & Institute of Child Health"],
    address: 'Ferozepur Road, Nishtar Town, Lahore',
    latitude: 31.479722,
    longitude: 74.342472,
  },
  {
    name: 'Punjab Institute of Neurosciences (PINS)',
    aliases: ['Punjab Institute of Neuro Sciences'],
    address: 'Lahore General Hospital, Ferozepur Road, Lahore',
    latitude: 31.461417,
    longitude: 74.348611,
  },
  {
    name: 'Pakistan Kidney and Liver Institute (PKLI)',
    aliases: ['Pakistan Kidney And Liver Institute'],
    address: '1 PKLI Avenue, DHA Phase 6, Lahore',
    latitude: 31.452778,
    longitude: 74.463889,
  },
  {
    name: 'Punjab Institute of Mental Health (PIMH)',
    aliases: ['Punjab Institute of Mental Health'],
    address: 'Jail Road, Shadman-II, Lahore',
    latitude: 31.533056,
    longitude: 74.334167,
  },
  {
    name: 'Institute of Nuclear Medicine & Oncology (INMOL)',
    aliases: ['INMOL Hospital', 'Inmol Hospital'],
    address: 'Near Shaikh Zayed Hospital, Wahdat Road, Lahore',
    latitude: 31.509333,
    longitude: 74.305806,
  },
  {
    name: 'Lady Willingdon Hospital',
    address: 'Ravi Road, Greater Iqbal Park, Lahore',
    latitude: 31.587472,
    longitude: 74.306889,
  },
  {
    name: 'Lady Aitchison Hospital',
    address: 'Mayo Hospital Road, Anarkali, Lahore',
    latitude: 31.5735,
    longitude: 74.315639,
  },
  {
    name: 'Government Mian Munshi Hospital',
    aliases: ['Govt. Mian Munshi DHQ Teaching Hospital'],
    address: 'Near Taj Company, Data Gunj Buksh Town, Lahore',
    latitude: 31.576028,
    longitude: 74.287389,
  },
  {
    name: 'Government Mian Muhammad Nawaz Sharif Hospital',
    aliases: ['Govt. Muhammad Nawaz Sharif Teaching Hospital'],
    address: 'Near Yakki Gate, Walled City, Lahore',
    latitude: 31.584861,
    longitude: 74.32725,
  },
  {
    name: 'Government Kot Khwaja Saeed Hospital',
    aliases: ['Govt. Kot Khawaja Saeed Teaching Hospital'],
    address: 'Kot Khawaja Saeed, Lahore',
    latitude: 31.594,
    longitude: 74.354167,
  },
  {
    name: 'Government Mozang Hospital',
    aliases: ['Govt. Mozang Hospital'],
    address: 'Temple Road, Mozang Chungi, Lahore',
    latitude: 31.5545,
    longitude: 74.315778,
  },
  {
    name: 'Government Teaching Hospital Shahdara',
    aliases: ['Government Shahdara Teaching Hospital'],
    address: 'GT Road, Shahdara Town, Lahore',
    latitude: 31.638139,
    longitude: 74.28575,
  },
  {
    name: 'Government Samanabad Hospital',
    aliases: ['Government Samnabad Hospital'],
    address: '153 Main Boulevard, Samanabad, Lahore',
    latitude: 31.540978,
    longitude: 74.302529,
  },
  {
    name: 'Police Hospital Lahore',
    aliases: ['Police Hospital'],
    address: 'Police Lines, Qila Gujjar Singh, Lahore',
    latitude: 31.568,
    longitude: 74.331,
  },
];

export const LAHORE_FLEET_RANGES = [
  { prefix: 'LhrR#', count: 60, providerCode: '1122', providerNameToken: 'rescue' },
  { prefix: 'LhrE#', count: 20, providerCode: 'EDHI', providerNameToken: 'edhi' },
  { prefix: 'LhrC#', count: 20, providerCode: 'CHIPPA', providerNameToken: 'chhip' },
] as const;
